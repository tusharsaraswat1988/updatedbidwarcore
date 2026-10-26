import { describe, it, expect } from "vitest";
import {
  createInitialCricketState,
  reduceCricket,
  replayCricketEvents,
  deriveCricketMatchResult,
  isCricketMatchTerminalState,
  getSuperOverPairNumber,
  isSuperOverInnings,
  buildStandingsFromMatches,
  buildCricketMatchSummary,
  buildCricketScorecardFromEvents,
  scorecardToPlayerStats,
  CricketEventType,
  type ScoringEventEnvelope,
} from "../index";

const BASE_META = {
  matchId: 1,
  tournamentId: 100,
  homeTeamId: 10,
  awayTeamId: 20,
  oversLimit: 20,
  maxWickets: 10,
  superOverEnabled: true,
  superOverOvers: 1,
  superOverWickets: 2,
};

let seq = 0;
function resetSeq() {
  seq = 0;
}

function mkEnvelope(
  eventType: string,
  payload: Record<string, unknown>,
): ScoringEventEnvelope {
  seq += 1;
  return {
    id: seq,
    sequence: seq,
    matchId: 1,
    tournamentId: 100,
    sportSlug: "cricket",
    eventType,
    payload,
    recordedAt: "2026-01-01T00:00:00.000Z",
    receivedAt: "2026-01-01T00:00:00.000Z",
  };
}

function buildRegulationTieState() {
  resetSeq();
  let state = createInitialCricketState(BASE_META);
  state = reduceCricket(
    state,
    mkEnvelope(CricketEventType.MATCH_STARTED, {
      tossWinnerTeamId: 10,
      electedTo: "bat",
      oversLimit: 20,
    }),
  );
  // Innings 1: 50 runs
  state = reduceCricket(
    state,
    mkEnvelope(CricketEventType.INNINGS_ENDED, {
      innings: 1,
      reason: "overs_complete",
      runs: 50,
      wickets: 5,
      overs: "20.0",
    }),
  );
  // Innings 2: 50 runs (Tie)
  state = reduceCricket(
    state,
    mkEnvelope(CricketEventType.INNINGS_ENDED, {
      innings: 2,
      reason: "super_over_required",
      runs: 50,
      wickets: 5,
      overs: "20.0",
    }),
  );
  return state;
}

