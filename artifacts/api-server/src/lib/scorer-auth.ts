/**
 * Global scorer authentication: mobile + personal PIN → JWT + session.
 * Independent of tournament assignments (future-ready).
 */

import { randomUUID } from "crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  scorerAccountsTable,
  scorerSessionsTable,
  scorerTournamentAssignmentsTable,
} from "@workspace/db";
import { parseIndianMobile } from "@workspace/api-base/mobile";
import { signScorerJwt, verifyScorerJwt, type ScorerAuthClaims } from "./jwt";
import { hashScorerPin, verifyScorerPin } from "./scorer-pin-crypto";
import { writeScorerAudit } from "./scorer-audit";
import { logger } from "./logger";
import {
  clearAllScorerLoginLockouts,
  clearScorerLoginFailures,
  getScorerLoginLockoutStatus,
  isScorerLoginRateLimited,
  recordScorerLoginFailure,
} from "./scorer-login-rate-limit";

export const SCORER_SESSION_TTL_SEC = 12 * 60 * 60; // 12 hours

export {
  SCORER_LOGIN_MAX_FAILURES,
  SCORER_LOGIN_WINDOW_MS,
  clearAllScorerLoginLockouts,
  getScorerLoginLockoutStatus,
  resetScorerLoginRateLimitForTests,
  recordScorerLoginFailure as recordScorerLoginFailureForTests,
  isScorerLoginRateLimited as isScorerLoginRateLimitedForTests,
} from "./scorer-login-rate-limit";

export class ScorerAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ScorerAuthError";
  }
}

export type ScorerProfile = {
  id: number;
  name: string;
  mobile: string;
  /** False when organizer deactivated the account — view-only, cannot score. */
  isActive: boolean;
};

export type ScorerAuthContext = {
  scorerId: number;
  sessionId: string;
  profile: ScorerProfile;
  /** Same as profile.isActive — scoring / lock acquire require this. */
  canScore: boolean;
};

/** Throw when an authenticated scorer may browse but must not score or take locks. */
export function assertScorerCanScore(auth: ScorerAuthContext): void {
  if (!auth.canScore) {
    throw new ScorerAuthError(
      "Account is view-only. Scoring is disabled for this scorer.",
      "ACCOUNT_INACTIVE",
      403,
    );
  }
}

function normalizeMobile(raw: string): string {
  const parsed = parseIndianMobile(raw.trim());
  if (!parsed.ok || !parsed.normalized) {
    throw new ScorerAuthError("Enter a valid Indian mobile number", "INVALID_MOBILE", 400);
  }
  return parsed.normalized;
}

/** Ensure exactly one bootstrap scorer when env is set (or defaults in non-production). */
export async function ensureBootstrapScorerAccount(): Promise<void> {
  const existing = await db.select({ id: scorerAccountsTable.id }).from(scorerAccountsTable).limit(1);
  if (existing.length > 0) return;

  const mobileRaw =
    process.env.SCORER_BOOTSTRAP_MOBILE?.trim() ||
    (process.env.BIDWAR_ENV === "production" ? "" : "9999999999");
  const pin =
    process.env.SCORER_BOOTSTRAP_PIN?.trim() ||
    (process.env.BIDWAR_ENV === "production" ? "" : "1234");
  const name = process.env.SCORER_BOOTSTRAP_NAME?.trim() || "Default Scorer";

  if (!mobileRaw || !pin || pin.length < 4) {
    logger.warn(
      "No scorer accounts and SCORER_BOOTSTRAP_MOBILE/PIN not set — scorer login unavailable until seeded",
    );
    return;
  }

  let mobile: string;
  try {
    mobile = normalizeMobile(mobileRaw);
  } catch {
    logger.warn({ mobileRaw }, "SCORER_BOOTSTRAP_MOBILE invalid — skip seed");
    return;
  }

  const pinHash = await hashScorerPin(pin);
  await db.insert(scorerAccountsTable).values({
    name,
    mobile,
    pinHash,
    isActive: true,
  });
  logger.info({ mobile, name }, "Bootstrap scorer account created");
}

