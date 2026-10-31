/**
 * Inbound webhook routes:
 * - POST /webhooks/comm-inbound   — WhatsApp/SMS inbound (consent bot, STOP, data queries)
 * - POST /webhooks/comm-delivery  — Twilio delivery receipts → comm_logs update
 * - POST /webhooks/wa-quality     — Meta quality rating events → wa_quality_log
 *
 * Security: Twilio signature verification is enforced when TWILIO_AUTH_TOKEN is present.
 * All webhook handlers refuse unsigned requests in production.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  organizersTable,
  tournamentsTable,
  otpSessionsTable,
  commLogsTable,
  waQualityLogTable,
  consentTokensTable,
  waConsentEventsTable,
  botSessionsTable,
  waTemplatesTable,
} from "@workspace/db";
import { eq, and, desc, or, sql, gt } from "drizzle-orm";
import { sendSms, sendWhatsApp, sendLicensedWhatsApp, isTournamentLicensedForComm } from "../lib/comm-sender";
import { logger, maskPhoneNumber } from "../lib/logger";
import { kvTechMediaProvider, metaDirectProvider, resolveWhatsAppProviderId } from "../lib/communication/providers/index.js";
import { conversationRouter } from "../lib/communication/conversation-router";
import { randomBytes, scrypt, timingSafeEqual, createHmac, randomInt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const router = Router();

// ─── Twilio Signature Verification ───────────────────────────────────────────

/**
 * Verifies the X-Twilio-Signature header using HMAC-SHA1.
 * Returns true when:
 *  - TWILIO_AUTH_TOKEN is not configured (stub/dev mode — allow through)
 *  - The computed signature matches the header
 * Returns false when the auth token is configured but the signature is missing or wrong.
 */
export function verifyTwilioSignature(req: import("express").Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    if (process.env.NODE_ENV === "production") {
      logger.error("Twilio webhook rejected: TWILIO_AUTH_TOKEN missing in production (failing closed)");
      return false;
    }
    return true; // stub mode in non-production
  }

  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) return false;

  const rawProtoHeader = req.headers["x-forwarded-proto"];
  const rawProto = (Array.isArray(rawProtoHeader) ? rawProtoHeader[0] : (rawProtoHeader as string | undefined)) ?? "https";
  const proto = (rawProto.split(",")[0] ?? "").trim().toLowerCase() || "https";
  if (proto !== "https" && proto !== "http") {
    logger.warn({ proto }, "Twilio webhook rejected: invalid or malformed protocol header");
    return false;
  }

  const rawHostHeader = req.headers["x-forwarded-host"];
  const rawHost = (Array.isArray(rawHostHeader) ? rawHostHeader[0] : (rawHostHeader as string | undefined)) ?? req.headers.host ?? "";
  const host = (rawHost.split(",")[0] ?? "").trim();
  if (!host || !/^[a-zA-Z0-9.-]+(:[0-9]+)?$/.test(host)) {
    logger.warn({ host }, "Twilio webhook rejected: unable to determine valid host for signature verification");
    return false;
  }

  const url = `${proto}://${host}${req.originalUrl}`;

  const body = (req.body as Record<string, string>) || {};
  const params = Object.keys(body).sort().reduce((acc, key) => acc + key + (body[key] ?? ""), "");
  const str = url + params;

  const expected = createHmac("sha1", authToken).update(str).digest("base64");

  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const signatureBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

// ─── Consent Question Version ─────────────────────────────────────────────────
// Bump this constant whenever the wording of the consent question changes so the
// exact text shown to the user at the time of their YES is queryable in wa_consent_events.
const CONSENT_QUESTION_V1 =
  `Kya aap BidWar se match updates, auction alerts aur tournament notifications WhatsApp pe paana chahte hain?\n\nHan ke liye "YES" bhejein\nNa ke liye "NO" bhejein`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "91");
}

async function hashOtp(otp: string): Promise<string> {
  const salt = randomBytes(8).toString("hex");
  const key = (await scryptAsync(otp, salt, 32)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derived = (await scryptAsync(otp, salt, 32)) as Buffer;
    return timingSafeEqual(derived, Buffer.from(key, "hex"));
  } catch { return false; }
}

export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

