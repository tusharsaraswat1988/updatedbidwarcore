import React, { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WeddingAnimatedValue,
  WeddingEventGraphic,
  WeddingCricketBroadcastStage,
} from "../index";
import type { ObsV2BroadcastEvent } from "../../obs-v2/obs-v2-events";
import type { BroadcastFrame, CricketScoreModel } from "../../obs-v2/contracts";

function createMockEvent(
  type: ObsV2BroadcastEvent["type"],
  overrides: Partial<ObsV2BroadcastEvent> = {}
): ObsV2BroadcastEvent {
  return {
    id: `evt-${Date.now()}-${type}`,
    type,
    matchId: 101,
    timestamp: Date.now(),
    title: type,
    subtitle: `${type} Event`,
    accentColor: "#D4AF37",
    borderColor: "#E5C378",
    priority: 70,
    batter: "Riya S.",
    bowler: "Arjun M.",
    detail: "4 RUNS",
    ...overrides,
  };
}

function createMockFrame(): BroadcastFrame {
  const model: CricketScoreModel = {
    battingTeam: { name: "Bride's XI", short: "BRD" },
    bowlingTeamShort: "Groom's XI",
    runs: 78,
    wickets: 3,
    overs: "9.2",
    maxOvers: 10,
    crr: 8.35,
    striker: { name: "Riya S.", runs: 34, balls: 26, onStrike: true, hasStats: true },
    nonStriker: { name: "Mehak T.", runs: 12, balls: 7, onStrike: false, hasStats: true },
    bowler: { name: "Arjun M.", runs: 20, wickets: 1, overs: "1.2", hasStats: true },
    thisOver: [{ kind: "four", label: "4" }, { kind: "dot", label: "0" }],
    status: { chip: "LIVE", text: "1ST INNINGS" },
  };

  return {
    scene: "CRICKET",
    model,
    branding: {
      tournamentName: "The Wedding Cricket Cup",
      tournamentAccent: "Aarav & Kiara",
      tournamentShort: "WCC",
    },
    sponsors: [],
    teams: [],
    settings: { performanceMode: false, showTicker: true },
    feed: { status: "live", secondsSinceUpdate: 1 },
  };
}

describe("Phase 3 — Royal Wedding Motion & Celebration System", () => {
  describe("WeddingAnimatedValue", () => {
    it("renders numeric value with tabular numerals", () => {
      const html = renderToStaticMarkup(createElement(WeddingAnimatedValue, { value: 72 }));
      expect(html).toContain("wedding-animated-value");
      expect(html).toContain("tabular-nums");
      expect(html).toContain("72");
    });
  });

  describe("WeddingEventGraphic Celebrations", () => {
    it("renders nothing when event is null", () => {
      const html = renderToStaticMarkup(createElement(WeddingEventGraphic, { event: null }));
      expect(html).toContain("wedding-event-graphic");
      expect(html).toContain('data-wedding-event-active="false"');
      expect(html).not.toContain("SIX");
      expect(html).not.toContain("FOUR");
      expect(html).not.toContain("WICKET");
    });

    it("renders Step 2: SIX celebration with circular medallion, sparkles, and gold typography", () => {
      const event = createMockEvent("SIX", {
        batter: "Riya S.",
        detail: "86 METERS",
      });
      const html = renderToStaticMarkup(createElement(WeddingEventGraphic, { event }));

      expect(html).toContain('data-celebration="six"');
      expect(html).toContain("SIX");
      expect(html).toContain("RIYA S.");
      expect(html).toContain("86 METERS");
      expect(html).toContain("<svg"); // Sparkles / crest
    });

    it("renders Step 3: FOUR celebration with horizontal gold ribbon banner and amber accents", () => {
      const event = createMockEvent("FOUR", {
        batter: "Mehak T.",
        detail: "4 RUNS",
      });
      const html = renderToStaticMarkup(createElement(WeddingEventGraphic, { event }));

      expect(html).toContain('data-celebration="four"');
      expect(html).toContain("FOUR");
      expect(html).toContain("MEHAK T.");
      expect(html).toContain("BOUNDARY");
      expect(html).not.toContain('data-celebration="six"'); // Visually distinct
    });

    it("renders Step 4: WICKET celebration with royal velvet burgundy plaque and dismissal details", () => {
      const event = createMockEvent("WICKET", {
        batter: "Riya S.",
        detail: "BOWLED",
      });
      const html = renderToStaticMarkup(createElement(WeddingEventGraphic, { event }));

      expect(html).toContain('data-celebration="wicket"');
      expect(html).toContain("WICKET");
      expect(html).toContain("KEY BREAKTHROUGH");
      expect(html).toContain("Riya S. (BOWLED)");
    });

    it("renders Step 5: MATCH_WON celebration with trophy, winner name, and margin text", () => {
      const event = createMockEvent("MATCH_WON", {
        winnerName: "Bride's XI",
        marginText: "WON BY 6 WICKETS",
      });
      const html = renderToStaticMarkup(createElement(WeddingEventGraphic, { event }));

      expect(html).toContain('data-celebration="match_won"');
      expect(html).toContain("WEDDING CUP CHAMPIONS");
      expect(html).toContain("Bride&#x27;s XI");
      expect(html).toContain("WON BY 6 WICKETS");
      expect(html).toContain("<svg"); // Victory trophy
    });

    it("renders generic celebration fallback for other event types (e.g. MILESTONE)", () => {
      const event = createMockEvent("MILESTONE", {
        title: "HALF CENTURY",
        subtitle: "Riya S. · 50 OFF 32 BALLS",
      });
      const html = renderToStaticMarkup(createElement(WeddingEventGraphic, { event }));

      expect(html).toContain('data-celebration="generic"');
      expect(html).toContain("HALF CENTURY");
      expect(html).toContain("Riya S. · 50 OFF 32 BALLS");
    });
  });

  describe("Integration in WeddingCricketBroadcastStage", () => {
    it("renders active celebratory event inside Zone 2 camera safe area", () => {
      const frame = createMockFrame();
      const event = createMockEvent("SIX", { batter: "Riya S." });

      const html = renderToStaticMarkup(
        createElement(WeddingCricketBroadcastStage, { frame, activeEvent: event })
      );

      expect(html).toContain("wedding-camera-impact-zone");
      expect(html).toContain('data-wedding-event-active="true"');
      expect(html).toContain('data-celebration="six"');
      expect(html).toContain("SIX");
      expect(html).toContain("The Wedding Cricket Cup"); // Header intact
      expect(html).toContain("wedding-scorebug"); // Scorebug intact
    });
  });
});
