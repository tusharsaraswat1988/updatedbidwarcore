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
} from "@workspace/db";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { sendSms, sendWhatsApp } from "../lib/comm-sender";
import { logger } from "../lib/logger";
import { randomBytes, scrypt, timingSafeEqual, createHmac } from "crypto";
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
function verifyTwilioSignature(req: import("express").Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // stub mode: skip verification

  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) return false;

  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "";
  const url = `${proto}://${host}${req.originalUrl}`;

  const body = req.body as Record<string, string>;
  const params = Object.keys(body).sort().reduce((acc, key) => acc + key + (body[key] ?? ""), "");
  const str = url + params;

  const expected = createHmac("sha1", authToken).update(str).digest("base64");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

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

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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

// ─── Inbound WhatsApp / SMS ───────────────────────────────────────────────────

router.post("/webhooks/comm-inbound", async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    logger.warn("Inbound webhook rejected: invalid Twilio signature");
    res.status(403).send("<Response/>");
    return;
  }

  const body = req.body as Record<string, string>;
  const from = body.From ?? body.from ?? "";
  const text = (body.Body ?? body.body ?? "").trim();
  const channel = from.startsWith("whatsapp:") ? "whatsapp" : "sms";
  const mobile = from.replace("whatsapp:", "").replace("+", "");

  logger.info({ from, text, channel }, "Inbound comm message");

  const upper = text.toUpperCase();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;

  // STOP — opt-out
  if (upper === "STOP" || upper === "UNSUBSCRIBE") {
    const target = await findConsentTarget(mobile);
    if (target) {
      await setConsentRevoked(target.type, target.id);
      await logConsentEvent(target, mobile, "STOP: WhatsApp consent revoked");
      await sendWhatsApp(from, "Aap BidWar WhatsApp updates se unsubscribe ho gaye hain. SMS pe updates milte rahenge. Wapas subscribe karne ke liye 'hello' bhejein.");
    }
    res.status(200).send("<Response/>");
    return;
  }

  // OTP reply — check pending OTP sessions
  if (/^\d{6}$/.test(upper)) {
    const sessions = await db.select().from(otpSessionsTable)
      .where(and(
        or(eq(otpSessionsTable.mobile, mobile), eq(otpSessionsTable.mobile, `+${mobile}`)),
        eq(otpSessionsTable.used, false),
        sql`${otpSessionsTable.expiresAt} > now()`,
      ))
      .orderBy(desc(otpSessionsTable.createdAt))
      .limit(1);

    if (sessions.length > 0) {
      const session = sessions[0];
      const valid = await verifyOtp(upper, session.otpHash);
      if (valid) {
        await db.update(otpSessionsTable).set({ used: true }).where(eq(otpSessionsTable.id, session.id));
        const target = await findConsentTarget(mobile);
        if (target) {
          await setConsentGranted(target.type, target.id, ip);
          await logConsentEvent(target, mobile, "OTP verified: WhatsApp consent granted (whatsapp_otp_verified)");
          await sendWhatsApp(from, `Shukriya ${target.name}! Aap BidWar WhatsApp notifications ke liye successfully subscribed hain. Tournament updates milenge. STOP bhejein unsubscribe ke liye.`);
        } else {
          await sendWhatsApp(from, "Identity verify ho gayi. BidWar updates shuru ho jayenge.");
        }
      } else {
        await sendWhatsApp(from, "Galat OTP. Dobara koshish karein ya nayi request ke liye 'hello' bhejein.");
      }
      res.status(200).send("<Response/>");
      return;
    }
  }

  // OPTIN TOKEN or YES (from consent question) — record explicit YES before OTP step
  if (upper.startsWith("OPTIN ") || upper === "YES" || upper === "HA" || upper === "HAN") {
    let tokenStr: string | null = null;
    if (upper.startsWith("OPTIN ")) tokenStr = text.slice(6).trim();

    const target = await findConsentTarget(mobile);
    if (!target) {
      await sendWhatsApp(from, "Aapka mobile number BidWar mein registered nahi hai. Kripya tournament organizer se contact karein.");
      res.status(200).send("<Response/>"); return;
    }

    // Mark consent token used if provided
    if (tokenStr) {
      await db.update(consentTokensTable).set({ used: true }).where(eq(consentTokensTable.token, tokenStr));
    }

    // ── Record the explicit YES as a separate audit event before proceeding to OTP ──
    await logConsentEvent(
      target,
      mobile,
      `Explicit YES consent received via WhatsApp (pending OTP verification). Token: ${tokenStr ?? "none"}`,
    );

    // Step 2: send OTP for identity verification
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await db.insert(otpSessionsTable).values({ mobile: mobile, otpHash, purpose: "wa_consent", expiresAt });

    await sendSms(`+${mobile}`, `BidWar OTP: ${otp} — WhatsApp consent verify karne ke liye use karein. 10 min valid.`);
    await sendWhatsApp(from, `Shukriya ${target.name}! Consent ke liye dhanyawaad.\n\nAapki identity confirm karne ke liye aapke registered number pe SMS OTP bheja ja raha hai.\n\nOTP aane ke baad WhatsApp pe reply karein.`);

    res.status(200).send("<Response/>"); return;
  }

  // Hello / Hi — greet + ask for consent
  if (upper === "HELLO" || upper === "HI" || upper === "NAMASTE") {
    const target = await findConsentTarget(mobile);
    if (!target) {
      await sendWhatsApp(from, "Namaste! Main BidWar bot hun. Aapka number hamare system mein registered nahi hai. Kripya bidwar.in pe jaayein aur register karein.");
      res.status(200).send("<Response/>"); return;
    }

    await sendWhatsApp(from,
      `Namaste ${target.name}!\n\nKya aap BidWar se match updates, auction alerts aur tournament notifications WhatsApp pe paana chahte hain?\n\nHan ke liye "YES" bhejein\nNa ke liye "NO" bhejein`
    );
    res.status(200).send("<Response/>"); return;
  }

  // NO — declined
  if (upper === "NO" || upper === "NAHI" || upper === "NAA") {
    await sendWhatsApp(from, "Samajh gaye. Aap SMS pe updates paate rahenge. WhatsApp pe subscribe karne ke liye 'hello' bhejein.");
    res.status(200).send("<Response/>"); return;
  }

  // DATA / REPORT — personalized data (requires confirmed WhatsApp consent)
  if (upper === "DATA" || upper === "REPORT" || upper === "MERI TEAM" || upper === "MY TEAM") {
    const target = await findConsentTarget(mobile);
    if (!target) {
      await sendWhatsApp(from, "Aapka number BidWar mein registered nahi hai. bidwar.in pe jaayein.");
      res.status(200).send("<Response/>"); return;
    }

    // Consent gate: only respond with personal data after WhatsApp consent is confirmed
    let hasConsent = false;
    if (target.type === "player") {
      const [p] = await db.select({ whatsappConsent: playersTable.whatsappConsent }).from(playersTable).where(eq(playersTable.id, target.id));
      hasConsent = p?.whatsappConsent ?? false;
    } else if (target.type === "team_owner") {
      const [tm] = await db.select({ whatsappConsent: teamsTable.whatsappConsent }).from(teamsTable).where(eq(teamsTable.id, target.id));
      hasConsent = tm?.whatsappConsent ?? false;
    } else if (target.type === "organizer") {
      const [o] = await db.select({ whatsappConsent: organizersTable.whatsappConsent }).from(organizersTable).where(eq(organizersTable.id, target.id));
      hasConsent = o?.whatsappConsent ?? false;
    }
    if (!hasConsent) {
      await sendWhatsApp(from, "Pehle WhatsApp notifications ke liye subscribe karein. 'hello' bhejein aur YES select karein.");
      res.status(200).send("<Response/>"); return;
    }

    // Build personalized summary
    let summary = "";
    if (target.type === "player") {
      const [p] = await db.select({
        name: playersTable.name, role: playersTable.role,
        status: playersTable.status, basePrice: playersTable.basePrice,
        soldPrice: playersTable.soldPrice,
      }).from(playersTable).where(eq(playersTable.id, target.id));
      const tname = target.tournamentId
        ? (await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, target.tournamentId)))[0]?.name ?? ""
        : "";
      const statusMap: Record<string, string> = { available: "Available", sold: "Sold", unsold: "Unsold", retained: "Retained" };
      summary = [
        `Khiladi: ${p?.name ?? target.name}`,
        `Role: ${p?.role ?? "-"}`,
        `Tournament: ${tname}`,
        `Status: ${statusMap[p?.status ?? ""] ?? p?.status ?? "-"}`,
        p?.soldPrice ? `Sold price: ₹${p.soldPrice.toLocaleString("en-IN")}` : `Base price: ₹${(p?.basePrice ?? 0).toLocaleString("en-IN")}`,
      ].join("\n");
    } else if (target.type === "team_owner") {
      const [tm] = await db.select({
        name: teamsTable.name, ownerName: teamsTable.ownerName,
        purse: teamsTable.purse, purseUsed: teamsTable.purseUsed,
      }).from(teamsTable).where(eq(teamsTable.id, target.id));
      const tname = target.tournamentId
        ? (await db.select({ name: tournamentsTable.name }).from(tournamentsTable).where(eq(tournamentsTable.id, target.tournamentId)))[0]?.name ?? ""
        : "";
      const remaining = (tm?.purse ?? 0) - (tm?.purseUsed ?? 0);
      summary = [
        `Team: ${tm?.name ?? target.name}`,
        `Owner: ${tm?.ownerName ?? "-"}`,
        `Tournament: ${tname}`,
        `Purse remaining: ₹${remaining.toLocaleString("en-IN")}`,
        `Purse used: ₹${(tm?.purseUsed ?? 0).toLocaleString("en-IN")}`,
      ].join("\n");
    } else if (target.type === "organizer") {
      const [o] = await db.select({ name: organizersTable.name, mobile: organizersTable.mobile })
        .from(organizersTable).where(eq(organizersTable.id, target.id));
      const tcount = (await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.organizerId, target.id))).length;
      summary = [`Organizer: ${o?.name ?? target.name}`, `Tournaments: ${tcount}`].join("\n");
    }

    await sendWhatsApp(from, `BidWar aapki jankari:\n\n${summary}\n\nDetails ke liye apne tournament portal pe jaayein.`);
    res.status(200).send("<Response/>"); return;
  }

  // Unknown
  await sendWhatsApp(from, "BidWar bot:\n'hello' — subscribe karo\n'data' — apni info dekho\n'STOP' — unsubscribe karo");
  res.status(200).send("<Response/>");
});

// ─── Delivery Receipt Webhook ─────────────────────────────────────────────────

router.post("/webhooks/comm-delivery", async (req, res) => {
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
    await db.update(commLogsTable).set({ deliveryStatus: mapped, deliveryUpdatedAt: new Date() }).where(eq(commLogsTable.metaMessageId, sid));
  }

  res.status(200).send("<Response/>");
});

// ─── Meta WhatsApp Quality Webhook ────────────────────────────────────────────

router.post("/webhooks/wa-quality", async (req, res) => {
  if (!verifyTwilioSignature(req)) {
    logger.warn("wa-quality webhook rejected: invalid Twilio signature");
    res.status(403).json({ error: "Unauthorized" });
    return;
  }
  const raw = JSON.stringify(req.body);
  const body = req.body as Record<string, unknown>;

  await db.insert(waQualityLogTable).values({
    eventType: String(body.event_type ?? body.entry ? "meta_event" : "unknown"),
    phoneNumber: String(body.phone_number ?? ""),
    qualityRating: String(body.quality_rating ?? ""),
    templateName: String(body.template_name ?? ""),
    templateStatus: String(body.template_status ?? ""),
    rawPayload: raw,
  });

  res.status(200).json({ success: true });
});

export default router;
