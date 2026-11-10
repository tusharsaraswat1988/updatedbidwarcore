import React, { createElement } from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WeddingOrnamentalBorder,
  WeddingGoldDivider,
  WeddingSurface,
  WeddingDecorativeLayer,
  WeddingScriptTitle,
  WeddingSerifSubtitle,
  WeddingTeamTitle,
  WeddingScoreNum,
  WeddingLabel,
  WeddingValue,
  WeddingPlayerName,
  WeddingBallPill,
} from "../index";

describe("Wedding UI Primitives", () => {
  describe("WeddingOrnamentalBorder", () => {
    it("renders with default gold border styling", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingOrnamentalBorder, null, createElement("span", null, "Plaque Content"))
      );
      expect(html).toContain("wedding-ornamental-border");
      expect(html).toContain("Plaque Content");
    });

    it("renders corner SVG flourishes when hasFlourishes is true", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingOrnamentalBorder, { hasFlourishes: true }, createElement("span", null, "Ornate Content"))
      );
      expect(html).toContain("<svg");
      expect(html).toContain("Ornate Content");
    });
  });

  describe("WeddingGoldDivider", () => {
    it("renders horizontal divider with center diamond motif by default", () => {
      const html = renderToStaticMarkup(createElement(WeddingGoldDivider, { length: 200 }));
      expect(html).toContain("wedding-gold-divider");
      expect(html).toContain('role="separator"');
      expect(html).toContain('aria-orientation="horizontal"');
    });

    it("renders vertical divider with vertical orientation", () => {
      const html = renderToStaticMarkup(createElement(WeddingGoldDivider, { orientation: "vertical", length: 80 }));
      expect(html).toContain('aria-orientation="vertical"');
    });

    it("renders heart motif", () => {
      const html = renderToStaticMarkup(createElement(WeddingGoldDivider, { motif: "heart" }));
      expect(html).toContain("♥");
    });
  });

  describe("WeddingSurface", () => {
    it("renders parchment variant by default with data attribute", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingSurface, null, createElement("span", null, "Content"))
      );
      expect(html).toContain('data-wedding-surface="parchment"');
      expect(html).toContain("Content");
    });

    it("renders bride and groom velvet variants", () => {
      const brideHtml = renderToStaticMarkup(
        createElement(WeddingSurface, { variant: "bride" }, "Bride's XI")
      );
      expect(brideHtml).toContain('data-wedding-surface="bride"');

      const groomHtml = renderToStaticMarkup(
        createElement(WeddingSurface, { variant: "groom" }, "Groom's XI")
      );
      expect(groomHtml).toContain('data-wedding-surface="groom"');
    });
  });

  describe("WeddingDecorativeLayer", () => {
    it("renders ambient lighting safely without intercepting pointer events", () => {
      const html = renderToStaticMarkup(createElement(WeddingDecorativeLayer, { showAmbientGlow: true }));
      expect(html).toContain("wedding-decorative-layer");
      expect(html).toContain("pointer-events-none");
    });
  });

  describe("WeddingTypography helpers", () => {
    it("renders script title with proper markup", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingScriptTitle, null, "The Wedding Cricket Cup")
      );
      expect(html).toContain("wedding-script-title");
      expect(html).toContain("The Wedding Cricket Cup");
    });

    it("renders serif subtitle with couple names", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingSerifSubtitle, null, "AARAV & KIARA")
      );
      expect(html).toContain("wedding-serif-subtitle");
      expect(html).toContain("AARAV");
    });

    it("renders team title for Bride's and Groom's badges", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingTeamTitle, { variant: "bride" }, "Bride's XI")
      );
      expect(html).toContain("wedding-team-title");
      expect(html).toContain("Bride&#x27;s XI");
    });

    it("renders dominant score numerals with tabular nums", () => {
      const html = renderToStaticMarkup(createElement(WeddingScoreNum, null, "72/3"));
      expect(html).toContain("wedding-score-num");
      expect(html).toContain("72/3");
    });

    it("renders label and value with appropriate classes", () => {
      const labelHtml = renderToStaticMarkup(createElement(WeddingLabel, null, "CRR"));
      expect(labelHtml).toContain("wedding-label");
      expect(labelHtml).toContain("CRR");

      const valueHtml = renderToStaticMarkup(createElement(WeddingValue, null, "8.31"));
      expect(valueHtml).toContain("wedding-value");
      expect(valueHtml).toContain("8.31");
    });

    it("renders player name with strike indicator when on strike", () => {
      const html = renderToStaticMarkup(
        createElement(WeddingPlayerName, { isOnStrike: true }, "Riya S.")
      );
      expect(html).toContain("wedding-player-name");
      expect(html).toContain("▶");
      expect(html).toContain("Riya S.");
    });
  });

  describe("WeddingBallPill", () => {
    it("renders dot ball (0)", () => {
      const html = renderToStaticMarkup(createElement(WeddingBallPill, { outcome: "0" }));
      expect(html).toContain('data-ball-outcome="0"');
      expect(html).toContain("0");
    });

    it("renders four (4) with gold gradient background", () => {
      const html = renderToStaticMarkup(createElement(WeddingBallPill, { outcome: "4" }));
      expect(html).toContain('data-ball-outcome="4"');
      expect(html).toContain("4");
      expect(html).toContain("F3CA68"); // Gold gradient color stop
    });

    it("renders wicket (W) with ruby burgundy background", () => {
      const html = renderToStaticMarkup(createElement(WeddingBallPill, { outcome: "W" }));
      expect(html).toContain('data-ball-outcome="W"');
      expect(html).toContain("W");
      expect(html).toContain("9C1F37"); // Wicket crimson stop
    });

    it("renders empty pending ball gracefully", () => {
      const html = renderToStaticMarkup(createElement(WeddingBallPill, { outcome: "" }));
      expect(html).toContain('data-ball-outcome="empty"');
    });
  });
});
