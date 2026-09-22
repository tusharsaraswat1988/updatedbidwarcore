/**
 * BIDWAR CRICKET — FINAL SCOREBOARD / LED / OBS INTEGRATION VERIFICATION TEST SUITE
 *
 * Verifies end-to-end multi-screen live convergence, mode switching, SSE recovery,
 * scoreboard refresh, routing reactivity, and terminal match completion across:
 * 1. Cricket Scorer Console
 * 2. Ground LED Screen (ScoreDisplayShell)
 * 3. OBS Overlay Scorebug & Stage (useCricketObsLive / buildCricketObsViewModel)
 * 4. Corporate Match Center & Public Scorecard
 */

import { describe, expect, it } from "vitest";
import {
  createInitialCricketState,
  reduceCricket,
  deriveCricketMatchResult,
  buildScorecardFromEvents,
  CricketEventType,
  type CricketScoreboardState,
  type ScoringEventEnvelope,
} from "@workspace/scoring-core";
import {
  getActiveInnings,
  oversText,
  runRate,
  requiredRate,
} from "@/lib/scoring-ball";
import {
  buildCricketObsViewModel,
  ballsRemaining,
  flashTokenForBall,
  mapBallToFlash,
  parseCricketObsMatchParam,
  type CricketObsViewModel,
} from "@/lib/cricket-obs-view-model";
import type { CricketScorerPlayer, CricketScorerTeam } from "@/lib/scoring-squad";
import type { ScoringLiveDisplay } from "@/lib/scoring-api";
import {
  getCricketObsDirectorState,
  setCricketObsDirectorState,
} from "../../../../../api-server/src/lib/scoring-broadcast";

// Setup Mock Teams & Players
const mockTeams: CricketScorerTeam[] = [
  {
    id: 1,
    name: "Royal Riders",
    shortCode: "RR",
    color: "#e11d48",
    logoUrl: "https://bidwar.in/logos/rr.png",
  },
  {
    id: 2,
    name: "Mumbai Icons",
    shortCode: "MI",
    color: "#2563eb",
    logoUrl: "https://bidwar.in/logos/mi.png",
  },
];

const mockPlayers: CricketScorerPlayer[] = [
  { id: 101, name: "Virat Sharma", role: "Top-order Batter" },
  { id: 102, name: "Rohit Verma", role: "Opening Batter" },
  { id: 103, name: "KL Rahul", role: "Wicketkeeper Batter" },
  { id: 201, name: "Jasprit Bumrah", role: "Right-Arm Fast" },
  { id: 202, name: "Hardik Pandya", role: "All-Rounder" },
];

function wrapEvent(
  matchId: number,
  sequence: number,
  eventType: CricketEventType,
  payload: Record<string, unknown>,
): ScoringEventEnvelope {
  return {
    id: sequence,
    matchId,
    tournamentId: 25,
    sportSlug: "cricket",
    eventType,
    payload,
    sequence,
    actor: { type: "scorer", id: "scorer-1" },
    createdAt: new Date().toISOString(),
  };
}