// Look up a mobile in players, teams, or organizers
async function findConsentTarget(mobile: string): Promise<{
  type: "player" | "team_owner" | "organizer";
  id: number;
  name: string;
  tournamentId?: number;
} | null> {
  const norm = normalizePhone(mobile);

  const players = await db.select({ id: playersTable.id, name: playersTable.name, tournamentId: playersTable.tournamentId })
    .from(playersTable)
    .where(or(eq(playersTable.mobileNumber, mobile), eq(playersTable.mobileNumber, norm), sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`))
    .limit(1);
  if (players.length > 0) return { type: "player", id: players[0].id, name: players[0].name, tournamentId: players[0].tournamentId };

  const teams = await db.select({ id: teamsTable.id, name: teamsTable.name, tournamentId: teamsTable.tournamentId })
    .from(teamsTable)
    .where(or(eq(teamsTable.ownerMobile, mobile), eq(teamsTable.ownerMobile, norm), sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`))
    .limit(1);
  if (teams.length > 0) return { type: "team_owner", id: teams[0].id, name: teams[0].name, tournamentId: teams[0].tournamentId };

  const orgs = await db.select({ id: organizersTable.id, name: organizersTable.name })
    .from(organizersTable)
    .where(or(eq(organizersTable.mobile, mobile), eq(organizersTable.mobile, norm)))
    .limit(1);
  if (orgs.length > 0) return { type: "organizer", id: orgs[0].id, name: orgs[0].name };

  return null;
}

// Return ALL player/team records matching the mobile across all tournaments.
// Used by the DATA/REPORT command to enable tournament disambiguation.
type ConsentTarget = { type: "player" | "team_owner" | "organizer"; id: number; name: string; tournamentId?: number; tournamentName?: string };

// Returns true if the tournament is licensed for outbound WhatsApp sends.
// Used to gate ALL outbound WA messages (admin sends, scheduler, and bot replies).
async function isTournamentWaLicensed(tournamentId: number | null | undefined): Promise<boolean> {
  if (!tournamentId) return false;
  const [t] = await db
    .select({
      licenseStatus: tournamentsTable.licenseStatus,
      adminLocked: tournamentsTable.adminLocked,
      scoringEnabled: tournamentsTable.scoringEnabled,
      scoringPhase: tournamentsTable.scoringPhase,
      licenseGrantedAt: tournamentsTable.licenseGrantedAt,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!t) return false;
  return isTournamentLicensedForComm(t);
}

async function findAllConsentTargets(mobile: string): Promise<ConsentTarget[]> {
  const norm = normalizePhone(mobile);
  const results: ConsentTarget[] = [];

  const players = await db
    .select({ id: playersTable.id, name: playersTable.name, tournamentId: playersTable.tournamentId })
    .from(playersTable)
    .where(or(
      eq(playersTable.mobileNumber, mobile),
      eq(playersTable.mobileNumber, norm),
      sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`,
    ));
  for (const p of players) {
    const [t] = await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, p.tournamentId));
    results.push({ type: "player", id: p.id, name: p.name, tournamentId: p.tournamentId, tournamentName: t?.name });
  }

  const teams = await db
    .select({ id: teamsTable.id, name: teamsTable.name, tournamentId: teamsTable.tournamentId })
    .from(teamsTable)
    .where(or(
      eq(teamsTable.ownerMobile, mobile),
      eq(teamsTable.ownerMobile, norm),
      sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`,
    ));
  for (const tm of teams) {
    const [t] = await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, tm.tournamentId));
    results.push({ type: "team_owner", id: tm.id, name: tm.name, tournamentId: tm.tournamentId, tournamentName: t?.name });
  }

  if (results.length === 0) {
    const orgs = await db
      .select({ id: organizersTable.id, name: organizersTable.name })
      .from(organizersTable)
      .where(or(eq(organizersTable.mobile, mobile), eq(organizersTable.mobile, norm)));
    for (const o of orgs) results.push({ type: "organizer", id: o.id, name: o.name });
  }
  return results;
}

