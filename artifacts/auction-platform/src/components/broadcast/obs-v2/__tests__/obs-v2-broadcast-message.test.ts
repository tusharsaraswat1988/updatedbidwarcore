import { describe, expect, it } from "vitest";
import { OBS_V2 } from "../obs-v2-tokens.ts";
import {
  MOCK_OBS_V2_BROADCAST_MESSAGE,
  type ObsV2BroadcastMessageData,
} from "../types.ts";

describe("OBS V2 Broadcast Message Visual Prototype (Layer 1)", () => {
  describe("1. Mock Data & Model Contract", () => {
    it("provides valid deterministic mock data for prototype review", () => {
      expect(MOCK_OBS_V2_BROADCAST_MESSAGE).toBeDefined();
      expect(MOCK_OBS_V2_BROADCAST_MESSAGE.eyebrow).toBe("MATCH UPDATE");
      expect(MOCK_OBS_V2_BROADCAST_MESSAGE.message).toBe("POWERPLAY 1 COMPLETE");
      expect(MOCK_OBS_V2_BROADCAST_MESSAGE.supportingText).toBe(
        "Riverside CC 52/1 after 6 overs",
      );
    });

    it("supports minimal broadcast message without optional eyebrow or supportingText", () => {
      const minimalMsg: ObsV2BroadcastMessageData = {
        message: "PLAY RESUMED",
      };

      expect(minimalMsg.message).toBe("PLAY RESUMED");
      expect(minimalMsg.eyebrow).toBeUndefined();
      expect(minimalMsg.supportingText).toBeUndefined();
    });

    it("supports tactical announcements with complete metadata", () => {
      const announcement: ObsV2BroadcastMessageData = {
        eyebrow: "WEATHER DELAY",
        message: "INSPECTION AT 15:45 IST",
        supportingText: "Covers being removed from central pitch",
      };

      expect(announcement.eyebrow).toBe("WEATHER DELAY");
      expect(announcement.message).toBe("INSPECTION AT 15:45 IST");
      expect(announcement.supportingText).toBe("Covers being removed from central pitch");
    });
  });

  describe("2. Coordinate Space & Lower-Third Docking Constraints", () => {
    it("docks exactly 16px (OBS_V2.spacing.lg) above the 140px scorebug", () => {
      const bottomDock = OBS_V2.canvas.scorebugHeight + OBS_V2.spacing.lg;
      expect(bottomDock).toBe(156);
      expect(bottomDock).toBeGreaterThan(OBS_V2.canvas.scorebugHeight);
    });

    it("aligns to the 5% action-safe left margin (96px)", () => {
      expect(OBS_V2.canvas.safeX).toBe(96);
    });

    it("resides on the slates broadcast z-index layer (40)", () => {
      expect(OBS_V2.layer.slates).toBe(40);
      // Ensures message sits below transient event flashes (50) and above the scorebug (20)
      expect(OBS_V2.layer.slates).toBeGreaterThan(OBS_V2.layer.scorebug);
      expect(OBS_V2.layer.eventFlash).toBeGreaterThan(OBS_V2.layer.slates);
    });

    it("preserves central camera visibility without spanning full width", () => {
      // Scorebug is full width inside safe margins (1728px), while chyron max width is 720px
      const maxChyronWidth = 720;
      const safeCanvasWidth = OBS_V2.canvas.safeWidth;
      const clearCameraSpan = safeCanvasWidth - maxChyronWidth;

      expect(clearCameraSpan).toBeGreaterThan(1000);
      expect(clearCameraSpan).toBe(1008);
    });
  });

  describe("3. Design System & Token Integrity", () => {
    it("enforces BidWar brand gold (#FFD700) for structural left rail", () => {
      expect(OBS_V2.color.brand).toBe("#FFD700");
    });

    it("uses obsidian elevated panel gradient for card chassis", () => {
      expect(OBS_V2.color.panelElevated).toBe("#11131A");
      expect(OBS_V2.color.gradient.elevated).toContain("#11131A");
    });

    it("provides high contrast secondary text color for supporting context", () => {
      expect(OBS_V2.color.textSecondary).toBe("rgba(248, 250, 252, 0.72)");
      expect(OBS_V2.color.text).toBe("#F8FAFC");
    });

    it("uses snappy broadcast easing for chyron entrance and exit", () => {
      expect(OBS_V2.motion.easing.snappy).toEqual([0.16, 1, 0.3, 1]);
    });
  });
});
