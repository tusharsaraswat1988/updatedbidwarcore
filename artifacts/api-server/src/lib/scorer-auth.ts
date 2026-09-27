/**
 * Global scorer authentication: mobile + personal PIN → JWT + session.
 * Independent of tournament assignments (future-ready).
 */

import { randomUUID } from "crypto";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import {
  db,
  scorerAccountsTable,
  scorerMatchLocksTable,
  scorerSessionsTable,
  scorerTournamentAssignmentsTable,
  scoringOfficialsTable,
  scoringMatchesTable,
  tournamentsTable,
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

/**
 * Startup repair for legacy roster deletes: accounts with no tournament
 * assignment are orphaned identities and must not retain login access.
 * Also clears any sessions/locks left behind by the old delete flow.
 */
export async function cleanupOrphanScorerAccounts(): Promise<number> {
  const orphaned = await db
    .select({ id: scorerAccountsTable.id, mobile: scorerAccountsTable.mobile, name: scorerAccountsTable.name })
    .from(scorerAccountsTable)
    .where(sql`NOT EXISTS (
      SELECT 1 FROM scorer_tournament_assignments sta
      WHERE sta.scorer_id = ${scorerAccountsTable.id}
    )`);
  for (const account of orphaned) {
    await db.update(scorerSessionsTable).set({ revokedAt: new Date() }).where(eq(scorerSessionsTable.scorerId, account.id));
    await db.delete(scorerMatchLocksTable).where(eq(scorerMatchLocksTable.scorerId, account.id));
    await db.delete(scorerAccountsTable).where(eq(scorerAccountsTable.id, account.id));
    await writeScorerAudit({ actorType: "system", actorId: "system", scorerId: account.id, action: "orphan_scorer_account_removed", payload: { mobile: account.mobile, name: account.name } });
  }
  if (orphaned.length > 0) logger.info({ count: orphaned.length }, "Removed orphaned scorer accounts at startup");
  return orphaned.length;
}
export type ScorerAssignedTournamentDto = {
  id: number;
  name: string;
  sport: string | null;
  status: string;
  hasLiveMatch: boolean;
};

export async function loginScorer(input: {
  mobile: string;
  pin: string;
  tournamentId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}): Promise<{
  token: string;
  scorer: ScorerProfile;
  canScore: boolean;
  expiresAt: string;
  tournaments: ScorerAssignedTournamentDto[];
}> {
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

  let [account] = await db
    .select()
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.mobile, mobile))
    .limit(1);

  let pinOk = false;
  if (account) {
    pinOk = await verifyScorerPin(pin, account.pinHash);
  }

  // Cross-tournament PIN tolerance:
  // If the entered PIN did not match the global account pinHash, check if it matches
  // ANY tournament's PIN in scoring_officials where this mobile is registered as a scorer.
  if (!pinOk) {
    const rawDigits = mobile.replace(/\D/g, "").slice(-10);
    const officials = await db
      .select({
        id: scoringOfficialsTable.id,
        tournamentId: scoringOfficialsTable.tournamentId,
        name: scoringOfficialsTable.name,
        pin: scoringOfficialsTable.pin,
        mobile: scoringOfficialsTable.mobile,
      })
      .from(scoringOfficialsTable)
      .where(eq(scoringOfficialsTable.role, "scorer"));

    const matchedOfficial = officials.find((o) => {
      if (!o.mobile || !o.pin) return false;
      const oDigits = o.mobile.replace(/\D/g, "").slice(-10);
      return oDigits === rawDigits && o.pin.trim() === pin;
    });

    if (matchedOfficial) {
      pinOk = true;
      const newPinHash = await hashScorerPin(pin);
      if (!account) {
        const [created] = await db
          .insert(scorerAccountsTable)
          .values({
            name: matchedOfficial.name,
            mobile,
            pinHash: newPinHash,
            isActive: true,
          })
          .returning();
        account = created!;
      } else {
        await db
          .update(scorerAccountsTable)
          .set({ pinHash: newPinHash })
          .where(eq(scorerAccountsTable.id, account.id));
      }
    }
  }

  if (!account || !pinOk) {
    failAuth();
  }

  const scorerAccount = account!;
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

  // Find all tournaments this scorer is registered/assigned to
  const rawDigits = mobile.replace(/\D/g, "").slice(-10);

  // 1. From scorer_tournament_assignments
  const assignedRows = await db
    .select({ tournamentId: scorerTournamentAssignmentsTable.tournamentId })
    .from(scorerTournamentAssignmentsTable)
    .where(eq(scorerTournamentAssignmentsTable.scorerId, scorerAccount.id));

  // 2. From scoring_officials roster
  const officialRows = await db
    .select({ tournamentId: scoringOfficialsTable.tournamentId, mobile: scoringOfficialsTable.mobile })
    .from(scoringOfficialsTable)
    .where(eq(scoringOfficialsTable.role, "scorer"));

  const matchedTournamentIds = new Set<number>();
  for (const r of assignedRows) {
    if (r.tournamentId) matchedTournamentIds.add(r.tournamentId);
  }
  for (const o of officialRows) {
    if (o.mobile && o.mobile.replace(/\D/g, "").slice(-10) === rawDigits) {
      matchedTournamentIds.add(o.tournamentId);
      // Auto-heal the assignment link
      await assignScorerToTournament(scorerAccount.id, o.tournamentId);
    }
  }

  // If a specific tournamentId was requested on login, verify assignment
  if (input.tournamentId && !matchedTournamentIds.has(input.tournamentId)) {
    throw new ScorerAuthError(
      `You are not registered as a scorer for Tournament #${input.tournamentId}. Please ask the tournament organizer to add your mobile number in Officials & Scorers.`,
      "TOURNAMENT_NOT_ASSIGNED",
      403,
    );
  }

  // Fetch details for non-ended tournaments (live / upcoming / active)
  let activeTournaments: ScorerAssignedTournamentDto[] = [];
  const assignedTournamentIds = Array.from(matchedTournamentIds);

  if (assignedTournamentIds.length > 0) {
    const tRows = await db
      .select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        sport: tournamentsTable.sport,
        status: tournamentsTable.status,
      })
      .from(tournamentsTable)
      .where(inArray(tournamentsTable.id, assignedTournamentIds));

    // Filter out ended tournaments (completed / archived / ended)
    const nonEnded = tRows.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s !== "completed" && s !== "archived" && s !== "ended";
    });

    let liveTids = new Set<number>();
    if (nonEnded.length > 0) {
      const liveMatches = await db
        .select({ tournamentId: scoringMatchesTable.tournamentId })
        .from(scoringMatchesTable)
        .where(
          and(
            inArray(scoringMatchesTable.tournamentId, nonEnded.map((t) => t.id)),
            eq(scoringMatchesTable.status, "live"),
          ),
        );
      liveTids = new Set(liveMatches.map((m) => m.tournamentId));
    }

    activeTournaments = nonEnded.map((t) => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      hasLiveMatch: liveTids.has(t.id),
    }));
  }

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
    payload: { mobile, canScore: scorerAccount.isActive, tournamentCount: activeTournaments.length },
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
    tournaments: activeTournaments,
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
  if (row) return true;

  // Auto-heal from tournament's scoring_officials roster:
  // If the scorer's mobile matches an official in scoringOfficialsTable for this tournament with role 'scorer',
  // reconcile and assign them immediately so they are never falsely blocked.
  try {
    const [acc] = await db
      .select({ mobile: scorerAccountsTable.mobile })
      .from(scorerAccountsTable)
      .where(eq(scorerAccountsTable.id, scorerId))
      .limit(1);

    if (acc?.mobile) {
      const officials = await db
        .select({ id: scoringOfficialsTable.id, mobile: scoringOfficialsTable.mobile })
        .from(scoringOfficialsTable)
        .where(
          and(
            eq(scoringOfficialsTable.tournamentId, tournamentId),
            eq(scoringOfficialsTable.role, "scorer"),
          ),
        );

      const matchedOfficial = officials.find((o) => {
        if (!o.mobile) return false;
        try {
          return normalizeMobile(o.mobile) === acc.mobile;
        } catch {
          return o.mobile.replace(/\D/g, "").slice(-10) === acc.mobile.replace(/\D/g, "").slice(-10);
        }
      });

      if (matchedOfficial) {
        await assignScorerToTournament(scorerId, tournamentId);
        logger.info(
          { scorerId, tournamentId, officialId: matchedOfficial.id },
          "Auto-healed missing scorer tournament assignment from scoring_officials roster",
        );
        return true;
      }
    }
  } catch (err) {
    logger.warn({ err, scorerId, tournamentId }, "Failed to auto-heal scorer assignment");
  }

  return false;
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
 * Organizer action: force unlock a scorer from scoring.
 * 1. Releases any active match locks held by this scorer or in this tournament.
 * 2. Clears login rate-limit lockouts.
 * 3. Revokes stale sessions to break deadlocked leases.
 * 4. Ensures tournament assignment in scorer_tournament_assignments is strictly synced.
 * 5. Reactivates the account if needed.
 */
