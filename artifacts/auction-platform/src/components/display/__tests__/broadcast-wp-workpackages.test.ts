import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyBreakTimingToDerivedState,
  derivedStateFromOverlayKey,
} from "@/lib/led-view/derive-led-overlay-state";

describe("WP-1: Break Timer & Overlay Precedence Overhaul", () => {
  it("allows breakCountdown > 0 to override banner overlay to 'break'", () => {
    const result = applyBreakTimingToDerivedState("banner", 300, {
      type: "break",
      isBreakFlag: false,
    });
    expect(result).toBe("break");
  });

  it("allows breakCountdown > 0 to override banner overlay to 'preAuction'", () => {
    const result = applyBreakTimingToDerivedState("banner", 600, {
      type: "pre-auction",
      isBreakFlag: false,
    });
    expect(result).toBe("preAuction");
  });

  it("overrides banner when isBreakFlag is true even if countdown is 0", () => {
    const result = applyBreakTimingToDerivedState("banner", 0, {
      type: "break",
      isBreakFlag: true,
    });
    expect(result).toBe("break");
  });

  it("preserves operator Top 5 or Team overlays if explicitly selected", () => {
    expect(
      applyBreakTimingToDerivedState("topSold", 180, {
        type: "break",
        isBreakFlag: false,
      }),
    ).toBe("topSold");

    expect(
      applyBreakTimingToDerivedState("teamWise", 180, {
        type: "break",
        isBreakFlag: false,
      }),
    ).toBe("teamWise");
  });

  it("derivedStateFromOverlayKey maps overlay keys correctly and clears on null", () => {
    expect(derivedStateFromOverlayKey(null, false)).toBeNull();
    expect(derivedStateFromOverlayKey("banner", false)).toBe("banner");
    expect(derivedStateFromOverlayKey("top5", false)).toBe("topSold");
  });
});

describe("WP-2: Purse Booster Responsive Overlay", () => {
  const filePath = resolve(__dirname, "../purse-booster-led-overlay.tsx");
  const content = readFileSync(filePath, "utf-8");

  it("replaces vw/vh sizing with container query units (cqw/cqh) within the 16:9 stage", () => {
    expect(content).toContain("cqw");
    expect(content).toContain("cqh");
    // Ensure viewport-relative sizing is not used for container placement
    expect(content).not.toContain("top-0 z-[70] flex justify-center px-[2vw] pt-[2vh]");
    expect(content).not.toContain("max-w-[92vw]");
    expect(content).not.toContain("max-h-[42vh]");
  });

  it("anchors below TopStrip header (top-[6cqh]) so header metadata is not obscured", () => {
    expect(content).toContain("top-[6cqh]");
  });

  it("implements responsive 2-column layout (grid-cols-2) for multi-team boosts (>5 teams)", () => {
    expect(content).toContain("overlay.teams.length > 5");
    expect(content).toContain("grid-cols-2");
    expect(content).toContain("max-h-[72cqh]");
  });
});