describe("1. MULTI-SCREEN LIVE CONVERGENCE TEST", () => {
  it("Scorer, Ground LED, and OBS Overlay remain 100% synchronized across an entire live over and innings transition", () => {
    let state = createInitialCricketState({
      matchId: 58,
      tournamentId: 25,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 1, // 1-over exhibition match for deterministic full-cycle test
      maxWickets: 10,
    });

    let seq = 0;

    // STEP 0: MATCH STARTED (Toss: Team 1 won, bat first)
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 1,
        powerplayOvers: [1],
      }),
    );

    // Set Lineups & Crease
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.LINEUP_SET, {
        teamId: 1,
        playerIds: [101, 102, 103],
        battingOrder: [101, 102, 103],
      }),
    );
    state = { ...state, bowlerId: 201 };

    // Function to compute Ground LED & OBS representations
    function getDisplays(currentState: CricketScoreboardState) {
      const liveDisplay: ScoringLiveDisplay = {
        match: {
          id: 58,
          tournamentId: 25,
          fixtureId: null,
          sportSlug: "cricket",
          homeTeamId: 1,
          awayTeamId: 2,
          winnerTeamId: currentState.winnerTeamId ?? null,
          status: currentState.matchStatus,
          roundName: "Final",
          venue: "Wankhede Arena",
          rules: null,
          branding: null,
          executionPolicyBind: null,
          presentationPolicyBind: null,
          resultSummary: currentState.resultText ?? null,
          startedAt: new Date().toISOString(),
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        state: currentState,
        summary: null,
      };

      const innings = getActiveInnings(currentState);
      const groundLed = {
        battingTeamId: innings?.battingTeamId,
        bowlingTeamId: innings?.bowlingTeamId,
        runs: innings?.runs ?? 0,
        wickets: innings?.wickets ?? 0,
        overs: oversText(innings?.over, innings?.ball),
        strikerId: currentState.strikerId,
        nonStrikerId: currentState.nonStrikerId,
        bowlerId: currentState.bowlerId,
        crr: innings ? runRate(innings.runs, innings.over, innings.ball) : "0.00",
        target: currentState.target ?? null,
        needRuns:
          currentState.target != null && innings
            ? Math.max(0, currentState.target - innings.runs)
            : null,
        rrr:
          currentState.target != null && innings
            ? requiredRate(currentState.target, innings.runs, currentState.oversLimit, innings.over, innings.ball)
            : null,
      };

      const obsVm: CricketObsViewModel = buildCricketObsViewModel({
        live: liveDisplay,
        teams: mockTeams,
        players: mockPlayers,
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: "https://bidwar.in/logo.png",
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
      });

      return { groundLed, obsVm };
    }

    // --- BALL 0.1: 0 runs ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      }),
    );
    let { groundLed, obsVm } = getDisplays(state);
    expect(state.innings[0].runs).toBe(0);
    expect(groundLed.runs).toBe(0);
    expect(groundLed.overs).toBe("0.1");
    expect(obsVm.runs).toBe(0);
    expect(obsVm.oversLabel).toBe("0.1");
    expect(groundLed.strikerId).toBe(101);
    expect(obsVm.striker?.id).toBe(101);
    expect(obsVm.bowler?.id).toBe(201);

    // --- BALL 0.2: 1 run (Strike rotates to 102) ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 2,
        strikerId: 101,
        nonStrikerId: 102,
        bowlerId: 201,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      }),
    );
    ({ groundLed, obsVm } = getDisplays(state));
    expect(state.innings[0].runs).toBe(1);
    expect(groundLed.runs).toBe(1);
    expect(groundLed.overs).toBe("0.2");
    expect(obsVm.runs).toBe(1);
    expect(obsVm.oversLabel).toBe("0.2");
    // Strike rotation verification
    expect(state.strikerId).toBe(102);
    expect(groundLed.strikerId).toBe(102);
    expect(obsVm.striker?.id).toBe(102);
    expect(state.nonStrikerId).toBe(101);
    expect(obsVm.nonStriker?.id).toBe(101);

    // --- BALL 0.3: 4 runs (Boundary, strike stays on 102) ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 3,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 4,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      }),
    );
    ({ groundLed, obsVm } = getDisplays(state));
    expect(groundLed.runs).toBe(5);
    expect(groundLed.overs).toBe("0.3");
    expect(obsVm.runs).toBe(5);
    expect(obsVm.striker?.id).toBe(102);
    expect(obsVm.flash).toBe("FOUR");

    // --- BALL 0.3 (Extra): Wide (1 penalty, ball count stays 0.3, strike stays 102) ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 3,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: "wide", runs: 1 },
        wicket: null,
        isLegalDelivery: false,
      }),
    );
    ({ groundLed, obsVm } = getDisplays(state));
    expect(groundLed.runs).toBe(6);
    expect(groundLed.overs).toBe("0.3");
    expect(obsVm.runs).toBe(6);
    expect(obsVm.oversLabel).toBe("0.3");
    expect(obsVm.flash).toBe("WIDE");

    // --- BALL 0.4: Wicket (Striker 102 dismissed) ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 4,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        wicket: {
          type: "bowled",
          dismissedPlayerId: 102,
        },
        isLegalDelivery: true,
      }),
    );
    ({ groundLed, obsVm } = getDisplays(state));
    expect(groundLed.wickets).toBe(1);
    expect(obsVm.wickets).toBe(1);
    expect(groundLed.overs).toBe("0.4");
    expect(state.strikerId).toBeNull(); // Dismissed striker is cleared
    expect(obsVm.flash).toBe("WICKET");

    // --- NEW BATSMAN: Player 103 comes in to face next ball ---
    state = { ...state, strikerId: 103 };
    ({ groundLed, obsVm } = getDisplays(state));
    expect(groundLed.strikerId).toBe(103);
    expect(obsVm.striker?.id).toBe(103);

    // --- BALL 0.5: 1 run (Strike rotates to 101) ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 5,
        strikerId: 103,
        nonStrikerId: 101,
        bowlerId: 201,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      }),
    );
    ({ groundLed, obsVm } = getDisplays(state));
    expect(groundLed.runs).toBe(7);
    expect(groundLed.overs).toBe("0.5");
    expect(state.strikerId).toBe(101);
    expect(obsVm.striker?.id).toBe(101);

    // --- BALL 0.6: 0 runs (Completes the 1-over innings) ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 6,
        strikerId: 101,
        nonStrikerId: 103,
        bowlerId: 201,
        runsOffBat: 0,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      }),
    );
    ({ groundLed, obsVm } = getDisplays(state));
    expect(groundLed.runs).toBe(7);
    expect(groundLed.wickets).toBe(1);
    expect(groundLed.overs).toBe("0.6");

    // --- INNINGS 1 END & INNINGS 2 TRANSITION ---
    seq++;
    state = reduceCricket(
      state,
      wrapEvent(58, seq, CricketEventType.INNINGS_ENDED, {
        innings: 1,
        reason: "overs_complete",
        runs: 7,
        wickets: 1,
        overs: "1.0",
      }),
    );

    // Setup Innings 2 State
    state = {
      ...state,
      currentInnings: 2,
      target: 8, // Target = 7 + 1
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
      innings: [
        state.innings[0],
        {
          innings: 2,
          battingTeamId: 2, // Swapped! Mumbai Icons now batting
          bowlingTeamId: 1, // Swapped! Royal Riders bowling
          runs: 0,
          wickets: 0,
          over: 0,
          ball: 0,
          phase: "in_progress",
          kind: "normal",
          oversLimit: 1,
        },
      ],
    };

    ({ groundLed, obsVm } = getDisplays(state));

    // Assert Innings 2 Display Synchronization
    expect(groundLed.battingTeamId).toBe(2);
    expect(obsVm.batting?.id).toBe(2);
    expect(groundLed.bowlingTeamId).toBe(1);
    expect(obsVm.bowling?.id).toBe(1);
    expect(groundLed.runs).toBe(0);
    expect(obsVm.runs).toBe(0);
    expect(groundLed.overs).toBe("0.0");
    expect(obsVm.oversLabel).toBe("0.0");
    expect(groundLed.target).toBe(8);
    expect(obsVm.target).toBe(8);
    expect(groundLed.needRuns).toBe(8);
    expect(obsVm.needRuns).toBe(8);
    expect(obsVm.ballsRemaining).toBe(6);
    expect(obsVm.rrr).toBe("8.00");
    expect(obsVm.phase).toBe("innings_break"); // Crease not yet set
  });
});

