import { and, eq, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonMatchDetailsTable,
} from "@workspace/db";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { updateBadmintonStatisticsFromMatch } from "../master-sports/badminton";
import {
  shouldApplyMasterStatisticsForMatch,
  shouldRunBadmintonMasterStatistics,
} from "../badminton-match-status";

/**
 * Adapter-owned badminton statistics materialization (master sports layer).
 *
 * S3-08: idempotent — claims `badminton_match_details.master_stats_applied_at`
 * before incrementing `player_statistics`. A second run for the same match is a no-op.
 * Terminal status is read from the state snapshot (not collapsed scoring_matches.status).
 */
export async function runBadmintonMasterStatisticsForMatch(matchId: number): Promise<void> {
  const [detail] = await db
    .select({
      tournamentId: badmintonMatchDetailsTable.tournamentId,
      stateSnapshotJson: badmintonMatchDetailsTable.stateSnapshotJson,
      leftSideJson: badmintonMatchDetailsTable.leftSideJson,
      rightSideJson: badmintonMatchDetailsTable.rightSideJson,
      masterStatsAppliedAt: badmintonMatchDetailsTable.masterStatsAppliedAt,
    })
    .from(badmintonMatchDetailsTable)
    .where(eq(badmintonMatchDetailsTable.scoringMatchId, matchId))
    .limit(1);

  if (!detail?.stateSnapshotJson || !detail.leftSideJson || !detail.rightSideJson) return;

  const state = detail.stateSnapshotJson as BadmintonMatchState;
  if (!shouldRunBadmintonMasterStatistics(state.matchStatus)) return;

  // Fast path — already processed.
  if (!shouldApplyMasterStatisticsForMatch(detail.masterStatsAppliedAt)) return;

  // Claim processed marker atomically so concurrent/double pipeline runs do not double-count.
  const claimed = await db
    .update(badmintonMatchDetailsTable)
    .set({
      masterStatsAppliedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        isNull(badmintonMatchDetailsTable.masterStatsAppliedAt),
      ),
    )
    .returning({ id: badmintonMatchDetailsTable.id });

  if (claimed.length === 0) return;

  try {
    await updateBadmintonStatisticsFromMatch(
      state,
      detail.tournamentId,
      detail.leftSideJson as Record<string, unknown>,
      detail.rightSideJson as Record<string, unknown>,
    );
  } catch (err) {
    // Release claim so a later retry can re-apply (avoid permanent under-count).
    await db
      .update(badmintonMatchDetailsTable)
      .set({
        masterStatsAppliedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(badmintonMatchDetailsTable.scoringMatchId, matchId));
    throw err;
  }
}