export async function unlockScorerForTournament(input: {
  tournamentId: number;
  officialId: number;
  actorId: string;
}): Promise<{ ok: true; message: string; locksReleased: number }> {
  const [official] = await db
    .select()
    .from(scoringOfficialsTable)
    .where(
      and(
        eq(scoringOfficialsTable.id, input.officialId),
        eq(scoringOfficialsTable.tournamentId, input.tournamentId),
      ),
    )
    .limit(1);

  if (!official) {
    throw new ScorerAuthError("Official not found in this tournament", "NOT_FOUND", 404);
  }

  let scorerAccountId: number | null = null;
  let mobileNormalized: string | null = null;

  if (official.mobile) {
    try {
      mobileNormalized = normalizeMobile(official.mobile);
    } catch {
      mobileNormalized = official.mobile.replace(/\D/g, "").slice(-10);
    }

    const [acc] = await db
      .select({ id: scorerAccountsTable.id })
      .from(scorerAccountsTable)
      .where(eq(scorerAccountsTable.mobile, mobileNormalized))
      .limit(1);

    if (acc) {
      scorerAccountId = acc.id;
    }
  }

  let locksReleased = 0;

  if (scorerAccountId) {
    // 1. Release match locks held by this scorer or for this tournament
    const deletedLocks = await db
      .delete(scorerMatchLocksTable)
      .where(
        or(
          eq(scorerMatchLocksTable.scorerId, scorerAccountId),
          and(
            eq(scorerMatchLocksTable.tournamentId, input.tournamentId),
            eq(scorerMatchLocksTable.scorerId, scorerAccountId),
          ),
        ),
      )
      .returning({ matchId: scorerMatchLocksTable.matchId });
    locksReleased = deletedLocks.length;

    // 2. Clear any rate-limit login lockout
    if (mobileNormalized) {
      clearAllScorerLoginLockouts(mobileNormalized);
    }

    // 3. Revoke active sessions for this scorer so that stale lease versions won't conflict
    await db
      .update(scorerSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(scorerSessionsTable.scorerId, scorerAccountId));

    // 4. Ensure tournament assignment exists
    await assignScorerToTournament(scorerAccountId, input.tournamentId);

    // 5. Ensure account is active
    await db
      .update(scorerAccountsTable)
      .set({ isActive: true })
      .where(eq(scorerAccountsTable.id, scorerAccountId));

    // 6. Audit log
    await writeScorerAudit({
      actorType: "organizer",
      actorId: input.actorId,
      scorerId: scorerAccountId,
      tournamentId: input.tournamentId,
      action: "scorer_force_unlocked",
      payload: { officialId: input.officialId, locksReleased, tournamentId: input.tournamentId },
    });
  } else if (official.role === "scorer" && official.mobile && official.pin && official.pin.trim().length >= 4) {
    // Account wasn't created yet in scorer_accounts — create and assign now!
    const created = await createScorerAccountForTournament(input.tournamentId, {
      name: official.name,
      mobile: official.mobile,
      pin: official.pin.trim(),
    });
    scorerAccountId = created.id;
  }

  return {
    ok: true,
    message:
      locksReleased > 0
        ? `Unlocked successfully: ${locksReleased} active match lock(s) released and tournament access verified.`
        : "Scorer unlocked: sessions refreshed, login lockouts cleared, and tournament access verified.",
    locksReleased,
  };
}

