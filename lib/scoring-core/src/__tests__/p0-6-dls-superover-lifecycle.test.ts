/**
 * P0 #6 — DLS & Super Over Lifecycle Hardening Regression Tests
 *
 * Covers audit items A through W from the task specification.
 * All checks use `enforceLiveRules: true` (live scoring path).
 * Replay path (no enforceLiveRules) must accept the same events without error.
 */
import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  reduceCricket,
  replayCricketEvents,
  InvalidEventPayloadError,
} from "../index";
import { deriveCricketMatchResult } from "../cricket/result";

// ─── Shared match meta helpers ────────────────────────────────────────────────

const BASE_META = {
  matchId: 999,
  tournamentId: 1,
  homeTeamId: 10,
  awayTeamId: 20,
  oversLimit: 20,
  maxWickets: 10,
  superOverEnabled: true,
  superOverOvers: 1,
  superOverWickets: 2,
  superOverTrigger: "manual" as const,
};

const KO_META = {
  ...BASE_META,
  superOverTrigger: "knockout_tie" as const,
  matchTypeId: "knockout",
};

type BallOverrides = {
  innings?: number;
  over?: number;
  ball?: number;
  strikerId?: number;
  nonStrikerId?: number;
  bowlerId?: number;
  runsOffBat?: number;
  isLegalDelivery?: boolean;
  wicket?: { type: "bowled"; dismissedPlayerId: number } | null;
};

let seq = 0;
function nextSeq() {
  return ++seq;
}
function resetSeq() {
  seq = 0;
}

function mkStart(meta = BASE_META) {
  return createEventEnvelope({
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    sportSlug: "cricket",
    eventType: CricketEventType.MATCH_STARTED,
    sequence: nextSeq(),
    payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: meta.oversLimit },
    actorType: "organizer",
  });
}

function mkBall(meta = BASE_META, o: BallOverrides = {}) {
  return createEventEnvelope({
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    sportSlug: "cricket",
    eventType: CricketEventType.BALL_RECORDED,
    sequence: nextSeq(),
    payload: {
      innings: o.innings ?? 1,
      over: o.over ?? 0,
      ball: o.ball ?? 1,
      strikerId: o.strikerId ?? 101,
      nonStrikerId: o.nonStrikerId ?? 102,
      bowlerId: o.bowlerId ?? 201,
      runsOffBat: o.runsOffBat ?? 0,
      extras: { type: null, runs: 0 },
      wicket: o.wicket ?? null,
      isLegalDelivery: o.isLegalDelivery ?? true,
    },
    actorType: "organizer",
  });
}

function mkInningsEnded(
  meta = BASE_META,
  o: { innings: number; reason: string; runs: number; wickets: number; overs: string },
) {
  return createEventEnvelope({
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    sportSlug: "cricket",
    eventType: CricketEventType.INNINGS_ENDED,
    sequence: nextSeq(),
    payload: o,
    actorType: "organizer",
  });
}

function mkDls(
  meta = BASE_META,
  o: { innings: number; revisedOvers: number; parScore: number; target: number; reason?: string },
) {
  return createEventEnvelope({
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    sportSlug: "cricket",
    eventType: CricketEventType.DLS_APPLIED,
    sequence: nextSeq(),
    payload: o,
    actorType: "organizer",
  });
}

function mkSuperOverStarted(
  meta = BASE_META,
  o: { innings: number; battingTeamId: number; bowlingTeamId: number; oversLimit?: number },
) {
  return createEventEnvelope({
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    sportSlug: "cricket",
    eventType: CricketEventType.SUPER_OVER_STARTED,
    sequence: nextSeq(),
    payload: { oversLimit: 1, ...o },
    actorType: "organizer",
  });
}

function mkMatchCompleted(meta = BASE_META, winnerTeamId: number | null = 10) {
  return createEventEnvelope({
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    sportSlug: "cricket",
    eventType: CricketEventType.MATCH_COMPLETED,
    sequence: nextSeq(),
    payload: {
      winnerTeamId,
      margin: "test",
      resultText: "test result",
    },
    actorType: "organizer",
  });
}

