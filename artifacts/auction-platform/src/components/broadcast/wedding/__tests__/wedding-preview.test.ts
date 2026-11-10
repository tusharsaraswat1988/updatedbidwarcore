import React, { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  makeWeddingPreviewFrame,
  type WeddingPreviewOptions,
} from "../preview/wedding-preview-data";
import CricketObsWeddingPreviewPage from "@/pages/cricket-obs-wedding-preview";
import type { CricketScoreModel } from "../../obs-v2/contracts";

describe("Phase 4 — Royal Wedding OBS Preview & QA Environment", () => {
  describe("wedding-preview-data", () => {
    it("generates authentic Live 1st Innings scenario matching user mockup", () => {
      const frame = makeWeddingPreviewFrame({ state: "live_1st_innings" });
      expect(frame.scene).toBe("CRICKET");

      const model = frame.model as CricketScoreModel;
      expect(model.battingTeam.name).toBe("Bride's XI");
      expect(model.bowlingTeamShort).toBe("Groom's XI");
      expect(model.runs).toBe(72);
      expect(model.wickets).toBe(3);
      expect(model.overs).toBe("8.4");
      expect(model.maxOvers).toBe(10);
      expect(model.crr).toBe(8.31);
      expect(model.striker.name).toBe("Riya S.");
      expect(model.striker.runs).toBe(28);
      expect(model.striker.balls).toBe(22);
      expect(model.nonStriker.name).toBe("Mehak T.");
      expect(model.bowler.name).toBe("Arjun M.");
      expect(model.bowler.wickets).toBe(1);
      expect(model.bowler.runs).toBe(14);
      expect(model.thisOver).toHaveLength(4);
    });

    it("generates authentic 2nd Innings Chase scenario", () => {
      const frame = makeWeddingPreviewFrame({ state: "live_chase" });
      const model = frame.model as CricketScoreModel;

      expect(model.battingTeam.name).toBe("Groom's XI");
      expect(model.bowlingTeamShort).toBe("Bride's XI");
      expect(model.runs).toBe(64);
      expect(model.wickets).toBe(2);
      expect(model.needRuns).toBe(46);
      expect(model.ballsRemaining).toBe(27);
      expect(model.rrr).toBe(10.22);
      expect(model.striker.name).toBe("Kabir V.");
    });

    it("generates Pre-Match scenario with toss announcement", () => {
      const frame = makeWeddingPreviewFrame({ state: "pre_match" });
      const model = frame.model as CricketScoreModel;

      expect(model.runs).toBe(0);
      expect(model.wickets).toBe(0);
      expect(model.status.chip).toBe("PRE-MATCH");
      expect(model.status.text).toContain("TOSS");
    });

    it("generates Innings Break scenario with target", () => {
      const frame = makeWeddingPreviewFrame({ state: "innings_break" });
      const model = frame.model as CricketScoreModel;

      expect(model.status.chip).toBe("BREAK");
      expect(model.target).toBe(110);
      expect(model.status.text).toContain("TARGET 110");
    });

    it("generates Match Result scenario with winner announcement", () => {
      const frame = makeWeddingPreviewFrame({ state: "match_result" });
      const model = frame.model as CricketScoreModel;

      expect(model.result).toBeDefined();
      expect(model.result?.headline).toContain("Bride's XI Won by 14 Runs");
      expect(model.status.chip).toBe("FINAL");
    });

    it("supports neutral team names and sponsor toggles", () => {
      const frame = makeWeddingPreviewFrame({
        state: "live_1st_innings",
        isNeutralTeams: true,
        hasSponsors: false,
      });
      const model = frame.model as CricketScoreModel;

      expect(model.battingTeam.name).toBe("Royal Challengers");
      expect(model.bowlingTeamShort).toBe("Palace Royals");
      expect(frame.sponsors).toHaveLength(0);
    });
  });

  describe("CricketObsWeddingPreviewPage Component", () => {
    it("renders developer QA toolbar and stage viewport", () => {
      const html = renderToStaticMarkup(createElement(CricketObsWeddingPreviewPage));

      // Developer Toolbar
      expect(html).toContain("Royal Wedding Edition · OBS Broadcast QA Studio");
      expect(html).toContain("1920×1080 Native");

      // Match Phase Buttons
      expect(html).toContain("Live (1st Inn)");
      expect(html).toContain("Chase (2nd Inn)");
      expect(html).toContain("Pre-Match");
      expect(html).toContain("Final Result");

      // Celebration Trigger Buttons
      expect(html).toContain("4 FOUR");
      expect(html).toContain("6 SIX");
      expect(html).toContain("W WICKET");
      expect(html).toContain("🏆 WINNER");

      // Variation Controls
      expect(html).toContain("Bride vs Groom");
      expect(html).toContain("Vector Avatars");
      expect(html).toContain("Sponsors ON");

      // Backdrop Options
      expect(html).toContain("Wedding Lawn");
      expect(html).toContain("Checker");

      // Stage Viewport
      expect(html).toContain("wedding-cricket-broadcast-stage");
      expect(html).toContain("The Wedding Cricket Cup");
      expect(html).toContain("AARAV &amp; KIARA");
    });
  });
});
