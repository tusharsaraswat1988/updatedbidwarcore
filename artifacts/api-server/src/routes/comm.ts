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
  smsNotificationSettingsTable,
} from "@workspace/db";
import { eq, and, desc, gte, lte, sql, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendSms, sendWhatsApp, buildWaMeLink, buildConsentSms, isTournamentLicensedForComm } from "../lib/comm-sender";
import { sendDltSms, playerSoldTemplateId } from "../lib/fast2sms";
import { getPublicOrigin } from "../lib/runtime-env";
import { logger } from "../lib/logger";
import { resolveWhatsAppProviderId, getWhatsAppProvider } from "../lib/communication/providers/index.js";

const router = Router();

// ─── Authoritative WhatsApp Template Definitions & Helpers ───────────────────

export interface CanonicalWaTemplate {
  templateName: string;
  title: string;
  category: "utility" | "marketing" | "authentication";
  description: string;
  body: string;
  variables: Array<{ key: string; label: string; placeholder: string }>;
  sampleArgs: string[];
}

export const CANONICAL_WA_TEMPLATES: Record<string, CanonicalWaTemplate> = {
  player_sold: {
    templateName: "player_sold",
    title: "🏆 Player Sold Celebration",
    category: "utility",
    description: "Celebratory announcement sent when a player is sold to a team",
    body: "*BidWar Auction Update*\n\nCongratulations {{1}}!\n\nYou have been *SOLD* to *{{2}}* for *₹{{3}}* in *{{4}}*.\n\nGood luck for the tournament!",
    variables: [
      { key: "1", label: "Player Name", placeholder: "e.g. Virat Kohli" },
      { key: "2", label: "Team Name", placeholder: "e.g. Royal Challengers" },
      { key: "3", label: "Sold Amount (₹)", placeholder: "e.g. 25,00,000" },
      { key: "4", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
    ],
    sampleArgs: ["Virat Kohli", "Royal Challengers", "25,00,000", "Premier League 2026"],
  },
  welcome_invite: {
    templateName: "welcome_invite",
    title: "🎉 Welcome & Tournament Invite",
    category: "utility",
    description: "Official invitation to participate in a tournament",
    body: "*Welcome to BidWar Auction!*\n\nYou are invited to participate in *{{1}}*.\n\n📅 Date: {{2}}\n📍 Venue/Mode: {{3}}\n\nClick below to view details and live rosters.",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Date & Time", placeholder: "e.g. 24 Sep 2026, 6:00 PM" },
      { key: "3", label: "Venue / Mode", placeholder: "e.g. Live Arena" },
    ],
    sampleArgs: ["Premier League 2026", "24 Sep 2026, 6:00 PM", "Live Arena"],
  },
  auction_reminder: {
    templateName: "auction_reminder",
    title: "🚨 Live Auction Countdown Alert",
    category: "utility",
    description: "Urgent countdown notification before auction commences",
    body: "*🚨 Live Auction Starting Soon!*\n\nThe player auction for *{{1}}* begins in *{{2}} minutes*.\n\nTap the link below to enter the live bidding arena right now:\n{{3}}",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Minutes Remaining", placeholder: "e.g. 15" },
      { key: "3", label: "Live Auction Link", placeholder: "e.g. https://bidwar.in/live/742" },
    ],
    sampleArgs: ["Premier League 2026", "15", "https://bidwar.in/live/742"],
  },
  consent_optin: {
    templateName: "consent_optin",
    title: "📲 WhatsApp Consent Opt-In Request",
    category: "utility",
    description: "Request recipient to opt in for WhatsApp notifications",
    body: "*BidWar Instant Alerts*\n\nTo receive real-time bid updates, sale notifications, and squad announcements directly on WhatsApp, please confirm your opt-in:\n\n{{1}}",
    variables: [
      { key: "1", label: "Consent Verification Link", placeholder: "e.g. https://bidwar.in/wa-consent/token981" },
    ],
    sampleArgs: ["https://bidwar.in/wa-consent/token981"],
  },
  credentials_share: {
    templateName: "credentials_share",
    title: "🔑 Team Owner Credentials",
    category: "authentication",
    description: "Private PIN and dashboard link sent to team owners",
    body: "*BidWar Team Pass*\n\nYour owner access for *{{1}}* (Team *{{2}}*) is ready.\n\n🔑 PIN: *{{3}}*\n🌐 App: {{4}}\n\nDo not share this PIN with anyone.",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Team Name", placeholder: "e.g. Super Kings" },
      { key: "3", label: "Access PIN", placeholder: "e.g. 4921" },
      { key: "4", label: "Platform URL", placeholder: "e.g. https://bidwar.in/owner" },
    ],
    sampleArgs: ["Premier League 2026", "Super Kings", "4921", "https://bidwar.in/owner"],
  },
};

