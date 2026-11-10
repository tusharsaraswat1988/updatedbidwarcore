import React, { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WeddingBrideAvatar,
  WeddingGroomAvatar,
  WeddingTeamAvatar,
  WeddingHeader,
  WeddingTeamPlaque,
  WeddingScorebug,
  WeddingCricketBroadcastStage,
} from "../index";
import type { BroadcastFrame, CricketScoreModel } from "../../obs-v2/contracts";

function createMockCricketScoreModel(): CricketScoreModel {
  return {
    battingTeam: {
      name: "Bride's XI",
      short: "BRD",
      logoUrl: null,
    },
    bowlingTeamShort: "Groom's XI",
    runs: 72,
    wickets: 3,
    overs: "8.4",
    maxOvers: 10,
    crr: 8.31,
    striker: {
      name: "Riya S.",
      runs: 28,
      balls: 22,
      onStrike: true,
      hasStats: true,
    },
    nonStriker: {
      name: "Mehak T.",
      runs: 12,
      balls: 7,
      onStrike: false,
      hasStats: true,
    },
    bowler: {
      name: "Arjun M.",
      runs: 14,
      wickets: 1,
      overs: "1.4",
      hasStats: true,
    },
    thisOver: [
      { kind: "run", label: "1" },
      { kind: "four", label: "4" },
      { kind: "dot", label: "0" },
      { kind: "wicket", label: "W" },
    ],
    status: {
      chip: "LIVE",
      text: "1ST INNINGS",
    },
  };
}

function createMockBroadcastFrame(scene: "CRICKET" | "WAITING" = "CRICKET"): BroadcastFrame {
  const model = createMockCricketScoreModel();
  return {
    scene,
    model: scene === "CRICKET" ? model : ({ headline: "STANDBY FOR MATCH", subline: "THE WEDDING CRICKET CUP" } as any),
    branding: {
      tournamentName: "The Wedding Cricket Cup",
      tournamentAccent: "Aarav & Kiara",
      tournamentShort: "WCC",
      venue: "Udaipur Palace Grounds",
    },
    sponsors: [
      { id: "sp-1", name: "Royal Jewelers", tier: "title" },
      { id: "sp-2", name: "Silk Sarees", tier: "associate" },
    ],
    teams: [],
    settings: {
      performanceMode: false,
      showTicker: true,
    },
    feed: {
      status: "live",
      secondsSinceUpdate: 2,
    },
  };
}

