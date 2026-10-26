import { describe, expect, it } from "vitest";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import { cricketVmToObsV2StageData, mapCricketTeamToObsV2 } from "../obs-v2-live-adapter";

function createBaseMockVm(overrides: Partial<CricketObsViewModel> = {}): CricketObsViewModel {
  return {
    phase: "live",
    matchId: 101,
    tournamentName: "BidWar Premier League",
    tournamentLogoUrl: "https://example.com/logo.png",
    home: {
      id: 1,
      name: "Titans Cricket Club",
      shortCode: "TIT",
      logoUrl: "https://example.com/titans.png",
      color: "#3B82F6",
    },
    away: {
      id: 2,
      name: "Royal Strikers",
      shortCode: "RS",
      logoUrl: "https://example.com/royals.png",
      color: "#EF4444",
    },
    batting: {
      id: 1,
      name: "Titans Cricket Club",
      shortCode: "TIT",
      logoUrl: "https://example.com/titans.png",
      color: "#3B82F6",
    },
    bowling: {
      id: 2,
      name: "Royal Strikers",
      shortCode: "RS",
      logoUrl: "https://example.com/royals.png",
      color: "#EF4444",
    },
    winner: null,
    runs: 85,
    wickets: 2,
    oversLabel: "10.4",
    oversLimit: 20,
    oversDisplay: "10.4",
    crr: "7.97",
    rrr: null,
    prr: null,
    projectedScore: 159,
    target: null,
    needRuns: null,
    ballsRemaining: null,
    thisOverLabels: ["1", "4", "0", "2"],
    striker: null,
    nonStriker: null,
    bowler: null,
    partnershipRuns: 42,
    partnershipBalls: 28,
    partnershipText: "PARTNERSHIP: 42 (28)",
    powerplayText: null,
    tossText: "TITANS ELECTED TO BAT",
    freeHitActive: false,
    superBallActive: false,
    venueText: "Wankhede Stadium",
    resultText: null,
    resultHeadline: null,
    firstInningsScoreLine: null,
    theme: {
      accent: "#FFD700",
      accentOn: "#0C0C10",
      shell: "#050507",
      panel: "#0C0C10",
      text: "#FFFFFF",
      sponsorStripEnabled: false,
    },
    branding: null,
    sponsors: [],
    showSponsorSlot: false,
    connectionHint: "none",
    flash: null,
    flashToken: null,
    midOverlay: "none",
    broadcastMessage: null,
    ...overrides,
  };
}

