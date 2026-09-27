import React from "react";
import { describe, expect, it } from "vitest";
import { OBS_V2 } from "../obs-v2-tokens";
import { VARIANT_CONFIGS } from "../slates/BroadcastSideSlate";
import { adaptCricketToBroadcastFrame } from "../cricket-v2-adapter";
import { Crest } from "../primitives";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

function createMockCricketVm(): CricketObsViewModel {
  return {
    matchId: 1,
    tournamentName: "BidWar Premier League",
    venueText: "National Stadium",
    home: { id: 1, name: "Delhi Panthers", shortCode: "DPS" },
    away: { id: 2, name: "Sunbeams Anaadis", shortCode: "SUN" },
    batting: { id: 1, name: "Delhi Panthers", shortCode: "DPS" },
    bowling: { id: 2, name: "Sunbeams Anaadis", shortCode: "SUN" },
    runs: 164,
    wickets: 4,
    overs: 17.4,
    oversDisplay: "17.4",
    oversLabel: "17.4",
    oversLimit: 20,
    crr: "9.28",
    target: 185,
    needRuns: 21,
    ballsRemaining: 14,
    rrr: "9.00",
    striker: { id: 101, name: "Mayank Pahuja", runs: 58, balls: 32, fours: 6, sixes: 3, strikeRate: "181.2" },
    nonStriker: { id: 102, name: "Siddharth Singh", runs: 24, balls: 14, fours: 2, sixes: 1, strikeRate: "171.4" },
    bowler: { id: 201, name: "Anubhav Bassi", overs: "3.4", maidens: 0, runsConceded: 31, wickets: 2, economy: 8.45 },
    thisOverLabels: ["1", "4", "0", "6", "W", "2"],
    phase: "chase",
    isNeutralActive: false,
    midOverlay: "none",
    freeHitActive: false,
    superBallActive: false,
    powerplayText: "POWERPLAY 2",
    tossText: "DPS WON TOSS & ELECTED TO BAT",
    resultHeadline: null,
    resultText: null,
    partnershipText: "50 off 28 balls",
    firstInningsScoreLine: "SUN 184/6 (20.0)",
    flash: null,
    flashToken: null,
    flashDetail: null,
    broadcastMessage: null,
    connectionHint: "connected",
    sponsors: [
      { publicId: "sp-1", name: "Heritage Hospital", isTitleSponsor: true, url: "https://example.com/h.png", type: "Official Healthcare Partner" },
      { publicId: "sp-2", name: "Good Morning", isTitleSponsor: false, url: "https://example.com/gm.png", type: "Official Refreshment Partner" },
    ],
  };
}