/** Ensure default canonical templates are seeded into wa_templates table */
export async function ensureCanonicalTemplatesSeeded(): Promise<void> {
  try {
    const existing = await db
      .select({ templateName: waTemplatesTable.templateName })
      .from(waTemplatesTable);
    const existingList = Array.isArray(existing) ? existing : [];
    const existingNames = new Set(existingList.map((t) => t.templateName));

    for (const [name, tpl] of Object.entries(CANONICAL_WA_TEMPLATES)) {
      if (!existingNames.has(name)) {
        await db
          .insert(waTemplatesTable)
          .values({
            templateName: name,
            category: tpl.category,
            description: tpl.description,
            status: "approved",
          })
          .onConflictDoNothing();
      }
    }
  } catch (err) {
    logger.warn({ err }, "ensureCanonicalTemplatesSeeded: database seed warning");
  }
}

/** Interpolate placeholders {{1}}, {{2}} or {{key}} with values */
export function interpolateTemplateVariables(
  templateBody: string,
  variables: Record<string, string>,
): string {
  let result = templateBody;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{{${key}}}`).join(value ?? "");
  }
  return result;
}

/** Server-side recipient mobile validation & normalization */
export function validateAndNormalizeMobile(raw: unknown): { valid: boolean; normalized?: string; error?: string } {
  if (typeof raw !== "string") {
    return { valid: false, error: "Recipient mobile must be a valid string" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: "Recipient mobile cannot be empty" };
  }
  // Check for invalid characters (only digits, plus, hyphen, space, parens allowed)
  if (/[^\d\s\-+()]/.test(trimmed)) {
    return { valid: false, error: `Recipient mobile "${trimmed}" contains invalid characters` };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10) {
    return { valid: false, error: `Recipient mobile "${trimmed}" has too few digits (minimum 10 required)` };
  }
  if (digits.length > 15) {
    return { valid: false, error: `Recipient mobile "${trimmed}" exceeds maximum allowed length (15 digits)` };
  }

  // Domestic Indian format normalization:
  // 10 digits -> keep 10 digits
  if (digits.length === 10) {
    return { valid: true, normalized: digits };
  }
  // 11 digits with leading 0 -> strip 0
  if (digits.length === 11 && digits.startsWith("0")) {
    return { valid: true, normalized: digits.slice(1) };
  }
  // 12 digits with 91 -> strip 91 for Indian 10-digit standard
  if (digits.length === 12 && digits.startsWith("91")) {
    return { valid: true, normalized: digits.slice(2) };
  }

  return { valid: true, normalized: digits };
}

/** Check if recipient has opted out of WhatsApp (STOP) */
async function isMobileRevoked(mobileDigits: string): Promise<boolean> {
  const tenDigit = mobileDigits.length === 12 && mobileDigits.startsWith("91") ? mobileDigits.slice(2) : mobileDigits;
  const twelveDigit = tenDigit.length === 10 ? `91${tenDigit}` : tenDigit;

  const events = await db
    .select({ eventType: waConsentEventsTable.eventType })
    .from(waConsentEventsTable)
    .where(
      or(
        eq(waConsentEventsTable.mobile, tenDigit),
        eq(waConsentEventsTable.mobile, twelveDigit),
        eq(waConsentEventsTable.mobile, `+${twelveDigit}`)
      )
    )
    .orderBy(desc(waConsentEventsTable.eventAt))
    .limit(1);

  if (events.length > 0) {
    return events[0].eventType === "STOP_REVOKED" || events[0].eventType === "declined";
  }
  return false;
}

/** Normalize free-text / dropdown template names to a canonical key. */
function normalizeCommTemplateName(name: string | undefined | null): string | null {
  if (!name?.trim()) return null;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "player_sold" || key === "playersold") return "player_sold";
  return name.trim();
}

function buildPlayerSoldWaMessage(opts: {
  playerName: string;
  teamName: string;
  amount: number;
  tournamentName: string;
}): string {
  const amt = `₹${opts.amount.toLocaleString("en-IN")}`;
  return `*BidWar Auction Update*\n\nCongratulations ${opts.playerName}!\n\nYou have been *SOLD* to *${opts.teamName}* for *${amt}* in *${opts.tournamentName}*.\n\nGood luck for the tournament!`;
}

function buildPlayerSoldSmsPreview(opts: {
  playerName: string;
  teamName: string;
  amount: number;
  appUrl: string;
}): string {
  return `Player Sold: ${opts.playerName} → ${opts.teamName} for ${opts.amount} | ${opts.appUrl}`;
}

function isMasterAdmin(req: import("express").Request): boolean {
  return !!req.jwtUser.isAdmin && req.jwtUser.adminLevel === "master";
}

function isAdminOrOrganizer(req: import("express").Request): boolean {
  return !!(req.jwtUser.isAdmin || req.jwtUser.organizerAccountId);
}

function newToken(): string {
  return randomBytes(16).toString("hex");
}

function generateBlastId(): string {
  return `blast_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

// ─── Bot Link (public — must be BEFORE /:token param route) ─────────────────

router.get("/consent/wa-link", (_req, res) => {
  const waNumber = (
    process.env.KV_TECHMEDIA_WHATSAPP_NUMBER ??
    process.env.META_WHATSAPP_PHONE_NUMBER ??
    process.env.TWILIO_WHATSAPP_FROM ??
    ""
  ).replace("whatsapp:", "").replace("+", "").trim();
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
  if (!req.jwtUser.isAdmin && req.jwtUser.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t || t.organizerId !== req.jwtUser.organizerAccountId) {
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
  if (!req.jwtUser.isAdmin && !req.jwtUser.organizerAccountId) {
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
  const orgId = req.jwtUser.isAdmin
    ? (parsed.data.orgId ?? req.jwtUser.organizerAccountId ?? null)
    : (req.jwtUser.organizerAccountId ?? null);

  // Scoping: non-admin organizers may only declare consent for recipients in their own tournaments
  if (!req.jwtUser.isAdmin && req.jwtUser.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId })
      .from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t || t.organizerId !== req.jwtUser.organizerAccountId) {
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
    recipientGroup: z.enum([
      "all_players",
      "sold_players",
      "unsold_players",
      "all_owners",
      "organizer",
      "manual",
      "custom",
    ]),
    specificTeamId: z.number().int().optional(),
    channel: z.enum(["whatsapp", "sms", "both"]),
    templateName: z.string().optional(),
    messageContent: z.string().max(4096).optional().default(""),
    manualMobiles: z.union([z.array(z.string()), z.string()]).optional(),
    customMobile: z.string().optional(),
    templateVariables: z.record(z.string()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const canonicalTemplate = normalizeCommTemplateName(d.templateName);
  const isPlayerSoldTemplate = canonicalTemplate === "player_sold";
  const isCustomOrFreeform = !canonicalTemplate || canonicalTemplate === "custom";

  // Ensure canonical templates are registered in wa_templates
  await ensureCanonicalTemplatesSeeded();

  let resolvedTemplateSid: string | undefined;

  // Validate approved template against authoritative database registry
  if (!isCustomOrFreeform) {
    const [dbTmpl] = await db
      .select({
        templateName: waTemplatesTable.templateName,
        templateSid: waTemplatesTable.templateSid,
        status: waTemplatesTable.status,
      })
      .from(waTemplatesTable)
      .where(eq(waTemplatesTable.templateName, canonicalTemplate!));

    if (!dbTmpl || dbTmpl.status !== "approved") {
      res.status(400).json({ error: `Template "${d.templateName}" is not approved.` });
      return;
    }
    resolvedTemplateSid = dbTmpl.templateSid ?? undefined;

    // Validate variables if template definition specifies them
    const canonicalDef = CANONICAL_WA_TEMPLATES[canonicalTemplate!];
    if (canonicalDef && canonicalDef.variables.length > 0) {
      const isAutoDbPlayerSold = isPlayerSoldTemplate && d.tournamentId && (d.recipientGroup === "sold_players" || d.recipientGroup === "all_players");
      if (!isAutoDbPlayerSold) {
        const suppliedVars = d.templateVariables ?? {};
        const missingVars: string[] = [];
        for (const v of canonicalDef.variables) {
          const val = suppliedVars[v.key] ?? suppliedVars[v.label];
          if (!val || !val.trim()) {
            missingVars.push(`${v.label} ({{${v.key}}})`);
          }
        }
        if (missingVars.length > 0) {
          res.status(400).json({ error: `Missing required template variable(s): ${missingVars.join(", ")}` });
          return;
        }
        d.messageContent = interpolateTemplateVariables(canonicalDef.body, suppliedVars);
      }
    } else if (canonicalDef) {
      if (!d.messageContent.trim()) {
        d.messageContent = canonicalDef.body;
      }
    }
  } else {
    // Custom message requires non-empty message content
    if (!d.messageContent.trim()) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }
  }

  // Early recipient validation for manual/custom before DB queries
  if (d.recipientGroup === "manual" || d.recipientGroup === "custom") {
    const rawMobiles: string[] = [];
    if (typeof d.customMobile === "string" && d.customMobile.trim()) {
      rawMobiles.push(d.customMobile.trim());
    }
    if (Array.isArray(d.manualMobiles)) {
      for (const m of d.manualMobiles) {
        if (typeof m === "string" && m.trim()) rawMobiles.push(m.trim());
      }
    } else if (typeof d.manualMobiles === "string" && d.manualMobiles.trim()) {
      rawMobiles.push(...d.manualMobiles.split(",").map((s) => s.trim()).filter(Boolean));
    }

    if (rawMobiles.length === 0) {
      res.status(400).json({ error: "At least one recipient mobile number is required" });
      return;
    }

    for (const raw of rawMobiles) {
      const normResult = validateAndNormalizeMobile(raw);
      if (!normResult.valid || !normResult.normalized) {
        res.status(400).json({ error: normResult.error || `Invalid mobile number: "${raw}"` });
        return;
      }
    }
  }

  // Player Sold template: personalized DLT SMS (+ optional WA) to sold players
  if (isPlayerSoldTemplate && (d.recipientGroup === "sold_players" || d.recipientGroup === "all_players")) {
    if (!d.tournamentId) {
      res.status(400).json({ error: "tournamentId is required for the player_sold template" });
      return;
    }
    if (d.recipientGroup !== "sold_players" && d.recipientGroup !== "all_players") {
      res.status(400).json({
        error: "player_sold template only supports sold_players (or all_players, which is filtered to sold)",
      });
      return;
    }

    const tid = d.tournamentId;
    const [tournament] = await db
      .select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        licenseStatus: tournamentsTable.licenseStatus,
        adminLocked: tournamentsTable.adminLocked,
        scoringEnabled: tournamentsTable.scoringEnabled,
        scoringPhase: tournamentsTable.scoringPhase,
        licenseGrantedAt: tournamentsTable.licenseGrantedAt,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid));
    if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

    if (d.channel === "whatsapp" || d.channel === "both") {
      if (!isTournamentLicensedForComm(tournament)) {
        res.status(403).json({ error: "WhatsApp messaging requires a live license and unlocked tournament" });
        return;
      }
    }

    // Resolve DLT template ID (env takes priority, same as auction auto-send)
    const [smsSettings] = await db.select().from(smsNotificationSettingsTable).limit(1);
    const envTemplateId = playerSoldTemplateId();
    const dltTemplateId = envTemplateId || smsSettings?.playerSoldTemplateId || null;

    // SMS path (direct or WA→SMS consent fallback) needs the DLT template ID
    if ((d.channel === "sms" || d.channel === "both") && !dltTemplateId) {
      res.status(400).json({
        error: "Player Sold DLT template ID is not configured. Set BULKSMS_PLAYER_SOLD_TEMPLATE_ID or configure it in SMS settings.",
      });
      return;
    }

    const soldPlayers = await db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        mobileNumber: playersTable.mobileNumber,
        soldPrice: playersTable.soldPrice,
        teamId: playersTable.teamId,
        whatsappConsent: playersTable.whatsappConsent,
      })
      .from(playersTable)
      .where(and(
        eq(playersTable.tournamentId, tid),
        eq(playersTable.status, "sold"),
        sql`${playersTable.mobileNumber} IS NOT NULL AND ${playersTable.mobileNumber} != ''`,
      ));

    if (soldPlayers.length === 0) {
      res.status(400).json({ error: "No sold players with mobile numbers found for this tournament" });
      return;
    }

    const teamIds = [...new Set(soldPlayers.map(p => p.teamId).filter((id): id is number => id != null))];
    const teamRows = teamIds.length > 0
      ? await db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).where(inArray(teamsTable.id, teamIds))
      : [];
    const teamNameById = new Map(teamRows.map(t => [t.id, t.name]));

    const appUrl = process.env.APP_URL?.trim() || getPublicOrigin();
    const blastId = generateBlastId();
    const results: Array<{ mobile: string; channel: string; success: boolean; stub?: boolean; error?: string }> = [];
    const logTemplateName = "player_sold";

    logger.info({
      tournamentId: tid,
      soldCount: soldPlayers.length,
      channel: d.channel,
      dltTemplateId,
      templateIdSource: envTemplateId ? "env" : "db",
    }, "Admin communicate: player_sold blast starting");

    for (const player of soldPlayers) {
      const mobile = player.mobileNumber!;
      const playerName = player.name ?? "Player";
      const teamName = (player.teamId != null ? teamNameById.get(player.teamId) : null) ?? "Team";
      const amount = player.soldPrice ?? 0;
      const shouldSendWa = (d.channel === "whatsapp" || d.channel === "both");
      const shouldSendSms = (d.channel === "sms" || d.channel === "both");

      if (shouldSendWa) {
        const waBody = buildPlayerSoldWaMessage({
          playerName,
          teamName,
          amount,
          tournamentName: tournament.name,
        });

        if (!player.whatsappConsent) {
          const err = "Recipient has no WhatsApp consent";
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "whatsapp",
            templateName: logTemplateName,
            messageContent: waBody,
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: "failed",
            metaMessageId: null,
            errorMessage: err,
          });
          results.push({ mobile, channel: "whatsapp", success: false, blocked: true, error: err });
        } else {
          const waResult = await sendWhatsApp(mobile, waBody, resolvedTemplateSid);
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "whatsapp",
            templateName: logTemplateName,
            messageContent: waBody,
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: waResult.success ? "sent" : "failed",
            metaMessageId: waResult.messageSid ?? null,
            errorMessage: waResult.error ?? null,
          });
          results.push({ mobile, channel: "whatsapp", success: waResult.success, stub: waResult.stub, error: waResult.error });
        }
      }

      if (shouldSendSms) {
        if (!dltTemplateId) {
          const err = "Player Sold DLT template ID is not configured";
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "sms",
            templateName: logTemplateName,
            messageContent: buildPlayerSoldSmsPreview({ playerName, teamName, amount, appUrl }),
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: "failed",
            metaMessageId: null,
            errorMessage: err,
          });
          results.push({ mobile, channel: "sms", success: false, error: err });
        } else {
          // DLT vars must match approved sample: 1=player, 2=team, 3=amount, 4=app URL
          const smsResult = await sendDltSms(
            [mobile],
            dltTemplateId,
            [playerName, teamName, String(amount), appUrl],
          );
          const preview = buildPlayerSoldSmsPreview({ playerName, teamName, amount, appUrl });
          await db.insert(commLogsTable).values({
            tournamentId: tid,
            recipientType: "player",
            recipientId: player.id,
            recipientMobile: mobile,
            channel: "sms",
            templateName: logTemplateName,
            messageContent: preview,
            sentByAdminId: "master_admin",
            blastId,
            deliveryStatus: smsResult.success ? "sent" : "failed",
            metaMessageId: null,
            errorMessage: smsResult.error ?? null,
          });
          results.push({ mobile, channel: "sms", success: smsResult.success, error: smsResult.error });
        }
      }
    }

    const sentCount = results.filter(r => r.success).length;
    const blockedCount = results.filter(r => (r as any).blocked || (!r.success && r.error?.includes("consent"))).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      blastId,
      template: "player_sold",
      total: results.length,
      sent: sentCount,
      blocked: blockedCount,
      failed: failedCount,
      stub: results.some(r => r.stub),
      results,
    });
    return;
  }

  // License gate for WhatsApp — "active" is the licensed status in this system.
  // All WhatsApp sends (including manual/custom) require a tournamentId so the
  // license can be verified; no anonymous/license-free WA blasts allowed.
  if (d.channel === "whatsapp" || d.channel === "both") {
    if (!d.tournamentId) {
      res.status(400).json({ error: "tournamentId is required for WhatsApp sends to enforce license gating" });
      return;
    }
    const [t] = await db
      .select({
        licenseStatus: tournamentsTable.licenseStatus,
        adminLocked: tournamentsTable.adminLocked,
        scoringEnabled: tournamentsTable.scoringEnabled,
        scoringPhase: tournamentsTable.scoringPhase,
        licenseGrantedAt: tournamentsTable.licenseGrantedAt,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, d.tournamentId));
    if (!t) { res.status(404).json({ error: "Tournament not found" }); return; }
    if (!isTournamentLicensedForComm(t)) {
      res.status(403).json({ error: "WhatsApp messaging requires a live license and unlocked tournament" });
      return;
    }
  }

  // Build recipient list
  type Recipient = { mobile: string; recipientType: string; recipientId: number | null; whatsappConsent: boolean };
  const recipients: Recipient[] = [];

  if (d.recipientGroup === "manual" || d.recipientGroup === "custom") {
    const rawMobiles: string[] = [];
    if (typeof d.customMobile === "string" && d.customMobile.trim()) {
      rawMobiles.push(d.customMobile.trim());
    }
    if (Array.isArray(d.manualMobiles)) {
      for (const m of d.manualMobiles) {
        if (typeof m === "string" && m.trim()) rawMobiles.push(m.trim());
      }
    } else if (typeof d.manualMobiles === "string" && d.manualMobiles.trim()) {
      rawMobiles.push(...d.manualMobiles.split(",").map((s) => s.trim()).filter(Boolean));
    }

    if (rawMobiles.length === 0) {
      res.status(400).json({ error: "At least one recipient mobile number is required" });
      return;
    }

    for (const raw of rawMobiles) {
      const normResult = validateAndNormalizeMobile(raw);
      if (!normResult.valid || !normResult.normalized) {
        res.status(400).json({ error: normResult.error || `Invalid mobile number: "${raw}"` });
        return;
      }
      const mobile = normResult.normalized;
      const revoked = await isMobileRevoked(mobile);
      let consent = !revoked;
      if (d.tournamentId && consent) {
        const [p] = await db
          .select({ whatsappConsent: playersTable.whatsappConsent })
          .from(playersTable)
          .where(
            and(
              eq(playersTable.tournamentId, d.tournamentId),
              or(eq(playersTable.mobileNumber, mobile), eq(playersTable.mobileNumber, `91${mobile}`)),
            ),
          );
        if (p && !p.whatsappConsent) consent = false;
      }
      recipients.push({
        mobile,
        recipientType: "manual",
        recipientId: null,
        whatsappConsent: consent,
      });
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
    const shouldSendWa = (d.channel === "whatsapp" || d.channel === "both");
    const shouldSendSms = (d.channel === "sms" || d.channel === "both");

    if (shouldSendWa) {
      if (!r.whatsappConsent) {
        const err = "Recipient has no WhatsApp consent or opted out (STOP)";
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
          deliveryStatus: "failed",
          metaMessageId: null,
          errorMessage: err,
        });
        results.push({ mobile: r.mobile, channel: "whatsapp", success: false, blocked: true, error: err });
      } else {
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
    }

    if (shouldSendSms) {
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

  const sentCount = results.filter(r => r.success).length;
  const blockedCount = results.filter(r => (r as any).blocked || (!r.success && r.error?.includes("consent"))).length;
  const failedCount = results.filter(r => !r.success).length;

  res.json({
    success: true,
    blastId,
    total: results.length,
    sent: sentCount,
    blocked: blockedCount,
    failed: failedCount,
    stub: results.some(r => r.stub),
    results,
  });
});

