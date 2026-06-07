import type { MatchMeta, ScoringMatchStatus, ScoringSessionStatus } from "../types";

export type CricketInningsPhase = "not_started" | "in_progress" | "completed";

export type BallDisplayOutcome = {
  over: number;
  ball: number;
  runsOffBat: number;
  extrasType: string | null;
  extrasRuns: number;
  isWicket: boolean;
  isLegalDelivery: boolean;
  label: string;
};

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
  maxWickets: number;
  tossWinnerTeamId: number | null;
  electedTo: "bat" | "bowl" | null;
  currentInnings: number;
  innings: CricketInningsState[];
  lineups: Record<number, number[]>;
  strikerId: number | null;
  nonStrikerId: number | null;
  bowlerId: number | null;
  thisOver: BallDisplayOutcome[];
  target: number | null;
  winnerTeamId: number | null;
  resultText: string | null;
  abandonedReason: string | null;
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
    maxWickets: meta.maxWickets ?? 10,
    tossWinnerTeamId: null,
    electedTo: null,
    currentInnings: 0,
    innings: [],
    lineups: {},
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    thisOver: [],
    target: null,
    winnerTeamId: null,
    resultText: null,
    abandonedReason: null,
    lastSequence: 0,
  };
}

export function getCurrentInnings(state: CricketScoreboardState): CricketInningsState | null {
  if (state.currentInnings <= 0) return null;
  return state.innings.find((i) => i.innings === state.currentInnings) ?? null;
}
