/**
 * OTP service using Fast2SMS OTP SMS (/dev/otp/send, /dev/otp/verify, /dev/otp/resend).
 *
 * Fast2SMS generates and tracks the OTP code — we don't hash it locally.
 * We do maintain an otp_sessions row for every send so multi-step flows
 * (e.g. signup) can store a payload (name/email/password hash) alongside
 * the OTP and read it back after successful verification.
 *
 * Required secrets:
 *   BULKSMS_KEY          — Fast2SMS API key (header: authorization)
 *   BULKSMS_TEMPLATE_ID  — Fast2SMS OTP template ID (e.g. 2adf37c5b4)
 *
 * Fast2SMS OTP endpoints:
 *   POST /dev/otp/send   { mobile, otp_id, otp_expiry, otp_length }
 *   POST /dev/otp/verify { mobile, otp }
 *   POST /dev/otp/resend { mobile }
 */

import { db } from "@workspace/db";
import { otpSessionsTable } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { logger } from "./logger";

export type OtpResult = { success: boolean; error?: string };
export type OtpVerifyResult = OtpResult & { sessionId?: number; payload?: string | null };

// ─── Fast2SMS OTP helpers ─────────────────────────────────────────────────────

const F2S_BASE = "https://www.fast2sms.com/dev";

function f2sApiKey(): string {
  return process.env.BULKSMS_KEY ?? "";
}

function f2sTemplateId(): string {
  return process.env.BULKSMS_TEMPLATE_ID ?? "";
}

function normaliseMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(-10);
}

type F2SResponse = {
  return?: boolean | string | number;
  status_code?: number;
  message?: string | string[];
  request_id?: string;
};

function f2sError(data: F2SResponse): string {
  if (!data.message) return "Unknown error";
  return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}

function f2sSuccess(res: Response, data: F2SResponse): boolean {
  if (data.return === true || data.return === "true" || data.return === 1) return true;
  if (data.status_code === 200) return true;
  const msg = f2sError(data).toLowerCase();
  if (res.ok && (msg.includes("otp sent") || msg.includes("success"))) return true;
  return res.ok && !!data.return;
}

async function f2sPost(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: F2SResponse }> {
  const key = f2sApiKey();
  if (!key) {
    logger.warn({ path }, "Fast2SMS: BULKSMS_KEY not set");
    return { ok: false, data: { message: "OTP service not configured" } };
  }
  try {
    const res = await fetch(`${F2S_BASE}${path}`, {
      method: "POST",
      headers: { authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const rawText = await res.text().catch(() => "");
    let data: F2SResponse = {};
    try {
      data = JSON.parse(rawText) as F2SResponse;
    } catch {
      /* non-JSON body */
    }
    const ok = f2sSuccess(res, data);
    if (!ok) {
      logger.error(
        { path, httpStatus: res.status, rawResponse: rawText.slice(0, 500), parsed: data },
        "Fast2SMS API error response",
      );
    }
    return { ok, data };
  } catch (err) {
    logger.error({ err, path }, "Fast2SMS request error");
    return { ok: false, data: { message: "OTP service unavailable" } };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send an OTP via Fast2SMS. Creates a local session row so callers can store
 * a payload (e.g. signup form data) that is returned after successful verify.
 *
 * @param mobile  Raw mobile — normalised to 10 digits for Fast2SMS
 * @param purpose Scopes the session: "signup" | "password_reset" | "complete_profile"
 * @param payload Optional JSON string stored alongside the session
 */
export async function sendOtp(
  mobile: string,
  purpose: string,
  payload?: string | null,
): Promise<OtpResult> {
  const templateId = f2sTemplateId();
  if (!templateId) {
    return { success: false, error: "OTP template not configured (BULKSMS_TEMPLATE_ID missing)" };
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const mobile10 = normaliseMobile(mobile);
  // Store as 91XXXXXXXXXX in DB for consistent lookup
  const mobileDb = mobile10.length === 10 ? `91${mobile10}` : mobile10;

  const { ok, data } = await f2sPost("/otp/send", {
    mobile: mobile10,
    otp_id: templateId,
    otp_expiry: 15,
    otp_length: 6,
  });

  if (!ok) {
    logger.error({ mobile: mobile10, purpose, err: f2sError(data) }, "Fast2SMS OTP send failed");
    return { success: false, error: f2sError(data) };
  }

  await db.insert(otpSessionsTable).values({
    mobile: mobileDb,
    otpHash: null,
    purpose,
    payload: payload ?? null,
    expiresAt,
  });

  logger.info({ mobile: mobile10, purpose }, "Fast2SMS OTP sent");
  return { success: true };
}

/**
 * Verify an OTP via Fast2SMS, then read the local session for the stored payload.
 * Marks the session as used on success.
 */
export async function verifyOtp(
  mobile: string,
  otp: string,
  purpose?: string,
): Promise<OtpVerifyResult> {
  const mobile10 = normaliseMobile(mobile);

  // Fast2SMS does the OTP check
  const { ok, data } = await f2sPost("/otp/verify", { mobile: mobile10, otp });
  if (!ok) {
    return { success: false, error: f2sError(data) || "Invalid or expired OTP" };
  }

  // Read the local session for payload + mark used
  const mobileDb = mobile10.length === 10 ? `91${mobile10}` : mobile10;
  const conditions = [
    eq(otpSessionsTable.mobile, mobileDb),
    eq(otpSessionsTable.used, false),
    gt(otpSessionsTable.expiresAt, new Date()),
  ];
  if (purpose) conditions.push(eq(otpSessionsTable.purpose, purpose));

  const [session] = await db
    .select()
    .from(otpSessionsTable)
    .where(and(...conditions))
    .orderBy(desc(otpSessionsTable.createdAt))
    .limit(1);

  if (!session) {
    // OTP was valid but session expired — still a success for pure OTP verify use cases
    logger.warn({ mobile: mobile10, purpose }, "OTP verified but no local session found");
    return { success: true, payload: null };
  }

  await db.update(otpSessionsTable).set({ used: true }).where(eq(otpSessionsTable.id, session.id));

  logger.info({ mobile: mobile10, purpose }, "Fast2SMS OTP verified");
  return { success: true, sessionId: session.id, payload: session.payload };
}

/**
 * Ask Fast2SMS to resend the OTP for this mobile number.
 * The local session stays active — no DB changes needed.
 */
export async function resendOtp(
  mobile: string,
  _purpose?: string,
): Promise<OtpResult> {
  const mobile10 = normaliseMobile(mobile);
  const { ok, data } = await f2sPost("/otp/resend", { mobile: mobile10 });
  if (!ok) {
    logger.error({ mobile: mobile10, err: f2sError(data) }, "Fast2SMS OTP resend failed");
    return { success: false, error: f2sError(data) };
  }
  logger.info({ mobile: mobile10 }, "Fast2SMS OTP resent");
  return { success: true };
}
