/**
 * Communication sender — WhatsApp (via Twilio) and SMS.
 *
 * Real sending requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and
 * TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+14155238886") to be configured.
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

/** Send an SMS via Twilio Programmable Messaging. */
export async function sendSms(
  to: string,
  body: string,
): Promise<SendResult> {
  const auth = twilioBasicAuth();
  const from = process.env.TWILIO_SMS_FROM;
  if (!auth || !from) {
    logger.warn({ to }, "SMS not configured — stub mode");
    return { success: true, stub: true, messageSid: `stub_sms_${Date.now()}` };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const e164 = toE164(to);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: from, Body: body }).toString(),
    });
    const data = await res.json() as { sid?: string; error_message?: string; message?: string };
    if (!res.ok) {
      logger.error({ to, status: res.status, err: data.error_message }, "SMS send failed");
      return { success: false, error: data.error_message ?? "SMS failed" };
    }
    return { success: true, messageSid: data.sid };
  } catch (err) {
    logger.error({ to, err }, "SMS send exception");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
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
  // Not licensed or no tournament context — fall back to SMS
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