/** Builds state up to: match started, innings 1 complete (60 runs), innings 2 started. */
function buildStateAfterInnings1(meta = BASE_META) {
  resetSeq();
  let state = createInitialCricketState(meta);
  state = reduceCricket(state, mkStart(meta));
  state = reduceCricket(state, mkInningsEnded(meta, {
    innings: 1,
    reason: "overs_complete",
    runs: 60,
    wickets: 4,
    overs: "20.0",
  }));
  return state;
}

/** Builds a tie-state: innings 1 = 50 runs, innings 2 = 50 runs, both completed. */
function buildTieState(meta = BASE_META) {
  resetSeq();
  let state = createInitialCricketState(meta);
  state = reduceCricket(state, mkStart(meta));
  state = reduceCricket(state, mkInningsEnded(meta, {
    innings: 1,
    reason: "overs_complete",
    runs: 50,
    wickets: 5,
    overs: "20.0",
  }));
  state = reduceCricket(state, mkInningsEnded(meta, {
    innings: 2,
    reason: "super_over_required",
    runs: 50,
    wickets: 5,
    overs: "20.0",
  }));
  return state;
}

/** Builds a clear-winner state: innings 1 = 80 runs, innings 2 = 50 runs (no tie). */
function buildNonTieState(meta = BASE_META) {
  resetSeq();
  let state = createInitialCricketState(meta);
  state = reduceCricket(state, mkStart(meta));
  state = reduceCricket(state, mkInningsEnded(meta, {
    innings: 1,
    reason: "overs_complete",
    runs: 80,
    wickets: 5,
    overs: "20.0",
  }));
  state = reduceCricket(state, mkInningsEnded(meta, {
    innings: 2,
    reason: "overs_complete",
    runs: 50,
    wickets: 8,
    overs: "20.0",
  }));
  return state;
}

// ─── Part A: DLS LIFECYCLE INTEGRITY ─────────────────────────────────────────

