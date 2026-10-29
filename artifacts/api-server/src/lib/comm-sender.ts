/**
 * Communication sender — WhatsApp (via KV TechMedia or Twilio) and SMS (via BulkSMS Gateway).
 *
 * WhatsApp Provider Selection:
 *   WHATSAPP_PROVIDER = "kv_techmedia" | "twilio"
 *
 * KV TechMedia requires:
 *   KV_META_BASE_URL (default: https://crmapi.kvtmedia.com/api/meta)
 *   KV_META_API_VERSION (default: v19.0)
 *   KV_META_PHONE_NUMBER_ID
 *   KV_META_ACCESS_TOKEN
 *   KV_META_APP_SECRET
 *   KV_WEBHOOK_VERIFY_TOKEN
 *
 * Twilio requires:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *
 * SMS requires:
 *   BULKSMS_KEY or BULKSMS_PASSWORD, BULKSMS_SENDER, BULKSMS_TEMPLATE_ID
 */

import { logger, maskPhoneNumber } from "./logger";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getActiveWhatsAppProvider, resolveWhatsAppProviderId } from "./communication/providers";
import { resolveTournamentFeatures } from "@workspace/platform-core/tournament-features";

export type SendResult = {
  success: boolean;
  messageSid?: string;
  error?: string;
  stub?: boolean;
  blocked?: boolean;
};

// ─── Provider Resolution ──────────────────────────────────────────────────────

export function resolveWhatsAppProvider(): "kv_techmedia" | "twilio" | "meta_direct" | "mock" | "none" {
  return resolveWhatsAppProviderId();
}

function _unusedLegacyResolve(): "kv_techmedia" | "twilio" | "none" {
  const configured = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase().trim();
  if (configured === "kv_techmedia" || configured === "kvtmedia" || configured === "kv") {
    return "kv_techmedia";
  }
  if (configured === "twilio") {
    return "twilio";
  }
  // Auto-detect based on presence of credentials if WHATSAPP_PROVIDER is unset
  if (process.env.KV_META_ACCESS_TOKEN || process.env.KV_META_PHONE_NUMBER_ID) {
    return "kv_techmedia";
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return "twilio";
  }
  return "none";
}

// ─── BulkSMS Gateway ──────────────────────────────────────────────────────────

