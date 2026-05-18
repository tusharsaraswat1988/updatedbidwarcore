/**
 * Communication sender — WhatsApp (via Twilio) and SMS (via BulkSMS Gateway).
 *
 * SMS requires the following env secrets:
 *   BULKSMS_PASSWORD  — account password for bulksmsgateway.in (user is hardcoded: bidwarsms)
 *   BULKSMS_SENDER    — approved sender ID (e.g. INVITE, BIDWAR)
 *   BULKSMS_TEMPLATE_ID — DLT-registered template ID (required by TRAI for transactional SMS)
 *
 * WhatsApp requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and
 * TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+14155238886").
 *
 * When credentials are absent the functions resolve with a stub result so
 * the rest of the system (consent flow, scheduler, API routes) works in
 * development/demo mode.
 */

import { logger } from "./logger";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type SendResult = {
  success: boolean;
  messageSid?: string;
  error?: string;
  stub?: boolean;
};

// ─── BulkSMS Gateway ──────────────────────────────────────────────────────────

const BULKSMS_USER = "bidwarsms";
const BULKSMS_API  = "http://api.bulksmsgateway.in/sendmessage.php";

/**
 * Apply the character substitutions required by BulkSMS Gateway for message bodies.
 * Per their API spec: & → Jg==   + → Kw==   # → Iw==
 */
function encodeBulkSmsMessage(msg: string): string {
  return msg.replace(/&/g, "Jg==").replace(/\+/g, "Kw==").replace(/#/g, "Iw==");
}

/** Normalise a mobile number for BulkSMS (digits only, 91XXXXXXXXXX for India). */
function toBulkSmsMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Send an SMS via BulkSMS Gateway (bulksmsgateway.in). */
async function sendBulkSms(to: string, body: string): Promise<SendResult> {
  const password   = process.env.BULKSMS_PASSWORD;
  const sender     = process.env.BULKSMS_SENDER;
  const templateId = process.env.BULKSMS_TEMPLATE_ID ?? "";

  if (!password || !sender) {
    logger.warn({ to }, "BulkSMS not configured (BULKSMS_PASSWORD / BULKSMS_SENDER missing) — stub mode");
    return { success: true, stub: true, messageSid: `stub_sms_${Date.now()}` };
  }

  const mobile = toBulkSmsMobile(to);
  const params = new URLSearchParams({
    user:        BULKSMS_USER,
    password,
    mobile,
    message:     encodeBulkSmsMessage(body),
    sender,
    type:        "3",
    template_id: templateId,
  });

  const url = `${BULKSMS_API}?${params.toString()}`;

  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const text = (await res.text()).trim();

    // BulkSMS Gateway returns a positive numeric message ID on success,
    // or a descriptive error string on failure.
    const isSuccess = /^\d+$/.test(text) && parseInt(text, 10) > 0;

    if (isSuccess) {
      logger.info({ mobile, msgId: text }, "BulkSMS sent");
      return { success: true, messageSid: text };
    }

    logger.error({ mobile, response: text }, "BulkSMS send failed");
    return { success: false, error: text };
  } catch (err) {
    logger.error({ mobile, err }, "BulkSMS send exception");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Send an SMS via BulkSMS Gateway. All callers unchanged — signature is identical. */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  return sendBulkSms(to, body);
}

// ─── Twilio helpers (WhatsApp only) ───────────────────────────────────────────

function toE164(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+91${digits.slice(1)}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function twilioBasicAuth(): string | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

/** Send a WhatsApp message via Twilio.
 *
 * STOP footer: WhatsApp Business messaging policy requires every business-initiated
 * message to include an opt-out instruction. This function appends
 * "Reply STOP to unsubscribe" unless the body already contains "STOP".
 */
export async function sendWhatsApp(
  to: string,
  body: string,
  templateSid?: string,
): Promise<SendResult> {
  // Append STOP footer if not already present (WhatsApp Business compliance)
  const STOP_FOOTER = "\n\nReply STOP to unsubscribe.";
  const finalBody = body.toUpperCase().includes("STOP") ? body : body + STOP_FOOTER;

  const auth = twilioBasicAuth();
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!auth || !from) {
    logger.warn({ to }, "WhatsApp not configured — stub mode");
    return { success: true, stub: true, messageSid: `stub_wa_${Date.now()}` };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const e164 = toE164(to);
  try {
    const params: Record<string, string> = {
      To: `whatsapp:${e164}`,
      From: from,
      Body: finalBody,
    };
    if (templateSid) params["ContentSid"] = templateSid;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
    const data = await res.json() as { sid?: string; error_message?: string };
    if (!res.ok) {
      logger.error({ to, status: res.status, err: data.error_message }, "WhatsApp send failed");
      return { success: false, error: data.error_message ?? "WhatsApp failed" };
    }
    return { success: true, messageSid: data.sid };
  } catch (err) {
    logger.error({ to, err }, "WhatsApp send exception");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Send a WhatsApp message ONLY when the tournament has an active (licensed) + unlocked status.
 * Falls back silently to SMS when the tournament is not licensed or no tournament context exists.
 * This is the single centralized entry point for ALL outbound WhatsApp in bot/scheduler flows.
 */
export async function sendLicensedWhatsApp(
  tournamentId: number | null | undefined,
  to: string,
  body: string,
  templateSid?: string,
): Promise<SendResult & { blocked?: boolean }> {
  if (tournamentId) {
    const [t] = await db
      .select({ licenseStatus: tournamentsTable.licenseStatus, adminLocked: tournamentsTable.adminLocked })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId));
    if (t && t.licenseStatus === "active" && !t.adminLocked) {
      return sendWhatsApp(to, body, templateSid);
    }
  }
  // Not licensed or no tournament context — explicit SMS fallback.
  // Logged at info level so operators can see the channel switch in production.
  logger.info({ tournamentId: tournamentId ?? null, to }, "sendLicensedWhatsApp: WA not licensed, falling back to SMS");
  const smsMobile = to.replace(/^whatsapp:/i, "").replace(/^\+/, "");
  const smsResult = await sendSms(smsMobile, body);
  return { ...smsResult, blocked: true };
}

/** Build the wa.me consent opt-in link for a given consent token. */
export function buildWaMeLink(token: string): string {
  const encoded = encodeURIComponent(`OPTIN ${token}`);
  const waNumber = (process.env.TWILIO_WHATSAPP_FROM ?? "").replace("whatsapp:", "").replace("+", "");
  if (!waNumber) return `https://wa.me/?text=${encoded}`;
  return `https://wa.me/${waNumber}?text=${encoded}`;
}

/** Consent SMS copy — sent 24h before auction. */
export function buildConsentSms(tournamentName: string, waLink: string): string {
  return `BidWar: ${tournamentName} auction kal hoga. WhatsApp updates ke liye click karein: ${waLink} — Reply STOP to opt out.`;
}
