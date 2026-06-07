import type { CricketScoreboardState } from "./state";

export type CricketInningsSummary = {
  innings: number;
  battingTeamId: number;
  bowlingTeamId: number;
  runs: number;
  wickets: number;
  overs: string;
  phase: string;
};

export type CricketMatchSummary = {
  innings: CricketInningsSummary[];
  target: number | null;
  winnerTeamId: number | null;
  resultText: string | null;
  homeTeamId: number;
  awayTeamId: number;
  oversLimit: number;
  currentInnings: number;
  matchStatus: string;
};

export function buildCricketMatchSummary(state: CricketScoreboardState): CricketMatchSummary {
  return {
    innings: state.innings.map((inn) => ({
      innings: inn.innings,
      battingTeamId: inn.battingTeamId,
      bowlingTeamId: inn.bowlingTeamId,
      runs: inn.runs,
      wickets: inn.wickets,
      overs: `${inn.over}.${inn.ball}`,
      phase: inn.phase,
    })),
    target: state.target,
    winnerTeamId: state.winnerTeamId,
    resultText: state.resultText,
    homeTeamId: state.homeTeamId,
    awayTeamId: state.awayTeamId,
    oversLimit: state.oversLimit,
    currentInnings: state.currentInnings,
    matchStatus: state.matchStatus,
  };
}
