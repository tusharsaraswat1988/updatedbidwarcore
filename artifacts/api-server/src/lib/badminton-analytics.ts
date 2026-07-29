/**
 * Tournament-level badminton analytics — materialized into `badminton_analytics`.
 * Recomputed after each terminal match (and on match delete) so aggregates stay correct.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonAnalyticsTable,
  badmintonMatchDetailsTable,
  scoringEventsTable,
  scoringMatchesTable,
} from "@workspace/db";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { isBadmintonTerminalMatchStatus } from "@workspace/badminton-core";
import { TERMINAL_SCORING_MATCH_STATUSES } from "./scoring-match-terminal";

const POINT_WON = "badminton.point.won";

function matchDurationMinutes(state: BadmintonMatchState): number | null {
  const start = state.startedAt ? new Date(state.startedAt).getTime() : NaN;
  const end = state.endedAt ? new Date(state.endedAt).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return (end - start) / 60_000;
}

function maxRallyFromEvents(
  events: Array<{ payloadJson: Record<string, unknown> | null }>,
): number {
  let max = 0;
  for (const row of events) {
    const len = row.payloadJson?.rallyLength;
    if (typeof len === "number" && len > max) max = len;
  }
  return max;
}

/**
 * Rebuild tournament analytics from all terminal matches + point events.
 * Safe to call repeatedly (upsert).
 */
export async function recomputeBadmintonAnalytics(tournamentId: number): Promise<void> {
  const terminalStatuses = [...TERMINAL_SCORING_MATCH_STATUSES];

  const rows = await db
    .select({
      matchId: scoringMatchesTable.id,
      status: scoringMatchesTable.status,
      stateSnapshotJson: badmintonMatchDetailsTable.stateSnapshotJson,
    })
    .from(scoringMatchesTable)
    .innerJoin(
      badmintonMatchDetailsTable,
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "badminton"),
        inArray(scoringMatchesTable.status, terminalStatuses),
      ),
    );

  let totalRallies = 0;
  let matchesCompleted = 0;
  let fastestMatchMinutes: number | null = null;
  let fastestMatchId: number | null = null;
  let longestRally = 0;
  let longestRallyMatchId: number | null = null;
  const outcomeCounts: Record<string, number> = {};

  for (const row of rows) {
    matchesCompleted += 1;
    outcomeCounts[row.status] = (outcomeCounts[row.status] ?? 0) + 1;

    const state = row.stateSnapshotJson as BadmintonMatchState | null;
    if (!state) continue;

    totalRallies += state.totalRallies ?? 0;

    const duration = matchDurationMinutes(state);
    if (duration != null && (fastestMatchMinutes == null || duration < fastestMatchMinutes)) {
      fastestMatchMinutes = duration;
      fastestMatchId = row.matchId;
    }
  }

  const matchIds = rows.map((r) => r.matchId);
  if (matchIds.length > 0) {
    const pointEvents = await db
      .select({ matchId: scoringEventsTable.matchId, payloadJson: scoringEventsTable.payloadJson })
      .from(scoringEventsTable)
      .where(
        and(
          eq(scoringEventsTable.tournamentId, tournamentId),
          eq(scoringEventsTable.sportSlug, "badminton"),
          eq(scoringEventsTable.eventType, POINT_WON),
          inArray(scoringEventsTable.matchId, matchIds),
        ),
      );

    const byMatch = new Map<number, Array<{ payloadJson: Record<string, unknown> | null }>>();
    for (const ev of pointEvents) {
      const list = byMatch.get(ev.matchId) ?? [];
      list.push({ payloadJson: ev.payloadJson as Record<string, unknown> | null });
      byMatch.set(ev.matchId, list);
    }

    for (const [matchId, events] of byMatch) {
      const max = maxRallyFromEvents(events);
      if (max > longestRally) {
        longestRally = max;
        longestRallyMatchId = matchId;
      }
    }
  }

  const analyticsJson: Record<string, unknown> = {
    outcomeCounts,
    fastestMatchId,
    recomputedAt: new Date().toISOString(),
  };

  const patch = {
    longestRally: longestRally > 0 ? longestRally : null,
    longestRallyMatchId,
    fastestMatchMinutes,
    totalRallies: totalRallies > 0 ? totalRallies : null,
    matchesPlayed: matchesCompleted,
    matchesCompleted,
    analyticsJson,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: badmintonAnalyticsTable.id })
    .from(badmintonAnalyticsTable)
    .where(eq(badmintonAnalyticsTable.tournamentId, tournamentId))
    .limit(1);

  if (existing) {
    await db
      .update(badmintonAnalyticsTable)
      .set(patch)
      .where(eq(badmintonAnalyticsTable.tournamentId, tournamentId));
  } else {
    await db.insert(badmintonAnalyticsTable).values({
      tournamentId,
      ...patch,
    });
  }
}

/** Fire-and-forget analytics refresh after terminal transitions. */
export function scheduleBadmintonAnalyticsRecompute(tournamentId: number): void {
  void recomputeBadmintonAnalytics(tournamentId).catch((err) => {
    console.error("[badminton-analytics] recompute failed:", err);
  });
}

/** Used by match delete to ensure aggregates drop removed matches. */
export async function refreshBadmintonAnalyticsAfterDelete(
  tournamentId: number,
): Promise<void> {
  await recomputeBadmintonAnalytics(tournamentId);
}

export function isEngineTerminalStatus(status: string | null | undefined): boolean {
  return isBadmintonTerminalMatchStatus(status);
}
