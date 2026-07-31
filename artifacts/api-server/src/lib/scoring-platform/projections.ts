import type { ScoringSportSlug, StatisticsCapableAdapter } from "@workspace/scoring-core";
import { scoringAdapterRegistry } from "@workspace/scoring-core";
import { isTerminalScoringMatchStatus } from "../scoring-match-terminal";

const statisticsAdapters = new Map<ScoringSportSlug, StatisticsCapableAdapter>();

export function registerStatisticsAdapter(adapter: StatisticsCapableAdapter): void {
  statisticsAdapters.set(adapter.manifest.sportSlug, adapter);
}

export function getStatisticsAdapter(sportSlug: ScoringSportSlug): StatisticsCapableAdapter | null {
  return statisticsAdapters.get(sportSlug) ?? null;
}

/**
 * Platform projection scheduler — orchestrates adapter statistics without sport formulas here.
 */
export async function runPostMatchProjectionPipeline(
  sportSlug: ScoringSportSlug,
  tournamentId: number,
  matchId: number,
  matchStatus: string,
): Promise<void> {
  const statsAdapter = getStatisticsAdapter(sportSlug);
  if (!statsAdapter) return;

  if (!isTerminalScoringMatchStatus(matchStatus)) return;

  if (statsAdapter.calculateTournamentStandings) {
    await statsAdapter.calculateTournamentStandings(tournamentId);
  }

  // Match-level awards/stats historically ran for completed only; include all terminals
  // so walkover/retired/DQ still materialize after S3-08 status preservation.
  if (statsAdapter.calculateMatchStatistics) {
    await statsAdapter.calculateMatchStatistics(matchId);
  }
  if (statsAdapter.calculateMatchAwards) {
    await statsAdapter.calculateMatchAwards(matchId);
  }
  if (statsAdapter.calculateTournamentLeaderboards) {
    await statsAdapter.calculateTournamentLeaderboards(tournamentId);
  }
  if (statsAdapter.calculateGlobalStatistics) {
    await statsAdapter.calculateGlobalStatistics(matchId);
  }
}

/** Run badminton master-sports statistics after terminal snapshot (adapter-owned formula). */
export async function runBadmintonMasterStatisticsPipeline(
  matchId: number,
): Promise<void> {
  const statsAdapter = getStatisticsAdapter("badminton");
  if (statsAdapter?.calculateMatchStatistics) {
    await statsAdapter.calculateMatchStatistics(matchId);
  }
}

export function listRegisteredStatisticsSports(): ScoringSportSlug[] {
  return [...statisticsAdapters.keys()];
}

export function getScoringAdapter(sportSlug: ScoringSportSlug) {
  return scoringAdapterRegistry.get(sportSlug);
}
