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

// Return ALL player/team records matching the mobile across all tournaments.
// Used by the DATA/REPORT command to enable tournament disambiguation.
type ConsentTarget = { type: "player" | "team_owner" | "organizer"; id: number; name: string; tournamentId?: number; tournamentName?: string };

// Returns true if the tournament is licensed for outbound WhatsApp sends.
// Used to gate ALL outbound WA messages (admin sends, scheduler, and bot replies).
async function isTournamentWaLicensed(tournamentId: number | null | undefined): Promise<boolean> {
  if (!tournamentId) return false;
  const [t] = await db
    .select({ licenseStatus: tournamentsTable.licenseStatus, adminLocked: tournamentsTable.adminLocked })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!t) return false;
  return t.licenseStatus === "live" && t.adminLocked !== true;
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

  // Short numeric reply — check for pending bot session (tournament disambiguation)
  if (/^\d{1,2}$/.test(upper.trim())) {
    const [sess] = await db.select().from(botSessionsTable)
      .where(and(eq(botSessionsTable.mobile, mobile), gt(botSessionsTable.expiresAt, new Date())));
    if (sess?.pendingAction === "disambiguate_tournament") {
      const choice = parseInt(upper.trim());
      const options = JSON.parse(sess.pendingData ?? "[]") as ConsentTarget[];
      const selected = options[choice - 1];
      if (selected) {
        await db.delete(botSessionsTable).where(eq(botSessionsTable.mobile, mobile));
        const summary = await buildPersonalizedSummary(selected);
        await sendWhatsApp(from, `BidWar aapki jankari:\n\n${summary}\n\nDetails ke liye apne tournament portal pe jaayein.`);
      } else {
        await sendWhatsApp(from, `Invalid choice. 1 se ${options.length} ke beech mein reply karein. Ya 'data' dobara bhejein.`);
      }
      res.status(200).send("<Response/>"); return;
    }
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
          await db.insert(waConsentEventsTable).values({
            mobile,
            recipientType: target.type,
            recipientId: target.id,
            tournamentId: target.tournamentId ?? null,
            eventType: "otp_verified",
            ip,
          });
          await logConsentEvent(target, mobile, "OTP verified: WhatsApp consent granted (whatsapp_otp_verified)");
          // License gate: only send WA confirmation if tournament is licensed; else SMS fallback
          const okWa = await isTournamentWaLicensed(target.tournamentId);
          if (okWa) {
            await sendWhatsApp(from, `Shukriya ${target.name}! Aap BidWar WhatsApp notifications ke liye successfully subscribed hain. Tournament updates milenge. STOP bhejein unsubscribe ke liye.`);
          } else {
            await sendSms(`+${mobile}`, `BidWar: Aapka consent record ho gaya hai. Tournament license activate hone ke baad WhatsApp updates shuru ho jayenge.`);
          }
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

  // OPTIN TOKEN — first step: show consent question and save token in bot session.
  // Do NOT immediately record YES or send OTP; wait for explicit YES/NO reply.
  if (upper.startsWith("OPTIN ")) {
    const tokenStr = text.slice(6).trim();
    const target = await findConsentTarget(mobile);
    if (!target) {
      await sendWhatsApp(from, "Aapka mobile number BidWar mein registered nahi hai. Kripya tournament organizer se contact karein.");
      res.status(200).send("<Response/>"); return;
    }

    // License gate: tournament must be WA-licensed before initiating consent flow
    if (!(await isTournamentWaLicensed(target.tournamentId))) {
      await sendSms(`+${mobile}`, `BidWar: Tournament abhi WhatsApp ke liye licensed nahi hai. SMS pe updates milte rahenge.`);
      res.status(200).send("<Response/>"); return;
    }

    // Save OPTIN token in bot session so the YES handler can use it
    await db.insert(botSessionsTable).values({
      mobile,
      pendingAction: "pending_yes",
      pendingData: tokenStr,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min window
    }).onConflictDoUpdate({
      target: botSessionsTable.mobile,
      set: { pendingAction: "pending_yes", pendingData: tokenStr, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    await sendWhatsApp(from,
      `Namaste ${target.name}!\n\nKya aap BidWar se match updates, auction alerts aur tournament notifications WhatsApp pe paana chahte hain?\n\nHan ke liye "YES" bhejein\nNa ke liye "NO" bhejein`
    );
    res.status(200).send("<Response/>"); return;
  }

  // YES (explicit consent reply to consent question) — record YES event then send OTP.
  if (upper === "YES" || upper === "HA" || upper === "HAN") {
    const target = await findConsentTarget(mobile);
    if (!target) {
      await sendWhatsApp(from, "Aapka mobile number BidWar mein registered nahi hai. Kripya tournament organizer se contact karein.");
      res.status(200).send("<Response/>"); return;
    }

    // Retrieve stored OPTIN token (if any) from pending bot session
    const now = new Date();
    const [session] = await db.select()
      .from(botSessionsTable)
      .where(and(
        eq(botSessionsTable.mobile, mobile),
        eq(botSessionsTable.pendingAction, "pending_yes"),
        gt(botSessionsTable.expiresAt, now),
      ));
    const tokenStr = session?.pendingData ?? null;

    // Clear the pending bot session
    await db.delete(botSessionsTable).where(eq(botSessionsTable.mobile, mobile));

    // Mark consent token used if present
    if (tokenStr) {
      await db.update(consentTokensTable).set({ used: true }).where(eq(consentTokensTable.token, tokenStr));
    }

    // Persist the explicit YES consent event with question version
    await db.insert(waConsentEventsTable).values({
      mobile,
      recipientType: target.type,
      recipientId: target.id,
      tournamentId: target.tournamentId ?? null,
      eventType: "yes_received",
      questionVersion: CONSENT_QUESTION_V1,
      tokenUsed: tokenStr ?? null,
    });
    await logConsentEvent(
      target,
      mobile,
      `Explicit YES consent received via WhatsApp (pending OTP verification). Token: ${tokenStr ?? "none"}`,
    );

    // Step 2: send OTP for identity verification
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await db.insert(otpSessionsTable).values({ mobile, otpHash, purpose: "wa_consent", expiresAt });

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

    // License gate: tournament must be WA-licensed before initiating consent flow
    if (!(await isTournamentWaLicensed(target.tournamentId))) {
      await sendSms(`+${mobile}`, `BidWar: Tournament abhi WhatsApp ke liye licensed nahi hai. SMS pe updates milte rahenge.`);
      res.status(200).send("<Response/>"); return;
    }

    await sendWhatsApp(from,
      `Namaste ${target.name}!\n\nKya aap BidWar se match updates, auction alerts aur tournament notifications WhatsApp pe paana chahte hain?\n\nHan ke liye "YES" bhejein\nNa ke liye "NO" bhejein`
    );
    res.status(200).send("<Response/>"); return;
  }

  // NO — declined
  if (upper === "NO" || upper === "NAHI" || upper === "NAA") {
    const target = await findConsentTarget(mobile);
    if (target) {
      await db.insert(waConsentEventsTable).values({
        mobile,
        recipientType: target.type,
        recipientId: target.id,
        tournamentId: target.tournamentId ?? null,
        eventType: "declined",
        questionVersion: CONSENT_QUESTION_V1,
      });
    }
    await sendWhatsApp(from, "Samajh gaye. Aap SMS pe updates paate rahenge. WhatsApp pe subscribe karne ke liye 'hello' bhejein.");
    res.status(200).send("<Response/>"); return;
  }

  // DATA / REPORT — personalized data (requires confirmed WhatsApp consent)
  if (upper === "DATA" || upper === "REPORT" || upper === "MERI TEAM" || upper === "MY TEAM") {
    const allTargets = await findAllConsentTargets(mobile);
    if (allTargets.length === 0) {
      await sendWhatsApp(from, "Aapka number BidWar mein registered nahi hai. bidwar.in pe jaayein.");
      res.status(200).send("<Response/>"); return;
    }

    // Consent gate: find the first target with confirmed consent
    let consentedTarget: ConsentTarget | null = null;
    for (const t of allTargets) {
      let hasConsent = false;
      if (t.type === "player") {
        const [p] = await db.select({ whatsappConsent: playersTable.whatsappConsent }).from(playersTable).where(eq(playersTable.id, t.id));
        hasConsent = p?.whatsappConsent ?? false;
      } else if (t.type === "team_owner") {
        const [tm] = await db.select({ whatsappConsent: teamsTable.whatsappConsent }).from(teamsTable).where(eq(teamsTable.id, t.id));
        hasConsent = tm?.whatsappConsent ?? false;
      } else if (t.type === "organizer") {
        const [o] = await db.select({ whatsappConsent: organizersTable.whatsappConsent }).from(organizersTable).where(eq(organizersTable.id, t.id));
        hasConsent = o?.whatsappConsent ?? false;
      }
      if (hasConsent) { consentedTarget = t; break; }
    }
    if (!consentedTarget) {
      await sendWhatsApp(from, "Pehle WhatsApp notifications ke liye subscribe karein. 'hello' bhejein aur YES select karein.");
      res.status(200).send("<Response/>"); return;
    }

    // Multi-tournament: if more than one tournament-scoped record, ask which one
    const tournamentTargets = allTargets.filter(t => t.tournamentId);
    if (tournamentTargets.length > 1) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-min window
      await db.insert(botSessionsTable)
        .values({ mobile, pendingAction: "disambiguate_tournament", pendingData: JSON.stringify(tournamentTargets), expiresAt })
        .onConflictDoUpdate({ target: botSessionsTable.mobile, set: { pendingAction: "disambiguate_tournament", pendingData: JSON.stringify(tournamentTargets), expiresAt } });
      const choices = tournamentTargets.map((t, i) =>
        `${i + 1}. ${t.tournamentName ?? "Tournament " + t.tournamentId} (${t.type === "player" ? "Khiladi" : "Team"})`
      ).join("\n");
      await sendWhatsApp(from, `Aap kai tournaments mein hain. Kaunsa?\n\n${choices}\n\nSirf number bhejein (1, 2 ...)`);
    } else {
      // Single match — return data directly
      const summary = await buildPersonalizedSummary(tournamentTargets[0] ?? consentedTarget);
      await sendWhatsApp(from, `BidWar aapki jankari:\n\n${summary}\n\nDetails ke liye apne tournament portal pe jaayein.`);
    }
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