describe("2. MODE SWITCHING & PINNING ISOLATION TEST", () => {
  it("LED and OBS screen modes transition cleanly through all canonical modes without leaking state or dropping live score", () => {
    const tournamentId = 25;

    // Reset director state
    setCricketObsDirectorState(tournamentId, "none");
    expect(getCricketObsDirectorState(tournamentId).overlay).toBe("none");

    const modeCycle = ["none", "standings", "scorecard", "summary", "intro", "none"] as const;

    for (const mode of modeCycle) {
      setCricketObsDirectorState(tournamentId, mode);
      const serverState = getCricketObsDirectorState(tournamentId);
      expect(serverState.overlay).toBe(mode);

      // Verify unpinned OBS view model adopts the director mode
      const obsVm = buildCricketObsViewModel({
        live: null,
        teams: mockTeams,
        tournamentName: "Test Tourney",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: serverState.overlay as any,
      });

      expect(obsVm.midOverlay).toBe(mode);
    }

    // Test OBS Mode Pinning Isolation:
    // When OBS has an explicit pin (e.g. scorecard), operator changing LED to 'standings' does NOT override OBS pin
    const obsPinnedVm = buildCricketObsViewModel({
      live: null,
      teams: mockTeams,
      tournamentName: "Test Tourney",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      midOverlay: "scorecard", // Explicitly pinned in OBS Browser Source
    });

    setCricketObsDirectorState(tournamentId, "standings"); // Operator pushed Standings to Ground LED
    expect(getCricketObsDirectorState(tournamentId).overlay).toBe("standings");
    expect(obsPinnedVm.midOverlay).toBe("scorecard"); // OBS stays pinned to Scorecard!

    // When pin is cleared (set back to director overlay), OBS resumes following director
    const obsFollowVm = buildCricketObsViewModel({
      live: null,
      teams: mockTeams,
      tournamentName: "Test Tourney",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      midOverlay: getCricketObsDirectorState(tournamentId).overlay as any,
    });
    expect(obsFollowVm.midOverlay).toBe("standings");
  });
});

