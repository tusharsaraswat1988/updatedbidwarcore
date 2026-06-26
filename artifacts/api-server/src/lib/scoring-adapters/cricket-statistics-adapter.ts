import type { StatisticsCapableAdapter } from "@workspace/scoring-core";

export const cricketStatisticsAdapter: StatisticsCapableAdapter = {
  manifest: {
    sportSlug: "cricket",
    displayName: "Cricket",
    adapterVersion: "1.0.0",
    capabilities: ["Statistics", "Standings", "Leaderboards"],
  },
  async calculateMatchStatistics(matchId: number) {
    const { projectMatchPlayerStats } = await import("../scoring-stats-service");
    await projectMatchPlayerStats(matchId);
  },
  async calculateMatchAwards(matchId: number) {
    const { projectMatchAwards } = await import("../scoring-stats-service");
    await projectMatchAwards(matchId);
  },
  async calculateTournamentLeaderboards(tournamentId: number) {
    const { rebuildTournamentLeaderboards } = await import("../scoring-stats-service");
    await rebuildTournamentLeaderboards(tournamentId);
  },
  async calculateTournamentStandings(tournamentId: number) {
    const { rebuildTournamentStandings } = await import("../scoring-standings");
    await rebuildTournamentStandings(tournamentId);
  },
  async calculateGlobalStatistics(matchId: number) {
    const { projectGlobalCricketStatsForMatch } = await import("../scoring-global-stats-service");
    await projectGlobalCricketStatsForMatch(matchId);
  },
};