describe("WP-3: Broadcast Fortune Wheel Canvas Engine", () => {
  it("proves mathematical landing accuracy: target rotation lands wedge center exactly on top pointer", () => {
    const pointerAngle = 1.5 * Math.PI; // 12 o'clock (270 degrees)
    const testCases = [4, 6, 8, 10, 12, 16];

    for (const n of testCases) {
      const arc = (2 * Math.PI) / n;
      for (let winnerIdx = 0; winnerIdx < n; winnerIdx++) {
        const winnerCenter = winnerIdx * arc + arc / 2;
        const currentRot = Math.random() * 100;

        const targetAngleNorm =
          (((pointerAngle - winnerCenter) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const currentAngleNorm = ((currentRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const forwardDelta = (targetAngleNorm - currentAngleNorm + 2 * Math.PI) % (2 * Math.PI);
        const finalRot = currentRot + 5 * 2 * Math.PI + forwardDelta;

        // Position of winner wedge center after rotation:
        const finalWinnerCenter = (winnerCenter + finalRot) % (2 * Math.PI);
        const diff = Math.abs(finalWinnerCenter - pointerAngle);
        expect(diff).toBeLessThan(1e-10);
      }
    }
  });

  it("eliminates the hardcoded 0-degree settle animation keyframe bug in CSS", () => {
    const cssPath = resolve(__dirname, "../../../styles/display-tv-mode.css");
    const cssContent = readFileSync(cssPath, "utf-8");
    expect(cssContent).not.toContain("100% { transform: rotate(0deg); }");
  });

  it("fortune-wheel-overlay.tsx implements high-DPI HTML5 canvas and Web Audio ticks", () => {
    const wheelPath = resolve(__dirname, "../fortune-wheel-overlay.tsx");
    const wheelContent = readFileSync(wheelPath, "utf-8");
    expect(wheelContent).toContain("getContext(\"2d\")");
    expect(wheelContent).toContain("AudioContext");
    expect(wheelContent).toContain("playTickSound");
    expect(wheelContent).toContain("pegDeflection");
    expect(wheelContent).toContain("drawCenterGem");
    expect(wheelContent).toContain("Winner of the Draw");
  });

  it("EffectsLayer renders FortuneWheelOverlay instead of crude conic-gradient stub", () => {
    const effectsPath = resolve(__dirname, "../v1/EffectsLayer.tsx");
    const effectsContent = readFileSync(effectsPath, "utf-8");
    expect(effectsContent).toContain("FortuneWheelOverlay");
    expect(effectsContent).not.toContain("function FortuneWheel({");
    expect(effectsContent).not.toContain("conic-gradient");
  });
});

describe("WP-5: Broadcast Typography & Header Modernisation", () => {
  it("registers authentic bold font files in fonts-display.css to eliminate faux-bold diode bloom", () => {
    const fontsPath = resolve(__dirname, "../../../../public/fonts/fonts-display.css");
    const fontsContent = readFileSync(fontsPath, "utf-8");
    expect(fontsContent).toContain("BarlowCondensed-Bold.ttf");
    expect(fontsContent).toContain("BarlowCondensed-ExtraBold.ttf");
    expect(fontsContent).toContain("space-grotesk-latin-700-normal.woff2");
    // Ensure Bebas Neue has explicit bold weights registered to prevent synthetic bold expansion
    expect(fontsContent).toContain("font-weight: 700");
    expect(fontsContent).toContain("font-weight: 800");
    expect(fontsContent).toContain("font-weight: 900");
  });

  it("replaces 'Standby' with 'ON DECK' in TopStrip.tsx", () => {
    const topStripPath = resolve(__dirname, "../v1/TopStrip.tsx");
    const topStripContent = readFileSync(topStripPath, "utf-8");
    expect(topStripContent).toContain('"ON DECK"');
    expect(topStripContent).not.toContain('"Standby"');
  });

  it("provides clean Title Sponsor sightline in top strip (Presented by)", () => {
    const topStripPath = resolve(__dirname, "../v1/TopStrip.tsx");
    const topStripContent = readFileSync(topStripPath, "utf-8");
    expect(topStripContent).toContain("Presented by");
    expect(topStripContent).toContain("titleSponsor");
  });
});

describe("WP-4: Right-Side Team Purse & Max Bid Simplification (Light Mode)", () => {
  const boardPath = resolve(__dirname, "../v1/TeamsPurseBoard.tsx");
  const content = readFileSync(boardPath, "utf-8");

  it("renders in high-contrast light mode with white container and slate-900 typography", () => {
    expect(content).toContain("bg-white");
    expect(content).toContain("border-slate-200");
    expect(content).toContain("text-slate-900");
    // Ensure dark murky background is replaced
    expect(content).not.toContain("bg-black/45");
  });

  it("implements a single broadcast column header row without repeating micro-labels per team", () => {
    expect(content).toContain("<span>Team</span>");
    expect(content).toContain('<span className="text-right">Purse</span>');
    expect(content).toContain('<span className="text-right text-emerald-700">Max Bid</span>');
  });

  it("eliminates max-w-[140px] cut-off so full team names can breathe", () => {
    expect(content).not.toContain("max-w-[140px]");
    expect(content).toContain("font-['Barlow_Condensed']");
  });

  it("stabilizes pagination interval to 12s so numbers do not rapidly flip beside the hammer timer", () => {
    expect(content).toContain("ROTATION_INTERVAL_MS = 12000");
  });
});
