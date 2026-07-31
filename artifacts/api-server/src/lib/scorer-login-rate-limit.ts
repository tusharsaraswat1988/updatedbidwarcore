/**
 * Scorer login brute-force protection — in-memory fixed window (per process).
 * Keyed by normalized mobile, and optionally `mobile|ip`.
 */

/** Max failed scorer login attempts per key within the window. */
export const SCORER_LOGIN_MAX_FAILURES = 5;
/** Window for scorer login failures (15 minutes). */
export const SCORER_LOGIN_WINDOW_MS = 15 * 60 * 1000;

const scorerLoginFailures = new Map<string, { count: number; resetAt: number }>();

function scorerLoginRateKeys(mobile: string, ipAddress?: string | null): string[] {
  const keys = [mobile];
  if (ipAddress) keys.push(`${mobile}|${ipAddress}`);
  return keys;
}

/** Returns true when any key is currently over the failure limit. */
export function isScorerLoginRateLimited(
  mobile: string,
  ipAddress?: string | null,
): boolean {
  const now = Date.now();
  for (const key of scorerLoginRateKeys(mobile, ipAddress)) {
    const entry = scorerLoginFailures.get(key);
    if (entry && entry.resetAt > now && entry.count >= SCORER_LOGIN_MAX_FAILURES) {
      return true;
    }
  }
  return false;
}

export function recordScorerLoginFailure(
  mobile: string,
  ipAddress?: string | null,
): void {
  const now = Date.now();
  for (const key of scorerLoginRateKeys(mobile, ipAddress)) {
    const entry = scorerLoginFailures.get(key);
    if (!entry || entry.resetAt <= now) {
      scorerLoginFailures.set(key, { count: 1, resetAt: now + SCORER_LOGIN_WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }
}

/** Clear failure counters for this mobile (and mobile|ip) after successful login. */
export function clearScorerLoginFailures(
  mobile: string,
  ipAddress?: string | null,
): void {
  for (const key of scorerLoginRateKeys(mobile, ipAddress)) {
    scorerLoginFailures.delete(key);
  }
  scorerLoginFailures.delete(mobile);
}

/**
 * Organizer-facing lockout status for a scorer mobile (any IP key).
 * Matches {@link isScorerLoginRateLimited} when no IP is supplied.
 */
export function getScorerLoginLockoutStatus(mobile: string): {
  loginLocked: boolean;
  loginLockoutRemainingSec: number;
} {
  const now = Date.now();
  let remainingMs = 0;
  for (const [key, entry] of scorerLoginFailures) {
    if (key !== mobile && !key.startsWith(`${mobile}|`)) continue;
    if (entry.resetAt > now && entry.count >= SCORER_LOGIN_MAX_FAILURES) {
      remainingMs = Math.max(remainingMs, entry.resetAt - now);
    }
  }
  const loginLockoutRemainingSec =
    remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  return {
    loginLocked: loginLockoutRemainingSec > 0,
    loginLockoutRemainingSec,
  };
}

/** Clear all failed-attempt counters for a mobile (all IPs). Returns entries removed. */
export function clearAllScorerLoginLockouts(mobile: string): number {
  let cleared = 0;
  for (const key of [...scorerLoginFailures.keys()]) {
    if (key === mobile || key.startsWith(`${mobile}|`)) {
      scorerLoginFailures.delete(key);
      cleared += 1;
    }
  }
  return cleared;
}

/** @internal Test helper — reset in-memory login failure map. */
export function resetScorerLoginRateLimitForTests(): void {
  scorerLoginFailures.clear();
}
