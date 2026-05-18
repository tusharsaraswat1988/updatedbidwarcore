/**
 * Communication routes — admin-only.
 * - POST /auth/admin/communicate/send      — blast messages (master admin)
 * - GET  /auth/admin/communicate/logs      — message history
 * - GET  /auth/admin/communicate/logs/:id  — single log entry
 * - GET  /auth/admin/communicate/blasts    — automated blast history
 * - POST /consent/generate                 — create consent token + send SMS (admin/organizer only)
 * - POST /consent/:token/confirm           — web fallback consent confirm
 * - GET  /consent/:token                   — resolve token metadata (landing page)
 * - POST /auth/admin/communicate/consent-declare — organizer declaration (scoped to their tournaments)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  playersTable,
  teamsTable,
  organizersTable,
  consentTokensTable,
  commLogsTable,
  consentBlastLogTable,
  waConsentEventsTable,
  waTemplatesTable,
} from "@workspace/db";
import { eq, and, desc, gte, lte, sql, or } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendSms, sendWhatsApp, buildWaMeLink, buildConsentSms } from "../lib/comm-sender";
import { logger } from "../lib/logger";

const router = Router();

function isMasterAdmin(req: import("express").Request): boolean {
  return !!req.session.isAdmin && req.session.adminLevel === "master";
}

function isAdminOrOrganizer(req: import("express").Request): boolean {
  return !!(req.session.isAdmin || req.session.organizerAccountId);
}

function newToken(): string {
  return randomBytes(16).toString("hex");
}

function generateBlastId(): string {
  return `blast_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

// ─── Bot Link (public — must be BEFORE /:token param route) ─────────────────

router.get("/consent/wa-link", (_req, res) => {
  const waNumber = (process.env.TWILIO_WHATSAPP_FROM ?? "").replace("whatsapp:", "").replace("+", "");
  const link = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent("hello")}` : null;
  res.json({ link, configured: !!waNumber });
});

// ─── Consent Token: Generate + Send SMS (requires admin or organizer auth) ───

router.post("/consent/generate", async (req, res) => {
  if (!isAdminOrOrganizer(req)) {
    res.status(403).json({ error: "Admin or organizer login required" });
    return;
  }

  const schema = z.object({
    recipientType: z.enum(["player", "team_owner", "organizer"]),
    recipientId: z.number().int(),
    mobile: z.string().min(7),
    tournamentId: z.number().int(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { recipientType, recipientId, mobile, tournamentId } = parsed.data;

  // Organizer callers may only generate tokens for their own tournament
  if (!req.session.isAdmin && req.session.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t || t.organizerId !== req.session.organizerAccountId) {
      res.status(403).json({ error: "Not authorized for this tournament" });
      return;
    }
  }

  const [tournament] = await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  // Recipient integrity: verify the recipient exists in this tournament and
  // the supplied mobile matches what is stored in the DB for that entity.
  // This prevents an organizer from minting tokens for unrelated recipient IDs.
  let dbMobile: string | null = null;
  if (recipientType === "player") {
    const [p] = await db.select({ tournamentId: playersTable.tournamentId, mobileNumber: playersTable.mobileNumber })
      .from(playersTable).where(eq(playersTable.id, recipientId));
    if (!p || p.tournamentId !== tournamentId) {
      res.status(403).json({ error: "Player does not belong to this tournament" }); return;
    }
    dbMobile = p.mobileNumber || null;
  } else if (recipientType === "team_owner") {
    const [tm] = await db.select({ tournamentId: teamsTable.tournamentId, ownerMobile: teamsTable.ownerMobile })
      .from(teamsTable).where(eq(teamsTable.id, recipientId));
    if (!tm || tm.tournamentId !== tournamentId) {
      res.status(403).json({ error: "Team does not belong to this tournament" }); return;
    }
    dbMobile = tm.ownerMobile || null;
  } else if (recipientType === "organizer") {
    // Bind organizer recipientId to the tournament's actual organizerId
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t?.organizerId) { res.status(400).json({ error: "Tournament has no linked organizer" }); return; }
    if (t.organizerId !== recipientId) {
      res.status(400).json({ error: "recipientId must match the tournament's organizerId for organizer tokens" }); return;
    }
    const [o] = await db.select({ id: organizersTable.id, mobile: organizersTable.mobile })
      .from(organizersTable).where(eq(organizersTable.id, recipientId));
    if (!o) { res.status(404).json({ error: "Organizer not found" }); return; }
    dbMobile = o.mobile || null;
  }
  // Ensure the supplied mobile matches the stored record (strip leading +/spaces for comparison)
  const normalize = (m: string) => m.replace(/\D/g, "");
  if (dbMobile && normalize(dbMobile) !== normalize(mobile)) {
    res.status(400).json({ error: "Supplied mobile number does not match the record on file for this recipient" });
    return;
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
  await db.insert(consentTokensTable).values({ token, recipientType, recipientId, mobile, tournamentId, expiresAt });

  const waLink = buildWaMeLink(token);
  const smsBody = buildConsentSms(tournament.name, waLink);
  const result = await sendSms(mobile, smsBody);

  res.json({ success: true, token, waLink, sent: result });
});

// ─── Consent Token: Resolve (landing page) ────────────────────────────────────

router.get("/consent/:token", async (req, res) => {
  const [ct] = await db.select().from(consentTokensTable).where(eq(consentTokensTable.token, req.params.token));
  if (!ct) { res.status(404).json({ error: "Token not found or expired" }); return; }
  const [tournament] = await db.select({ id: tournamentsTable.id, name: tournamentsTable.name, logoUrl: tournamentsTable.logoUrl }).from(tournamentsTable).where(eq(tournamentsTable.id, ct.tournamentId));
  const waLink = buildWaMeLink(ct.token);
  res.json({ token: ct.token, mobile: ct.mobile.replace(/\d(?=\d{4})/g, "*"), recipientType: ct.recipientType, tournamentName: tournament?.name ?? "", tournamentLogoUrl: tournament?.logoUrl ?? null, waLink, used: ct.used, expired: new Date() > ct.expiresAt });
});

// ─── Consent Token: Web Fallback Confirm ─────────────────────────────────────

router.post("/consent/:token/confirm", async (req, res) => {
  const [ct] = await db.select().from(consentTokensTable).where(eq(consentTokensTable.token, req.params.token));
  if (!ct) { res.status(404).json({ error: "Token not found" }); return; }
  if (ct.used) { res.json({ success: true, alreadyConfirmed: true }); return; }
  if (new Date() > ct.expiresAt) { res.status(410).json({ error: "Token expired" }); return; }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;
  const consentData = {
    whatsappConsent: true,
    whatsappConsentAt: new Date(),
    whatsappConsentMethod: "web_fallback" as const,
    whatsappConsentIp: ip,
  };

  if (ct.recipientType === "player") {
    await db.update(playersTable).set(consentData).where(eq(playersTable.id, ct.recipientId));
  } else if (ct.recipientType === "team_owner") {
    await db.update(teamsTable).set(consentData).where(eq(teamsTable.id, ct.recipientId));
  } else if (ct.recipientType === "organizer") {
    await db.update(organizersTable).set(consentData).where(eq(organizersTable.id, ct.recipientId));
  }

  await db.update(consentTokensTable).set({ used: true }).where(eq(consentTokensTable.token, ct.token));

  await db.insert(commLogsTable).values({
    tournamentId: ct.tournamentId,
    recipientType: ct.recipientType,
    recipientId: ct.recipientId,
    recipientMobile: ct.mobile,
    channel: "web",
    messageContent: "Web fallback consent confirmed",
    deliveryStatus: "delivered",
  });

  res.json({ success: true });
});

// ─── Organizer Declaration (scoped to caller's own tournaments) ───────────────

router.post("/auth/admin/communicate/consent-declare", async (req, res) => {
  if (!req.session.isAdmin && !req.session.organizerAccountId) {
    res.status(403).json({ error: "Not authorized" }); return;
  }
  const schema = z.object({
    recipientType: z.enum(["player", "team_owner"]),
    recipientId: z.number().int(),
    tournamentId: z.number().int(),
    orgId: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { recipientType, recipientId, tournamentId } = parsed.data;
  // Force orgId from session for organizer callers — never trust caller-supplied orgId
  const orgId = req.session.isAdmin
    ? (parsed.data.orgId ?? req.session.organizerAccountId ?? null)
    : (req.session.organizerAccountId ?? null);

  // Scoping: non-admin organizers may only declare consent for recipients in their own tournaments
  if (!req.session.isAdmin && req.session.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t || t.organizerId !== req.session.organizerAccountId) {
      res.status(403).json({ error: "Not authorized for this tournament" }); return;
    }

    // Also verify the recipient belongs to this tournament
    if (recipientType === "player") {
      const [p] = await db.select({ tournamentId: playersTable.tournamentId })
        .from(playersTable).where(eq(playersTable.id, recipientId));
      if (!p || p.tournamentId !== tournamentId) {
        res.status(403).json({ error: "Recipient does not belong to this tournament" }); return;
      }
    } else {
      const [tm] = await db.select({ tournamentId: teamsTable.tournamentId })
        .from(teamsTable).where(eq(teamsTable.id, recipientId));
      if (!tm || tm.tournamentId !== tournamentId) {
        res.status(403).json({ error: "Recipient does not belong to this tournament" }); return;
      }
    }
  }

  const consentData = {
    whatsappConsent: true,
    whatsappConsentAt: new Date(),
    whatsappConsentMethod: "organizer_declaration" as const,
    whatsappConsentOrgId: orgId,
  };

  if (recipientType === "player") {
    await db.update(playersTable).set(consentData).where(eq(playersTable.id, recipientId));
  } else {
    await db.update(teamsTable).set(consentData).where(eq(teamsTable.id, recipientId));
  }

  res.json({ success: true });
});

// ─── Send Message ─────────────────────────────────────────────────────────────

router.post("/auth/admin/communicate/send", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }

  const schema = z.object({
    tournamentId: z.number().int().optional(),
    recipientGroup: z.enum(["all_players", "sold_players", "unsold_players", "all_owners", "organizer", "manual"]),
    specificTeamId: z.number().int().optional(),
    channel: z.enum(["whatsapp", "sms", "both"]),
    templateName: z.string().optional(),
    messageContent: z.string().min(1).max(4096),
    manualMobiles: z.array(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const d = parsed.data;

  // WhatsApp template resolution.
  // In prototype / stub mode (no Twilio creds): sends stub anyway — no template enforcement.
  // In production (Twilio creds present + DB templates exist): templateName must match approved template.
  let resolvedTemplateSid: string | undefined;
  if ((d.channel === "whatsapp" || d.channel === "both") && d.templateName) {
    const dbTemplates = await db.select({ templateName: waTemplatesTable.templateName, templateSid: waTemplatesTable.templateSid, status: waTemplatesTable.status })
      .from(waTemplatesTable);
    const isLiveMode = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    if (isLiveMode && dbTemplates.length > 0) {
      const tmpl = dbTemplates.find(t => t.templateName === d.templateName && t.status === "approved");
      if (!tmpl) {
        const approved = dbTemplates.filter(t => t.status === "approved").map(t => t.templateName);
        res.status(400).json({ error: `Template "${d.templateName}" is not approved. Approved: ${approved.join(", ")}` });
        return;
      }
      resolvedTemplateSid = tmpl.templateSid ?? undefined;
    } else if (isLiveMode) {
      const envTemplates = (process.env.TWILIO_WA_TEMPLATES ?? "").split(",").map(s => s.trim()).filter(Boolean);
      if (envTemplates.length > 0 && !envTemplates.includes(d.templateName)) {
        res.status(400).json({ error: `Template "${d.templateName}" is not in the approved list.` });
        return;
      }
    }
  }

  // License gate for WhatsApp — "live" is the licensed status in this system.
  // All WhatsApp sends (including manual) require a tournamentId so the
  // license can be verified; no anonymous/licence-free WA blasts allowed.
  if (d.channel === "whatsapp" || d.channel === "both") {
    if (!d.tournamentId) {
      res.status(400).json({ error: "tournamentId is required for WhatsApp sends to enforce license gating" });
      return;
    }
    const [t] = await db.select({ licenseStatus: tournamentsTable.licenseStatus, adminLocked: tournamentsTable.adminLocked }).from(tournamentsTable).where(eq(tournamentsTable.id, d.tournamentId));
    if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }
    if (t.licenseStatus !== "live" || t.adminLocked) {
      res.status(403).json({ error: "WhatsApp messaging requires a live license and unlocked tournament" }); return;
    }
  }

  // Build recipient list
  type Recipient = { mobile: string; recipientType: string; recipientId: number | null; whatsappConsent: boolean };
  const recipients: Recipient[] = [];

  if (d.recipientGroup === "manual" && d.manualMobiles) {
    for (const m of d.manualMobiles) {
      recipients.push({ mobile: m, recipientType: "manual", recipientId: null, whatsappConsent: false });
    }
  } else if (d.tournamentId) {
    const tid = d.tournamentId;
    if (d.recipientGroup === "all_players" || d.recipientGroup === "sold_players" || d.recipientGroup === "unsold_players") {
      const conds = [eq(playersTable.tournamentId, tid), sql`${playersTable.mobileNumber} IS NOT NULL AND ${playersTable.mobileNumber} != ''`];
      if (d.recipientGroup === "sold_players") conds.push(eq(playersTable.status, "sold"));
      if (d.recipientGroup === "unsold_players") conds.push(eq(playersTable.status, "unsold"));
      const players = await db.select({ id: playersTable.id, mobileNumber: playersTable.mobileNumber, whatsappConsent: playersTable.whatsappConsent }).from(playersTable).where(and(...conds));
      for (const p of players) {
        if (p.mobileNumber) recipients.push({ mobile: p.mobileNumber, recipientType: "player", recipientId: p.id, whatsappConsent: p.whatsappConsent });
      }
    } else if (d.recipientGroup === "all_owners") {
      const teamConds = [eq(teamsTable.tournamentId, tid), sql`${teamsTable.ownerMobile} IS NOT NULL AND ${teamsTable.ownerMobile} != ''`];
      if (d.specificTeamId) teamConds.push(eq(teamsTable.id, d.specificTeamId));
      const teams = await db.select({ id: teamsTable.id, ownerMobile: teamsTable.ownerMobile, whatsappConsent: teamsTable.whatsappConsent }).from(teamsTable).where(and(...teamConds));
      for (const t of teams) {
        if (t.ownerMobile) recipients.push({ mobile: t.ownerMobile, recipientType: "team_owner", recipientId: t.id, whatsappConsent: t.whatsappConsent });
      }
    } else if (d.recipientGroup === "organizer") {
      const [t] = await db.select({ organizerMobile: tournamentsTable.organizerMobile, organizerId: tournamentsTable.organizerId }).from(tournamentsTable).where(eq(tournamentsTable.id, tid));
      if (t?.organizerMobile) {
        // Look up organizer's actual WhatsApp consent
        let orgConsent = false;
        if (t.organizerId) {
          const [org] = await db.select({ whatsappConsent: organizersTable.whatsappConsent })
            .from(organizersTable).where(eq(organizersTable.id, t.organizerId));
          orgConsent = org?.whatsappConsent ?? false;
        }
        recipients.push({ mobile: t.organizerMobile, recipientType: "organizer", recipientId: t.organizerId, whatsappConsent: orgConsent });
      }
    }
  }

  if (recipients.length === 0) { res.status(400).json({ error: "No recipients found" }); return; }

  const blastId = generateBlastId();
  const results: Array<{ mobile: string; channel: string; success: boolean; stub?: boolean; error?: string }> = [];

  for (const r of recipients) {
    // Consent-based channel routing: no WA consent → route to SMS automatically
    const effectiveChannel = (d.channel === "whatsapp" || d.channel === "both") && !r.whatsappConsent ? "sms" : d.channel;

    if (effectiveChannel === "whatsapp" || effectiveChannel === "both") {
      const waResult = await sendWhatsApp(r.mobile, d.messageContent, resolvedTemplateSid);
      await db.insert(commLogsTable).values({
        tournamentId: d.tournamentId ?? null,
        recipientType: r.recipientType,
        recipientId: r.recipientId,
        recipientMobile: r.mobile,
        channel: "whatsapp",
        templateName: d.templateName ?? null,
        messageContent: d.messageContent,
        sentByAdminId: "master_admin",
        blastId,
        deliveryStatus: waResult.success ? "sent" : "failed",
        metaMessageId: waResult.messageSid ?? null,
        errorMessage: waResult.error ?? null,
      });
      results.push({ mobile: r.mobile, channel: "whatsapp", success: waResult.success, stub: waResult.stub, error: waResult.error });
    }
    if (effectiveChannel === "sms" || effectiveChannel === "both") {
      const smsResult = await sendSms(r.mobile, d.messageContent);
      await db.insert(commLogsTable).values({
        tournamentId: d.tournamentId ?? null,
        recipientType: r.recipientType,
        recipientId: r.recipientId,
        recipientMobile: r.mobile,
        channel: "sms",
        templateName: d.templateName ?? null,
        messageContent: d.messageContent,
        sentByAdminId: "master_admin",
        blastId,
        deliveryStatus: smsResult.success ? "sent" : "failed",
        metaMessageId: smsResult.messageSid ?? null,
        errorMessage: smsResult.error ?? null,
      });
      results.push({ mobile: r.mobile, channel: "sms", success: smsResult.success, stub: smsResult.stub, error: smsResult.error });
    }
  }

  res.json({ success: true, blastId, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, stub: results.some(r => r.stub), results });
});

// ─── WhatsApp Template Config (admin-managed) ─────────────────────────────────

router.get("/auth/admin/communicate/templates", async (req, res) => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const templates = await db.select().from(waTemplatesTable).orderBy(waTemplatesTable.templateName);
  res.json(templates);
});

router.post("/auth/admin/communicate/templates", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }
  const schema = z.object({
    templateName: z.string().min(1),
    templateSid: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [created] = await db.insert(waTemplatesTable)
    .values({ ...parsed.data, status: "approved" })
    .onConflictDoUpdate({ target: waTemplatesTable.templateName, set: { templateSid: parsed.data.templateSid ?? null, category: parsed.data.category ?? null, description: parsed.data.description ?? null, status: "approved" } })
    .returning();
  res.status(201).json(created);
});

router.patch("/auth/admin/communicate/templates/:id", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    status: z.enum(["approved", "paused", "rejected"]).optional(),
    templateSid: z.string().optional(),
    description: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.templateSid !== undefined) updates.templateSid = parsed.data.templateSid;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  const [updated] = await db.update(waTemplatesTable).set(updates).where(eq(waTemplatesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(updated);
});

router.delete("/auth/admin/communicate/templates/:id", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Master admin required" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(waTemplatesTable).where(eq(waTemplatesTable.id, id));
  res.json({ success: true });
});

// ─── Communication Logs ────────────────────────────────────────────────────────

router.get("/auth/admin/communicate/logs", async (req, res) => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  const tournamentId = req.query.tournamentId ? parseInt(String(req.query.tournamentId)) : null;
  const channel = String(req.query.channel || "");
  const status = String(req.query.status || "");
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  const limit = Math.min(parseInt(String(req.query.limit || "100")), 500);
  const offset = parseInt(String(req.query.offset || "0"));

  const conds = [];
  if (tournamentId && !isNaN(tournamentId)) conds.push(eq(commLogsTable.tournamentId, tournamentId));
  if (channel) conds.push(eq(commLogsTable.channel, channel));
  if (status) conds.push(eq(commLogsTable.deliveryStatus, status));
  if (from) conds.push(gte(commLogsTable.sentAt, from));
  if (to) conds.push(lte(commLogsTable.sentAt, to));

  const logs = await db.select().from(commLogsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(commLogsTable.sentAt))
    .limit(limit)
    .offset(offset);

  res.json(logs);
});

router.get("/auth/admin/communicate/logs/:id", async (req, res) => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [log] = await db.select().from(commLogsTable).where(eq(commLogsTable.id, id));
  if (!log) { res.status(404).json({ error: "Not found" }); return; }
  res.json(log);
});

// ─── Automated Blast History ───────────────────────────────────────────────────

router.get("/auth/admin/communicate/blasts", async (req, res) => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const tournamentId = req.query.tournamentId ? parseInt(String(req.query.tournamentId)) : null;
  const conds = tournamentId ? [eq(consentBlastLogTable.tournamentId, tournamentId)] : [];
  const entries = await db.select().from(consentBlastLogTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(consentBlastLogTable.sentAt))
    .limit(200);
  res.json(entries);
});

// ─── Missing Contacts (players/teams with no mobile) ─────────────────────────

router.get("/auth/admin/communicate/missing-contacts/:tournamentId", async (req, res) => {
  if (!req.session.isAdmin && !req.session.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!req.session.isAdmin && req.session.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId }).from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    if (!t || t.organizerId !== req.session.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
  }

  const missingPlayers = await db
    .select({ id: playersTable.id, name: playersTable.name, role: playersTable.role })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tid), sql`${playersTable.mobileNumber} IS NULL OR ${playersTable.mobileNumber} = ''`));

  const missingOwners = await db
    .select({ id: teamsTable.id, name: teamsTable.name, ownerName: teamsTable.ownerName })
    .from(teamsTable)
    .where(and(eq(teamsTable.tournamentId, tid), sql`${teamsTable.ownerMobile} IS NULL OR ${teamsTable.ownerMobile} = ''`));

  res.json({ missingPlayers, missingOwners });
});

// ─── Bulk In-Person Consent Declaration ──────────────────────────────────────

router.post("/auth/admin/communicate/consent-declare-bulk", async (req, res) => {
  if (!req.session.isAdmin && !req.session.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
  const schema = z.object({
    tournamentId: z.number().int(),
    recipientType: z.enum(["player", "team_owner", "all"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { tournamentId, recipientType } = parsed.data;

  if (!req.session.isAdmin && req.session.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId }).from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t || t.organizerId !== req.session.organizerAccountId) { res.status(403).json({ error: "Not authorized for this tournament" }); return; }
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;
  const consentData = { whatsappConsent: true, whatsappConsentAt: new Date(), whatsappConsentMethod: "in_person" as const, whatsappConsentIp: ip };
  let playerCount = 0;
  let ownerCount = 0;

  if (recipientType === "player" || recipientType === "all") {
    const affected = await db.update(playersTable).set(consentData)
      .where(and(
        eq(playersTable.tournamentId, tournamentId),
        eq(playersTable.whatsappConsent, false),
        sql`${playersTable.mobileNumber} IS NOT NULL AND ${playersTable.mobileNumber} != ''`,
      )).returning({ id: playersTable.id });
    playerCount = affected.length;
  }
  if (recipientType === "team_owner" || recipientType === "all") {
    const affected = await db.update(teamsTable).set(consentData)
      .where(and(
        eq(teamsTable.tournamentId, tournamentId),
        eq(teamsTable.whatsappConsent, false),
        sql`${teamsTable.ownerMobile} IS NOT NULL AND ${teamsTable.ownerMobile} != ''`,
      )).returning({ id: teamsTable.id });
    ownerCount = affected.length;
  }

  req.log.info({ tournamentId, recipientType, playerCount, ownerCount, by: req.session.organizerAccountId ?? (req.session.isAdmin ? "admin" : null) }, "Bulk in-person consent declared");
  res.json({ success: true, playerCount, ownerCount });
});

// ─── Consent Status for a Tournament ─────────────────────────────────────────

router.get("/auth/admin/communicate/consent-status/:tournamentId", async (req, res) => {
  if (!req.session.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [playerStats] = await db.select({
    total: sql<number>`count(*)::int`,
    consented: sql<number>`sum(case when whatsapp_consent then 1 else 0 end)::int`,
    hasMobile: sql<number>`sum(case when mobile_number is not null and mobile_number != '' then 1 else 0 end)::int`,
  }).from(playersTable).where(eq(playersTable.tournamentId, tid));

  const [ownerStats] = await db.select({
    total: sql<number>`count(*)::int`,
    consented: sql<number>`sum(case when whatsapp_consent then 1 else 0 end)::int`,
    hasMobile: sql<number>`sum(case when owner_mobile is not null and owner_mobile != '' then 1 else 0 end)::int`,
  }).from(teamsTable).where(eq(teamsTable.tournamentId, tid));

  res.json({ players: playerStats, owners: ownerStats });
});

export default router;
