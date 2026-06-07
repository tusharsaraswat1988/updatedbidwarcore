import type { MatchMeta, ScoringMatchStatus, ScoringSessionStatus } from "../types";

export type CricketInningsPhase = "not_started" | "in_progress" | "completed";

export type CricketInningsState = {
  innings: number;
  battingTeamId: number;
  bowlingTeamId: number;
  runs: number;
  wickets: number;
  over: number;
  ball: number;
  phase: CricketInningsPhase;
};

export type CricketScoreboardState = {
  sportSlug: "cricket";
  matchId: number;
  tournamentId: number;
  homeTeamId: number;
  awayTeamId: number;
  matchStatus: ScoringMatchStatus;
  sessionStatus: ScoringSessionStatus;
  oversLimit: number;
  tossWinnerTeamId: number | null;
  electedTo: "bat" | "bowl" | null;
  currentInnings: number;
  innings: CricketInningsState[];
  lineups: Record<number, number[]>;
  lastSequence: number;
};

export function createInitialCricketState(meta: MatchMeta): CricketScoreboardState {
  return {
    sportSlug: "cricket",
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    homeTeamId: meta.homeTeamId,
    awayTeamId: meta.awayTeamId,
    matchStatus: "scheduled",
    sessionStatus: "idle",
    oversLimit: meta.oversLimit,
    tossWinnerTeamId: null,
    electedTo: null,
    currentInnings: 0,
    innings: [],
    lineups: {},
    lastSequence: 0,
  };
}