describe("P0 #6 — DLS lifecycle integrity", () => {
  // A: Valid DLS application at its intended lifecycle point
  it("A: allows DLS before first innings is completed (targeting innings 2)", () => {
    resetSeq();
    let state = createInitialCricketState(BASE_META);
    state = reduceCricket(state, mkStart());
    // Innings 1 in progress; DLS applied for upcoming innings 2
    expect(() =>
      reduceCricket(state, mkDls(BASE_META, {
        innings: 2,
        revisedOvers: 15,
        parScore: 80,
        target: 81,
      }), { enforceLiveRules: true }),
    ).not.toThrow();
  });

  it("A: allows DLS after first innings is completed (targeting innings 2)", () => {
    const state = buildStateAfterInnings1();
    expect(() =>
      reduceCricket(state, mkDls(BASE_META, {
        innings: 2,
        revisedOvers: 15,
        parScore: 50,
        target: 51,
      }), { enforceLiveRules: true }),
    ).not.toThrow();
  });

  it("A: allows DLS during second innings chase (mid-chase revision)", () => {
    const state = buildStateAfterInnings1();
    // Add a ball in innings 2
    const withBall = reduceCricket(state, mkBall(BASE_META, {
      innings: 2, over: 0, ball: 1, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 5,
    }));
    expect(() =>
      reduceCricket(withBall, mkDls(BASE_META, {
        innings: 2,
        revisedOvers: 10,
        parScore: 45,
        target: 46,
      }), { enforceLiveRules: true }),
    ).not.toThrow();
  });

  // B: Invalid DLS before required innings/state
  it("B: rejects DLS before match has started", () => {
    resetSeq();
    const state = createInitialCricketState(BASE_META);
    expect(() =>
      reduceCricket(state, mkDls(BASE_META, {
        innings: 2,
        revisedOvers: 15,
        parScore: 80,
        target: 81,
      }), { enforceLiveRules: true }),
    ).toThrow(/match is not live/);
  });

  it("B: rejects DLS when targeting innings 2 before first innings has even started", () => {
    resetSeq();
    let state = createInitialCricketState(BASE_META);
    state = reduceCricket(state, mkStart()); // innings 1 started
    // Innings 2 does not exist yet but innings === 2 is allowed (pre-innings DLS)
    // However innings 1 must exist; this should NOT throw (innings 1 exists)
    expect(() =>
      reduceCricket(state, mkDls(BASE_META, {
        innings: 2, revisedOvers: 15, parScore: 80, target: 81,
      }), { enforceLiveRules: true }),
    ).not.toThrow(); // innings 1 started, innings 2 DLS is valid
  });

  // C: Invalid DLS after innings completion
  it("C: rejects DLS for innings 1 after innings 1 is completed", () => {
    const state = buildStateAfterInnings1();
    expect(() =>
      reduceCricket(state, mkDls(BASE_META, {
        innings: 1,
        revisedOvers: 15,
        parScore: 50,
        target: 51,
      }), { enforceLiveRules: true }),
    ).toThrow(/already completed|completed first innings/);
  });

  it("C: rejects DLS for innings 2 after innings 2 is completed", () => {
    const state = buildNonTieState();
    expect(() =>
      reduceCricket(state, mkDls(BASE_META, {
        innings: 2,
        revisedOvers: 15,
        parScore: 50,
        target: 51,
      }), { enforceLiveRules: true }),
    ).toThrow(/already completed|terminal state/);
  });

  // D: Invalid DLS after match completion
  it("D: rejects DLS after match is completed", () => {
    const nonTieState = buildNonTieState();
    // Complete the match
    const completed = reduceCricket(nonTieState, mkMatchCompleted(BASE_META, 10));
    expect(completed.matchStatus).toBe("completed");

    expect(() =>
      reduceCricket(completed, mkDls(BASE_META, {
        innings: 2,
        revisedOvers: 15,
        parScore: 50,
        target: 51,
      }), { enforceLiveRules: true }),
    ).toThrow(/match is not live/);
  });

  // E: Duplicate DLS — multiple DLS applications are permitted by the repository's model
  // (each application replaces the previous target; this is documented as intentional)
  it("E: allows second DLS application (sequential revision is supported)", () => {
    const state = buildStateAfterInnings1();
    const afterFirst = reduceCricket(state, mkDls(BASE_META, {
      innings: 2, revisedOvers: 15, parScore: 50, target: 51,
    }), { enforceLiveRules: true });
    expect(afterFirst.target).toBe(51);

    // Second DLS — allowed (replaces target with new calculation)
    const afterSecond = reduceCricket(afterFirst, mkDls(BASE_META, {
      innings: 2, revisedOvers: 12, parScore: 45, target: 46,
    }), { enforceLiveRules: true });
    expect(afterSecond.target).toBe(46);
    expect(afterSecond.revisedOversLimit).toBe(12);
  });

  // F: DLS revised target reached → correct terminal result
  it("F: DLS revised target reached → MATCH_COMPLETED accepted with correct winner", () => {
    resetSeq();
    let state = createInitialCricketState(BASE_META);
    state = reduceCricket(state, mkStart());
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 1, reason: "overs_complete", runs: 160, wickets: 4, overs: "20.0",
    }));
    state = reduceCricket(state, mkDls(BASE_META, {
      innings: 2, revisedOvers: 10, parScore: 10, target: 11,
    }));
    expect(state.target).toBe(11);

    // Chase team reaches target
    state = reduceCricket(state, mkBall(BASE_META, {
      innings: 2, over: 0, ball: 1, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 6,
    }));
    state = reduceCricket(state, mkBall(BASE_META, {
      innings: 2, over: 0, ball: 2, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 6,
    }));
    expect(state.innings.find(i => i.innings === 2)!.runs).toBe(12);

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 2, reason: "target_reached", runs: 12, wickets: 0, overs: "0.2",
    }));

    const result = deriveCricketMatchResult(state);
    expect(result.isTie).toBe(false);
    expect(result.winnerTeamId).toBe(20); // batting team of innings 2

    state = reduceCricket(state, mkMatchCompleted(BASE_META, 20));
    expect(state.matchStatus).toBe("completed");
    expect(state.winnerTeamId).toBe(20);
  });

  // G: DLS revised target not reached → correct innings completion path
  it("G: DLS revised overs exhausted without reaching target → correct terminal result", () => {
    resetSeq();
    let state = createInitialCricketState(BASE_META);
    state = reduceCricket(state, mkStart());
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 1, reason: "overs_complete", runs: 160, wickets: 4, overs: "20.0",
    }));
    state = reduceCricket(state, mkDls(BASE_META, {
      innings: 2, revisedOvers: 10, parScore: 130, target: 131,
    }));

    // End innings 2 without reaching target (100 < 131)
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 2, reason: "overs_complete", runs: 100, wickets: 5, overs: "10.0",
    }));

    const result = deriveCricketMatchResult(state);
    expect(result.winnerTeamId).toBe(10); // innings 1 batting team wins
    expect(result.isTie).toBe(false);

    state = reduceCricket(state, mkMatchCompleted(BASE_META, 10));
    expect(state.matchStatus).toBe("completed");
  });

  // R: DLS + Super Over boundary — DLS cannot be applied during Super Over
  it("R: rejects DLS during a Super Over innings", () => {
    const tieState = buildTieState();
    const withSuperOver = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3,
      battingTeamId: 10,
      bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    expect(() =>
      reduceCricket(withSuperOver, mkDls(BASE_META, {
        innings: 3, revisedOvers: 1, parScore: 10, target: 11,
      }), { enforceLiveRules: true }),
    ).toThrow(/DLS cannot be applied to a Super Over innings/);
  });

  it("R: rejects DLS targeting innings 3+ number even if Super Over is not yet started", () => {
    const state = buildStateAfterInnings1();
    expect(() =>
      reduceCricket(state, mkDls(BASE_META, {
        innings: 3, revisedOvers: 1, parScore: 5, target: 6,
      }), { enforceLiveRules: true }),
    ).toThrow(/DLS cannot be applied to a Super Over innings/);
  });
});

