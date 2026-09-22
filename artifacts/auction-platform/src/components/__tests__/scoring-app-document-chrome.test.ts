import { describe, it, expect } from "vitest";
import { resolveScoringDocumentTitle } from "../scoring-app-document-chrome";

describe("resolveScoringDocumentTitle", () => {
  describe("Cricket organizer routes", () => {
    it("returns BidWar Live Control for live control path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/live-control")).toBe(
        "BidWar Live Control",
      );
      expect(resolveScoringDocumentTitle("/tournament/42/score/live-control/")).toBe(
        "BidWar Live Control",
      );
    });

    it("returns BidWar Dashboard for dashboard path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/dashboard")).toBe(
        "BidWar Dashboard",
      );
    });

    it("returns BidWar Matches for match list path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score")).toBe("BidWar Matches");
      expect(resolveScoringDocumentTitle("/tournament/10/score/")).toBe("BidWar Matches");
    });

    it("returns BidWar Schedule for schedule path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/schedule")).toBe(
        "BidWar Schedule",
      );
    });

    it("returns BidWar Fixtures for fixtures path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/fixtures")).toBe(
        "BidWar Fixtures",
      );
    });

    it("returns BidWar Teams for teams path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/teams")).toBe(
        "BidWar Teams",
      );
    });

    it("returns BidWar Players for players path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/players")).toBe(
        "BidWar Players",
      );
    });

    it("returns BidWar Standings for standings path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/standings")).toBe(
        "BidWar Standings",
      );
    });

    it("returns BidWar Stats for stats path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/stats")).toBe(
        "BidWar Stats",
      );
    });

    it("returns BidWar Officials for officials path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/officials")).toBe(
        "BidWar Officials",
      );
    });

    it("returns BidWar Awards for awards path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/awards")).toBe(
        "BidWar Awards",
      );
    });

    it("returns BidWar Reports for reports path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/reports")).toBe(
        "BidWar Reports",
      );
    });

    it("returns BidWar Rules for rules path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/rules")).toBe(
        "BidWar Rules",
      );
    });

    it("returns BidWar Settings for settings path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/settings")).toBe(
        "BidWar Settings",
      );
    });

    it("returns BidWar Links for links path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/links")).toBe(
        "BidWar Links",
      );
    });

    it("returns BidWar Match Center for match details path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/123")).toBe(
        "BidWar Match Center",
      );
    });

    it("returns BidWar Scoring for organizer live match scoring path", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score/123/live")).toBe(
        "BidWar Scoring",
      );
    });
  });

  describe("Umpire and Scorer routes", () => {
    it("returns BidWar Scoring for cricket umpire console", () => {
      expect(resolveScoringDocumentTitle("/cricket/123/score")).toBe("BidWar Scoring");
      expect(resolveScoringDocumentTitle("/cricket/123/score?tid=10")).toBe("BidWar Scoring");
    });

    it("returns BidWar Scorer Home for cricket scorer home", () => {
      expect(resolveScoringDocumentTitle("/cricket/scorer")).toBe("BidWar Scorer Home");
      expect(resolveScoringDocumentTitle("/cricket/scorer?tid=10")).toBe("BidWar Scorer Home");
    });

    it("returns BidWar Scoring for badminton umpire console", () => {
      expect(resolveScoringDocumentTitle("/badminton/123/score")).toBe("BidWar Scoring");
    });

    it("returns BidWar Scorer Home for badminton scorer home", () => {
      expect(resolveScoringDocumentTitle("/badminton/scorer")).toBe("BidWar Scorer Home");
    });
  });

  describe("Badminton routes", () => {
    it("returns BidWar Tournament Hub for badminton tournament root", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/badminton")).toBe(
        "BidWar Tournament Hub",
      );
    });

    it("returns BidWar Players for badminton players", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/badminton/players")).toBe(
        "BidWar Players",
      );
    });

    it("returns BidWar Matches for badminton matches", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/badminton/matches")).toBe(
        "BidWar Matches",
      );
    });

    it("returns BidWar Control Center for badminton control center", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/badminton/control")).toBe(
        "BidWar Control Center",
      );
    });

    it("returns BidWar Broadcast Director when focus=broadcast", () => {
      expect(
        resolveScoringDocumentTitle("/tournament/10/badminton/control", "?focus=broadcast"),
      ).toBe("BidWar Broadcast Director");
    });

    it("returns BidWar Scoreboard Display for venue display", () => {
      expect(resolveScoringDocumentTitle("/badminton/123/display")).toBe(
        "BidWar Scoreboard Display",
      );
    });

    it("returns BidWar OBS Overlay for badminton overlay", () => {
      expect(resolveScoringDocumentTitle("/badminton/123/overlay")).toBe(
        "BidWar OBS Overlay",
      );
      expect(resolveScoringDocumentTitle("/badminton/123/overlay", "?type=full")).toBe(
        "BidWar OBS Overlay (Full)",
      );
    });
  });

  describe("Displays, OBS and Special pages", () => {
    it("returns BidWar Score Display for score display", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/score-display")).toBe(
        "BidWar Score Display",
      );
    });

    it("returns BidWar Cricket OBS for cricket obs overlay", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/cricket/obs/123")).toBe(
        "BidWar Cricket OBS",
      );
    });

    it("returns BidWar Mission Control for mission control", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/mission-control")).toBe(
        "BidWar Mission Control",
      );
    });

    it("returns BidWar Scoring Login for login", () => {
      expect(resolveScoringDocumentTitle("/login")).toBe("BidWar Scoring Login");
    });

    it("returns BidWar Fan Hub for fan pages", () => {
      expect(resolveScoringDocumentTitle("/tournament/10/fan")).toBe("BidWar Fan Hub");
      expect(resolveScoringDocumentTitle("/fan/10")).toBe("BidWar Fan Hub");
      expect(resolveScoringDocumentTitle("/fanpage/10")).toBe("BidWar Fan Hub");
    });
  });

  describe("Custom branding replacement", () => {
    it("correctly replaces BidWar with custom brand name", () => {
      const applyBrand = (title: string, brand: string) =>
        brand && brand !== "BidWar" ? title.replace(/BidWar/g, brand) : title;

      const liveControlTitle = resolveScoringDocumentTitle("/tournament/10/score/live-control");
      expect(applyBrand(liveControlTitle, "Premier League")).toBe("Premier League Live Control");

      const scoringTitle = resolveScoringDocumentTitle("/cricket/123/score");
      expect(applyBrand(scoringTitle, "Premier League")).toBe("Premier League Scoring");

      const matchesTitle = resolveScoringDocumentTitle("/tournament/10/score");
      expect(applyBrand(matchesTitle, "Premier League")).toBe("Premier League Matches");
    });
  });
});
