import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonMatchDetailsTable,
  scoringMatchesTable,
} from "@workspace/db";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { updateBadmintonStatisticsFromMatch } from "../master-sports/badminton";

/** Adapter-owned badminton statistics materialization (master sports layer). */
export async function runBadmintonMasterStatisticsForMatch(matchId: number): Promise<void> {
  const [match] = await db
    .select({ status: scoringMatchesTable.status })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.id, matchId))
    .limit(1);

  if (!match || match.status !== "completed") return;

  const [detail] = await db
    .select({
      tournamentId: badmintonMatchDetailsTable.tournamentId,
      stateSnapshotJson: badmintonMatchDetailsTable.stateSnapshotJson,
      leftSideJson: badmintonMatchDetailsTable.leftSideJson,
      rightSideJson: badmintonMatchDetailsTable.rightSideJson,
    })
    .from(badmintonMatchDetailsTable)
    .where(eq(badmintonMatchDetailsTable.scoringMatchId, matchId))
    .limit(1);

  if (!detail?.stateSnapshotJson || !detail.leftSideJson || !detail.rightSideJson) return;

  await updateBadmintonStatisticsFromMatch(
    detail.stateSnapshotJson as BadmintonMatchState,
    detail.tournamentId,
    detail.leftSideJson as Record<string, unknown>,
    detail.rightSideJson as Record<string, unknown>,
  );
}
