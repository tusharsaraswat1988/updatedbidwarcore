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

  const errors: { step: string; error: unknown }[] = [];

  if (statsAdapter.calculateTournamentStandings) {
    try {
      await statsAdapter.calculateTournamentStandings(tournamentId);
    } catch (err) {
      console.error(
        `[PROJECTION_PIPELINE] calculateTournamentStandings failed for tournament ${tournamentId}:`,
        err,
      );
      errors.push({ step: "standings", error: err });
    }
  }

  // Match-level awards/stats historically ran for completed only; include all terminals
  // so walkover/retired/DQ still materialize after S3-08 status preservation.
  if (statsAdapter.calculateMatchStatistics) {
    try {
      await statsAdapter.calculateMatchStatistics(matchId);
    } catch (err) {
      console.error(
        `[PROJECTION_PIPELINE] calculateMatchStatistics failed for match ${matchId}:`,
        err,
      );
      errors.push({ step: "match_stats", error: err });
    }
  }
  if (statsAdapter.calculateMatchAwards) {
    try {
      await statsAdapter.calculateMatchAwards(matchId);
    } catch (err) {
      console.error(
        `[PROJECTION_PIPELINE] calculateMatchAwards failed for match ${matchId}:`,
        err,
      );
      errors.push({ step: "awards", error: err });
    }
  }
  if (statsAdapter.calculateTournamentLeaderboards) {
    try {
      await statsAdapter.calculateTournamentLeaderboards(tournamentId);
    } catch (err) {
      console.error(
        `[PROJECTION_PIPELINE] calculateTournamentLeaderboards failed for tournament ${tournamentId}:`,
        err,
      );
      errors.push({ step: "leaderboards", error: err });
    }
  }
  if (statsAdapter.calculateGlobalStatistics) {
    try {
      await statsAdapter.calculateGlobalStatistics(matchId);
    } catch (err) {
      console.error(
        `[PROJECTION_PIPELINE] calculateGlobalStatistics failed for match ${matchId}:`,
        err,
      );
      errors.push({ step: "global_stats", error: err });
    }
  }

  if (errors.length > 0) {
    console.warn(
      `[PROJECTION_PIPELINE] Completed with ${errors.length} step error(s) for match ${matchId} (tournament ${tournamentId})`,
    );
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
