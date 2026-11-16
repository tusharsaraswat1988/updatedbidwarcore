import { timingSafeEqual, createHash } from "node:crypto";

interface AttemptRecord {
  failedCount: number;
  firstFailedAt: number;
  lockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes lockout

const attemptsStore = new Map<string, AttemptRecord>();

function getStoreKey(ip: string, tournamentId: number): string {
  return `${ip}:${tournamentId}`;
}

/**
 * Constant-time comparison between submitted PIN and stored tournament PIN.
 * Uses SHA-256 digest comparison to prevent timing attacks.
 */
export function secureComparePins(
  inputPin?: string | null,
  actualPin?: string | null
): boolean {
  if (!inputPin || !actualPin) return false;
  const cleanInput = inputPin.trim();
  const cleanActual = actualPin.trim();
  if (cleanInput.length === 0 || cleanActual.length === 0) return false;

  const hashInput = createHash("sha256").update(cleanInput).digest();
  const hashActual = createHash("sha256").update(cleanActual).digest();

  return timingSafeEqual(hashInput, hashActual);
}

/**
 * Check if the current IP is locked out from guessing the PIN for this tournament.
 */
export function checkPinRateLimit(
  ip: string,
  tournamentId: number
): { allowed: boolean; retryAfterSeconds?: number } {
  const key = getStoreKey(ip, tournamentId);
  const record = attemptsStore.get(key);

  if (!record) {
    return { allowed: true };
  }

  const now = Date.now();

  // Check if actively locked out
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // If lockout expired or window expired, reset
  if (now - record.firstFailedAt > WINDOW_MS && !record.lockedUntil) {
    attemptsStore.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Record a PIN verification attempt.
 * Increments failed count on failure; clears record on success.
 */
export function recordPinAttempt(
  ip: string,
  tournamentId: number,
  success: boolean
): { lockedOut: boolean; retryAfterSeconds?: number } {
  const key = getStoreKey(ip, tournamentId);

  if (success) {
    attemptsStore.delete(key);
    return { lockedOut: false };
  }

  const now = Date.now();
  let record = attemptsStore.get(key);

  if (!record || now - record.firstFailedAt > WINDOW_MS) {
    record = {
      failedCount: 1,
      firstFailedAt: now,
      lockedUntil: null,
    };
    attemptsStore.set(key, record);
    return { lockedOut: false };
  }

  record.failedCount += 1;

  if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
    return { lockedOut: true, retryAfterSeconds };
  }

  return { lockedOut: false };
}

/**
 * Reset rate limit store (for testing purposes).
 */
export function resetPinRateLimit(ip?: string, tournamentId?: number): void {
  if (ip && tournamentId) {
    attemptsStore.delete(getStoreKey(ip, tournamentId));
  } else {
    attemptsStore.clear();
  }
}
