import type { CricketScoreboardState } from "./state";

export type CricketInningsSummary = {
  innings: number;
  battingTeamId: number;
  bowlingTeamId: number;
  runs: number;
  wickets: number;
  overs: string;
  phase: string;
  kind?: "normal" | "super_over";
  allOut?: boolean;
  oversLimit?: number;
};

export type CricketMatchSummary = {
  innings: CricketInningsSummary[];
  target: number | null;
  winnerTeamId: number | null;
  resultText: string | null;
  homeTeamId: number;
  awayTeamId: number;
  oversLimit: number;
  maxWickets?: number;
  currentInnings: number;
  matchStatus: string;
  ballsPerOver?: number;
};

export function buildCricketMatchSummary(state: CricketScoreboardState): CricketMatchSummary {
  return {
    innings: state.innings.map((inn) => {
      const innMaxWickets = inn.kind === "super_over" ? state.superOverWickets : state.maxWickets;
      const isAllOut = inn.wickets >= innMaxWickets;
      return {
        innings: inn.innings,
        battingTeamId: inn.battingTeamId,
        bowlingTeamId: inn.bowlingTeamId,
        runs: inn.runs,
        wickets: inn.wickets,
        overs: `${inn.over}.${inn.ball}`,
        phase: inn.phase,
        kind: inn.kind,
        allOut: isAllOut,
        oversLimit: inn.oversLimit || state.revisedOversLimit || state.oversLimit,
      };
    }),
    target: state.target,
    winnerTeamId: state.winnerTeamId,
    resultText: state.resultText,
    homeTeamId: state.homeTeamId,
    awayTeamId: state.awayTeamId,
    oversLimit: state.oversLimit,
    maxWickets: state.maxWickets,
    currentInnings: state.currentInnings,
    matchStatus: state.matchStatus,
    ballsPerOver: state.ballsPerOver,
  };
}
