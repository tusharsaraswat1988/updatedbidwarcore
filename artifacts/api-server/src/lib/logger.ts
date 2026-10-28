import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Mask a phone number for operational logging without exposing full PII.
 * Example: "+919876543210" -> "+91******3210"
 * Example: "9876543210" -> "98******3210"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "[EMPTY]";
  const cleaned = String(phone).trim();
  const prefix = cleaned.startsWith("+") ? "+" : "";
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length <= 4) return "****";

  if (digitsOnly.length >= 10) {
    const head = digitsOnly.slice(0, 2);
    const tail = digitsOnly.slice(-4);
    return `${prefix}${head}******${tail}`;
  }

  const tail = digitsOnly.slice(-2);
  const mask = "*".repeat(Math.max(2, digitsOnly.length - 2));
  return `${prefix}${mask}${tail}`;
}

/**
 * Mask a sensitive token or secret for logging.
 */
export function maskSecret(secret?: string | null): string {
  if (!secret) return "[UNSET]";
  const str = String(secret).trim();
  if (str.length <= 6) return "***";
  return `${str.slice(0, 3)}...${str.slice(-3)}`;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "*.token",
    "*.*.token",
    "*.accessToken",
    "*.*.accessToken",
    "*.secret",
    "*.*.secret",
    "*.password",
    "*.*.password",
    "*.otp",
    "*.*.otp",
    "*.code",
    "*.*.code",
    "*.appSecret",
    "*.*.appSecret",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
