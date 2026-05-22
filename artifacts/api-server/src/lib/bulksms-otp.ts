/**
 * Self-managed OTP via BulkSMS Gateway (bulksmsgateway.in).
 *
 * OTPs are generated server-side (crypto.randomInt), hashed with scrypt, and
 * stored in otp_sessions.otp_hash.  The BulkSMS-approved DLT template text is
 * configured via BULKSMS_OTP_TEMPLATE — set it to match your DLT registration
 * exactly, using {#var#} as the OTP placeholder, e.g.:
 *
 *   BULKSMS_OTP_TEMPLATE="Your BidWar OTP is {#var#}. Valid for 10 minutes. Do not share."
 *
 * Requires: BULKSMS_PASSWORD, BULKSMS_SENDER, BULKSMS_TEMPLATE_ID (already set).
 */

import { randomInt, scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "@workspace/db";
import { otpSessionsTable } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { sendSms } from "./comm-sender";
import { logger } from "./logger";

const scryptAsync = promisify(scrypt);

export type OtpResult = { success: boolean; error?: string };
export type OtpVerifyResult = OtpResult & { sessionId?: number; payload?: string | null };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

async function hashOtp(otp: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(otp, salt, 32)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function checkOtpHash(otp: string, hash: string): Promise<boolean> {
  try {
    const [salt, stored] = hash.split(":");
    if (!salt || !stored) return false;
    const key = (await scryptAsync(otp, salt, 32)) as Buffer;
    const storedBuf = Buffer.from(stored, "hex");
    if (key.length !== storedBuf.length) return false;
    return timingSafeEqual(key, storedBuf);
  } catch {
    return false;
  }
}

function buildOtpMessage(otp: string): string {
  const template =
    process.env.BULKSMS_OTP_TEMPLATE ??
    "Your BidWar OTP is {#var#}. Valid for 10 minutes. Do not share with anyone.";
  return template.replace(/\{#var#\}/g, otp);
}

function normaliseMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a 6-digit OTP, store its hash in otp_sessions, and send it via
 * BulkSMS Gateway using the approved DLT template.
 *
 * @param mobile  Raw mobile string — normalised internally to 91XXXXXXXXXX
 * @param purpose Stored in otp_sessions.purpose for scoped lookups
 * @param payload Optional JSON payload (e.g. serialised signup form data)
 */
export async function sendOtp(
  mobile: string,
  purpose: string,
  payload?: string | null,
): Promise<OtpResult> {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const normalised = normaliseMobile(mobile);

  await db.insert(otpSessionsTable).values({
    mobile: normalised,
    otpHash,
    purpose,
    payload: payload ?? null,
    expiresAt,
  });

  const message = buildOtpMessage(otp);
  const result = await sendSms(normalised, message);

  if (!result.success) {
    logger.error({ mobile: normalised, purpose, err: result.error }, "bulksms-otp: SMS send failed");
    return { success: false, error: result.error ?? "Failed to send OTP. Please try again." };
  }

  logger.info({ mobile: normalised, purpose }, "bulksms-otp: OTP sent");
  return { success: true };
}

/**
 * Verify a 6-digit OTP for a given mobile + optional purpose.
 * On success, marks the session as used and returns the stored payload.
 */
export async function verifyOtp(
  mobile: string,
  otp: string,
  purpose?: string,
): Promise<OtpVerifyResult> {
  const normalised = normaliseMobile(mobile);

  const conditions = [
    eq(otpSessionsTable.mobile, normalised),
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

  if (!session || !session.otpHash) {
    return { success: false, error: "OTP expired or not found. Please request a new one." };
  }

  const valid = await checkOtpHash(otp, session.otpHash);
  if (!valid) {
    return { success: false, error: "Invalid OTP. Please check and try again." };
  }

  await db
    .update(otpSessionsTable)
    .set({ used: true })
    .where(eq(otpSessionsTable.id, session.id));

  logger.info({ mobile: normalised, purpose }, "bulksms-otp: OTP verified");
  return { success: true, sessionId: session.id, payload: session.payload };
}

/**
 * Invalidate any active OTP sessions for this mobile + purpose, then generate
 * and send a fresh OTP.
 */
export async function resendOtp(
  mobile: string,
  purpose: string,
): Promise<OtpResult> {
  const normalised = normaliseMobile(mobile);

  await db
    .update(otpSessionsTable)
    .set({ used: true })
    .where(
      and(
        eq(otpSessionsTable.mobile, normalised),
        eq(otpSessionsTable.purpose, purpose),
        eq(otpSessionsTable.used, false),
      ),
    );

  return sendOtp(mobile, purpose);
}