export async function removeScorerFromTournament(
  tournamentId: number,
  mobileOrScorerId: string | number,
): Promise<void> {
  let scorerId: number | null = null;
  let mobile: string | null = null;

  if (typeof mobileOrScorerId === "number") {
    scorerId = mobileOrScorerId;
    const [acc] = await db
      .select({ id: scorerAccountsTable.id, mobile: scorerAccountsTable.mobile })
      .from(scorerAccountsTable)
      .where(eq(scorerAccountsTable.id, scorerId))
      .limit(1);
    if (acc) mobile = acc.mobile;
  } else {
    try {
      mobile = normalizeMobile(mobileOrScorerId);
      const [acc] = await db
        .select({ id: scorerAccountsTable.id })
        .from(scorerAccountsTable)
        .where(eq(scorerAccountsTable.mobile, mobile))
        .limit(1);
      if (acc) scorerId = acc.id;
    } catch {
      return;
    }
  }

  if (!scorerId) return;

  // 1. Delete tournament assignment
  await db
    .delete(scorerTournamentAssignmentsTable)
    .where(
      and(
        eq(scorerTournamentAssignmentsTable.scorerId, scorerId),
        eq(scorerTournamentAssignmentsTable.tournamentId, tournamentId),
      ),
    );

  // 2. Revoke all active sessions for this scorer so scoring stops immediately
  await db
    .update(scorerSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(scorerSessionsTable.scorerId, scorerId));

  // 3. Remove any active match locks held by this scorer
  await db
    .delete(scorerMatchLocksTable)
    .where(eq(scorerMatchLocksTable.scorerId, scorerId));

  // 4. Clear any login lockout records for this mobile
  if (mobile) {
    clearAllScorerLoginLockouts(mobile);
  }

  await writeScorerAudit({
    actorType: "organizer",
    action: "scorer_removed_from_tournament",
    scorerId,
    tournamentId,
    payload: { tournamentId },
  });
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
  const pinHash = await hashScorerPin(pin);

  if (existing) {
    // Update PIN/name and ensure active when organizer sets/resets official credentials.
    const [updated] = await db
      .update(scorerAccountsTable)
      .set({ name, pinHash, isActive: true })
      .where(eq(scorerAccountsTable.id, existing.id))
      .returning();
    account = updated!;

    // Re-provisioning credentials invalidates old sessions so the new PIN is
    // the only credential accepted by active scoring tabs.
    await db
      .update(scorerSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(scorerSessionsTable.scorerId, existing.id));
  } else {
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

  // Clear any existing login failure lockouts for this mobile
  clearAllScorerLoginLockouts(mobile);

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

/**
 * Organizer: remove a scorer from a tournament and invalidate all active
 * sessions for that scorer identity so old browser tabs can no longer score.
 */
export async function deleteScorerAccountForTournament(
  tournamentId: number,
  scorerId: number,
): Promise<ScorerAccountAdminRow> {
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

  const revokedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .delete(scorerTournamentAssignmentsTable)
      .where(
        and(
          eq(scorerTournamentAssignmentsTable.scorerId, scorerId),
          eq(scorerTournamentAssignmentsTable.tournamentId, tournamentId),
        ),
      );

    const remaining = await tx
      .select({ id: scorerTournamentAssignmentsTable.id })
      .from(scorerTournamentAssignmentsTable)
      .where(eq(scorerTournamentAssignmentsTable.scorerId, scorerId))
      .limit(1);

    // Scorer identity is global. Only destroy it when this was its final
    // tournament assignment; otherwise preserve credentials for other events.
    if (remaining.length === 0) {
      await tx
        .update(scorerSessionsTable)
        .set({ revokedAt })
        .where(eq(scorerSessionsTable.scorerId, scorerId));

      await tx
        .delete(scorerMatchLocksTable)
        .where(eq(scorerMatchLocksTable.scorerId, scorerId));

      await tx
        .delete(scorerAccountsTable)
        .where(eq(scorerAccountsTable.id, scorerId));
    }
  });

  await writeScorerAudit({
    actorType: "organizer",
    action: "scorer_account_deleted",
    scorerId,
    tournamentId,
    payload: { mobile: account.mobile, name: account.name },
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

/**
 * Extract Bearer token from an Express request and resolve a full ScorerAuthContext.
 * Throws ScorerAuthError (with structured code + HTTP status) on any failure.
 * Import this in any route that requires a valid dedicated scorer session.
 */
export async function requireScorerFromRequest(
  req: import("express").Request,
): Promise<ScorerAuthContext> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new ScorerAuthError("Authentication required", "AUTH_REQUIRED", 401);
  }
  return resolveScorerAuthFromToken(token);
}
