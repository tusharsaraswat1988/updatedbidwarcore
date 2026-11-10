import { describe, it, expect } from "vitest";
import { WEDDING_TOKENS, getWeddingCssVariables } from "../wedding-ui-tokens";

describe("WEDDING_TOKENS Foundation", () => {
  it("enforces 1920x1080 16:9 canvas dimensions and standard broadcast insets", () => {
    expect(WEDDING_TOKENS.canvas.width).toBe(1920);
    expect(WEDDING_TOKENS.canvas.height).toBe(1080);
    expect(WEDDING_TOKENS.canvas.aspect).toBe("16:9");
    expect(WEDDING_TOKENS.canvas.safeX).toBe(96);
    expect(WEDDING_TOKENS.canvas.safeY).toBe(54);
    expect(WEDDING_TOKENS.canvas.safeWidth).toBe(1728);
    expect(WEDDING_TOKENS.canvas.safeHeight).toBe(972);
  });

  it("defines physical geometry for scoreboard lower-third", () => {
    const { scoreboard } = WEDDING_TOKENS.canvas;
    expect(scoreboard.width).toBeGreaterThanOrEqual(1000);
    expect(scoreboard.mainStripHeight).toBeGreaterThan(0);
    expect(scoreboard.statsRibbonHeight).toBeGreaterThan(0);
    expect(scoreboard.totalHeight).toBe(scoreboard.mainStripHeight + scoreboard.statsRibbonHeight);
    expect(scoreboard.vsMedallionSize).toBe(44);
    expect(scoreboard.ballPillSize).toBe(32);
  });

  it("contains royal wedding palette colors", () => {
    // Royal Burgundy (Bride's XI)
    expect(WEDDING_TOKENS.color.burgundy.base).toBe("#6B1D2F");
    expect(WEDDING_TOKENS.color.burgundy.deep).toBe("#4A0E18");

    // Royal Navy (Groom's XI)
    expect(WEDDING_TOKENS.color.navy.base).toBe("#182042");
    expect(WEDDING_TOKENS.color.navy.deep).toBe("#0F162B");

    // Champagne & Royal Gold
    expect(WEDDING_TOKENS.color.gold.rich).toBe("#D4AF37");
    expect(WEDDING_TOKENS.color.gold.champagne).toBe("#E5C378");

    // Warm Ivory Parchment
    expect(WEDDING_TOKENS.color.ivory.parchment).toBe("#FDFBF7");

    // Deep Emerald & Dark Charcoal
    expect(WEDDING_TOKENS.color.emerald.base).toBe("#124E38");
    expect(WEDDING_TOKENS.color.charcoal.ink).toBe("#1C1917");
  });

  it("contains typography scale for wedding header, score, and statistics", () => {
    const { scale } = WEDDING_TOKENS.typography;
    expect(scale.cupTitle.fontSize).toBe(44);
    expect(scale.coupleSubtitle.fontSize).toBe(16);
    expect(scale.teamName.fontSize).toBe(26);
    expect(scale.primaryScore.fontSize).toBe(66);
    expect(scale.oversScore.fontSize).toBe(26);
    expect(scale.analyticsLabel.fontSize).toBe(11);
    expect(scale.ballPill.fontSize).toBe(13);
  });

  it("generates valid CSS variable map for stylesheet injection", () => {
    const vars = getWeddingCssVariables();
    expect(vars["--wedding-color-burgundy"]).toBe("#6B1D2F");
    expect(vars["--wedding-color-navy"]).toBe("#182042");
    expect(vars["--wedding-color-gold"]).toBe("#D4AF37");
    expect(vars["--wedding-color-ivory"]).toBe("#FDFBF7");
    expect(vars["--wedding-color-emerald"]).toBe("#124E38");
    expect(vars["--wedding-color-ink"]).toBe("#1C1917");
  });
});