describe("OBS V2 Live Cricket Data Adapter (Step 3)", () => {
  describe("1. Team Normalization", () => {
    it("maps cricket team into V2 broadcast team info", () => {
      const team = mapCricketTeamToObsV2({
        id: 1,
        name: "Titans Cricket Club",
        shortCode: "TIT",
        logoUrl: "https://cdn.example.com/crest.png",
        color: "#3B82F6",
      });

      expect(team).toEqual({
        name: "Titans Cricket Club",
        shortCode: "TIT",
        color: "#3B82F6",
        logoUrl: "https://cdn.example.com/crest.png",
      });
    });

    it("generates 3-letter shortcode fallback when missing", () => {
      const team = mapCricketTeamToObsV2({
        id: 2,
        name: "Spartans",
        shortCode: "",
        logoUrl: null,
        color: null,
      });

      expect(team?.shortCode).toBe("SPA");
    });

    it("strips data: URI logos to avoid OBS browser source performance lag", () => {
      const team = mapCricketTeamToObsV2({
        id: 3,
        name: "Warriors",
        shortCode: "WAR",
        logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
        color: null,
      });

      expect(team?.logoUrl).toBeNull();
    });

    it("returns null when team is null or undefined", () => {
      expect(mapCricketTeamToObsV2(null)).toBeNull();
      expect(mapCricketTeamToObsV2(undefined)).toBeNull();
    });
  });

  describe("2. Live 1st Innings State", () => {
    it("maps active 1st innings score, overs, and CRR", () => {
      const vm = createBaseMockVm({
        phase: "live",
        runs: 85,
        wickets: 2,
        oversDisplay: "10.4",
        crr: "7.97",
        target: null,
        rrr: null,
      });

      const stage = cricketVmToObsV2StageData(vm);

      // Header verification
      expect(stage.header.live).toBe(true);
      expect(stage.header.statusLabel).toBe("LIVE");
      expect(stage.header.tournamentName).toBe("BidWar Premier League");
      expect(stage.header.matchContext).toBe("Wankhede Stadium");

      // Scorebug verification
      expect(stage.scorebug.runs).toBe(85);
      expect(stage.scorebug.wickets).toBe(2);
      expect(stage.scorebug.overs).toBe("10.4");
      expect(stage.scorebug.maxOvers).toBe(20);
      expect(stage.scorebug.crr).toBe("7.97");
      expect(stage.scorebug.target).toBeNull(); // Target should NOT be present in 1st innings
      expect(stage.scorebug.rrr).toBeNull();
      expect(stage.scorebug.statusText).toBe("PARTNERSHIP: 42 (28)");
    });
  });

  describe("3. Live 2nd Innings Chase State", () => {
    it("maps chase equation, target, and RRR", () => {
      const vm = createBaseMockVm({
        phase: "chase",
        runs: 142,
        wickets: 5,
        oversDisplay: "16.2",
        target: 175,
        needRuns: 33,
        ballsRemaining: 22,
        crr: "8.69",
        rrr: "9.00",
      });

      const stage = cricketVmToObsV2StageData(vm);

      expect(stage.header.live).toBe(true);
      expect(stage.header.statusLabel).toBe("CHASE");
      expect(stage.scorebug.target).toBe(175);
      expect(stage.scorebug.needRuns).toBe(33);
      expect(stage.scorebug.ballsRemaining).toBe(22);
      expect(stage.scorebug.crr).toBe("8.69");
      expect(stage.scorebug.rrr).toBe("9.00");
      expect(stage.scorebug.statusText).toBe("NEED 33 RUNS IN 22 BALLS");
    });
  });

  describe("4. Pre-Match Build-up State", () => {
    it("hides live score numbers and presents toss/teams info", () => {
      const vm = createBaseMockVm({
        phase: "pre_match",
        runs: 0,
        wickets: 0,
        oversDisplay: "0.0",
        tossText: "TITANS WON TOSS & ELECTED TO BAT",
      });

      const stage = cricketVmToObsV2StageData(vm);

      expect(stage.header.live).toBe(false);
      expect(stage.header.statusLabel).toBe("PRE-MATCH");
      expect(stage.scorebug.runs).toBeNull();
      expect(stage.scorebug.wickets).toBeNull();
      expect(stage.scorebug.overs).toBeNull();
      expect(stage.scorebug.statusText).toBe("TITANS WON TOSS & ELECTED TO BAT");
    });
  });

  describe("5. Innings Break State", () => {
    it("displays 1st innings total and target without live indicator", () => {
      const vm = createBaseMockVm({
        phase: "innings_break",
        runs: 165,
        wickets: 7,
        oversDisplay: "20.0",
        target: 166,
        firstInningsScoreLine: "TITANS 165/7 (20.0) · TARGET 166",
      });

      const stage = cricketVmToObsV2StageData(vm);

      expect(stage.header.live).toBe(false);
      expect(stage.header.statusLabel).toBe("BREAK");
      expect(stage.scorebug.runs).toBe(165);
      expect(stage.scorebug.wickets).toBe(7);
      expect(stage.scorebug.overs).toBe("20.0");
      expect(stage.scorebug.target).toBe(166);
      expect(stage.scorebug.statusText).toBe("TITANS 165/7 (20.0) · TARGET 166");
    });
  });

  describe("6. Completed Match State", () => {
    it("displays final result headline and winner banner", () => {
      const vm = createBaseMockVm({
        phase: "completed",
        runs: 168,
        wickets: 6,
        oversDisplay: "19.3",
        resultHeadline: "ROYAL STRIKERS WON BY 4 WICKETS",
        winner: {
          id: 2,
          name: "Royal Strikers",
          shortCode: "RS",
          logoUrl: "https://example.com/royals.png",
          color: "#EF4444",
        },
      });

      const stage = cricketVmToObsV2StageData(vm);

      expect(stage.header.live).toBe(false);
      expect(stage.header.statusLabel).toBe("FINAL");
      expect(stage.scorebug.statusText).toBe("ROYAL STRIKERS WON BY 4 WICKETS");
    });
  });

  describe("7. Loading & Reconnecting Feed Protection", () => {
    it("does not render fake numbers while loading initial feed", () => {
      const vm = createBaseMockVm({
        phase: "no_live",
        runs: 0,
        wickets: 0,
      });

      const stage = cricketVmToObsV2StageData(vm, true);

      expect(stage.isLoading).toBe(true);
      expect(stage.header.statusLabel).toBe("SYNCING");
      expect(stage.scorebug.isLoading).toBe(true);
      expect(stage.scorebug.runs).toBeUndefined(); // NO fake 124/4!
      expect(stage.scorebug.statusText).toContain("CONNECTING");
    });

    it("handles no active match gracefully", () => {
      const vm = createBaseMockVm({
        phase: "no_live",
        batting: null,
        bowling: null,
      });

      const stage = cricketVmToObsV2StageData(vm, false);

      expect(stage.header.live).toBe(false);
      expect(stage.header.statusLabel).toBe("STANDBY");
      expect(stage.scorebug.runs).toBeNull();
      expect(stage.scorebug.statusText).toBe("WAITING FOR NEXT MATCH");
    });

    it("reflects SSE reconnecting status cleanly", () => {
      const vm = createBaseMockVm({
        connectionHint: "reconnecting",
        phase: "live",
      });

      const stage = cricketVmToObsV2StageData(vm);

      expect(stage.connectionStatus).toBe("reconnecting");
    });
  });

  describe("8. Live Score Update Transition", () => {
    it("faithfully translates consecutive scoring state updates (Four scored)", () => {
      const ball1Vm = createBaseMockVm({
        runs: 123,
        wickets: 4,
        oversDisplay: "15.2",
      });

      const stage1 = cricketVmToObsV2StageData(ball1Vm);
      expect(stage1.scorebug.runs).toBe(123);
      expect(stage1.scorebug.wickets).toBe(4);
      expect(stage1.scorebug.overs).toBe("15.2");

      // Scorer enters FOUR
      const ball2Vm = createBaseMockVm({
        runs: 127,
        wickets: 4,
        oversDisplay: "15.3",
      });

      const stage2 = cricketVmToObsV2StageData(ball2Vm);
      expect(stage2.scorebug.runs).toBe(127);
      expect(stage2.scorebug.wickets).toBe(4);
      expect(stage2.scorebug.overs).toBe("15.3");
    });
  });
});
