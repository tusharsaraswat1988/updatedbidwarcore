import { logger } from "./logger";

const BASE = "https://www.fast2sms.com/dev";

function apiKey(): string {
  return process.env.BULKSMS_KEY ?? process.env.BULKSMS_PASSWORD ?? "";
}

function otpTemplateId(): string {
  return process.env.BULKSMS_TEMPLATE_ID ?? "";
}

function senderId(): string {
  return process.env.BULKSMS_SENDER ?? "";
}

function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0")
    ? digits.slice(1)
    : digits.slice(-10);
}

export type SmsResult = { success: boolean; error?: string };

type Fast2SmsResponse = {
  return?: boolean;
  message?: string | string[];
  request_id?: string;
};

function extractError(data: Fast2SmsResponse): string {
  if (!data.message) return "Unknown error";
  return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}

async function f2sPost(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: Fast2SmsResponse }> {
  const key = apiKey();
  if (!key) return { ok: false, data: { message: "Fast2SMS API key not configured" } };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const rawText = await res.text().catch(() => "");
    let data: Fast2SmsResponse = {};
    try { data = JSON.parse(rawText) as Fast2SmsResponse; } catch { /* non-JSON response */ }
    const ok = res.ok && !!data.return;
    if (!ok) {
      logger.error({ path, httpStatus: res.status, rawResponse: rawText.slice(0, 500), parsed: data }, "fast2sms API error response");
    }
    return { ok, data };
  } catch (err) {
    logger.error({ err, path }, "fast2sms request error");
    return { ok: false, data: { message: "SMS service unavailable" } };
  }
}

export async function sendOtp(mobile: string): Promise<SmsResult> {
  const templateId = otpTemplateId();
  if (!templateId) {
    logger.warn("BULKSMS_TEMPLATE_ID not set — cannot send OTP");
    return { success: false, error: "OTP template not configured" };
  }
  const { ok, data } = await f2sPost("/otp/send", {
    mobile: normalizeMobile(mobile),
    otp_id: templateId,
    otp_expiry: 15,
    otp_length: 6,
  });
  if (!ok) {
    logger.error({ mobile, err: extractError(data) }, "fast2sms sendOtp failed");
    return { success: false, error: extractError(data) };
  }
  return { success: true };
}

export async function verifyOtp(mobile: string, otp: string): Promise<SmsResult> {
  const { ok, data } = await f2sPost("/otp/verify", {
    mobile: normalizeMobile(mobile),
    otp,
  });
  if (!ok) return { success: false, error: extractError(data) };
  return { success: true };
}

export async function resendOtp(mobile: string): Promise<SmsResult> {
  const { ok, data } = await f2sPost("/otp/resend", {
    mobile: normalizeMobile(mobile),
  });
  if (!ok) {
    logger.error({ mobile, err: extractError(data) }, "fast2sms resendOtp failed");
    return { success: false, error: extractError(data) };
  }
  return { success: true };
}

export async function sendDltSms(
  numbers: string[],
  templateId: string,
  variables: string[],
): Promise<SmsResult> {
  const sender = senderId();
  if (!apiKey() || !sender || !templateId) {
    return { success: false, error: "DLT SMS not fully configured (key/sender/template missing)" };
  }
  const normalizedNumbers = numbers.map(normalizeMobile).filter(n => n.length === 10);
  if (normalizedNumbers.length === 0) return { success: false, error: "No valid mobile numbers" };

  const { ok, data } = await f2sPost("/bulkv2", {
    sender_id: sender,
    message: templateId,
    variables_values: variables.join("|"),
    route: "dlt",
    numbers: normalizedNumbers.join(","),
  });
  if (!ok) {
    logger.error({ templateId, err: extractError(data) }, "fast2sms sendDltSms failed");
    return { success: false, error: extractError(data) };
  }
  return { success: true };
}