describe("Phase 2 — Royal Wedding Broadcast Presentation Components", () => {
  describe("Wedding Illustrated Avatars", () => {
    it("renders WeddingBrideAvatar SVG with traditional dupatta and maang tikka", () => {
      const html = renderToStaticMarkup(createElement(WeddingBrideAvatar, { size: 68 }));
      expect(html).toContain("wedding-bride-avatar");
      expect(html).toContain("<svg");
      expect(html).toContain("aria-label=\"Bride illustration\"");
    });

    it("renders WeddingGroomAvatar SVG with safa/turban and sherwani", () => {
      const html = renderToStaticMarkup(createElement(WeddingGroomAvatar, { size: 68 }));
      expect(html).toContain("wedding-groom-avatar");
      expect(html).toContain("<svg");
      expect(html).toContain("aria-label=\"Groom illustration\"");
    });

    it("renders custom logo image when logoUrl is provided", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingTeamAvatar, {
          logoUrl: "https://example.com/crest.png",
          teamName: "Bride's XI",
        })
      );
      expect(html).toContain("<img");
      expect(html).toContain("https://example.com/crest.png");
    });
  });

  describe("WeddingHeader", () => {
    it("renders tournament title and couple subtitle with crossed bats crest", () => {
      const frame = createMockBroadcastFrame();
      const html = renderToStaticMarkup(
        createElement(WeddingHeader, {
          branding: frame.branding,
          feedStatus: frame.feed.status,
        })
      );
      expect(html).toContain("The Wedding Cricket Cup");
      expect(html).toContain("AARAV &amp; KIARA");
      expect(html).toContain("LIVE");
    });

    it("gracefully falls back when couple branding is not explicitly set", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingHeader, {
          branding: {
            tournamentName: "Wedding Match",
            tournamentAccent: "",
            tournamentShort: "WM",
          },
        })
      );
      expect(html).toContain("Wedding Match");
      expect(html).toContain("AARAV &amp; KIARA");
    });
  });

  describe("WeddingTeamPlaque", () => {
    it("renders Bride's XI plaque with velvet burgundy gradient and avatar", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingTeamPlaque, {
          name: "Bride's XI",
          shortCode: "BRD",
          side: "bride",
        })
      );
      expect(html).toContain("wedding-team-plaque");
      expect(html).toContain('data-team-side="bride"');
      expect(html).toContain("Bride&#x27;s XI");
    });

    it("renders Groom's XI plaque with velvet navy gradient", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingTeamPlaque, {
          name: "Groom's XI",
          shortCode: "GRM",
          side: "groom",
        })
      );
      expect(html).toContain("wedding-team-plaque");
      expect(html).toContain('data-team-side="groom"');
      expect(html).toContain("Groom&#x27;s XI");
    });
  });

  describe("WeddingScorebug", () => {
    it("renders lower third with match score, overs, batsmen, bowler, and ball pills", () => {
      const model = createMockCricketScoreModel();
      const html = renderToStaticMarkup(createElement(WeddingScorebug, { model }));

      expect(html).toContain('data-wedding-scorebug="true"');

      // Primary Score & Overs
      expect(html).toContain("72");
      expect(html).toContain("3");
      expect(html).toContain("8.4");
      expect(html).toContain("OVERS");

      // Batters
      expect(html).toContain("Riya S.");
      expect(html).toContain("28");
      expect(html).toContain("22");
      expect(html).toContain("Mehak T.");
      expect(html).toContain("12");

      // Analytics
      expect(html).toContain("CRR");
      expect(html).toContain("8.31");
      expect(html).toContain("PROJECTED");
      expect(html).toContain("83");

      // Bowler
      expect(html).toContain("Arjun M.");
      expect(html).toContain("1");
      expect(html).toContain("14");
      expect(html).toContain("1.4");

      // Over Ball-by-ball sequence
      expect(html).toContain('data-ball-outcome="1"');
      expect(html).toContain('data-ball-outcome="4"');
      expect(html).toContain('data-ball-outcome="0"');
      expect(html).toContain('data-ball-outcome="W"');
      expect(html).toContain('data-ball-outcome="empty"');
    });

    it("renders chase equation when in 2nd innings chase mode", () => {
      const model = {
        ...createMockCricketScoreModel(),
        needRuns: 24,
        ballsRemaining: 18,
        rrr: 8.0,
      };
      const html = renderToStaticMarkup(createElement(WeddingScorebug, { model }));
      expect(html).toContain("NEED ");
      expect(html).toContain("24");
      expect(html).toContain(" OFF ");
      expect(html).toContain("18");
      expect(html).toContain("RRR 8.00");
    });

    it("renders result panel when match is completed", () => {
      const model = {
        ...createMockCricketScoreModel(),
        result: {
          kicker: "CHAMPIONS",
          headline: "Bride's XI Won by 6 Wickets",
        },
      };
      const html = renderToStaticMarkup(createElement(WeddingScorebug, { model }));
      expect(html).toContain("CHAMPIONS");
      expect(html).toContain("Bride&#x27;s XI Won by 6 Wickets");
    });
  });

  describe("WeddingCricketBroadcastStage", () => {
    it("renders 1920x1080 stage with wedding theme (footer omitted by default)", () => {
      const frame = createMockBroadcastFrame("CRICKET");
      const html = renderToStaticMarkup(
        createElement(WeddingCricketBroadcastStage, { frame })
      );

      expect(html).toContain("wedding-cricket-broadcast-stage");
      expect(html).toContain('data-broadcast-theme="wedding"');
      expect(html).toContain('data-broadcast-scene="CRICKET"');

      // Zone 1: Header
      expect(html).toContain("The Wedding Cricket Cup");

      // Zone 2: Camera Safe Area
      expect(html).toContain("wedding-camera-impact-zone");

      // Zone 3: Scorebug
      expect(html).toContain("wedding-scorebug");

      // Zone 4: Footer bar omitted by default
      expect(html).not.toContain("wedding-footer-bar");
    });

    it("renders footer when hideFooter is explicitly set to false", () => {
      const frame = createMockBroadcastFrame("CRICKET");
      const html = renderToStaticMarkup(
        createElement(WeddingCricketBroadcastStage, { frame, hideFooter: false })
      );

      expect(html).toContain("wedding-footer-bar");
    });

    it("renders waiting plaque when scene is WAITING", () => {
      const frame = createMockBroadcastFrame("WAITING");
      const html = renderToStaticMarkup(
        createElement(WeddingCricketBroadcastStage, { frame })
      );

      expect(html).toContain("wedding-waiting-plaque");
      expect(html).toContain("MATCH STANDBY");
    });
  });
});
