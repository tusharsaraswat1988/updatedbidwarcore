import { describe, expect, it } from "vitest";
import { createInitialCricketState, type CricketScoreboardState } from "@workspace/scoring-core";
import type { ScoringLiveDisplay } from "../scoring-api";
import type { CricketScorerTeam } from "../scoring-squad";
import {
  ballsRemaining,
  buildCricketObsViewModel,
  deriveCricketNeutralStatus,
  mapBallToFlash,
  mergeLiveDisplayPreserveBranding,
  parseCricketObsMatchParam,
} from "../cricket-obs-view-model";

const teams: CricketScorerTeam[] = [
  {
    id: 1,
    name: "Royal Riders",
    shortCode: "RR",
    color: "#c00",
    logoUrl: "https://example.com/rr.png",
  },
  {
    id: 2,
    name: "Mumbai Icons",
    shortCode: "MI",
    color: "#06c",
    logoUrl: null,
  },
];

function baseState(overrides: Partial<CricketScoreboardState> = {}): CricketScoreboardState {
  const state = createInitialCricketState({
    matchId: 10,
    tournamentId: 5,
    homeTeamId: 1,
    awayTeamId: 2,
    oversLimit: 6,
    maxWickets: 10,
  });
  return {
    ...state,
    matchStatus: "live",
    sessionStatus: "live",
    currentInnings: 1,
    innings: [
      {
        innings: 1,
        battingTeamId: 1,
        bowlingTeamId: 2,
        runs: 48,
        wickets: 2,
        over: 4,
        ball: 3,
        phase: "in_progress",
        kind: "normal",
        oversLimit: 6,
      },
    ],
    thisOver: [
      {
        over: 4,
        ball: 1,
        runsOffBat: 1,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        isLegalDelivery: true,
        label: "1",
      },
      {
        over: 4,
        ball: 2,
        runsOffBat: 4,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        isLegalDelivery: true,
        label: "4",
      },
      {
        over: 4,
        ball: 3,
        runsOffBat: 0,
        extrasType: null,
        extrasRuns: 0,
        isWicket: true,
        isLegalDelivery: true,
        label: "W",
      },
    ],
    lastSequence: 42,
    ...overrides,
  };
}

function liveFromState(state: CricketScoreboardState, branding?: Record<string, unknown>): ScoringLiveDisplay {
  return {
    match: {
      id: state.matchId,
      tournamentId: state.tournamentId,
      fixtureId: null,
      sportSlug: "cricket",
      status: state.matchStatus,
      homeTeamId: state.homeTeamId,
      awayTeamId: state.awayTeamId,
      roundName: null,
      scheduledAt: null,
      venue: null,
      rules: null,
      branding: branding ?? {
        source: "presentation_execution_policy",
        accentColor: "#FFD700",
        sponsorStripEnabled: true,
      },
      winnerTeamId: state.winnerTeamId,
      resultSummary: state.resultText,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    },
    state,
    summary: {
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
    },
  };
}

