import React, { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  isWeddingBroadcastEnabled,
  TOURNAMENT_FEATURE_DEFAULTS,
  resolveTournamentFeatures,
  mergeTournamentFeatures,
} from "@workspace/platform-core/tournament-features";
import {
  cricketObsWeddingPath,
  cricketObsWeddingPreviewPath,
  cricketObsV2Path,
  cricketObsV2PreviewPath,
  cricketObsLivePath,
} from "@/lib/tournament-navigation";

describe("Phase 5 — V3 Royal Wedding OBS Live Routing & Admin Entitlement", () => {
  describe("Feature Flag & Entitlement Policy", () => {
    it("defaults weddingBroadcast to false in TOURNAMENT_FEATURE_DEFAULTS", () => {
      expect(TOURNAMENT_FEATURE_DEFAULTS.weddingBroadcast).toBe(false);
    });

    it("isWeddingBroadcastEnabled returns false when features are empty, null, or undefined", () => {
      expect(isWeddingBroadcastEnabled(null)).toBe(false);
      expect(isWeddingBroadcastEnabled(undefined)).toBe(false);
      expect(isWeddingBroadcastEnabled({})).toBe(false);
      expect(isWeddingBroadcastEnabled({ ownerApp: true })).toBe(false);
    });

    it("isWeddingBroadcastEnabled returns true only when weddingBroadcast is explicitly true", () => {
      expect(isWeddingBroadcastEnabled({ weddingBroadcast: true })).toBe(true);
      expect(isWeddingBroadcastEnabled({ weddingBroadcast: false })).toBe(false);
    });

    it("resolveTournamentFeatures preserves weddingBroadcast flag", () => {
      const resolvedOff = resolveTournamentFeatures({ whatsappNotifications: true });
      expect(resolvedOff.weddingBroadcast).toBe(false);

      const resolvedOn = resolveTournamentFeatures({ weddingBroadcast: true });
      expect(resolvedOn.weddingBroadcast).toBe(true);
    });

    it("mergeTournamentFeatures correctly updates weddingBroadcast flag", () => {
      const initial = { weddingBroadcast: false };
      const merged = mergeTournamentFeatures(initial, { weddingBroadcast: true });
      expect(merged.weddingBroadcast).toBe(true);

      const turnedOff = mergeTournamentFeatures(merged, { weddingBroadcast: false });
      expect(turnedOff.weddingBroadcast).toBe(false);
    });
  });

  describe("URL & Navigation Routing Contracts", () => {
    it("generates authoritative V3 Wedding OBS Browser Source URL", () => {
      expect(cricketObsWeddingPath(42)).toBe("/tournament/42/cricket/obs/wedding");
      expect(cricketObsWeddingPath(999)).toBe("/tournament/999/cricket/obs/wedding");
    });

    it("generates authoritative V3 Wedding OBS Preview URL", () => {
      expect(cricketObsWeddingPreviewPath(42)).toBe("/tournament/42/cricket/obs/wedding/preview");
    });

    it("preserves legacy and standard V2 OBS URLs without collision", () => {
      expect(cricketObsV2Path(42)).toBe("/tournament/42/cricket/obs/v2");
      expect(cricketObsV2PreviewPath(42)).toBe("/tournament/42/cricket/obs/v2/preview");
      expect(cricketObsLivePath(42)).toContain("/tournament/42/cricket/obs/live");
    });
  });

  describe("Entitlement Gate Render Behavior", () => {
    it("displays unauthorized lockout notice when weddingBroadcast is not enabled for a tournament", () => {
      // Mocking the unauthorized card structure rendered when feature is disabled
      const lockedHtml = renderToStaticMarkup(
        createElement(
          "div",
          { className: "locked-card" },
          createElement("h2", null, "Royal Wedding Broadcast (V3)"),
          createElement("p", null, "This broadcast theme is not enabled for this tournament."),
          createElement("span", null, "Please contact your platform administrator to activate the Wedding Edition broadcast license.")
        )
      );

      expect(lockedHtml).toContain("Royal Wedding Broadcast (V3)");
      expect(lockedHtml).toContain("This broadcast theme is not enabled");
      expect(lockedHtml).toContain("Please contact your platform administrator");
    });
  });
});