describe("Repeated Super Overs Until a Winner", () => {
  // A. First Super Over after regulation tie
  it("A. First Super Over (pair 1) starts correctly after regulation tie", () => {
    const state = buildRegulationTieState();
    const so1 = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, {
        innings: 3,
        battingTeamId: 10,
        bowlingTeamId: 20,
        oversLimit: 1,
      }),
      { enforceLiveRules: true },
    );

    expect(so1.currentInnings).toBe(3);
    expect(so1.matchStatus).toBe("live");
    expect(so1.innings.find((i) => i.innings === 3)!.kind).toBe("super_over");
    expect(so1.innings.find((i) => i.innings === 3)!.phase).toBe("in_progress");
    expect(getSuperOverPairNumber(3)).toBe(1);
    expect(isSuperOverInnings(3)).toBe(true);
  });

  // B. First Super Over tied → match remains live
  it("B. First Super Over tied → match remains live, winnerTeamId is null, MATCH_COMPLETED rejected", () => {
    let state = buildRegulationTieState();
    // Super Over 1: innings 3 (Team 10)
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, {
        innings: 3,
        battingTeamId: 10,
        bowlingTeamId: 20,
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, {
        innings: 3,
        reason: "overs_complete",
        runs: 10,
        wickets: 1,
        overs: "1.0",
      }),
      { enforceLiveRules: true },
    );
    // Super Over 1: innings 4 (Team 20)
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, {
        innings: 4,
        battingTeamId: 20,
        bowlingTeamId: 10,
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, {
        innings: 4,
        reason: "overs_complete",
        runs: 10,
        wickets: 1,
        overs: "1.0",
      }),
      { enforceLiveRules: true },
    );

    const result = deriveCricketMatchResult(state);
    expect(result.isTie).toBe(true);
    expect(result.winnerTeamId).toBeNull();
    expect(result.resultText).toBe("Super Over tied");
    expect(state.matchStatus).toBe("live");

    const terminalCheck = isCricketMatchTerminalState(state);
    expect(terminalCheck.valid).toBe(false);
    expect(terminalCheck.reason).toMatch(/Super Over is tied, another Super Over is required/);

    expect(() =>
      reduceCricket(
        state,
        mkEnvelope(CricketEventType.MATCH_COMPLETED, {
          winnerTeamId: null,
          margin: "tie",
          resultText: "Super Over tied",
        }),
      ),
    ).toThrow(/Super Over is tied, another Super Over is required/);
  });

  // C. Second Super Over starts with innings 5
  it("C. Second Super Over starts with innings 5 with fresh state", () => {
    let state = buildRegulationTieState();
    // Pair 1 (innings 3 & 4) tied at 10
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, {
        innings: 3,
        battingTeamId: 10,
        bowlingTeamId: 20,
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, {
        innings: 3,
        reason: "overs_complete",
        runs: 10,
        wickets: 1,
        overs: "1.0",
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, {
        innings: 4,
        battingTeamId: 20,
        bowlingTeamId: 10,
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, {
        innings: 4,
        reason: "overs_complete",
        runs: 10,
        wickets: 1,
        overs: "1.0",
      }),
      { enforceLiveRules: true },
    );

    // Start Pair 2 (innings 5)
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, {
        innings: 5,
        battingTeamId: 20,
        bowlingTeamId: 10,
        oversLimit: 1,
      }),
      { enforceLiveRules: true },
    );

    expect(state.currentInnings).toBe(5);
    const inn5 = state.innings.find((i) => i.innings === 5)!;
    expect(inn5).toBeDefined();
    expect(inn5.over).toBe(0);
    expect(inn5.ball).toBe(0);
    expect(inn5.runs).toBe(0);
    expect(inn5.wickets).toBe(0);
    expect(inn5.phase).toBe("in_progress");
    expect(inn5.kind).toBe("super_over");
    expect(getSuperOverPairNumber(5)).toBe(2);
    expect(getSuperOverPairNumber(6)).toBe(2);
  });

  // D. Second Super Over decisive → match completes
  it("D. Second Super Over decisive → match completes with decisive winner", () => {
    let state = buildRegulationTieState();
    // Pair 1 tied (10 vs 10)
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }),
      { enforceLiveRules: true },
    );

    // Pair 2 (innings 5 & 6): Team 20 scores 12, Team 10 scores 15
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 20, bowlingTeamId: 10 }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 5, reason: "overs_complete", runs: 12, wickets: 0, overs: "1.0" }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 6, battingTeamId: 10, bowlingTeamId: 20 }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 6, reason: "overs_complete", runs: 15, wickets: 0, overs: "0.5" }),
      { enforceLiveRules: true },
    );

    const result = deriveCricketMatchResult(state);
    expect(result.winnerTeamId).toBe(10);
    expect(result.isTie).toBe(false);
    expect(result.resultText).toBe("Won in Super Over");
    expect(result.margin).toBe("Super Over");

    const terminalCheck = isCricketMatchTerminalState(state);
    expect(terminalCheck.valid).toBe(true);

    state = reduceCricket(
      state,
      mkEnvelope(CricketEventType.MATCH_COMPLETED, {
        winnerTeamId: 10,
        margin: "Super Over",
        resultText: "Won in Super Over",
      }),
    );
    expect(state.matchStatus).toBe("completed");
    expect(state.winnerTeamId).toBe(10);
  });

  // E. Two consecutive tied Super Over pairs → third pair starts with innings 7
  it("E. Two consecutive tied Super Over pairs (3/4 and 5/6) → third pair starts with innings 7", () => {
    let state = buildRegulationTieState();
    // Pair 1: innings 3 & 4 tied at 10
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });

    // Pair 2: innings 5 & 6 tied at 14
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 5, reason: "overs_complete", runs: 14, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 6, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 6, reason: "overs_complete", runs: 14, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });

    const result = deriveCricketMatchResult(state);
    expect(result.isTie).toBe(true);
    expect(result.winnerTeamId).toBeNull();
    expect(isCricketMatchTerminalState(state).valid).toBe(false);

    // Pair 3: starts with innings 7
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 7, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    expect(state.currentInnings).toBe(7);
    expect(getSuperOverPairNumber(7)).toBe(3);
    expect(getSuperOverPairNumber(8)).toBe(3);
  });

  // F. Third pair decisive → match completes
  it("F. Third Super Over pair decisive → match completes", () => {
    let state = buildRegulationTieState();
    // Pair 1: 10 vs 10
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });

    // Pair 2: 14 vs 14
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 5, reason: "overs_complete", runs: 14, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 6, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 6, reason: "overs_complete", runs: 14, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });

    // Pair 3: innings 7 (18 runs) vs innings 8 (12 runs) → Team 10 wins
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 7, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 7, reason: "overs_complete", runs: 18, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 8, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 8, reason: "overs_complete", runs: 12, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });

    const result = deriveCricketMatchResult(state);
    expect(result.winnerTeamId).toBe(10);
    expect(result.isTie).toBe(false);
    expect(isCricketMatchTerminalState(state).valid).toBe(true);

    state = reduceCricket(state, mkEnvelope(CricketEventType.MATCH_COMPLETED, {
      winnerTeamId: 10,
      margin: "Super Over",
      resultText: "Won in Super Over",
    }));
    expect(state.matchStatus).toBe("completed");
    expect(state.winnerTeamId).toBe(10);
  });

  // G. No artificial innings <= 4 restriction (innings 3, 4, 5, 6, 7, 8, 9, 10...)
  it("G. Domain supports deep repeated Super Overs (e.g. innings 9, 10) without arbitrary limit", () => {
    let state = buildRegulationTieState();
    // 4 tied pairs: 3/4, 5/6, 7/8, 9/10
    const pairs = [
      { innA: 3, innB: 4, teamA: 10, teamB: 20, runs: 11 },
      { innA: 5, innB: 6, teamA: 20, teamB: 10, runs: 12 },
      { innA: 7, innB: 8, teamA: 10, teamB: 20, runs: 13 },
      { innA: 9, innB: 10, teamA: 20, teamB: 10, runs: 14 },
    ];

    for (const p of pairs) {
      state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: p.innA, battingTeamId: p.teamA, bowlingTeamId: p.teamB }), { enforceLiveRules: true });
      state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: p.innA, reason: "overs_complete", runs: p.runs, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
      state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: p.innB, battingTeamId: p.teamB, bowlingTeamId: p.teamA }), { enforceLiveRules: true });
      state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: p.innB, reason: "overs_complete", runs: p.runs, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    }

    expect(state.innings.length).toBe(10);
    expect(getSuperOverPairNumber(9)).toBe(4);
    expect(getSuperOverPairNumber(10)).toBe(4);

    // Pair 5 (innings 11 & 12): decisive
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 11, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 11, reason: "overs_complete", runs: 20, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 12, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 12, reason: "overs_complete", runs: 15, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });

    const result = deriveCricketMatchResult(state);
    expect(result.winnerTeamId).toBe(10);
    expect(isCricketMatchTerminalState(state).valid).toBe(true);
  });

  // H. Invalid skipped Super Over pair
  it("H. Rejects skipped Super Over innings number (e.g. attempting innings 7 after innings 4)", () => {
    let state = buildRegulationTieState();
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });

    // Attempting innings 7 directly instead of 5
    expect(() =>
      reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 7, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true }),
    ).toThrow(/Super Over innings number must be 5, got 7/);
  });

  // I. Invalid duplicate Super Over innings
  it("I. Rejects duplicate Super Over innings number", () => {
    let state = buildRegulationTieState();
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });

    // Attempting to start innings 3 again
    expect(() =>
      reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true }),
    ).toThrow(/Super Over innings number must be 4, got 3/);
  });

  // J. Cannot start next pair while previous pair incomplete
  it("J. Rejects starting next Super Over pair while previous innings is incomplete", () => {
    let state = buildRegulationTieState();
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    // Innings 3 is in progress

    // Attempting to start innings 4 while 3 is in progress
    expect(() =>
      reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true }),
    ).toThrow(/previous Super Over innings is not yet completed/);
  });

  // K. Cannot start another pair after decisive result
  it("K. Rejects starting another Super Over pair when immediately preceding pair was decisive", () => {
    let state = buildRegulationTieState();
    // Pair 1 decisive: 10 vs 15
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 15, wickets: 0, overs: "0.5" }), { enforceLiveRules: true });

    expect(() =>
      reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true }),
    ).toThrow(/the previous Super Over already produced a decisive result/);
  });

  // L. MATCH_COMPLETED rejected after tied Super Over
  it("L. Rejects MATCH_COMPLETED after a tied Super Over pair", () => {
    let state = buildRegulationTieState();
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 12, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 12, wickets: 1, overs: "1.0" }), { enforceLiveRules: true });

    expect(() =>
      reduceCricket(state, mkEnvelope(CricketEventType.MATCH_COMPLETED, { winnerTeamId: 10, margin: "Super Over", resultText: "Won in Super Over" })),
    ).toThrow(/Super Over is tied, another Super Over is required/);
  });

  // M & N. Fresh ball/over and score/wickets/target state for every pair
  it("M & N. Every Super Over innings starts with isolated score, wickets, over, ball, target", () => {
    let state = buildRegulationTieState();
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    const inn3 = state.innings.find((i) => i.innings === 3)!;
    expect(inn3.runs).toBe(0);
    expect(inn3.wickets).toBe(0);
    expect(inn3.over).toBe(0);
    expect(inn3.ball).toBe(0);
    expect(state.target).toBeNull();
    expect(state.strikerId).toBeNull();
    expect(state.nonStrikerId).toBeNull();
    expect(state.bowlerId).toBeNull();

    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 2, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 2, overs: "1.0" }), { enforceLiveRules: true });

    // Pair 2 (innings 5)
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    const inn5 = state.innings.find((i) => i.innings === 5)!;
    expect(inn5.runs).toBe(0);
    expect(inn5.wickets).toBe(0);
    expect(inn5.over).toBe(0);
    expect(inn5.ball).toBe(0);
    expect(state.target).toBeNull();
  });

  // O. Replay determinism for 2 Super Over pairs
  it("O. Replay determinism: 2 Super Over pairs produces identical state", () => {
    resetSeq();
    const events = [
      mkEnvelope(CricketEventType.MATCH_STARTED, { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 1, reason: "overs_complete", runs: 50, wickets: 5, overs: "20.0" }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 2, reason: "super_over_required", runs: 50, wickets: 5, overs: "20.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 20, bowlingTeamId: 10 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 5, reason: "overs_complete", runs: 12, wickets: 0, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 6, battingTeamId: 10, bowlingTeamId: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 6, reason: "overs_complete", runs: 15, wickets: 0, overs: "0.5" }),
      mkEnvelope(CricketEventType.MATCH_COMPLETED, { winnerTeamId: 10, margin: "Super Over", resultText: "Won in Super Over" }),
    ];

    let liveState = createInitialCricketState(BASE_META);
    for (const e of events) {
      liveState = reduceCricket(liveState, e);
    }

    const replayState = replayCricketEvents(BASE_META, events);
    expect(replayState.matchStatus).toBe("completed");
    expect(replayState.winnerTeamId).toBe(10);
    expect(replayState.innings.length).toBe(6);
    expect(replayState).toEqual(liveState);
  });

  // P. Replay determinism for 3 Super Over pairs
  it("P. Replay determinism: 3 Super Over pairs produces identical state", () => {
    resetSeq();
    const events = [
      mkEnvelope(CricketEventType.MATCH_STARTED, { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 1, reason: "overs_complete", runs: 50, wickets: 5, overs: "20.0" }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 2, reason: "super_over_required", runs: 50, wickets: 5, overs: "20.0" }),
      // Pair 1: tied 8-8
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 8, wickets: 1, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 8, wickets: 1, overs: "1.0" }),
      // Pair 2: tied 11-11
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 20, bowlingTeamId: 10 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 5, reason: "overs_complete", runs: 11, wickets: 0, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 6, battingTeamId: 10, bowlingTeamId: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 6, reason: "overs_complete", runs: 11, wickets: 0, overs: "1.0" }),
      // Pair 3: Team 10 scores 16, Team 20 scores 14 → Team 10 wins
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 7, battingTeamId: 10, bowlingTeamId: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 7, reason: "overs_complete", runs: 16, wickets: 0, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 8, battingTeamId: 20, bowlingTeamId: 10 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 8, reason: "overs_complete", runs: 14, wickets: 1, overs: "1.0" }),
      mkEnvelope(CricketEventType.MATCH_COMPLETED, { winnerTeamId: 10, margin: "Super Over", resultText: "Won in Super Over" }),
    ];

    let liveState = createInitialCricketState(BASE_META);
    for (const e of events) {
      liveState = reduceCricket(liveState, e);
    }

    const replayState = replayCricketEvents(BASE_META, events);
    expect(replayState.matchStatus).toBe("completed");
    expect(replayState.winnerTeamId).toBe(10);
    expect(replayState.innings.length).toBe(8);
    expect(replayState).toEqual(liveState);
  });

  // Q. Stats isolation across multiple Super Over pairs
  it("Q. Stats and scorecard isolation: individual super over innings tracked, excluded from NRR", () => {
    resetSeq();
    const events = [
      mkEnvelope(CricketEventType.MATCH_STARTED, { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 1, reason: "overs_complete", runs: 100, wickets: 5, overs: "20.0" }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 2, reason: "super_over_required", runs: 100, wickets: 5, overs: "20.0" }),
      // Pair 1
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }),
      mkEnvelope(CricketEventType.BALL_RECORDED, {
        innings: 3, over: 0, ball: 1, strikerId: 101, nonStrikerId: 102, bowlerId: 201, runsOffBat: 6,
        extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true,
      }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 6, wickets: 0, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }),
      mkEnvelope(CricketEventType.BALL_RECORDED, {
        innings: 4, over: 0, ball: 1, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 6,
        extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true,
      }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 6, wickets: 0, overs: "1.0" }),
      // Pair 2
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 20, bowlingTeamId: 10 }),
      mkEnvelope(CricketEventType.BALL_RECORDED, {
        innings: 5, over: 0, ball: 1, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 4,
        extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true,
      }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 5, reason: "overs_complete", runs: 4, wickets: 0, overs: "1.0" }),
      mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 6, battingTeamId: 10, bowlingTeamId: 20 }),
      mkEnvelope(CricketEventType.BALL_RECORDED, {
        innings: 6, over: 0, ball: 1, strikerId: 101, nonStrikerId: 102, bowlerId: 201, runsOffBat: 6,
        extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true,
      }),
      mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 6, reason: "overs_complete", runs: 6, wickets: 0, overs: "0.1" }),
      mkEnvelope(CricketEventType.MATCH_COMPLETED, { winnerTeamId: 10, margin: "Super Over", resultText: "Won in Super Over" }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, BASE_META);
    expect(scorecard.innings.length).toBe(6);
    expect(scorecard.innings.map((i) => i.innings)).toEqual([1, 2, 3, 4, 5, 6]);

    let state = createInitialCricketState(BASE_META);
    for (const e of events) {
      state = reduceCricket(state, e);
    }
    const summary = buildCricketMatchSummary(state);
    const standings = buildStandingsFromMatches([10, 20], [
      {
        matchId: 1,
        homeTeamId: 10,
        awayTeamId: 20,
        status: "completed",
        isTie: false,
        summary,
      },
    ]);

    const team10 = standings.find((s) => s.teamId === 10)!;
    const team20 = standings.find((s) => s.teamId === 20)!;
    expect(team10.points).toBe(2);
    expect(team20.points).toBe(0);
    // Super Over runs excluded from NRR: only regulation 100 runs in 20.0 overs count
    expect(team10.runsScored).toBe(100);
    expect(team10.oversFaced).toBe(20);
    expect(team20.runsScored).toBe(100);
    expect(team20.oversFaced).toBe(20);
    expect(team10.netRunRate).toBe(0);
    expect(team20.netRunRate).toBe(0);
  });

  // R. Standings/final projection occurs only after decisive pair
  it("R. Standings do not award points for tied super over pair; awards 2 points only after decisive super over", () => {
    let state = buildRegulationTieState();
    // Pair 1: tied
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });

    // Match is still live
    expect(state.matchStatus).toBe("live");
    expect(state.winnerTeamId).toBeNull();

    // Pair 2: decisive (Team 10 wins)
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 5, reason: "overs_complete", runs: 12, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 6, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 6, reason: "overs_complete", runs: 13, wickets: 0, overs: "0.4" }), { enforceLiveRules: true });

    state = reduceCricket(state, mkEnvelope(CricketEventType.MATCH_COMPLETED, { winnerTeamId: 10, margin: "Super Over", resultText: "Won in Super Over" }));
    expect(state.matchStatus).toBe("completed");
    expect(state.winnerTeamId).toBe(10);
  });

  // S. DLS remains prohibited during repeated Super Overs
  it("S. DLS is prohibited during repeated Super Overs (innings 5, 6, etc.)", () => {
    let state = buildRegulationTieState();
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 3, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }), { enforceLiveRules: true });
    state = reduceCricket(state, mkEnvelope(CricketEventType.INNINGS_ENDED, { innings: 4, reason: "overs_complete", runs: 10, wickets: 0, overs: "1.0" }), { enforceLiveRules: true });

    state = reduceCricket(state, mkEnvelope(CricketEventType.SUPER_OVER_STARTED, { innings: 5, battingTeamId: 10, bowlingTeamId: 20 }), { enforceLiveRules: true });

    // Attempting DLS on innings 5
    expect(() =>
      reduceCricket(state, mkEnvelope(CricketEventType.DLS_APPLIED, { innings: 5, revisedOvers: 1, parScore: 5, target: 6 }), { enforceLiveRules: true }),
    ).toThrow(/DLS cannot be applied to a Super Over innings/);
  });
});