const BULKSMS_USER = "bidwarsms";
const BULKSMS_API = "https://api.bulksmsgateway.in/sendmessage.php";

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
  const password = process.env.BULKSMS_KEY ?? process.env.BULKSMS_PASSWORD;
  const sender = process.env.BULKSMS_SENDER;
  const templateId = process.env.BULKSMS_TEMPLATE_ID;

  const maskedTo = maskPhoneNumber(to);

  if (!password || !sender || !templateId) {
    logger.warn(
      {
        to: maskedTo,
        missingVars: [
          !password && "BULKSMS_KEY",
          !sender && "BULKSMS_SENDER",
          !templateId && "BULKSMS_TEMPLATE_ID",
        ].filter(Boolean),
      },
      "BulkSMS not configured — stub mode",
    );
    return { success: true, stub: true, messageSid: `stub_sms_${Date.now()}` };
  }

  const mobile = toBulkSmsMobile(to);
  const params = new URLSearchParams({
    user: BULKSMS_USER,
    password,
    mobile,
    message: encodeBulkSmsMessage(body),
    sender,
    type: "3",
    template_id: templateId,
  });

  const url = `${BULKSMS_API}?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const text = (await res.text()).trim();

    // BulkSMS Gateway returns a positive numeric message ID on success,
    // or a descriptive error string on failure.
    const isSuccess = /^\d+$/.test(text) && parseInt(text, 10) > 0;

    if (isSuccess) {
      logger.info({ mobile: maskPhoneNumber(mobile), msgId: text }, "BulkSMS sent");
      return { success: true, messageSid: text };
    }

    logger.error({ mobile: maskPhoneNumber(mobile), response: text }, "BulkSMS send failed");
    return { success: false, error: text };
  } catch (err) {
    logger.error({ mobile: maskPhoneNumber(mobile), err }, "BulkSMS send exception");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Send an SMS via BulkSMS Gateway. All callers unchanged — signature is identical. */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  return sendBulkSms(to, body);
}

// ─── WhatsApp Dispatch via Provider Abstraction ──────────────────────────────

export interface SendWhatsAppOptions {
  type?: "text" | "template";
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<{
    type: "header" | "body" | "button";
    sub_type?: string;
    index?: string | number;
    parameters: Array<{
      type: "text" | "currency" | "date_time" | "image" | "document" | "video";
      text?: string;
      image?: { link: string };
      document?: { link: string; filename?: string };
    }>;
  }>;
}

/** Send a WhatsApp message via the active configured provider. */
export async function sendWhatsApp(
  to: string,
  body: string,
  templateSid?: string,
  options?: SendWhatsAppOptions,
): Promise<SendResult> {
  const activeProvider = getActiveWhatsAppProvider();
  const maskedTo = maskPhoneNumber(to);

  logger.info(
    { provider: activeProvider.providerId, to: maskedTo, template: options?.templateName },
    "sendWhatsApp: initiating dispatch",
  );

  const res = await activeProvider.send({
    to,
    type: options?.type ?? (options?.templateName ? "template" : "text"),
    textBody: body,
    templateSid,
    templateName: options?.templateName,
    templateLanguage: options?.templateLanguage ?? (options?.templateName ? "en" : undefined),
    templateComponents: options?.templateComponents,
  });

  if (!res.success) {
    logger.error(
      { provider: activeProvider.providerId, to: maskedTo, error: res.error },
      "WhatsApp send failed",
    );
    return {
      success: false,
      error: res.error ?? "WhatsApp send failed",
    };
  }

  return {
    success: true,
    messageSid: res.messageId,
    stub: res.stub,
  };
}

/**
 * Module-aware communication license check.
 * - Emergency lock (adminLocked) strictly blocks communications.
 * - Active license entitlement (licenseStatus === 'active') is allowed.
 * - If an auction has concluded (licenseStatus === 'completed'), but the tournament holds a granted
 *   live license and sports scoring is actively in progress, match communications remain authorized.
 */
export function isTournamentLicensedForComm(
  tournament: {
    licenseStatus?: string | null;
    adminLocked?: boolean | null;
    scoringEnabled?: boolean | null;
    scoringPhase?: string | null;
    licenseGrantedAt?: Date | string | null;
    featuresJson?: Record<string, unknown> | null;
    features?: { whatsappNotifications?: boolean } | null;
  } | null | undefined,
): boolean {
  if (!tournament) return false;
  if (tournament.adminLocked) return false;

  // Explicit admin disablement via tournament feature flags (e.g. discounted in-person license)
  const rawFeatures = (tournament as any).featuresJson ?? (tournament as any).features;
  if (rawFeatures) {
    const features = resolveTournamentFeatures(rawFeatures);
    if (features.whatsappNotifications === false) {
      return false;
    }
  }
  if (tournament.licenseStatus === "active") return true;

  if (
    tournament.licenseStatus === "completed" &&
    tournament.scoringEnabled &&
    tournament.scoringPhase === "active" &&
    tournament.licenseGrantedAt != null
  ) {
    return true;
  }

  return false;
}

export async function sendLicensedWhatsApp(
  tournamentId: number | null | undefined,
  to: string,
  body: string,
  templateSid?: string,
): Promise<SendResult & { blocked?: boolean }> {
  if (!to || to.trim() === "") {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }

  if (tournamentId) {
    const [t] = await db
      .select({
        licenseStatus: tournamentsTable.licenseStatus,
        adminLocked: tournamentsTable.adminLocked,
        scoringEnabled: tournamentsTable.scoringEnabled,
        scoringPhase: tournamentsTable.scoringPhase,
        licenseGrantedAt: tournamentsTable.licenseGrantedAt,
        featuresJson: tournamentsTable.featuresJson,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId));
    if (isTournamentLicensedForComm(t)) {
      return sendWhatsApp(to, body, templateSid);
    }
  }

  // Not licensed, admin-locked, or missing tournament context.
  // CRITICAL REQUIREMENT (Stage 2): Automatic WhatsApp-to-SMS fallback is strictly ELIMINATED.
  const reason = !tournamentId
    ? "Missing tournament context"
    : "Tournament not licensed or admin-locked for WhatsApp communications";

  logger.warn(
    { tournamentId: tournamentId ?? null, to: maskPhoneNumber(to), reason },
    "sendLicensedWhatsApp: WhatsApp dispatch suppressed (unlicensed/blocked); SMS fallback eliminated",
  );

  return {
    success: false,
    blocked: true,
    error: reason,
  };
}

/** Build the wa.me consent opt-in link for a given consent token. */
export function buildWaMeLink(token: string): string {
  const encoded = encodeURIComponent(`OPTIN ${token}`);
  const waNumber = (process.env.TWILIO_WHATSAPP_FROM ?? "")
    .replace("whatsapp:", "")
    .replace("+", "");
  if (!waNumber) return `https://wa.me/?text=${encoded}`;
  return `https://wa.me/${waNumber}?text=${encoded}`;
}

/** Consent SMS copy — sent 24h before auction. */
export function buildConsentSms(tournamentName: string, waLink: string): string {
  return `BidWar: ${tournamentName} auction kal hoga. WhatsApp updates ke liye click karein: ${waLink} — Reply STOP to opt out.`;
}
