/**
 * Inbound webhook routes:
 * - POST /webhooks/comm-inbound   — WhatsApp/SMS inbound (consent bot, STOP, data queries)
 * - POST /webhooks/comm-delivery  — Twilio delivery receipts → comm_logs update
 * - POST /webhooks/wa-quality     — Meta quality rating events → wa_quality_log
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  organizersTable,
  otpSessionsTable,
  commLogsTable,
  waQualityLogTable,
  consentTokensTable,
} from "@workspace/db";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { z } from "zod";
import { sendSms, sendWhatsApp, buildWaMeLink } from "../lib/comm-sender";
import { logger } from "../lib/logger";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const router = Router();

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

  // Players
  const players = await db.select({ id: playersTable.id, name: playersTable.name, tournamentId: playersTable.tournamentId })
    .from(playersTable)
    .where(or(eq(playersTable.mobileNumber, mobile), eq(playersTable.mobileNumber, norm), sql`regexp_replace(${playersTable.mobileNumber}, '\\D', '', 'g') = ${norm}`))
    .limit(1);
  if (players.length > 0) return { type: "player", id: players[0].id, name: players[0].name, tournamentId: players[0].tournamentId };

  // Teams (owner mobile)
  const teams = await db.select({ id: teamsTable.id, name: teamsTable.name, tournamentId: teamsTable.tournamentId })
    .from(teamsTable)
    .where(or(eq(teamsTable.ownerMobile, mobile), eq(teamsTable.ownerMobile, norm), sql`regexp_replace(${teamsTable.ownerMobile}, '\\D', '', 'g') = ${norm}`))
    .limit(1);
  if (teams.length > 0) return { type: "team_owner", id: teams[0].id, name: teams[0].name, tournamentId: teams[0].tournamentId };

  // Organizers
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

// ─── Inbound WhatsApp / SMS ───────────────────────────────────────────────────

router.post("/webhooks/comm-inbound", async (req, res) => {
  // Twilio sends form-encoded body
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

  // OPTIN TOKEN or YES (from consent question)
  if (upper.startsWith("OPTIN ") || upper === "YES" || upper === "HA" || upper === "HAN") {
    let tokenStr: string | null = null;
    if (upper.startsWith("OPTIN ")) tokenStr = text.slice(6).trim();

    // Find the person
    const target = await findConsentTarget(mobile);
    if (!target) {
      await sendWhatsApp(from, "Aapka mobile number BidWar mein registered nahi hai. Kripya tournament organizer se contact karein.");
      res.status(200).send("<Response/>"); return;
    }

    // Mark consent token used if provided
    if (tokenStr) {
      await db.update(consentTokensTable).set({ used: true }).where(eq(consentTokensTable.token, tokenStr));
    }

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

  // DATA / REPORT — personalized data
  if (upper === "DATA" || upper === "REPORT" || upper === "MERI TEAM" || upper === "MY TEAM") {
    const target = await findConsentTarget(mobile);
    if (!target) {
      await sendWhatsApp(from, "Aapka number BidWar mein registered nahi hai. bidwar.in pe jaayein.");
      res.status(200).send("<Response/>"); return;
    }
    await sendWhatsApp(from, `Aapki BidWar information:\nType: ${target.type}\nID: ${target.id}\n\nDetailed report ke liye organizer se contact karein.`);
    res.status(200).send("<Response/>"); return;
  }

  // Unknown
  await sendWhatsApp(from, "BidWar bot:\n'hello' — subscribe karo\n'data' — apni info dekho\n'STOP' — unsubscribe karo");
  res.status(200).send("<Response/>");
});

// ─── Delivery Receipt Webhook ─────────────────────────────────────────────────

router.post("/webhooks/comm-delivery", async (req, res) => {
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