export async function loginScorer(input: {
  mobile: string;
  pin: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}): Promise<{ token: string; scorer: ScorerProfile; expiresAt: string }> {
  const mobile = normalizeMobile(input.mobile);
  const pin = input.pin.trim();
  if (pin.length < 4) {
    throw new ScorerAuthError("PIN must be at least 4 characters", "INVALID_PIN", 400);
  }

  if (isScorerLoginRateLimited(mobile, input.ipAddress)) {
    throw new ScorerAuthError(
      "Too many failed login attempts. Try again in 15 minutes.",
      "RATE_LIMITED",
      429,
    );
  }

  const failAuth = (): never => {
    recordScorerLoginFailure(mobile, input.ipAddress);
    if (isScorerLoginRateLimited(mobile, input.ipAddress)) {
      throw new ScorerAuthError(
        "Too many failed login attempts. Try again in 15 minutes.",
        "RATE_LIMITED",
        429,
      );
    }
    throw new ScorerAuthError("Invalid mobile or PIN", "AUTH_FAILED", 401);
  };

  const [account] = await db
    .select()
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.mobile, mobile))
    .limit(1);

  // Inactive accounts may still log in for view-only Scorer Home access.
  if (!account) {
    failAuth();
  }

  const scorerAccount = account!;
  const pinOk = await verifyScorerPin(pin, scorerAccount.pinHash);
  if (!pinOk) {
    failAuth();
  }

  clearScorerLoginFailures(mobile, input.ipAddress);

  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SCORER_SESSION_TTL_SEC * 1000);

  await db.insert(scorerSessionsTable).values({
    id: sessionId,
    scorerId: scorerAccount.id,
    deviceName: input.deviceName ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    revokedAt: null,
  });

  await db
    .update(scorerAccountsTable)
    .set({ lastLoginAt: now })
    .where(eq(scorerAccountsTable.id, scorerAccount.id));

  const token = signScorerJwt({
    purpose: "scorer",
    scorerId: scorerAccount.id,
    sessionId,
  });

  await writeScorerAudit({
    actorType: "scorer",
    actorId: String(scorerAccount.id),
    scorerId: scorerAccount.id,
    sessionId,
    action: "login",
    payload: { mobile, canScore: scorerAccount.isActive },
  });

  return {
    token,
    scorer: {
      id: scorerAccount.id,
      name: scorerAccount.name,
      mobile: scorerAccount.mobile,
      isActive: scorerAccount.isActive,
    },
    canScore: scorerAccount.isActive,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function logoutScorer(sessionId: string, scorerId: number): Promise<void> {
  await db
    .update(scorerSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(scorerSessionsTable.id, sessionId), eq(scorerSessionsTable.scorerId, scorerId)));

  await writeScorerAudit({
    actorType: "scorer",
    actorId: String(scorerId),
    scorerId,
    sessionId,
    action: "logout",
  });
}

export async function resolveScorerAuthFromToken(token: string): Promise<ScorerAuthContext> {
  const claims = verifyScorerJwt(token);
  if (!claims) {
    throw new ScorerAuthError("Authentication required", "AUTH_REQUIRED", 401);
  }
  return resolveScorerAuthFromClaims(claims);
}

export async function resolveScorerAuthFromClaims(
  claims: ScorerAuthClaims,
): Promise<ScorerAuthContext> {
  const [session] = await db
    .select()
    .from(scorerSessionsTable)
    .where(eq(scorerSessionsTable.id, claims.sessionId))
    .limit(1);

  if (!session || session.scorerId !== claims.scorerId) {
    throw new ScorerAuthError("Session invalid", "SESSION_INVALID", 401);
  }
  if (session.revokedAt) {
    throw new ScorerAuthError("Session revoked", "SESSION_REVOKED", 401);
  }
  if (session.expiresAt.getTime() < Date.now()) {
    throw new ScorerAuthError("Session expired", "SESSION_EXPIRED", 401);
  }

  const [account] = await db
    .select()
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.id, claims.scorerId))
    .limit(1);

  if (!account) {
    throw new ScorerAuthError("Account not found", "AUTH_FAILED", 401);
  }

  await db
    .update(scorerSessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(scorerSessionsTable.id, claims.sessionId));

  return {
    scorerId: account.id,
    sessionId: session.id,
    canScore: account.isActive,
    profile: {
      id: account.id,
      name: account.name,
      mobile: account.mobile,
      isActive: account.isActive,
    },
  };
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m?.[1]?.trim() || null;
}

export type ScorerAccountAdminRow = {
  id: number;
  name: string;
  mobile: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Present on tournament organizer list — true when login is rate-limited. */
  loginLocked?: boolean;
  loginLockoutRemainingSec?: number;
};