// Build a personalized data summary for a resolved ConsentTarget
async function buildPersonalizedSummary(target: ConsentTarget): Promise<string> {
  if (target.type === "player") {
    const [p] = await db.select({ name: playersTable.name, role: playersTable.role, status: playersTable.status, basePrice: playersTable.basePrice, soldPrice: playersTable.soldPrice }).from(playersTable).where(eq(playersTable.id, target.id));
    const statusMap: Record<string, string> = { available: "Available", sold: "Sold", unsold: "Unsold", retained: "Retained" };
    return [
      `Khiladi: ${p?.name ?? target.name}`,
      `Role: ${p?.role ?? "-"}`,
      `Tournament: ${target.tournamentName ?? "-"}`,
      `Status: ${statusMap[p?.status ?? ""] ?? p?.status ?? "-"}`,
      p?.soldPrice ? `Sold price: ₹${p.soldPrice.toLocaleString("en-IN")}` : `Base price: ₹${(p?.basePrice ?? 0).toLocaleString("en-IN")}`,
    ].join("\n");
  } else if (target.type === "team_owner") {
    const [tm] = await db.select({ name: teamsTable.name, ownerName: teamsTable.ownerName, purse: teamsTable.purse, purseUsed: teamsTable.purseUsed }).from(teamsTable).where(eq(teamsTable.id, target.id));
    const remaining = (tm?.purse ?? 0) - (tm?.purseUsed ?? 0);
    return [
      `Team: ${tm?.name ?? target.name}`,
      `Owner: ${tm?.ownerName ?? "-"}`,
      `Tournament: ${target.tournamentName ?? "-"}`,
      `Purse remaining: ₹${remaining.toLocaleString("en-IN")}`,
      `Purse used: ₹${(tm?.purseUsed ?? 0).toLocaleString("en-IN")}`,
    ].join("\n");
  } else {
    const [o] = await db.select({ name: organizersTable.name }).from(organizersTable).where(eq(organizersTable.id, target.id));
    const tcount = (await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.organizerId, target.id))).length;
    return [`Organizer: ${o?.name ?? target.name}`, `Tournaments: ${tcount}`].join("\n");
  }
}

async function setConsentGranted(type: string, id: number, ip: string | null) {
  const data = { whatsappConsent: true, whatsappConsentAt: new Date(), whatsappConsentMethod: "whatsapp_otp_verified", whatsappConsentIp: ip };
  if (type === "player") await db.update(playersTable).set(data).where(eq(playersTable.id, id));
  else if (type === "team_owner") await db.update(teamsTable).set(data).where(eq(teamsTable.id, id));
  else if (type === "organizer") await db.update(organizersTable).set(data).where(eq(organizersTable.id, id));
}

async function setConsentRevoked(type: string, id: number) {
  const data = { whatsappConsent: false };
  if (type === "player") await db.update(playersTable).set(data).where(eq(playersTable.id, id));
  else if (type === "team_owner") await db.update(teamsTable).set(data).where(eq(teamsTable.id, id));
  else if (type === "organizer") await db.update(organizersTable).set(data).where(eq(organizersTable.id, id));
}

async function logConsentEvent(
  target: { type: string; id: number; tournamentId?: number } | null,
  mobile: string,
  content: string,
) {
  await db.insert(commLogsTable).values({
    tournamentId: target?.tournamentId ?? null,
    recipientType: target?.type ?? "unknown",
    recipientId: target ? target.id : null,
    recipientMobile: mobile,
    channel: "whatsapp",
    messageContent: content,
    deliveryStatus: "delivered",
  });
}

// ─── Meta / KV TechMedia Webhook Handlers ─────────────────────────────────────

/**
 * Handle Meta Cloud API / KV TechMedia webhooks.
 * Supports GET hub.challenge verification and POST signed payloads.
 */
router.get(["/webhooks/kv-meta", "/webhooks/comm-inbound"], (req, res) => {
  const isMetaDirect = resolveWhatsAppProviderId() === "meta_direct";
  const verifier = isMetaDirect ? metaDirectProvider : kvTechMediaProvider;
  const { isValid, challenge } = verifier.verifyWebhookChallenge(req);
  if (isValid && challenge !== undefined) {
    logger.info("Meta/KV TechMedia webhook challenge verified successfully");
    res.status(200).send(challenge);
    return;
  }
  logger.warn("Meta/KV TechMedia webhook challenge rejected: invalid token or mode");
  res.status(403).send("Forbidden");
});


