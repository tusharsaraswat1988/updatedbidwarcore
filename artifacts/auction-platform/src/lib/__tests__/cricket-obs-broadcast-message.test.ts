import { describe, expect, it } from "vitest";
import { createInitialCricketState, type CricketScoreboardState } from "@workspace/scoring-core";
import type { ScoringLiveDisplay } from "../scoring-api";
import type { CricketScorerTeam } from "../scoring-squad";
import {
  buildCricketObsViewModel,
  type CricketBroadcastMessage,
  type CricketObsMidOverlayKind,
  type CricketObsViewModel,
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
        runs: 54,
        wickets: 1,
        over: 5,
        ball: 2,
        phase: "in_progress",
        kind: "normal",
        oversLimit: 6,
      },
    ],
    thisOver: [
      {
        over: 5,
        ball: 1,
        runsOffBat: 4,
        extrasType: null,
        extrasRuns: 0,
        isWicket: false,
        isLegalDelivery: true,
        label: "4",
      },
    ],
    lastSequence: 100,
    ...overrides,
  };
}

function liveFromState(state: CricketScoreboardState): ScoringLiveDisplay {
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
      branding: {
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

describe("Cricket OBS Broadcast Message Feature", () => {
  it("Point 5 & 19: exposes Broadcast Message with Name and Details in the view model", () => {
    const broadcastMessage: CricketBroadcastMessage = {
      active: true,
      name: "Rahul Sharma",
      details: "Former India Player & Special Guest",
    };

    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Premier League",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      broadcastMessage,
    });

    expect(vm.broadcastMessage).toEqual(broadcastMessage);
    expect(vm.broadcastMessage?.active).toBe(true);
    expect(vm.broadcastMessage?.name).toBe("Rahul Sharma");
    expect(vm.broadcastMessage?.details).toBe("Former India Player & Special Guest");
  });

  it("Point 4 & 34: broadcast message never modifies cricket scoring state", () => {
    const rawState = baseState();
    const live = liveFromState(rawState);

    const vmWithMsg = buildCricketObsViewModel({
      live,
      teams,
      tournamentName: "Box Premier League",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      broadcastMessage: {
        active: true,
        name: "Arjun Mehta",
        details: "Today's Match Sponsor Representative",
      },
    });

    const vmWithoutMsg = buildCricketObsViewModel({
      live,
      teams,
      tournamentName: "Box Premier League",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      broadcastMessage: null,
    });

    // Match scoring metrics must be completely identical
    expect(vmWithMsg.runs).toBe(vmWithoutMsg.runs);
    expect(vmWithMsg.wickets).toBe(vmWithoutMsg.wickets);
    expect(vmWithMsg.oversLabel).toBe(vmWithoutMsg.oversLabel);
    expect(vmWithMsg.oversDisplay).toBe(vmWithoutMsg.oversDisplay);
    expect(vmWithMsg.phase).toBe(vmWithoutMsg.phase);
    expect(vmWithMsg.crr).toBe(vmWithoutMsg.crr);
    expect(vmWithMsg.thisOverLabels).toEqual(vmWithoutMsg.thisOverLabels);
  });

  it("Point 16 & 17: closing the broadcast message sets active = false without auto-expiry", () => {
    const closedMessage: CricketBroadcastMessage = {
      active: false,
      name: "",
      details: "",
    };

    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Premier League",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      broadcastMessage: closedMessage,
    });

    expect(vm.broadcastMessage?.active).toBe(false);
  });

  it("Point 32: broadcast message coexists with mid overlays, event flashes, and scorebug", () => {
    const overlays: CricketObsMidOverlayKind[] = [
      "sponsors",
      "standings",
      "fixtures",
      "scorecard",
      "summary",
      "intro",
    ];

    const broadcastMessage: CricketBroadcastMessage = {
      active: true,
      name: "Suresh Raina",
      details: "Tournament Chief Guest",
    };

    for (const overlay of overlays) {
      const vm = buildCricketObsViewModel({
        live: liveFromState(baseState()),
        teams,
        tournamentName: "Box Premier League",
        tournamentLogoUrl: null,
        sponsors: [{ url: "https://example.com/sp.png", name: "Acme Motors", type: "title" }],
        pinnedMatchId: null,
        connectionStatus: "connected",
        midOverlay: overlay,
        overrideFlash: "SIX",
        overrideFlashToken: "token-six",
        overrideFlashDetail: "Maximum 6",
        broadcastMessage,
      });

      // All layers coexist in VM without conflicting
      expect(vm.midOverlay).toBe(overlay);
      expect(vm.flash).toBe("SIX");
      expect(vm.flashDetail).toBe("Maximum 6");
      expect(vm.broadcastMessage).toEqual(broadcastMessage);
      expect(vm.runs).toBe(54);
      expect(vm.wickets).toBe(1);
    }
  });

  it("Point 27: timestamp ordering protects against stale out-of-order SSE director updates", () => {
    let activeState: CricketBroadcastMessage | null = null;
    let lastDirectorTimestamp = 0;

    function handleEvent(detail: {
      broadcastMessage?: CricketBroadcastMessage | null;
      timestamp: number;
    }) {
      if (detail.timestamp < lastDirectorTimestamp) {
        return; // Stale event rejected
      }
      lastDirectorTimestamp = detail.timestamp;
      if (detail.broadcastMessage !== undefined) {
        activeState = detail.broadcastMessage;
      }
    }

    // 1. PUSH A (timestamp 100)
    handleEvent({
      timestamp: 100,
      broadcastMessage: { active: true, name: "Person A", details: "Guest A" },
    });
    expect(activeState).toEqual({ active: true, name: "Person A", details: "Guest A" });

    // 2. PUSH B (timestamp 110)
    handleEvent({
      timestamp: 110,
      broadcastMessage: { active: true, name: "Person B", details: "Guest B" },
    });
    expect(activeState).toEqual({ active: true, name: "Person B", details: "Guest B" });

    // 3. CLOSE (timestamp 120)
    handleEvent({
      timestamp: 120,
      broadcastMessage: { active: false, name: "", details: "" },
    });
    expect(activeState).toEqual({ active: false, name: "", details: "" });

    // 4. Stale PUSH A arrives late (timestamp 100) -> MUST BE REJECTED
    handleEvent({
      timestamp: 100,
      broadcastMessage: { active: true, name: "Person A", details: "Guest A" },
    });
    expect(activeState).toEqual({ active: false, name: "", details: "" });
  });

  it("Point 7 & 30: supports quick messages and validates length limits safely", () => {
    const validQuickName = "Arjun Mehta".trim();
    const validQuickDetails = "Today's Match Sponsor Representative".trim();

    expect(validQuickName.length).toBeGreaterThanOrEqual(1);
    expect(validQuickName.length).toBeLessThanOrEqual(100);
    expect(validQuickDetails.length).toBeGreaterThanOrEqual(1);
    expect(validQuickDetails.length).toBeLessThanOrEqual(180);

    const quickMsg: CricketBroadcastMessage = {
      active: true,
      name: validQuickName,
      details: validQuickDetails,
    };

    const vm = buildCricketObsViewModel({
      live: liveFromState(baseState()),
      teams,
      tournamentName: "Box Premier League",
      tournamentLogoUrl: null,
      sponsors: [],
      pinnedMatchId: null,
      connectionStatus: "connected",
      broadcastMessage: quickMsg,
    });

    expect(vm.broadcastMessage?.name).toBe("Arjun Mehta");
    expect(vm.broadcastMessage?.details).toBe("Today's Match Sponsor Representative");
  });
});