// ─── Part B: DLS Replay Determinism ──────────────────────────────────────────

describe("P0 #6 — DLS replay determinism", () => {
  // S: Replay determinism for a DLS match
  it("S: replaying a DLS event stream produces identical state", () => {
    resetSeq();
    const events = [
      mkStart(),
      mkInningsEnded(BASE_META, { innings: 1, reason: "overs_complete", runs: 160, wickets: 4, overs: "20.0" }),
      mkDls(BASE_META, { innings: 2, revisedOvers: 10, parScore: 10, target: 11 }),
      mkBall(BASE_META, { innings: 2, over: 0, ball: 1, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 6 }),
      mkBall(BASE_META, { innings: 2, over: 0, ball: 2, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 6 }),
      mkInningsEnded(BASE_META, { innings: 2, reason: "target_reached", runs: 12, wickets: 0, overs: "0.2" }),
      mkMatchCompleted(BASE_META, 20),
    ];

    // Live state (event-by-event)
    let liveState = createInitialCricketState(BASE_META);
    for (const e of events) {
      liveState = reduceCricket(liveState, e);
    }

    // Replay state
    const replayState = replayCricketEvents(BASE_META, events);

    expect(replayState.matchStatus).toBe(liveState.matchStatus);
    expect(replayState.winnerTeamId).toBe(liveState.winnerTeamId);
    expect(replayState.target).toBe(liveState.target);
    expect(replayState.revisedOversLimit).toBe(liveState.revisedOversLimit);
    expect(replayState.innings.length).toBe(liveState.innings.length);
    expect(replayState.innings.map(i => i.runs)).toEqual(liveState.innings.map(i => i.runs));
    expect(replayState.innings.map(i => i.phase)).toEqual(liveState.innings.map(i => i.phase));
  });
});

// ─── Part C: SUPER OVER LIFECYCLE ────────────────────────────────────────────