describe("cricket-obs-view-model", () => {
  it("renders Corporate Box 6-over live score without hardcoding 6 in the mapper", () => {
    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.phase).toBe("live");
    expect(vm.runs).toBe(48);
    expect(vm.wickets).toBe(2);
    expect(vm.oversLimit).toBe(6);
    expect(vm.oversDisplay).toBe("4.3/6 OV");
    expect(vm.batting?.shortCode).toBe("RR");
    expect(vm.batting?.logoUrl).toBe("https://example.com/rr.png");
  });

  it("uses a different oversLimit when runtime state says so", () => {
    const state = baseState({
      oversLimit: 8,
      innings: [
        {
          innings: 1,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 20,
          wickets: 0,
          over: 2,
          ball: 0,
          phase: "in_progress",
          kind: "normal",
          oversLimit: 8,
        },
      ],
      thisOver: [],
    });
    const vm = buildCricketObsViewModel({
      live: liveFromState(state),
      teams,
      tournamentName: "Society Box",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.oversLimit).toBe(8);
    expect(vm.oversDisplay).toBe("2.0/8 OV");
  });

  it("derives chase target, need, RRR and CRR", () => {
    const state = baseState({
      target: 67,
      currentInnings: 2,
      innings: [
        {
          innings: 1,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 66,
          wickets: 3,
          over: 6,
          ball: 0,
          phase: "completed",
          kind: "normal",
          oversLimit: 6,
        },
        {
          innings: 2,
          battingTeamId: 2,
          bowlingTeamId: 1,
          runs: 47,
          wickets: 1,
          over: 3,
          ball: 4,
          phase: "in_progress",
          kind: "normal",
          oversLimit: 6,
        },
      ],
      thisOver: [
        {
          over: 3,
          ball: 4,
          runsOffBat: 1,
          extrasType: null,
          extrasRuns: 0,
          isWicket: false,
          isLegalDelivery: true,
          label: "1",
        },
      ],
    });
    const vm = buildCricketObsViewModel({
      live: liveFromState(state),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.phase).toBe("chase");
    expect(vm.target).toBe(67);
    expect(vm.needRuns).toBe(20);
    expect(vm.ballsRemaining).toBe(ballsRemaining(6, 3, 4));
    expect(vm.crr).toBeTruthy();
    expect(vm.rrr).toBeTruthy();
    expect(Number(vm.rrr)).toBeCloseTo(20 / (14 / 6), 1);
  });

  it("shows completed result and winner", () => {
    const state = baseState({
      matchStatus: "completed",
      winnerTeamId: 2,
      resultText: "Won by 9 wickets",
      target: 49,
      currentInnings: 2,
      innings: [
        {
          innings: 1,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 48,
          wickets: 3,
          over: 6,
          ball: 0,
          phase: "completed",
          kind: "normal",
          oversLimit: 6,
        },
        {
          innings: 2,
          battingTeamId: 2,
          bowlingTeamId: 1,
          runs: 51,
          wickets: 1,
          over: 5,
          ball: 2,
          phase: "completed",
          kind: "normal",
          oversLimit: 6,
        },
      ],
      thisOver: [],
    });
    const vm = buildCricketObsViewModel({
      live: liveFromState(state),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.phase).toBe("completed");
    expect(vm.winner?.shortCode).toBe("MI");
    expect(vm.resultHeadline).toContain("MI");
    expect(vm.resultHeadline).toContain("Won by 9 wickets");
  });

  it("shows walkover result and winner in terminal walkover state", () => {
    const state = baseState({
      matchStatus: "walkover",
      winnerTeamId: 1,
      resultText: "Won by Walkover (Opposition forfeited)",
      target: 32,
      currentInnings: 2,
      innings: [
        {
          innings: 1,
          battingTeamId: 2,
          bowlingTeamId: 1,
          runs: 31,
          wickets: 10,
          over: 5,
          ball: 0,
          phase: "completed",
          kind: "normal",
          oversLimit: 5,
        },
        {
          innings: 2,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 27,
          wickets: 0,
          over: 1,
          ball: 3,
          phase: "completed",
          kind: "normal",
          oversLimit: 5,
        },
      ],
      thisOver: [],
    });
    const live = liveFromState(state);
    live.match!.status = "walkover";
    const vm = buildCricketObsViewModel({
      live,
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.phase).toBe("completed");
    expect(vm.winner?.shortCode).toBe("RR");
    expect(vm.resultText).toBe("Won by Walkover (Opposition forfeited)");
    expect(vm.resultHeadline).toContain("Won by Walkover");
  });

  it("exposes this-over trail labels", () => {
    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.thisOverLabels).toEqual(["1", "4", "W"]);
  });

  it("maps ball flashes without inventing events", () => {
    expect(
      mapBallToFlash({
        over: 1,
        ball: 1,
        runsOffBat: 4,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        isLegalDelivery: true,
        label: "4",
      }),
    ).toBe("FOUR");
    expect(
      mapBallToFlash({
        over: 1,
        ball: 2,
        runsOffBat: 6,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        isLegalDelivery: true,
        label: "6",
      }),
    ).toBe("SIX");
    expect(
      mapBallToFlash({
        over: 1,
        ball: 3,
        runsOffBat: 0,
        extrasType: null,
        extrasRuns: 0,
        isWicket: true,
        isLegalDelivery: true,
        label: "W",
      }),
    ).toBe("WICKET");
    expect(
      mapBallToFlash({
        over: 1,
        ball: 4,
        runsOffBat: 0,
        extrasType: "wide",
        extrasRuns: 1,
        isWicket: false,
        isLegalDelivery: false,
        label: "Wd",
      }),
    ).toBe("WIDE");
    expect(
      mapBallToFlash({
        over: 1,
        ball: 5,
        runsOffBat: 0,
        extrasType: "no_ball",
        extrasRuns: 1,
        isWicket: false,
        isLegalDelivery: false,
        label: "Nb",
      }),
    ).toBe("NO_BALL");
    expect(
      mapBallToFlash({
        over: 1,
        ball: 6,
        runsOffBat: 1,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        isLegalDelivery: true,
        label: "1",
      }),
    ).toBeNull();
  });

  it("does not re-flash the same ball token", () => {
    const live = liveFromState(baseState());
    const first = buildCricketObsViewModel({
      live,
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(first.flash).toBe("WICKET");
    const second = buildCricketObsViewModel({
      live,
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      previousFlashToken: first.flashToken,
    });
    expect(second.flash).toBeNull();
  });

  it("falls back safely when team logo is missing", () => {
    const vm = buildCricketObsViewModel({
      live: liveFromState(
        baseState({
          innings: [
            {
              innings: 1,
              battingTeamId: 2,
              bowlingTeamId: 1,
              runs: 10,
              wickets: 0,
              over: 1,
              ball: 0,
              phase: "in_progress",
              kind: "normal",
              oversLimit: 6,
            },
          ],
          thisOver: [],
        }),
      ),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.batting?.shortCode).toBe("MI");
    expect(vm.batting?.logoUrl).toBeNull();
  });

  it("hides sponsor slot when sponsors are missing", () => {
    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.showSponsorSlot).toBe(false);
  });

  it("shows sponsor slot when sponsors exist", () => {
    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [{ url: "https://example.com/s.png", name: "Acme", type: "title" }],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.showSponsorSlot).toBe(true);
  });

  it("falls back to default readable theme without presentation paint", () => {
    const live = liveFromState(baseState(), undefined);
    live.match!.branding = null;
    const vm = buildCricketObsViewModel({
      live,
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.theme.accent).toBeTruthy();
    expect(vm.theme.panel).toBeTruthy();
  });

  it("preserves REST branding when SSE sends a slim match", () => {
    const rest = liveFromState(baseState(), {
      source: "presentation_execution_policy",
      accentColor: "#112233",
      sponsorStripEnabled: true,
    });
    const sse: ScoringLiveDisplay = {
      match: {
        id: 10,
        tournamentId: 5,
        fixtureId: null,
        sportSlug: "cricket",
        status: "live",
        homeTeamId: 1,
        awayTeamId: 2,
        roundName: null,
        scheduledAt: null,
        venue: null,
        rules: null,
        winnerTeamId: null,
        resultSummary: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
      },
      state: baseState({ runs: 49 } as never),
      summary: rest.summary,
    };
    // Fix state properly
    sse.state = baseState({
      innings: [
        {
          innings: 1,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 49,
          wickets: 2,
          over: 4,
          ball: 4,
          phase: "in_progress",
          kind: "normal",
          oversLimit: 6,
        },
      ],
    });

    const merged = mergeLiveDisplayPreserveBranding(rest, sse);
    expect(merged?.match?.branding).toEqual(rest.match?.branding);
    expect(merged?.state?.innings[0]?.runs).toBe(49);
  });

  it("does not silently show another match on a pinned URL", () => {
    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: 999,
      connectionStatus: "connected",
    });
    expect(vm.phase).toBe("match_unavailable");
    expect(vm.runs).toBe(0);
    expect(vm.batting).toBeNull();
  });

  it("renders a safe no-live waiting state", () => {
    const vm = buildCricketObsViewModel({
      live: { match: null, state: null, summary: null },
      teams,
      tournamentName: "Box Cup",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
    });
    expect(vm.phase).toBe("no_live");
    expect(vm.tournamentName).toBe("Box Cup");
  });

  it("parses live and match route segments", () => {
    expect(parseCricketObsMatchParam("live")).toEqual({ mode: "live" });
    expect(parseCricketObsMatchParam("12")).toEqual({ mode: "match", matchId: 12 });
    expect(parseCricketObsMatchParam("abc")).toEqual({ mode: "invalid" });
  });

  it("OBS view-model module does not import scoring write APIs", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.resolve(import.meta.dirname, "../cricket-obs-view-model.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/appendScoringEvent/);
    expect(src).not.toMatch(/POST/);
    expect(src).not.toMatch(/useAuctionSocket/);
  });

  describe("Neutral Screen Activation (Intervals & Walkover)", () => {
    it("activates neutral screen when match is completed or walkover and overlay is none", () => {
      const walkoverState = baseState({
        matchStatus: "walkover",
        sessionStatus: "completed",
      });
      const vm = buildCricketObsViewModel({
        live: liveFromState(walkoverState),
        teams,
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: "none",
      });
      expect(vm.isNeutralActive).toBe(true);
    });

    it("activates neutral screen when midOverlay is explicitly neutral even during live match", () => {
      const liveState = baseState({
        matchStatus: "live",
      });
      const vm = buildCricketObsViewModel({
        live: liveFromState(liveState),
        teams,
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: "neutral",
      });
      expect(vm.isNeutralActive).toBe(true);
    });

    it("does not activate neutral screen during active live match when midOverlay is none", () => {
      const liveState = baseState({
        matchStatus: "live",
      });
      const vm = buildCricketObsViewModel({
        live: liveFromState(liveState),
        teams,
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: "none",
      });
      expect(vm.isNeutralActive).toBe(false);
    });

    it("does not activate neutral screen when a specific overlay (e.g. summary or standings) is chosen", () => {
      const walkoverState = baseState({
        matchStatus: "walkover",
        sessionStatus: "completed",
      });
      const vm = buildCricketObsViewModel({
        live: liveFromState(walkoverState),
        teams,
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: "summary",
      });
      expect(vm.isNeutralActive).toBe(false);
      expect(vm.midOverlay).toBe("summary");
    });

    it("displays 'MATCH STARTING SOON' (STANDBY) when tournament is newly created with no match or live feed", () => {
      const vm = buildCricketObsViewModel({
        live: null,
        teams: [],
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: "none",
      });
      expect(vm.isNeutralActive).toBe(true);
      expect(vm.neutralStatusText).toBe("MATCH STARTING SOON");
      expect(vm.neutralStatusChip).toBe("STANDBY");
      // Must NEVER display "MATCH INTERVAL" when no match has started!
      expect(vm.neutralStatusText).not.toBe("MATCH INTERVAL");
    });

    it("displays 'MATCH INTERVAL' (INTERVAL) only when midOverlay is explicitly set to neutral", () => {
      const vm = buildCricketObsViewModel({
        live: null,
        teams: [],
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: "neutral",
      });
      expect(vm.isNeutralActive).toBe(true);
      expect(vm.neutralStatusText).toBe("MATCH INTERVAL");
      expect(vm.neutralStatusChip).toBe("INTERVAL");
    });

    it("displays match target/break text when in innings break", () => {
      const breakState = baseState({
        matchStatus: "live",
        sessionStatus: "innings_break",
        currentInnings: 2,
        target: 151,
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 150,
            wickets: 5,
            over: 20,
            ball: 0,
            status: "completed",
            phase: "completed",
            oversLimit: 20,
            kind: "normal",
          },
          {
            innings: 2,
            battingTeamId: 2,
            bowlingTeamId: 1,
            runs: 0,
            wickets: 0,
            over: 0,
            ball: 0,
            status: "not_started",
            phase: "not_started",
            oversLimit: 20,
            kind: "normal",
          },
        ],
      });
      const liveBreak = liveFromState(breakState);
      liveBreak.match.rules = { overs: 20 };
      const vm = buildCricketObsViewModel({
        live: liveBreak,
        teams,
        tournamentName: "BidWar Premier League",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: "neutral",
      });
      expect(vm.phase).toBe("innings_break");
      expect(vm.neutralStatusChip).toBe("INNINGS BREAK");
      expect(vm.neutralStatusText).toContain("INNINGS BREAK");
    });
  });

  describe("Powerplay Indicator", () => {
    it("returns null powerplayText when powerplay is disabled", () => {
      const state = baseState({
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 10,
            wickets: 0,
            over: 0,
            ball: 2,
            phase: "in_progress",
            kind: "normal",
            oversLimit: 20,
          },
        ],
        powerplayOvers: [],
      });
      const live = liveFromState(state);
      live.match.rules = { powerplayEnabled: false };
      const vm = buildCricketObsViewModel({
        live,
        teams,
        tournamentName: "Test",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
      });
      expect(vm.powerplayText).toBeNull();
    });

    it("displays powerplayText only on configured powerplay overs", () => {
      const stateP1 = baseState({
        innings: [
          {
            innings: 1,
            battingTeamId: 1,
            bowlingTeamId: 2,
            runs: 10,
            wickets: 0,
            over: 1, // Over 2 in cricket
            ball: 2,
            phase: "in_progress",
            kind: "normal",
            oversLimit: 10,
          },
        ],
        powerplayOvers: [1, 2],
      });
      const liveP1 = liveFromState(stateP1);
      liveP1.match.rules = { powerplayEnabled: true, powerplayOvers: [1, 2] };
      const vmP1 = buildCricketObsViewModel({
        live: liveP1,
        teams,
        tournamentName: "Test",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
      });
      expect(vmP1.powerplayText).toBe("P1 (2 OV)");

      // Over 3 (index 2) - should not be in powerplay
      const stateOutside = baseState({
        ...stateP1,
        innings: [
          {
            ...stateP1.innings[0],
            over: 2, // Over 3 in cricket
          },
        ],
        powerplayOvers: [1, 2],
      });
      const liveOutside = liveFromState(stateOutside);
      liveOutside.match.rules = { powerplayEnabled: true, powerplayOvers: [1, 2] };
      const vmOutside = buildCricketObsViewModel({
        live: liveOutside,
        teams,
        tournamentName: "Test",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
      });
      expect(vmOutside.powerplayText).toBeNull();
    });
  });
});
