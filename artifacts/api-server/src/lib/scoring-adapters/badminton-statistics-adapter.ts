import type { StatisticsCapableAdapter } from "@workspace/scoring-core";

export const badmintonStatisticsAdapter: StatisticsCapableAdapter = {
  manifest: {
    sportSlug: "badminton",
    displayName: "Badminton",
    adapterVersion: "1.0.0",
    capabilities: ["Statistics"],
  },
  async calculateMatchStatistics(matchId: number) {
    const { runBadmintonMasterStatisticsForMatch } = await import(
      "../scoring-platform/badminton-statistics"
    );
    await runBadmintonMasterStatisticsForMatch(matchId);
  },
};