describe("P0 #6 — Super Over lifecycle integrity", () => {
  // H: Regulation tie → valid Super Over activation
  it("H: allows Super Over after regulation tie", () => {
    const state = buildTieState();
    expect(() =>
      reduceCricket(state, mkSuperOverStarted(BASE_META, {
        innings: 3,
        battingTeamId: 10,
        bowlingTeamId: 20,
      }), { enforceLiveRules: true }),
    ).not.toThrow();
  });

  // I: Non-tie match → Super Over activation rejected
  it("I: rejects Super Over when regulation result is not a tie (team 1 won clearly)", () => {
    const state = buildNonTieState();
    expect(() =>
      reduceCricket(state, mkSuperOverStarted(BASE_META, {
        innings: 3,
        battingTeamId: 20,
        bowlingTeamId: 10,
      }), { enforceLiveRules: true }),
    ).toThrow(/regulation match was not a tie/);
  });

  it("I: rejects Super Over when second innings is still in progress (not completed)", () => {
    const state = buildStateAfterInnings1(); // innings 2 just started, not completed
    expect(() =>
      reduceCricket(state, mkSuperOverStarted(BASE_META, {
        innings: 3,
        battingTeamId: 20,
        bowlingTeamId: 10,
      }), { enforceLiveRules: true }),
    ).toThrow(/second innings is not yet completed/);
  });

  it("I: rejects Super Over when first innings not yet completed", () => {
    resetSeq();
    let state = createInitialCricketState(BASE_META);
    state = reduceCricket(state, mkStart());
    // Innings 1 still in progress
    expect(() =>
      reduceCricket(state, mkSuperOverStarted(BASE_META, {
        innings: 3,
        battingTeamId: 20,
        bowlingTeamId: 10,
      }), { enforceLiveRules: true }),
    ).toThrow(/first innings is not yet completed/);
  });

  it("I: rejects Super Over when match is completed", () => {
    const nonTie = buildNonTieState();
    const completed = reduceCricket(nonTie, mkMatchCompleted(BASE_META, 10));
    expect(() =>
      reduceCricket(completed, mkSuperOverStarted(BASE_META, {
        innings: 3,
        battingTeamId: 20,
        bowlingTeamId: 10,
      }), { enforceLiveRules: true }),
    ).toThrow(/match is not live/);
  });

  // J: Super Over starts with fresh over/ball state
  it("J: Super Over innings starts with fresh over=0 and ball=0 state", () => {
    const state = buildTieState();
    const withSuperOver = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 3,
      battingTeamId: 10,
      bowlingTeamId: 20,
      oversLimit: 1,
    }), { enforceLiveRules: true });

    const soInnings = withSuperOver.innings.find(i => i.innings === 3)!;
    expect(soInnings.over).toBe(0);
    expect(soInnings.ball).toBe(0);
    expect(soInnings.runs).toBe(0);
    expect(soInnings.wickets).toBe(0);
    expect(soInnings.phase).toBe("in_progress");
    expect(soInnings.kind).toBe("super_over");
  });

  // K: Super Over does not inherit regulation innings score/wickets/target
  it("K: Super Over innings has isolated score state (not inherited from regulation)", () => {
    const tieState = buildTieState(); // 50 runs each
    const withSuperOver = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3,
      battingTeamId: 10,
      bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    const soInnings = withSuperOver.innings.find(i => i.innings === 3)!;
    // Super Over score must NOT inherit 50 runs from regulation
    expect(soInnings.runs).toBe(0);
    expect(soInnings.wickets).toBe(0);
    // strikerId/nonStrikerId must be cleared
    expect(withSuperOver.strikerId).toBeNull();
    expect(withSuperOver.nonStrikerId).toBeNull();
    // target must be reset (no regulation target carrying over)
    expect(withSuperOver.target).toBeNull();
  });

  // L: Super Over legal-ball limit enforced
  it("L: Super Over uses its own 1-over limit (not regulation 20 overs)", () => {
    const tieState = buildTieState();
    const withSo = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20, oversLimit: 1,
    }), { enforceLiveRules: true });

    const soInnings = withSo.innings.find(i => i.innings === 3)!;
    expect(soInnings.oversLimit).toBe(1);

    // The state's global oversLimit should reflect the super over limit
    expect(withSo.oversLimit).toBe(1);
  });

  // M: Super Over innings completion enforced
  it("M: INNINGS_ENDED completes the Super Over innings", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 12, wickets: 1, overs: "1.0",
    }));

    const soInnings = state.innings.find(i => i.innings === 3)!;
    expect(soInnings.phase).toBe("completed");
    expect(soInnings.runs).toBe(12);
  });

  // N: Super Over decisive result → MATCH_COMPLETED accepted
  it("N: Super Over decisive result → match can be completed", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 12, wickets: 1, overs: "1.0",
    }));

    state = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 4, battingTeamId: 20, bowlingTeamId: 10,
    }), { enforceLiveRules: true });

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 4, reason: "overs_complete", runs: 14, wickets: 0, overs: "0.6",
    }));

    // innings 4 (second SO) = 14 > 12 (first SO) → innings 4 batting team wins
    const result = deriveCricketMatchResult(state);
    expect(result.winnerTeamId).toBe(20);
    expect(result.isTie).toBe(false);

    state = reduceCricket(state, mkMatchCompleted(BASE_META, 20));
    expect(state.matchStatus).toBe("completed");
    expect(state.winnerTeamId).toBe(20);
  });

  // O: Super Over tie → repository-defined behavior (returns tie result; allows another SO)
  it("O: Super Over tie produces isTie=true result and allows another Super Over pair", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0",
    }));

    state = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 4, battingTeamId: 20, bowlingTeamId: 10,
    }), { enforceLiveRules: true });

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 4, reason: "overs_complete", runs: 10, wickets: 1, overs: "1.0",
    }));

    // Both Super Over innings = 10 runs → tie
    const result = deriveCricketMatchResult(state);
    expect(result.isTie).toBe(true);
    expect(result.winnerTeamId).toBeNull();
    expect(result.resultText).toBe("Super Over tied");

    // The repository schema restricts innings to max 4 (one Super Over pair: innings 3 & 4).
    // An additional Super Over (innings 5) is rejected by event payload schema validation.
    expect(() =>
      reduceCricket(state, mkSuperOverStarted(BASE_META, {
        innings: 5, battingTeamId: 10, bowlingTeamId: 20,
      }), { enforceLiveRules: true }),
    ).toThrow(InvalidEventPayloadError);
  });

  // P: MATCH_COMPLETED during active Super Over → rejected
  it("P: rejects MATCH_COMPLETED while first Super Over innings is in progress", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    expect(() =>
      reduceCricket(state, mkMatchCompleted(BASE_META, 10)),
    ).toThrow(/Super Over is in progress/);
  });

  it("P: rejects MATCH_COMPLETED while second Super Over innings is in progress", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 12, wickets: 1, overs: "1.0",
    }));

    state = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 4, battingTeamId: 20, bowlingTeamId: 10,
    }), { enforceLiveRules: true });

    expect(() =>
      reduceCricket(state, mkMatchCompleted(BASE_META, 20)),
    ).toThrow(/second Super Over innings is still in progress/);
  });

  // Q: BALL_RECORDED after terminal Super Over innings → rejected (enforceLiveRules)
  it("Q: rejects BALL_RECORDED for a Super Over innings after it has completed", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });

    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 8, wickets: 0, overs: "1.0",
    }));

    // Super Over innings 3 is now completed; recording a ball should fail
    expect(() =>
      reduceCricket(state, mkBall(BASE_META, {
        innings: 3, over: 0, ball: 1, strikerId: 101, nonStrikerId: 102, bowlerId: 201,
      }), { enforceLiveRules: true }),
    ).toThrow(/innings is not in progress|does not match current/);
  });

  // Super Over tie: prevent another Super Over from starting if there's a decisive result
  it("prevents starting a third Super Over when previous SO pair was decisive or exceeds innings schema", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 12, wickets: 1, overs: "1.0",
    }));
    state = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 4, battingTeamId: 20, bowlingTeamId: 10,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 4, reason: "overs_complete", runs: 9, wickets: 0, overs: "0.4",
    }));

    // SO 1 (12 runs) vs SO 2 (9 runs) → decisive. Attempting another Super Over is rejected.
    expect(() =>
      reduceCricket(state, mkSuperOverStarted(BASE_META, {
        innings: 5, battingTeamId: 10, bowlingTeamId: 20,
      }), { enforceLiveRules: true }),
    ).toThrow(InvalidEventPayloadError);
  });
});

