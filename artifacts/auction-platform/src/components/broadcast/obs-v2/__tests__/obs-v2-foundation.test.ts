import { describe, expect, it } from "vitest";
import { OBS_V2, getObsV2CssVariables } from "../obs-v2-tokens";

describe("OBS V2 Foundation Design Tokens", () => {
  describe("1. Canvas & Safe Areas", () => {
    it("enforces 1920x1080 16:9 canvas dimensions", () => {
      expect(OBS_V2.canvas.width).toBe(1920);
      expect(OBS_V2.canvas.height).toBe(1080);
      expect(OBS_V2.canvas.aspect).toBe("16:9");
    });

    it("defines 5% action-safe insets (96x54)", () => {
      expect(OBS_V2.canvas.safeX).toBe(96);
      expect(OBS_V2.canvas.safeY).toBe(54);
      expect(OBS_V2.canvas.safeWidth).toBe(1728);
      expect(OBS_V2.canvas.safeHeight).toBe(972);
    });

    it("defines standard layout vertical allocations", () => {
      expect(OBS_V2.canvas.headerHeight).toBe(96);
      expect(OBS_V2.canvas.scorebugHeight).toBe(160);
      expect(OBS_V2.canvas.footerHeight).toBe(40);
      expect(OBS_V2.canvas.cameraHeight).toBe(784);
    });
  });

  describe("2. Color System", () => {
    it("maintains dark obsidian foundation", () => {
      expect(OBS_V2.color.obsidian).toBe("#050507");
      expect(OBS_V2.color.carbon).toBe("#08080C");
      expect(OBS_V2.color.panel).toBe("#0C0C10");
      expect(OBS_V2.color.panelElevated).toBe("#11131A");
      expect(OBS_V2.color.panelInset).toBe("#07080C");
    });

    it("uses authoritative BidWar Gold #FFD700 as brand accent", () => {
      expect(OBS_V2.color.brand).toBe("#FFD700");
      expect(OBS_V2.color.brandOn).toBe("#0C0C10");
      expect(OBS_V2.color.brandSoft).toContain("255, 215, 0");
      expect(OBS_V2.color.brandBorder).toContain("255, 215, 0");
    });

    it("defines semantic sports status colors", () => {
      expect(OBS_V2.color.info).toBe("#12CFFF"); // Free Hit / Secondary
      expect(OBS_V2.color.success).toBe("#22C55E"); // Milestone / Boundary
      expect(OBS_V2.color.danger).toBe("#EF3340"); // Wicket / Out
      expect(OBS_V2.color.warning).toBe("#F59E0B"); // Caution / RRR spike
      expect(OBS_V2.color.neutral).toBe("#94A3B8"); // Dot ball / Wide
    });

    it("defines typography color hierarchy", () => {
      expect(OBS_V2.color.text).toBe("#F8FAFC");
      expect(OBS_V2.color.textSecondary).toContain("248, 250, 252");
      expect(OBS_V2.color.textMuted).toContain("248, 250, 252");
      expect(OBS_V2.color.textDisabled).toContain("248, 250, 252");
    });

    it("provides subtle obsidian gradients", () => {
      expect(OBS_V2.color.gradient.panel).toContain("linear-gradient");
      expect(OBS_V2.color.gradient.elevated).toContain("linear-gradient");
      expect(OBS_V2.color.gradient.hero).toContain("linear-gradient");
      expect(OBS_V2.color.gradient.inset).toContain("linear-gradient");
    });
  });

  describe("3. Typography Hierarchy", () => {
    it("defines authoritative broadcast font families", () => {
      expect(OBS_V2.typography.family.display).toContain("Bebas Neue");
      expect(OBS_V2.typography.family.body).toContain("Inter");
      expect(OBS_V2.typography.family.mono).toContain("JetBrains Mono");
    });

    it("scales correctly across broadcast levels", () => {
      const scale = OBS_V2.typography.scale;
      expect(scale.mega.fontSize).toBe(112);
      expect(scale.score.fontSize).toBe(72);
      expect(scale.hero.fontSize).toBe(56);
      expect(scale.title.fontSize).toBe(36);
      expect(scale.headline.fontSize).toBe(24);
      expect(scale.scoreSub.fontSize).toBe(28);
      expect(scale.statNum.fontSize).toBe(22);
      expect(scale.value.fontSize).toBe(16);
      expect(scale.body.fontSize).toBe(14);
      expect(scale.label.fontSize).toBe(11);
      expect(scale.micro.fontSize).toBe(9);
    });

    it("preserves broadcast letter tracking", () => {
      expect(OBS_V2.typography.tracking.tight).toBe("-0.02em");
      expect(OBS_V2.typography.tracking.wide).toBe("0.08em");
      expect(OBS_V2.typography.tracking.wider).toBe("0.16em");
      expect(OBS_V2.typography.tracking.widest).toBe("0.24em");
    });
  });

  describe("4. Spacing System", () => {
    it("follows strict 4px grid rhythm", () => {
      expect(OBS_V2.spacing.xs).toBe(4);
      expect(OBS_V2.spacing.sm).toBe(8);
      expect(OBS_V2.spacing.md).toBe(12);
      expect(OBS_V2.spacing.lg).toBe(16);
      expect(OBS_V2.spacing.xl).toBe(24);
      expect(OBS_V2.spacing.xxl).toBe(32);
      expect(OBS_V2.spacing.section).toBe(48);
      expect(OBS_V2.spacing.canvas).toBe(64);
    });
  });

  describe("5. Broadcast Geometry", () => {
    it("defines restrained corner radiuses", () => {
      expect(OBS_V2.geometry.radius.none).toBe(0);
      expect(OBS_V2.geometry.radius.sm).toBe(4);
      expect(OBS_V2.geometry.radius.md).toBe(6);
      expect(OBS_V2.geometry.radius.lg).toBe(8);
    });

    it("generates valid CSS clip-paths for chamfers", () => {
      const clipTR = OBS_V2.geometry.chamfer.clipTopRight(6);
      expect(clipTR).toContain("polygon");
      expect(clipTR).toContain("calc(100% - 6px)");

      const clipBoth = OBS_V2.geometry.chamfer.clipBothRight(6);
      expect(clipBoth).toContain("polygon");

      const clipSlanted = OBS_V2.geometry.chamfer.clipSlanted(14);
      expect(clipSlanted).toContain("polygon");
    });

    it("defines broadcast rail thicknesses", () => {
      expect(OBS_V2.geometry.rail.hairline).toBe(1);
      expect(OBS_V2.geometry.rail.standard).toBe(2);
      expect(OBS_V2.geometry.rail.hero).toBe(3);
    });
  });

  describe("6. Depth & Motion", () => {
    it("defines depth shadows and edge hairlines", () => {
      expect(OBS_V2.depth.shadow.standard).toContain("rgba");
      expect(OBS_V2.depth.shadow.elevated).toContain("rgba");
      expect(OBS_V2.depth.edge.topBrandRail).toContain("#FFD700");
    });

    it("defines controlled broadcast motion durations", () => {
      expect(OBS_V2.motion.duration.instant).toBe(100);
      expect(OBS_V2.motion.duration.fast).toBe(180);
      expect(OBS_V2.motion.duration.standard).toBe(300);
      expect(OBS_V2.motion.duration.broadcast).toBe(450);
      expect(OBS_V2.motion.duration.major).toBe(700);
      expect(OBS_V2.motion.duration.entrance).toBe(220);
      expect(OBS_V2.motion.duration.exit).toBe(500);
      expect(OBS_V2.motion.duration.hold).toBe(1280);
      expect(OBS_V2.motion.duration.eventTotal).toBe(2000);
    });

    it("defines snappy broadcast easing curves", () => {
      expect(OBS_V2.motion.easing.snappy).toEqual([0.16, 1, 0.3, 1]);
      expect(OBS_V2.motion.easing.exit).toEqual([0.7, 0, 0.84, 0]);
    });
  });

  describe("7. Z-Index Layering", () => {
    it("establishes clear broadcast layering", () => {
      expect(OBS_V2.layer.canvas).toBe(0);
      expect(OBS_V2.layer.cameraFeed).toBe(10);
      expect(OBS_V2.layer.scorebug).toBe(20);
      expect(OBS_V2.layer.header).toBe(30);
      expect(OBS_V2.layer.structuralRail).toBe(35);
      expect(OBS_V2.layer.slates).toBe(40);
      expect(OBS_V2.layer.eventFlash).toBe(50);
      expect(OBS_V2.layer.operatorControls).toBe(90);
    });
  });

  describe("8. CSS Custom Properties Generator", () => {
    it("maps all core tokens to --obs-v2-* CSS variables", () => {
      const cssVars = getObsV2CssVariables();
      expect(cssVars["--obs-v2-canvas-width"]).toBe("1920px");
      expect(cssVars["--obs-v2-canvas-height"]).toBe("1080px");
      expect(cssVars["--obs-v2-safe-x"]).toBe("96px");
      expect(cssVars["--obs-v2-safe-y"]).toBe("54px");
      expect(cssVars["--obs-v2-color-obsidian"]).toBe("#050507");
      expect(cssVars["--obs-v2-color-carbon"]).toBe("#08080C");
      expect(cssVars["--obs-v2-color-brand"]).toBe("#FFD700");
      expect(cssVars["--obs-v2-color-info"]).toBe("#12CFFF");
      expect(cssVars["--obs-v2-color-success"]).toBe("#22C55E");
      expect(cssVars["--obs-v2-color-danger"]).toBe("#EF3340");
      expect(cssVars["--obs-v2-font-display"]).toContain("Bebas Neue");
      expect(cssVars["--obs-v2-font-body"]).toContain("Inter");
      expect(cssVars["--obs-v2-font-mono"]).toContain("JetBrains Mono");
    });
  });
});