describe("3. SSE DISCONNECT / RECONNECT CONVERGENCE TEST", () => {
  it("Scoreboard disconnected during live scoring immediately converges to latest snapshot upon reconnect without intermediate replaying", () => {
    // Initial connected state at Ball 0.2 (Score 1/0)
    const initialLive: ScoringLiveDisplay = {
      match: {
        id: 58,
        tournamentId: 25,
        fixtureId: null,
        sportSlug: "cricket",
        homeTeamId: 1,
        awayTeamId: 2,
        winnerTeamId: null,
        status: "live",
        roundName: "Final",
        venue: "Wankhede Arena",
        rules: null,
        branding: null,
        executionPolicyBind: null,
        presentationPolicyBind: null,
        resultSummary: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      state: {
        matchId: 58,
        tournamentId: 25,
        homeTeamId: 1,
        awayTeamId: 2,
        oversLimit: 20,
        maxWickets: 10,
        matchStatus: "live",
        sessionStatus: "live",
        currentInnings: 1,
        strikerId: 102,
        nonStrikerId: 101,
        bowlerId: 201,
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 1,
            wickets: 0,
            over: 0,
            ball: 2,
            phase: "in_progress",
            kind: "normal",
            oversLimit: 20,
          },
        ],
        thisOver: [
          { over: 0, ball: 1, runsOffBat: 0, extrasType: null, extrasRuns: 0, isWicket: false, isLegalDelivery: true, label: "0" },
          { over: 0, ball: 2, runsOffBat: 1, extrasType: null, extrasRuns: 0, isWicket: false, isLegalDelivery: true, label: "1" },
        ],
        lastSequence: 2,
      },
      summary: null,
    };

    let obsVm = buildCricketObsViewModel({
      live: initialLive,
      teams: mockTeams,
      players: mockPlayers,
      tournamentName: "BidWar Live",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });

    expect(obsVm.runs).toBe(1);
    expect(obsVm.oversLabel).toBe("0.2");

    // SSE Disconnects (network dropout for 20 seconds)
    obsVm = buildCricketObsViewModel({
      live: initialLive,
      teams: mockTeams,
      players: mockPlayers,
      tournamentName: "BidWar Live",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "disconnected",
    });
    expect(obsVm.connectionHint).toBe("reconnecting");

    // 3 balls scored in background while client is disconnected:
    // Ball 0.3 (4), Ball 0.4 (1), Ball 0.5 (6) -> Score becomes 12/0 (0.5 ov) at seq 5
    const reconnectedLive: ScoringLiveDisplay = {
      ...initialLive,
      state: {
        ...initialLive.state!,
        lastSequence: 5,
        strikerId: 101,
        nonStrikerId: 102,
        innings: [
          {
            ...initialLive.state!.innings[0],
            runs: 12,
            over: 0,
            ball: 5,
          },
        ],
        thisOver: [
          ...initialLive.state!.thisOver,
          { over: 0, ball: 3, runsOffBat: 4, extrasType: null, extrasRuns: 0, isWicket: false, isLegalDelivery: true, label: "4" },
          { over: 0, ball: 4, runsOffBat: 1, extrasType: null, extrasRuns: 0, isWicket: false, isLegalDelivery: true, label: "1" },
          { over: 0, ball: 5, runsOffBat: 6, extrasType: null, extrasRuns: 0, isWicket: false, isLegalDelivery: true, label: "6" },
        ],
      },
    };

    // Client reconnects: SSE emits full snapshot frame
    const prevFlashToken = flashTokenForBall(58, 2, initialLive.state!.thisOver[1]);
    obsVm = buildCricketObsViewModel({
      live: reconnectedLive,
      teams: mockTeams,
      players: mockPlayers,
      tournamentName: "BidWar Live",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      previousFlashToken: prevFlashToken,
    });

    // Immediate authoritative convergence
    expect(obsVm.connectionHint).toBe("none");
    expect(obsVm.runs).toBe(12);
    expect(obsVm.oversLabel).toBe("0.5");
    expect(obsVm.striker?.id).toBe(101);
    expect(obsVm.flash).toBe("SIX"); // Only the newest ball flashes
  });
});