describe("OBS V2 Cricket Presentation Refactor Contract", () => {
  describe("1. Auction Decontamination in Cricket V2 Adapter", () => {
    it("never populates auction-shaped TeamPurse in teams array", () => {
      const vm = createMockCricketVm();
      const frame = adaptCricketToBroadcastFrame({ vm });

      // Teams array must be empty - no auction purse or slot data
      expect(frame.teams).toEqual([]);
      expect(frame.settings.showTicker).toBe(false);
    });

    it("does not leak purseRemaining or slotsRemaining into cricket model", () => {
      const vm = createMockCricketVm();
      const frame = adaptCricketToBroadcastFrame({ vm });

      expect(frame.scene).toBe("CRICKET");
      const model = frame.model as any;
      expect(model.purseRemaining).toBeUndefined();
      expect(model.slotsRemaining).toBeUndefined();
      expect(model.playersBought).toBeUndefined();
    });
  });

  describe("2. Broadcast Zone Geometry Invariants (1920×1080)", () => {
    it("enforces explicit 4-zone allocation without magic numbers", () => {
      const { headerHeight, cameraHeight, scorebugHeight, footerHeight } = OBS_V2.canvas;

      expect(headerHeight).toBe(96);
      expect(cameraHeight).toBe(784);
      expect(scorebugHeight).toBe(160);
      expect(footerHeight).toBe(40);

      // Exact 1080 total height
      expect(headerHeight + cameraHeight + scorebugHeight + footerHeight).toBe(1080);

      // Zones definitions
      expect(OBS_V2.canvas.zones.header.height).toBe(96);
      expect(OBS_V2.canvas.zones.camera.height).toBe(784);
      expect(OBS_V2.canvas.zones.camera.top).toBe(96);
      expect(OBS_V2.canvas.zones.camera.bottom).toBe(200); // 160 scorebug + 40 footer
      expect(OBS_V2.canvas.zones.lowerThird.top).toBe(880);
      expect(OBS_V2.canvas.zones.footer.top).toBe(1040);
    });
  });

  describe("3. Side Slate System & Content-Driven Sizing", () => {
    it("configures large panels for information-dense graphics", () => {
      // STANDINGS
      expect(VARIANT_CONFIGS.STANDINGS.heightMode).toBe("fill");
      expect(VARIANT_CONFIGS.STANDINGS.widthPx).toBeGreaterThanOrEqual(800);
      expect(VARIANT_CONFIGS.STANDINGS.widthPx).toBeLessThanOrEqual(900);

      // FIXTURES
      expect(VARIANT_CONFIGS.FIXTURES.heightMode).toBe("fill");
      expect(VARIANT_CONFIGS.FIXTURES.widthPx).toBeGreaterThanOrEqual(760);
      expect(VARIANT_CONFIGS.FIXTURES.widthPx).toBeLessThanOrEqual(850);

      // SCORECARD
      expect(VARIANT_CONFIGS.SCORECARD.heightMode).toBe("fill");
      expect(VARIANT_CONFIGS.SCORECARD.widthPx).toBeGreaterThanOrEqual(900);
      expect(VARIANT_CONFIGS.SCORECARD.widthPx).toBeLessThanOrEqual(960);
    });

    it("configures compact cards for lightweight graphics (no giant empty boxes)", () => {
      // SPONSORS
      expect(VARIANT_CONFIGS.SPONSORS.heightMode).toBe("compact");
      expect(VARIANT_CONFIGS.SPONSORS.widthPx).toBeGreaterThanOrEqual(560);
      expect(VARIANT_CONFIGS.SPONSORS.widthPx).toBeLessThanOrEqual(650);
      expect(VARIANT_CONFIGS.SPONSORS.heightPx).toBeGreaterThanOrEqual(250);
      expect(VARIANT_CONFIGS.SPONSORS.heightPx).toBeLessThanOrEqual(330);

      // VS_INTRO
      expect(VARIANT_CONFIGS.VS_INTRO.heightMode).toBe("compact");
      expect(VARIANT_CONFIGS.VS_INTRO.widthPx).toBeGreaterThanOrEqual(600);
      expect(VARIANT_CONFIGS.VS_INTRO.widthPx).toBeLessThanOrEqual(700);
      expect(VARIANT_CONFIGS.VS_INTRO.heightPx).toBeGreaterThanOrEqual(260);
      expect(VARIANT_CONFIGS.VS_INTRO.heightPx).toBeLessThanOrEqual(350);

      // SUMMARY
      expect(VARIANT_CONFIGS.SUMMARY.heightMode).toBe("compact");
      expect(VARIANT_CONFIGS.SUMMARY.widthPx).toBeGreaterThanOrEqual(620);
      expect(VARIANT_CONFIGS.SUMMARY.widthPx).toBeLessThanOrEqual(720);
      expect(VARIANT_CONFIGS.SUMMARY.heightPx).toBeLessThan(500);
    });
  });

  describe("4. Layer Isolation & Z-Index Monotonicity", () => {
    it("ensures Slates and Messages do not overlap or replace Scorebug", () => {
      // Scorebug is z-20
      expect(OBS_V2.layer.scorebug).toBe(20);
      // Header is z-30 (protected)
      expect(OBS_V2.layer.header).toBe(30);
      // Structural/Chyron is z-35
      expect(OBS_V2.layer.structuralRail).toBe(35);
      // Slates is z-40 (inside camera safe zone)
      expect(OBS_V2.layer.slates).toBe(40);
      // Central Event Impact is z-50 (hero layer)
      expect(OBS_V2.layer.eventFlash).toBe(50);
    });
  });

  describe("5. User Requested OBS Broadcast Enhancements", () => {
    it("formats overs as clean string without duplicate /OV for single-line display", () => {
      const vm = createMockCricketVm();
      vm.oversDisplay = "0.3/6 OV";
      vm.oversLabel = "0.3";
      vm.oversLimit = 6;

      const frame = adaptCricketToBroadcastFrame({ vm });
      const model = frame.model as any;
      expect(model.overs).toBe("0.3");
      expect(model.maxOvers).toBe(6);
    });

    it("ensures Crest renders with square dimensions", () => {
      const element = Crest({ text: "WHS", size: 74 });
      expect(element.props.style.width).toBe(74);
      expect(element.props.style.height).toBe(74);
    });

    it("preserves autoFlash when overrideFlash is not active in buildCricketObsViewModel", async () => {
      const { buildCricketObsViewModel } = await import("@/lib/cricket-obs-view-model");
      const vm = buildCricketObsViewModel({
        live: {
          match: { id: 10, status: "live" } as any,
          state: {
            matchStatus: "live",
            lastSequence: 5,
            innings: [],
            thisOver: [{ over: 0, ball: 3, runsOffBat: 4, label: "4", isWicket: false, isSuperBall: false }],
          } as any,
        },
        teams: [],
        players: [],
        scorecard: null,
        tournamentName: "Test Trophy",
        tournamentLogoUrl: null,
        sponsors: [],
        pinnedMatchId: null,
        connectionStatus: "connected",
        previousFlashToken: null,
        overrideFlash: null,
        overrideFlashToken: null,
        overrideFlashDetail: null,
      });

      expect(vm.flash).toBe("FOUR");
      expect(vm.flashToken).toContain("10:5:0.3:4");
    });
  });
});