// ─── WhatsApp Provider Status (admin-managed, read-only) ───────────────────────

router.get("/auth/admin/communicate/provider-status", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const providerId = resolveWhatsAppProviderId();
  const provider = getWhatsAppProvider(providerId);
  const validation = provider.validateConfig();

  const isConfigured = providerId !== "none";
  let status: "unconfigured" | "invalid_config" | "configured" | "mock";
  if (providerId === "none") {
    status = "unconfigured";
  } else if (providerId === "mock") {
    status = "mock";
  } else if (!validation.valid) {
    status = "invalid_config";
  } else {
    status = "configured";
  }

  const providerDisplayNames: Record<string, string> = {
    kv_techmedia: "KV TechMedia",
    twilio: "Twilio WhatsApp",
    meta_direct: "Meta Direct Cloud API",
    mock: "Mock Provider (Test/Dev Only)",
    none: "Not Configured",
  };

  // Query recent delivery logs for WhatsApp channel to give truthful health metrics without pinging live provider
  let recentHealth = {
    totalLogged: 0,
    deliveredCount: 0,
    failedCount: 0,
    lastDispatchedAt: null as string | null,
    lastDeliveryStatus: null as string | null,
  };

  try {
    const recentLogs = await db
      .select({
        id: commLogsTable.id,
        deliveryStatus: commLogsTable.deliveryStatus,
        sentAt: commLogsTable.sentAt,
      })
      .from(commLogsTable)
      .where(eq(commLogsTable.channel, "whatsapp"))
      .orderBy(desc(commLogsTable.sentAt))
      .limit(50);

    if (Array.isArray(recentLogs) && recentLogs.length > 0) {
      recentHealth.totalLogged = recentLogs.length;
      recentHealth.deliveredCount = recentLogs.filter((l) =>
        ["sent", "delivered", "read"].includes(l.deliveryStatus || "")
      ).length;
      recentHealth.failedCount = recentLogs.filter(
        (l) => l.deliveryStatus === "failed"
      ).length;
      recentHealth.lastDispatchedAt = recentLogs[0].sentAt
        ? new Date(recentLogs[0].sentAt).toISOString()
        : null;
      recentHealth.lastDeliveryStatus = recentLogs[0].deliveryStatus ?? null;
    }
  } catch (err) {
    logger.warn({ err }, "provider-status: unable to query commLogsTable");
  }

  res.json({
    provider: providerId,
    displayName: providerDisplayNames[providerId] || providerId,
    configured: isConfigured,
    configValid: validation.valid,
    configErrors: validation.errors,
    status,
    verifiedConnectivity: false,
    connectivityNote: "Live connectivity not verified via live ping to conserve provider quota and prevent accidental billing",
    environment: process.env.NODE_ENV || "development",
    isProduction: process.env.NODE_ENV === "production",
    deliveryHealth: recentHealth,
  });
});