function serializeScorerAccountAdmin(
  row: typeof scorerAccountsTable.$inferSelect,
  opts?: { includeLoginLockout?: boolean },
): ScorerAccountAdminRow {
  const base: ScorerAccountAdminRow = {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
  if (!opts?.includeLoginLockout) return base;
  return { ...base, ...getScorerLoginLockoutStatus(row.mobile) };
}

/** Organizer admin: list scorer accounts (global). */
export async function listScorerAccountsForAdmin(): Promise<ScorerAccountAdminRow[]> {
  const rows = await db
    .select()
    .from(scorerAccountsTable)
    .orderBy(asc(scorerAccountsTable.name), asc(scorerAccountsTable.id));
  return rows.map(serializeScorerAccountAdmin);
}

/** Organizer admin: create a scorer account. */
export async function createScorerAccountForAdmin(input: {
  name: string;
  mobile: string;
  pin: string;
}): Promise<ScorerAccountAdminRow> {
  const name = input.name.trim();
  if (!name) {
    throw new ScorerAuthError("Name is required", "INVALID_NAME", 400);
  }
  const mobile = normalizeMobile(input.mobile);
  const pin = input.pin.trim();
  if (pin.length < 4) {
    throw new ScorerAuthError("PIN must be at least 4 characters", "INVALID_PIN", 400);
  }

  const [existing] = await db
    .select({ id: scorerAccountsTable.id })
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.mobile, mobile))
    .limit(1);
  if (existing) {
    throw new ScorerAuthError(
      "A scorer with this mobile number already exists",
      "MOBILE_TAKEN",
      409,
    );
  }

  const pinHash = await hashScorerPin(pin);
  const [created] = await db
    .insert(scorerAccountsTable)
    .values({
      name,
      mobile,
      pinHash,
      isActive: true,
    })
    .returning();

  await writeScorerAudit({
    actorType: "organizer",
    action: "scorer_account_created",
    scorerId: created.id,
    payload: { mobile, name },
  });

  return serializeScorerAccountAdmin(created);
}

/** Organizer admin: update name / PIN / active flag. */
export async function updateScorerAccountForAdmin(
  scorerId: number,
  input: { name?: string; pin?: string; isActive?: boolean },
): Promise<ScorerAccountAdminRow> {
  const [existing] = await db
    .select()
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.id, scorerId))
    .limit(1);
  if (!existing) {
    throw new ScorerAuthError("Scorer not found", "NOT_FOUND", 404);
  }

  const patch: Partial<typeof scorerAccountsTable.$inferInsert> = {};
  let revokeSessions = false;

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new ScorerAuthError("Name is required", "INVALID_NAME", 400);
    }
    patch.name = name;
  }

  if (input.pin !== undefined) {
    const pin = input.pin.trim();
    if (pin.length < 4) {
      throw new ScorerAuthError("PIN must be at least 4 characters", "INVALID_PIN", 400);
    }
    patch.pinHash = await hashScorerPin(pin);
    revokeSessions = true;
  }

  if (input.isActive !== undefined) {
    patch.isActive = input.isActive;
    if (!input.isActive) revokeSessions = true;
  }

  if (Object.keys(patch).length === 0) {
    return serializeScorerAccountAdmin(existing);
  }

  const [updated] = await db
    .update(scorerAccountsTable)
    .set(patch)
    .where(eq(scorerAccountsTable.id, scorerId))
    .returning();

  if (revokeSessions) {
    await db
      .update(scorerSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(scorerSessionsTable.scorerId, scorerId));
  }

  await writeScorerAudit({
    actorType: "organizer",
    action: "scorer_account_updated",
    scorerId,
    payload: {
      name: input.name !== undefined,
      pinReset: input.pin !== undefined,
      isActive: input.isActive,
    },
  });

  return serializeScorerAccountAdmin(updated);
}

/** Count assignments for a tournament (0 = legacy open access). */
export async function countScorerAssignmentsForTournament(
  tournamentId: number,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scorerTournamentAssignmentsTable)
    .where(eq(scorerTournamentAssignmentsTable.tournamentId, tournamentId));
  return Number(row?.count ?? 0);
}

