import { timingSafeEqual } from "crypto";

/**
 * Clock skew tolerance for export token expiry checks.
 * Allows the local server's clock to drift up to 5 minutes from the cloud
 * server without causing spurious token-expiry rejections.
 */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Machine-readable reason code for audit logging.
 * Never logged alongside the token value itself.
 */
export type TokenFailureReason =
  | "missing_token"
  | "no_token_configured"
  | "invalid_token"
  | "token_expired";

export type TokenValidationResult =
  | { valid: true }
  | { valid: false; status: 401 | 403; error: string; reason: TokenFailureReason };

/**
 * Validates an export token from an incoming request against the stored
 * tournament token.
 *
 * Protections applied:
 *  1. Constant-time comparison (timingSafeEqual) — prevents timing attacks
 *     that could leak token bytes one character at a time.
 *  2. Clock-drift tolerance — expiry window is extended by CLOCK_SKEW_MS so
 *     a local server whose clock drifts a few minutes does not get spuriously
 *     rejected at the expiry boundary.
 */
export function validateExportToken(
  providedToken: string | string[] | undefined,
  storedToken: string | null | undefined,
  expiresAt: Date | null | undefined,
): TokenValidationResult {
  if (!providedToken || typeof providedToken !== "string") {
    return { valid: false, status: 401, error: "Missing X-Export-Token header", reason: "missing_token" };
  }

  if (!storedToken) {
    return { valid: false, status: 403, error: "No export token configured for this tournament", reason: "no_token_configured" };
  }

  // Timing-safe comparison: avoids oracle attacks even if token chars differ in length.
  // If lengths differ the token is definitely wrong, but we must not short-circuit
  // before the timingSafeEqual call — use a constant-length buffer comparison instead.
  const aBytes = Buffer.from(providedToken, "utf8");
  const bBytes = Buffer.from(storedToken, "utf8");
  const tokenMatch =
    aBytes.length === bBytes.length && timingSafeEqual(aBytes, bBytes);

  if (!tokenMatch) {
    return { valid: false, status: 403, error: "Invalid export token", reason: "invalid_token" };
  }

  // Expiry check with clock-drift tolerance: the local server clock may lag or
  // lead by up to CLOCK_SKEW_MS without triggering a false expiry rejection.
  if (expiresAt && expiresAt.getTime() < Date.now() - CLOCK_SKEW_MS) {
    return { valid: false, status: 403, error: "Export token has expired — re-export from cloud", reason: "token_expired" };
  }

  return { valid: true };
}
