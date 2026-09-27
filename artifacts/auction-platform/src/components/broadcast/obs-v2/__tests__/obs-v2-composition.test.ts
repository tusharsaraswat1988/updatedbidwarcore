import { describe, expect, it } from "vitest";
import { OBS_V2 } from "../obs-v2-tokens";
import { MOCK_OBS_V2_STAGE_DATA, type ObsV2StageData } from "../types";

describe("OBS V2 Master Broadcast Composition (Step 2)", () => {
  describe("1. Coordinate Space & Vertical Allocations", () => {
    it("guarantees 1920x1080 fixed broadcast canvas bounds", () => {
      expect(OBS_V2.canvas.width).toBe(1920);
      expect(OBS_V2.canvas.height).toBe(1080);
      expect(OBS_V2.canvas.aspect).toBe("16:9");
    });

    it("reserves 96px for top structural header", () => {
      expect(OBS_V2.canvas.headerHeight).toBe(96);
    });

    it("reserves 160px for docked scorebug and 40px for footer bar", () => {
      expect(OBS_V2.canvas.scorebugHeight).toBe(160);
      expect(OBS_V2.canvas.footerHeight).toBe(40);
    });

    it("preserves exactly 784px transparent camera-safe viewport", () => {
      const topOffset = OBS_V2.canvas.headerHeight;
      const bottomOffset = OBS_V2.canvas.scorebugHeight + OBS_V2.canvas.footerHeight;
      const cameraHeight = OBS_V2.canvas.height - topOffset - bottomOffset;

      expect(cameraHeight).toBe(784);
      expect(OBS_V2.canvas.cameraHeight).toBe(784);
      expect(topOffset + cameraHeight + bottomOffset).toBe(1080);
    });

    it("enforces 5% action-safe insets across all horizontal sections", () => {
      expect(OBS_V2.canvas.safeX).toBe(96);
      expect(OBS_V2.canvas.safeY).toBe(54);
      expect(OBS_V2.canvas.safeWidth).toBe(1728);
      expect(OBS_V2.canvas.safeHeight).toBe(972);
      expect(OBS_V2.canvas.safeX * 2 + OBS_V2.canvas.safeWidth).toBe(1920);
      expect(OBS_V2.canvas.safeY * 2 + OBS_V2.canvas.safeHeight).toBe(1080);
    });
  });

  describe("2. Layering & Z-Index Architecture", () => {
    it("orders z-indexes so camera is clear and graphics remain properly stacked", () => {
      expect(OBS_V2.layer.canvas).toBe(0);
      expect(OBS_V2.layer.cameraFeed).toBe(10);
      expect(OBS_V2.layer.scorebug).toBe(20);
      expect(OBS_V2.layer.header).toBe(30);
      expect(OBS_V2.layer.structuralRail).toBe(35);
      expect(OBS_V2.layer.slates).toBe(40);
      expect(OBS_V2.layer.eventFlash).toBe(50);

      // Verify strict monotonicity
      expect(OBS_V2.layer.cameraFeed).toBeGreaterThan(OBS_V2.layer.canvas);
      expect(OBS_V2.layer.scorebug).toBeGreaterThan(OBS_V2.layer.cameraFeed);
      expect(OBS_V2.layer.header).toBeGreaterThan(OBS_V2.layer.scorebug);
      expect(OBS_V2.layer.slates).toBeGreaterThan(OBS_V2.layer.header);
      expect(OBS_V2.layer.eventFlash).toBeGreaterThan(OBS_V2.layer.slates);
    });
  });

  describe("3. Deterministic Mock Data Model", () => {
    it("provides valid and complete mock broadcast data", () => {
      expect(MOCK_OBS_V2_STAGE_DATA).toBeDefined();

      // Header contract
      const header = MOCK_OBS_V2_STAGE_DATA.header;
      expect(header.tournamentName).toBe("BidWar Premier League");
      expect(header.matchContext).toBe("Qualifier 01");
      expect(header.live).toBe(true);
      expect(header.statusLabel).toBe("LIVE");

      // Scorebug contract
      const scorebug = MOCK_OBS_V2_STAGE_DATA.scorebug;
      expect(scorebug.battingTeam.shortCode).toBe("TIT");
      expect(scorebug.bowlingTeam?.shortCode).toBe("RS");
      expect(scorebug.runs).toBe(124);
      expect(scorebug.wickets).toBe(4);
      expect(scorebug.overs).toBe("17.3");
      expect(scorebug.maxOvers).toBe(20);
      expect(scorebug.target).toBe(168);
      expect(scorebug.needRuns).toBe(44);
      expect(scorebug.ballsRemaining).toBe(15);
      expect(scorebug.crr).toBe("7.08");
      expect(scorebug.rrr).toBe("17.60");
      expect(scorebug.statusText).toContain("NEED 44 RUNS");
    });

    it("allows custom data overriding mock model cleanly", () => {
      const customData: ObsV2StageData = {
        header: {
          tournamentName: "Super Cup 2026",
          matchContext: "Final",
          live: true,
          statusLabel: "CHASE",
        },
        scorebug: {
          battingTeam: {
            name: "Lions XI",
            shortCode: "LIO",
            color: "#F59E0B",
          },
          runs: 210,
          wickets: 2,
          overs: "19.1",
          maxOvers: 20,
          target: 209,
          statusText: "LIONS WON BY 8 WICKETS",
        },
      };

      expect(customData.header.matchContext).toBe("Final");
      expect(customData.scorebug.runs).toBe(210);
      expect(customData.scorebug.target).toBe(209);
    });
  });

  describe("4. Structural Rails & Design Consistency", () => {
    it("uses continuous 2px standard rail metric", () => {
      expect(OBS_V2.geometry.rail.standard).toBe(2);
      expect(OBS_V2.color.brand).toBe("#FFD700");
    });

    it("defines high-contrast text foreground for brand surfaces", () => {
      expect(OBS_V2.color.brandOn).toBe("#0C0C10");
    });
  });
});