// ─── WhatsApp Template Config (admin-managed) ─────────────────────────────────

router.get("/auth/admin/communicate/templates", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  await ensureCanonicalTemplatesSeeded();
  const templates = await db.select().from(waTemplatesTable).orderBy(waTemplatesTable.templateName);
  const enriched = templates.map((t) => {
    const canonical = CANONICAL_WA_TEMPLATES[t.templateName];
    return {
      id: t.id,
      templateName: t.templateName,
      templateSid: t.templateSid,
      category: t.category || canonical?.category || "utility",
      description: t.description || canonical?.description || "",
      status: t.status,
      title: canonical?.title || t.templateName,
      body: canonical?.body || "",
      variables: canonical?.variables || [],
      sampleArgs: canonical?.sampleArgs || [],
    };
  });
  res.json(enriched);
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
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

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
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [log] = await db.select().from(commLogsTable).where(eq(commLogsTable.id, id));
  if (!log) { res.status(404).json({ error: "Not found" }); return; }
  res.json(log);
});

// ─── Automated Blast History ───────────────────────────────────────────────────

router.get("/auth/admin/communicate/blasts", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
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
  if (!req.jwtUser.isAdmin && !req.jwtUser.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!req.jwtUser.isAdmin && req.jwtUser.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId }).from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    if (!t || t.organizerId !== req.jwtUser.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
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
  if (!req.jwtUser.isAdmin && !req.jwtUser.organizerAccountId) { res.status(403).json({ error: "Not authorized" }); return; }
  const schema = z.object({
    tournamentId: z.number().int(),
    recipientType: z.enum(["player", "team_owner", "all"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const { tournamentId, recipientType } = parsed.data;

  if (!req.jwtUser.isAdmin && req.jwtUser.organizerAccountId) {
    const [t] = await db.select({ organizerId: tournamentsTable.organizerId }).from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!t || t.organizerId !== req.jwtUser.organizerAccountId) { res.status(403).json({ error: "Not authorized for this tournament" }); return; }
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;
  const consentOrgId = req.jwtUser.organizerAccountId ?? null;
  const consentData = { whatsappConsent: true, whatsappConsentAt: new Date(), whatsappConsentMethod: "organizer_declaration" as const, whatsappConsentIp: ip, whatsappConsentOrgId: consentOrgId };
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

  req.log.info({ tournamentId, recipientType, playerCount, ownerCount, by: req.jwtUser.organizerAccountId ?? (req.jwtUser.isAdmin ? "admin" : null) }, "Bulk organizer-declaration consent recorded");
  res.json({ success: true, playerCount, ownerCount });
});

// ─── Consent Status for a Tournament ─────────────────────────────────────────

router.get("/auth/admin/communicate/consent-status/:tournamentId", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
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
