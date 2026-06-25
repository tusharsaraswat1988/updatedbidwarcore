import type { Request } from "express";
import { logger } from "./logger";

export const VERIFY_ACCESS_FAILURE_THRESHOLD = 5;
export const VERIFY_ACCESS_LOCKOUT_MS = 15 * 60 * 1000;

type VerifyAccessEntry = {
  failures: number;
  lockedUntil: number | null;
  lastActivity: number;
};

const attempts = new Map<string, VerifyAccessEntry>();

function getClientIp(req: Request): string {
  return (req.ip || req.socket.remoteAddress || "unknown").replace("::ffff:", "");
}

export function buildVerifyAccessKey(
  req: Request,
  tournamentId: number,
  teamId: number,
): string {
  const ip = getClientIp(req);
  return `${ip}|${tournamentId}|${teamId}`;
}

function getEntry(key: string, now = Date.now()): VerifyAccessEntry {
  const existing = attempts.get(key);
  if (!existing) return { failures: 0, lockedUntil: null, lastActivity: now };
  if (existing.lockedUntil !== null && now >= existing.lockedUntil) {
    return { failures: 0, lockedUntil: null, lastActivity: now };
  }
  return existing;
}

export type VerifyAccessGuardStatus = {
  locked: boolean;
  failures: number;
  lockoutRemainingSec: number;
};

export function getVerifyAccessGuardStatus(
  req: Request,
  tournamentId: number,
  teamId: number,
): VerifyAccessGuardStatus {
  const now = Date.now();
  const key = buildVerifyAccessKey(req, tournamentId, teamId);
  const entry = getEntry(key, now);
  const lockoutRemainingSec =
    entry.lockedUntil && now < entry.lockedUntil
      ? Math.ceil((entry.lockedUntil - now) / 1000)
      : 0;
  return {
    locked: lockoutRemainingSec > 0,
    failures: entry.failures,
    lockoutRemainingSec,
  };
}

export type VerifyAccessGuardBlock =
  | { allowed: true }
  | { allowed: false; status: number; error: string; lockoutRemainingSec: number };

export function checkVerifyAccessAllowed(
  req: Request,
  tournamentId: number,
  teamId: number,
): VerifyAccessGuardBlock {
  const status = getVerifyAccessGuardStatus(req, tournamentId, teamId);
  if (status.locked) {
    return {
      allowed: false,
      status: 429,
      error: `Too many failed attempts. Try again in ${status.lockoutRemainingSec} seconds.`,
      lockoutRemainingSec: status.lockoutRemainingSec,
    };
  }
  return { allowed: true };
}

export function recordVerifyAccessFailure(
  req: Request,
  tournamentId: number,
  teamId: number,
): VerifyAccessGuardStatus {
  const now = Date.now();
  const key = buildVerifyAccessKey(req, tournamentId, teamId);
  const entry = getEntry(key, now);
  entry.failures += 1;
  entry.lastActivity = now;
  if (entry.failures >= VERIFY_ACCESS_FAILURE_THRESHOLD) {
    entry.lockedUntil = now + VERIFY_ACCESS_LOCKOUT_MS;
    logger.warn(
      {
        ip: getClientIp(req),
        teamId,
        tournamentId,
        failures: entry.failures,
        lockedUntil: new Date(entry.lockedUntil).toISOString(),
      },
      "verify-access lockout triggered",
    );
  } else {
    logger.info(
      {
        ip: getClientIp(req),
        teamId,
        tournamentId,
        failures: entry.failures,
        timestamp: new Date(now).toISOString(),
      },
      "verify-access failed attempt",
    );
  }
  attempts.set(key, entry);
  return getVerifyAccessGuardStatus(req, tournamentId, teamId);
}

export function clearVerifyAccessFailures(
  req: Request,
  tournamentId: number,
  teamId: number,
) {
  const key = buildVerifyAccessKey(req, tournamentId, teamId);
  attempts.delete(key);
}

function teamKeySuffix(tournamentId: number, teamId: number): string {
  return `|${tournamentId}|${teamId}`;
}

/** Aggregate lockout across all IPs for a team (organiser panel). */
export function getTeamAccessLockoutStatus(
  tournamentId: number,
  teamId: number,
): { ownerAccessLocked: boolean; ownerAccessLockoutRemainingSec: number } {
  const suffix = teamKeySuffix(tournamentId, teamId);
  const now = Date.now();
  let ownerAccessLockoutRemainingSec = 0;
  for (const [key, entry] of attempts) {
    if (!key.endsWith(suffix)) continue;
    if (entry.lockedUntil !== null && now < entry.lockedUntil) {
      ownerAccessLockoutRemainingSec = Math.max(
        ownerAccessLockoutRemainingSec,
        Math.ceil((entry.lockedUntil - now) / 1000),
      );
    }
  }
  return {
    ownerAccessLocked: ownerAccessLockoutRemainingSec > 0,
    ownerAccessLockoutRemainingSec,
  };
}

/** Clear all failed-attempt counters and lockouts for a team (all IPs). */
export function clearAllTeamAccessLockouts(tournamentId: number, teamId: number): number {
  const suffix = teamKeySuffix(tournamentId, teamId);
  let cleared = 0;
  for (const key of [...attempts.keys()]) {
    if (key.endsWith(suffix)) {
      attempts.delete(key);
      cleared += 1;
    }
  }
  return cleared;
}

/** @internal test helper */
export function _resetVerifyAccessGuardForTests() {
  attempts.clear();
}