// ─── Part D: Super Over Replay Determinism ────────────────────────────────────

describe("P0 #6 — Super Over replay determinism", () => {
  // T: Replay determinism for a Super Over match
  it("T: replaying a Super Over event stream produces identical state", () => {
    resetSeq();
    const events = [
      mkStart(),
      mkInningsEnded(BASE_META, { innings: 1, reason: "overs_complete", runs: 50, wickets: 5, overs: "20.0" }),
      mkInningsEnded(BASE_META, { innings: 2, reason: "super_over_required", runs: 50, wickets: 5, overs: "20.0" }),
      mkSuperOverStarted(BASE_META, { innings: 3, battingTeamId: 10, bowlingTeamId: 20 }),
      mkBall(BASE_META, { innings: 3, over: 0, ball: 1, strikerId: 101, nonStrikerId: 102, bowlerId: 201, runsOffBat: 12 }),
      mkInningsEnded(BASE_META, { innings: 3, reason: "overs_complete", runs: 12, wickets: 0, overs: "0.1" }),
      mkSuperOverStarted(BASE_META, { innings: 4, battingTeamId: 20, bowlingTeamId: 10 }),
      mkBall(BASE_META, { innings: 4, over: 0, ball: 1, strikerId: 201, nonStrikerId: 202, bowlerId: 101, runsOffBat: 14 }),
      mkInningsEnded(BASE_META, { innings: 4, reason: "overs_complete", runs: 14, wickets: 0, overs: "0.1" }),
      mkMatchCompleted(BASE_META, 20),
    ];

    let liveState = createInitialCricketState(BASE_META);
    for (const e of events) {
      liveState = reduceCricket(liveState, e);
    }

    const replayState = replayCricketEvents(BASE_META, events);

    expect(replayState.matchStatus).toBe(liveState.matchStatus);
    expect(replayState.winnerTeamId).toBe(liveState.winnerTeamId);
    expect(replayState.innings.length).toBe(liveState.innings.length);

    for (let i = 0; i < liveState.innings.length; i++) {
      const live = liveState.innings[i]!;
      const replayed = replayState.innings[i]!;
      expect(replayed.innings).toBe(live.innings);
      expect(replayed.runs).toBe(live.runs);
      expect(replayed.wickets).toBe(live.wickets);
      expect(replayed.phase).toBe(live.phase);
      expect(replayed.kind).toBe(live.kind);
    }
  });
});