const STATUS_RANK: Record<string, number> = {
  pending: 0,
  submitted: 10,
  sent: 20,
  delivered: 30,
  read: 40,
  failed: 50,
};

async function handleMetaWebhook(req: import("express").Request, res: import("express").Response): Promise<void> {
  const isMetaDirect = resolveWhatsAppProviderId() === "meta_direct";
  const verifier = isMetaDirect ? metaDirectProvider : kvTechMediaProvider;
  if (!verifier.verifyWebhookSignature(req)) {
    logger.warn("Inbound KV/Meta webhook rejected: invalid signature or missing secret");
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  const { statuses, messages } = verifier.normalizeWebhookPayload(req.body);

  // 1. Process delivery receipts with monotonic guard
  for (const status of statuses) {
    logger.info(
      { providerMessageId: status.providerMessageId, status: status.status },
      "Processing Meta/KV delivery status receipt",
    );

    const [current] = await db
      .select({ deliveryStatus: commLogsTable.deliveryStatus })
      .from(commLogsTable)
      .where(eq(commLogsTable.metaMessageId, status.providerMessageId))
      .limit(1);

    if (current) {
      const currentRank = STATUS_RANK[current.deliveryStatus] ?? 0;
      const newRank = STATUS_RANK[status.status] ?? 0;
      if (newRank >= currentRank || status.status === "failed") {
        const updateData: {
          deliveryStatus: string;
          deliveryUpdatedAt: Date;
          errorMessage?: string | null;
        } = {
          deliveryStatus: status.status,
          deliveryUpdatedAt: status.timestamp,
        };
        if (status.status === "failed" && status.errorMessage) {
          updateData.errorMessage = status.errorMessage;
        }
        await db
          .update(commLogsTable)
          .set(updateData)
          .where(eq(commLogsTable.metaMessageId, status.providerMessageId));
      } else {
        logger.info(
          { providerMessageId: status.providerMessageId, current: current.deliveryStatus, incoming: status.status },
          "Ignoring out-of-order delivery status receipt (monotonic guard)",
        );
      }
    }
  }

  // 2. Process inbound messages via unified ConversationRouter
  let allHandled = true;
  for (const msg of messages) {
    const result = await conversationRouter.processInboundMessage({
      from: msg.from,
      channel: "whatsapp",
      text: msg.text ?? "",
      messageId: msg.messageId,
      raw: msg.raw,
      ip: req.ip ?? null,
    });
    if (!result.handled) {
      allHandled = false;
    }
  }

  if (!allHandled) {
    logger.warn("Meta webhook partially or wholly unhandled/locked; requesting retry with 503");
    res.status(503).json({ error: "Inbound message currently locked or unhandled; retry requested" });
    return;
  }

  res.status(200).json({ success: true });
}

router.post("/webhooks/kv-meta", handleMetaWebhook);

// ─── Inbound WhatsApp / SMS ───────────────────────────────────────────────────

router.post("/webhooks/comm-inbound", async (req, res) => {
  if (req.headers["x-hub-signature-256"] || (req.body && req.body.object === "whatsapp_business_account")) {
    await handleMetaWebhook(req, res);
    return;
  }
  if (!verifyTwilioSignature(req)) {
    logger.warn("Inbound webhook rejected: invalid Twilio signature");
    res.status(403).send("<Response/>");
    return;
  }

  const body = req.body as Record<string, string>;
  const from = body.From ?? body.from ?? "";
  const text = (body.Body ?? body.body ?? "").trim();
  const channel = from.startsWith("whatsapp:") ? "whatsapp" : "sms";
  const sid = body.MessageSid ?? body.SmsSid ?? `twilio_${Date.now()}`;
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;

  const result = await conversationRouter.processInboundMessage({
    from,
    channel,
    text,
    messageId: sid,
    raw: body,
    ip,
  });

  if (!result.handled) {
    logger.warn({ sid, channel }, "Twilio inbound webhook unhandled or locked; requesting retry with 503");
    res.status(503).send("<Response/>");
    return;
  }

  res.status(200).send("<Response/>");
});

// ─── Delivery Receipt Webhook ─────────────────────────────────────────────────

router.post("/webhooks/comm-delivery", async (req, res) => {
  if (req.headers["x-hub-signature-256"] || (req.body && req.body.object === "whatsapp_business_account")) {
    await handleMetaWebhook(req, res);
    return;
  }
  if (!verifyTwilioSignature(req)) {
    logger.warn("Delivery webhook rejected: invalid Twilio signature");
    res.status(403).send("<Response/>");
    return;
  }

  const body = req.body as Record<string, string>;
  const sid = body.MessageSid ?? body.SmsSid ?? "";
  const status = body.MessageStatus ?? body.SmsStatus ?? "";

  if (sid) {
    const statusMap: Record<string, string> = {
      sent: "sent", delivered: "delivered", read: "read",
      failed: "failed", undelivered: "failed",
    };
    const mapped = statusMap[status] ?? status;

    const [current] = await db
      .select({ deliveryStatus: commLogsTable.deliveryStatus })
      .from(commLogsTable)
      .where(eq(commLogsTable.metaMessageId, sid))
      .limit(1);

    if (current) {
      const currentRank = STATUS_RANK[current.deliveryStatus] ?? 0;
      const newRank = STATUS_RANK[mapped] ?? 0;
      if (newRank >= currentRank || mapped === "failed") {
        const updateData: {
          deliveryStatus: string;
          deliveryUpdatedAt: Date;
          errorMessage?: string | null;
        } = {
          deliveryStatus: mapped,
          deliveryUpdatedAt: new Date(),
        };
        const twilioErr = body.ErrorMessage ?? body.errorMessage ?? (body.ErrorCode ? `Twilio Error ${body.ErrorCode}` : null);
        if (mapped === "failed" && twilioErr) {
          updateData.errorMessage = twilioErr;
        }
        await db.update(commLogsTable).set(updateData).where(eq(commLogsTable.metaMessageId, sid));
      }
    }
  }

  res.status(200).send("<Response/>");
});

// ─── Meta WhatsApp Quality Webhook ────────────────────────────────────────────

// NOTE: This endpoint validates using Twilio's X-Twilio-Signature header.
// Meta can deliver quality webhook events either directly (in which case
// Twilio-style validation will reject them) or via a Twilio integration.
// In production, confirm the delivery path and update this verification
// strategy (e.g. validate Meta's X-Hub-Signature-256 header) if needed.
router.post("/webhooks/wa-quality", async (req, res) => {
  const isMeta = Boolean(req.headers["x-hub-signature-256"]);
  const isTwilio = Boolean(req.headers["x-twilio-signature"]);

  let authorized = false;
  if (isMeta) {
    const isMetaDirect = resolveWhatsAppProviderId() === "meta_direct";
    const verifier = isMetaDirect ? metaDirectProvider : kvTechMediaProvider;
    authorized = verifier.verifyWebhookSignature(req);
  } else if (isTwilio) {
    authorized = verifyTwilioSignature(req);
  } else {
    if (process.env.NODE_ENV === "production") {
      logger.warn("wa-quality webhook rejected: unsigned webhook in production (failing closed)");
      res.status(403).json({ error: "Unauthorized: Missing webhook signature" });
      return;
    }
    authorized = true;
  }

  if (!authorized) {
    logger.warn("wa-quality webhook rejected: invalid signature");
    res.status(403).json({ error: "Unauthorized" });
    return;
  }
  const raw = JSON.stringify(req.body);
  const body = req.body as Record<string, unknown>;

  await db.insert(waQualityLogTable).values({
    eventType: String(body.event_type ?? (body.entry ? "meta_event" : "unknown")),
    phoneNumber: String(body.phone_number ?? ""),
    qualityRating: String(body.quality_rating ?? ""),
    templateName: String(body.template_name ?? ""),
    templateStatus: String(body.template_status ?? ""),
    rawPayload: raw,
  });

  // Sync template status into the admin template registry when Meta reports a change
  if (body.event_type === "template_status_update" && body.template_name && body.template_status) {
    const statusMap: Record<string, string> = { APPROVED: "approved", REJECTED: "rejected", PAUSED: "paused" };
    const newStatus = statusMap[String(body.template_status)] ?? "approved";
    await db.update(waTemplatesTable)
      .set({ status: newStatus })
      .where(eq(waTemplatesTable.templateName, String(body.template_name)));
  }

  res.status(200).json({ success: true });
});

export default router;