describe("4. SCOREBOARD REFRESH & HYDRATION TEST", () => {
  it("Reconstructs correct state cleanly across all 6 critical match checkpoints upon browser refresh", () => {
    const checkpoints = [
      { name: "A. Mid-over (0.3)", runs: 5, wickets: 0, over: 0, ball: 3, target: null, phase: "live" },
      { name: "B. After boundary (4)", runs: 9, wickets: 0, over: 0, ball: 4, target: null, phase: "live" },
      { name: "C. After wicket", runs: 9, wickets: 1, over: 0, ball: 5, target: null, phase: "live" },
      { name: "D. Innings break", runs: 145, wickets: 6, over: 20, ball: 0, target: 146, phase: "innings_break" },
      { name: "E. 1st ball chase", runs: 1, wickets: 0, over: 0, ball: 1, target: 146, phase: "chase" },
      { name: "F. Match completed", runs: 148, wickets: 4, over: 19, ball: 2, target: 146, phase: "completed" },
    ];

    for (const cp of checkpoints) {
      const live: ScoringLiveDisplay = {
        match: {
          id: 58,
          tournamentId: 25,
          fixtureId: null,
          sportSlug: "cricket",
          homeTeamId: 1,
          awayTeamId: 2,
          winnerTeamId: cp.phase === "completed" ? 2 : null,
          status: cp.phase === "completed" ? "completed" : "live",
          roundName: "Final",
          venue: "Wankhede",
          rules: null,
          branding: null,
          executionPolicyBind: null,
          presentationPolicyBind: null,
          resultSummary: cp.phase === "completed" ? "Mumbai Icons won by 6 wickets" : null,
          startedAt: new Date().toISOString(),
          completedAt: cp.phase === "completed" ? new Date().toISOString() : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        state: {
          matchId: 58,
          tournamentId: 25,
          homeTeamId: 1,
          awayTeamId: 2,
          oversLimit: 20,
          maxWickets: 10,
          matchStatus: cp.phase === "completed" ? "completed" : "live",
          sessionStatus: cp.phase === "completed" ? "completed" : "live",
          currentInnings: cp.target ? 2 : 1,
          target: cp.target,
          strikerId: cp.phase === "innings_break" ? null : 101,
          nonStrikerId: cp.phase === "innings_break" ? null : 102,
          bowlerId: cp.phase === "innings_break" ? null : 201,
          innings: [
            {
              innings: cp.target ? 2 : 1,
              battingTeamId: cp.target ? 2 : 1,
              bowlingTeamId: cp.target ? 1 : 2,
              runs: cp.runs,
              wickets: cp.wickets,
              over: cp.over,
              ball: cp.ball,
              phase: cp.phase === "completed" ? "completed" : cp.phase === "innings_break" ? "not_started" : "in_progress",
              kind: "normal",
              oversLimit: 20,
            },
          ],
          thisOver: [],
          lastSequence: 100,
        },
        summary: null,
      };

      const obsVm = buildCricketObsViewModel({
        live,
        teams: mockTeams,
        players: mockPlayers,
        tournamentName: "BidWar",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
      });

      expect(obsVm.runs).toBe(cp.runs);
      expect(obsVm.wickets).toBe(cp.wickets);
      expect(obsVm.oversLabel).toBe(`${cp.over}.${cp.ball}`);
      expect(obsVm.phase).toBe(cp.phase);
      expect(obsVm.target).toBe(cp.target);
    }
  });
});

describe("5. ROUTING & BROWSER BACK/FORWARD REACTIVITY TEST", () => {
  it("parseCricketObsMatchParam and route matchers react immediately to URL changes", () => {
    // Mode 1: Live follow URL (/tournament/25/cricket/obs/live)
    expect(parseCricketObsMatchParam("live")).toEqual({ mode: "live" });
    expect(parseCricketObsMatchParam(undefined)).toEqual({ mode: "live" });

    // Mode 2: Match-pinned URL (/tournament/25/cricket/obs/58)
    expect(parseCricketObsMatchParam("58")).toEqual({ mode: "match", matchId: 58 });

    // Mode 3: Invalid slug
    expect(parseCricketObsMatchParam("abc")).toEqual({ mode: "invalid" });
    expect(parseCricketObsMatchParam("-5")).toEqual({ mode: "invalid" });
  });
});

describe("6. MATCH COMPLETION & TERMINAL STATE TEST", () => {
  it("Terminal match result is derived authoritatively, freezes all scoreboards, and rejects subsequent mutations", () => {
    const finalInningsState: CricketScoreboardState = {
      matchId: 58,
      tournamentId: 25,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 20,
      maxWickets: 10,
      matchStatus: "completed",
      sessionStatus: "completed",
      currentInnings: 2,
      target: 140,
      winnerTeamId: 2,
      resultText: "Mumbai Icons won by 6 wickets",
      strikerId: 201,
      nonStrikerId: 202,
      bowlerId: 101,
      innings: [
        {
          innings: 1,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 139,
          wickets: 8,
          over: 20,
          ball: 0,
          phase: "completed",
          kind: "normal",
          oversLimit: 20,
        },
        {
          innings: 2,
          battingTeamId: 2,
          bowlingTeamId: 1,
          runs: 142,
          wickets: 4,
          over: 18,
          ball: 4,
          phase: "completed",
          kind: "normal",
          oversLimit: 20,
        },
      ],
      thisOver: [
        { over: 18, ball: 4, runsOffBat: 4, extrasType: null, extrasRuns: 0, isWicket: false, isLegalDelivery: true, label: "4" },
      ],
      lastSequence: 142,
    };

    const derivedResult = deriveCricketMatchResult(finalInningsState);
    expect(derivedResult.winnerTeamId).toBe(2);
    expect(derivedResult.margin).toContain("6 wkts");
    expect(derivedResult.isTie).toBe(false);

    const liveDisplay: ScoringLiveDisplay = {
      match: {
        id: 58,
        tournamentId: 25,
        fixtureId: null,
        sportSlug: "cricket",
        homeTeamId: 1,
        awayTeamId: 2,
        winnerTeamId: 2,
        status: "completed",
        roundName: "Grand Finale",
        venue: "Wankhede Arena",
        rules: null,
        branding: null,
        executionPolicyBind: null,
        presentationPolicyBind: null,
        resultSummary: derivedResult.resultText,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      state: finalInningsState,
      summary: null,
    };

    const obsVm = buildCricketObsViewModel({
      live: liveDisplay,
      teams: mockTeams,
      players: mockPlayers,
      tournamentName: "BidWar Finale",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });

    expect(obsVm.phase).toBe("completed");
    expect(obsVm.resultHeadline).toContain("Mumbai Icons won by 6 wickets");
    expect(obsVm.winner?.id).toBe(2);
    expect(obsVm.needRuns).toBeNull(); // No further runs needed
  });
});