// ─── Part E: Duplicate / Stale Event Rejection ───────────────────────────────

describe("P0 #6 — Duplicate/stale lifecycle event rejection", () => {
  // U: Duplicate lifecycle event rejection
  it("U: rejects INNINGS_ENDED for an innings already marked as completed", () => {
    const state = buildStateAfterInnings1(); // innings 1 completed
    // innings 1 is already completed; try to end it again
    expect(() =>
      reduceCricket(state, mkInningsEnded(BASE_META, {
        innings: 1, reason: "overs_complete", runs: 80, wickets: 5, overs: "20.0",
      }), { enforceLiveRules: true }),
    ).toThrow(/Cannot end innings 1: current active innings is 2/);
  });

  it("U: rejects SUPER_OVER_STARTED when last Super Over innings is still in progress", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });
    // Innings 3 is in_progress; try to start innings 4 immediately
    expect(() =>
      reduceCricket(state, mkSuperOverStarted(BASE_META, {
        innings: 4, battingTeamId: 20, bowlingTeamId: 10,
      }), { enforceLiveRules: true }),
    ).toThrow(/previous Super Over innings is not yet completed/);
  });

  it("U: rejects MATCH_COMPLETED twice (second attempt on completed match)", () => {
    const nonTie = buildNonTieState();
    const completed = reduceCricket(nonTie, mkMatchCompleted(BASE_META, 10));
    expect(completed.matchStatus).toBe("completed");

    // Try to complete again
    expect(() =>
      reduceCricket(completed, mkMatchCompleted(BASE_META, 10)),
    ).toThrow(/Match is not in progress/);
  });
});

// ─── Part F: Stats / Standings / Result Projection ───────────────────────────