export async function isScorerAssignedToTournament(
  scorerId: number,
  tournamentId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: scorerTournamentAssignmentsTable.id })
    .from(scorerTournamentAssignmentsTable)
    .where(
      and(
        eq(scorerTournamentAssignmentsTable.scorerId, scorerId),
        eq(scorerTournamentAssignmentsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Sprint 1 / C3 — when the tournament has ≥1 assignment, the scorer must be
 * assigned. Zero assignments keeps legacy open access for gradual rollout.
 */
export async function assertScorerMayAccessTournament(
  scorerId: number,
  tournamentId: number,
): Promise<void> {
  const assignedCount = await countScorerAssignmentsForTournament(tournamentId);
  if (assignedCount === 0) return;
  const ok = await isScorerAssignedToTournament(scorerId, tournamentId);
  if (!ok) {
    throw new ScorerAuthError(
      "You are not assigned to this tournament",
      "TOURNAMENT_NOT_ASSIGNED",
      403,
    );
  }
}

export async function assignScorerToTournament(
  scorerId: number,
  tournamentId: number,
): Promise<void> {
  await db
    .insert(scorerTournamentAssignmentsTable)
    .values({ scorerId, tournamentId })
    .onConflictDoNothing({
      target: [
        scorerTournamentAssignmentsTable.scorerId,
        scorerTournamentAssignmentsTable.tournamentId,
      ],
    });
}

/** Organizer: list scorers assigned to this tournament only (Sprint 1 / C7). */
export async function listScorerAccountsForTournament(
  tournamentId: number,
): Promise<ScorerAccountAdminRow[]> {
  const rows = await db
    .select({ account: scorerAccountsTable })
    .from(scorerTournamentAssignmentsTable)
    .innerJoin(
      scorerAccountsTable,
      eq(scorerAccountsTable.id, scorerTournamentAssignmentsTable.scorerId),
    )
    .where(eq(scorerTournamentAssignmentsTable.tournamentId, tournamentId))
    .orderBy(asc(scorerAccountsTable.name), asc(scorerAccountsTable.id));
  return rows.map((r) =>
    serializeScorerAccountAdmin(r.account, { includeLoginLockout: true }),
  );
}

/**
 * Organizer clears scorer login brute-force lockout for an assigned scorer.
 * Returns cleared in-memory entry count (0 if not locked).
 */
export async function clearScorerLoginLockoutForTournament(
  tournamentId: number,
  scorerId: number,
): Promise<{ cleared: number; scorer: ScorerAccountAdminRow }> {
  const assigned = await isScorerAssignedToTournament(scorerId, tournamentId);
  if (!assigned) {
    throw new ScorerAuthError("Scorer is not assigned to this tournament", "NOT_FOUND", 404);
  }
  const [account] = await db
    .select()
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.id, scorerId))
    .limit(1);
  if (!account) {
    throw new ScorerAuthError("Scorer not found", "NOT_FOUND", 404);
  }
  const cleared = clearAllScorerLoginLockouts(account.mobile);
  await writeScorerAudit({
    actorType: "organizer",
    action: "scorer_login_lockout_reset",
    scorerId: account.id,
    tournamentId,
    payload: { mobile: account.mobile, clearedEntries: cleared, tournamentId },
  });
  return {
    cleared,
    scorer: serializeScorerAccountAdmin(account, { includeLoginLockout: true }),
  };
}

/**
 * Create (or re-use by mobile) a scorer and assign them to this tournament.
 * Does not expose/list scorers from other tournaments.
 */
export async function createScorerAccountForTournament(
  tournamentId: number,
  input: { name: string; mobile: string; pin: string },
): Promise<ScorerAccountAdminRow> {
  const name = input.name.trim();
  if (!name) {
    throw new ScorerAuthError("Name is required", "INVALID_NAME", 400);
  }
  const mobile = normalizeMobile(input.mobile);
  const pin = input.pin.trim();
  if (pin.length < 4) {
    throw new ScorerAuthError("PIN must be at least 4 characters", "INVALID_PIN", 400);
  }

  const [existing] = await db
    .select()
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.mobile, mobile))
    .limit(1);

  let account: typeof scorerAccountsTable.$inferSelect;
  if (existing) {
    // Re-use global identity but only expose via this tournament's assignment.
    const already = await isScorerAssignedToTournament(existing.id, tournamentId);
    if (already) {
      throw new ScorerAuthError(
        "This scorer is already assigned to this tournament",
        "ALREADY_ASSIGNED",
        409,
      );
    }
    // Update PIN/name when re-assigning an existing mobile to this tournament.
    const pinHash = await hashScorerPin(pin);
    const [updated] = await db
      .update(scorerAccountsTable)
      .set({ name, pinHash, isActive: true })
      .where(eq(scorerAccountsTable.id, existing.id))
      .returning();
    account = updated!;
  } else {
    const pinHash = await hashScorerPin(pin);
    const [created] = await db
      .insert(scorerAccountsTable)
      .values({
        name,
        mobile,
        pinHash,
        isActive: true,
      })
      .returning();
    account = created!;
  }

  await assignScorerToTournament(account.id, tournamentId);

  await writeScorerAudit({
    actorType: "organizer",
    action: "scorer_account_created",
    scorerId: account.id,
    tournamentId,
    payload: { mobile, name, tournamentId },
  });

  return serializeScorerAccountAdmin(account);
}

/** Update a scorer only if assigned to this tournament. */
export async function updateScorerAccountForTournament(
  tournamentId: number,
  scorerId: number,
  input: { name?: string; pin?: string; isActive?: boolean },
): Promise<ScorerAccountAdminRow> {
  const assigned = await isScorerAssignedToTournament(scorerId, tournamentId);
  if (!assigned) {
    throw new ScorerAuthError(
      "Scorer is not assigned to this tournament",
      "NOT_FOUND",
      404,
    );
  }
  return updateScorerAccountForAdmin(scorerId, input);
}

