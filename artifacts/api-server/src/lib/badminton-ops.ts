/**
 * Production ops helpers for badminton — court conflicts, friendly errors, PIN rate limit.
 * No new features; reliability only.
 */

import { and, eq, isNotNull, ne, notInArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonFixturesTable,
  badmintonMatchDetailsTable,
  scoringMatchesTable,
} from "@workspace/db";

const COURT_CONFLICT_WINDOW_MS = 45 * 60_000;

/** Map engine/command failures to operator-facing copy. */
export function friendlyBadmintonCommandMessage(raw: string): string {
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  if (lower.includes("not in scheduled") || lower.includes("not scheduled")) {
    return "This match is not ready to start. Open Match Control and check the match status.";
  }
  if (lower.includes("not live")) {
    return "This action only works while the match is live.";
  }
  if (lower.includes("walkover")) {
    return "Walkover is not allowed in the current match state.";
  }
  if (lower.includes("no points") || lower.includes("nothing to undo")) {
    return "Nothing to undo yet.";
  }
  if (lower.includes("already")) {
    return msg;
  }
  return msg || "Action could not be completed. Check match status and try again.";
}

/**
 * Fixtures on the same court within ±45 minutes (excludes cancelled/completed/walkover).
 */
export async function findServerCourtScheduleConflicts(opts: {
  tournamentId: number;
  courtId: number;
  scheduledAt: Date;
  excludeFixtureId?: number;
  windowMs?: number;
}): Promise<Array<{ id: number; slotNumber: number | null; scheduledAt: Date | null }>> {
  const windowMs = opts.windowMs ?? COURT_CONFLICT_WINDOW_MS;
  const center = opts.scheduledAt.getTime();
  if (Number.isNaN(center)) return [];

  const conditions = [
    eq(badmintonFixturesTable.tournamentId, opts.tournamentId),
    eq(badmintonFixturesTable.courtId, opts.courtId),
    isNotNull(badmintonFixturesTable.scheduledAt),
    notInArray(badmintonFixturesTable.status, [
      "cancelled",
      "walkover",
      "completed",
    ]),
  ];
  if (opts.excludeFixtureId != null) {
    conditions.push(ne(badmintonFixturesTable.id, opts.excludeFixtureId));
  }

  const rows = await db
    .select({
      id: badmintonFixturesTable.id,
      slotNumber: badmintonFixturesTable.slotNumber,
      scheduledAt: badmintonFixturesTable.scheduledAt,
      status: badmintonFixturesTable.status,
    })
    .from(badmintonFixturesTable)
    .where(and(...conditions));

  return rows
    .filter((r) => {
      if (!r.scheduledAt) return false;
      const t = new Date(r.scheduledAt).getTime();
      if (Number.isNaN(t)) return false;
      return Math.abs(t - center) <= windowMs;
    })
    .map((r) => ({
      id: r.id,
      slotNumber: r.slotNumber,
      scheduledAt: r.scheduledAt,
    }));
}

/** Another badminton match already live on the same court. */
export async function findOtherLiveMatchOnCourt(opts: {
  tournamentId: number;
  courtId: number;
  excludeMatchId: number;
}): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: scoringMatchesTable.id })
    .from(scoringMatchesTable)
    .innerJoin(
      badmintonMatchDetailsTable,
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
        eq(badmintonMatchDetailsTable.tournamentId, opts.tournamentId),
      ),
    )
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, opts.tournamentId),
        eq(scoringMatchesTable.sportSlug, "badminton"),
        eq(scoringMatchesTable.status, "live"),
        eq(badmintonMatchDetailsTable.courtId, opts.courtId),
        ne(scoringMatchesTable.id, opts.excludeMatchId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Simple in-memory PIN verify rate limit (per process). */
const pinAttempts = new Map<string, { count: number; resetAt: number }>();

export function consumePinVerifyAttempt(key: string, limit = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = pinAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    pinAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