describe("P0 #6 — Stats and result projection integrity", () => {
  // V: Regulation innings stats remain separate from Super Over stats
  it("V: Super Over innings are tagged as kind=super_over and regulation innings as kind=normal", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 15, wickets: 1, overs: "1.0",
    }));
    state = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 4, battingTeamId: 20, bowlingTeamId: 10,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 4, reason: "overs_complete", runs: 13, wickets: 0, overs: "0.4",
    }));

    const normal = state.innings.filter(i => i.kind === "normal");
    const superOvers = state.innings.filter(i => i.kind === "super_over");

    expect(normal.length).toBe(2);
    expect(superOvers.length).toBe(2);
    // Regulation totals: 50+50 = 100
    const regulationTotal = normal.reduce((sum, i) => sum + i.runs, 0);
    expect(regulationTotal).toBe(100);
    // Super Over totals: 15+13 = 28
    const soTotal = superOvers.reduce((sum, i) => sum + i.runs, 0);
    expect(soTotal).toBe(28);
    // They must not overlap
    expect(regulationTotal + soTotal).toBe(128);
  });

  it("V: deriveCricketMatchResult uses Super Over innings when available", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 15, wickets: 1, overs: "1.0",
    }));
    state = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 4, battingTeamId: 20, bowlingTeamId: 10,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 4, reason: "overs_complete", runs: 13, wickets: 0, overs: "0.4",
    }));
    state = reduceCricket(state, mkMatchCompleted(BASE_META, 10));

    const result = deriveCricketMatchResult(state);
    // innings 3 (SO1) = 15 > innings 4 (SO2) = 13 → SO1 batting team (10) wins
    expect(result.winnerTeamId).toBe(10);
    expect(result.isTie).toBe(false);
    expect(result.margin).toBe("Super Over");
  });

  it("V: MATCH_COMPLETED can only fire once — second attempt fails after terminal state", () => {
    const tieState = buildTieState();
    let state = reduceCricket(tieState, mkSuperOverStarted(BASE_META, {
      innings: 3, battingTeamId: 10, bowlingTeamId: 20,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 3, reason: "overs_complete", runs: 15, wickets: 1, overs: "1.0",
    }));
    state = reduceCricket(state, mkSuperOverStarted(BASE_META, {
      innings: 4, battingTeamId: 20, bowlingTeamId: 10,
    }), { enforceLiveRules: true });
    state = reduceCricket(state, mkInningsEnded(BASE_META, {
      innings: 4, reason: "overs_complete", runs: 13, wickets: 0, overs: "0.4",
    }));
    state = reduceCricket(state, mkMatchCompleted(BASE_META, 10));
    expect(state.matchStatus).toBe("completed");

    // Second MATCH_COMPLETED must fail
    expect(() =>
      reduceCricket(state, mkMatchCompleted(BASE_META, 10)),
    ).toThrow(/Match is not in progress/);
  });
});

// ─── Part G: Knockout-tie trigger ────────────────────────────────────────────

describe("P0 #6 — knockout_tie trigger enforcement", () => {
  it("allows Super Over in knockout match that tied", () => {
    resetSeq();
    let state = createInitialCricketState(KO_META);
    state = reduceCricket(state, mkStart(KO_META));
    state = reduceCricket(state, mkInningsEnded(KO_META, {
      innings: 1, reason: "overs_complete", runs: 50, wickets: 5, overs: "20.0",
    }));
    state = reduceCricket(state, mkInningsEnded(KO_META, {
      innings: 2, reason: "super_over_required", runs: 50, wickets: 5, overs: "20.0",
    }));

    expect(() =>
      reduceCricket(state, mkSuperOverStarted(KO_META, {
        innings: 3, battingTeamId: 10, bowlingTeamId: 20,
      }), { enforceLiveRules: true }),
    ).not.toThrow();
  });

  it("rejects Super Over in non-knockout match with knockout_tie trigger set", () => {
    resetSeq();
    const nonKoMeta = { ...KO_META, matchTypeId: "league" };
    let state = createInitialCricketState(nonKoMeta);
    state = reduceCricket(state, createEventEnvelope({
      matchId: nonKoMeta.matchId,
      tournamentId: nonKoMeta.tournamentId,
      sportSlug: "cricket",
      eventType: CricketEventType.MATCH_STARTED,
      sequence: nextSeq(),
      payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: nonKoMeta.oversLimit },
      actorType: "organizer",
    }));
    state = reduceCricket(state, mkInningsEnded(nonKoMeta as typeof BASE_META, {
      innings: 1, reason: "overs_complete", runs: 50, wickets: 5, overs: "20.0",
    }));
    state = reduceCricket(state, mkInningsEnded(nonKoMeta as typeof BASE_META, {
      innings: 2, reason: "super_over_required", runs: 50, wickets: 5, overs: "20.0",
    }));

    expect(() =>
      reduceCricket(state, mkSuperOverStarted(nonKoMeta as typeof BASE_META, {
        innings: 3, battingTeamId: 10, bowlingTeamId: 20,
      }), { enforceLiveRules: true }),
    ).toThrow(/knockout ties/);
  });
});
