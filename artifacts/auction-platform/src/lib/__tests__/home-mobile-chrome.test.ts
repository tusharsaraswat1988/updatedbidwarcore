import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  centeredScrollLeft,
  isPastScrollThreshold,
  scrollBehavior,
  stickyContentOffsetPx,
} from "../home-mobile-chrome";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function source(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("homepage mobile chrome math", () => {
  it("reserves the measured sticky bar height only on narrow viewports", () => {
    expect(stickyContentOffsetPx(76.2, false)).toBe(77);
    expect(stickyContentOffsetPx(76, true)).toBe(0);
    expect(stickyContentOffsetPx(0, false)).toBe(0);
    expect(stickyContentOffsetPx(Number.NaN, false)).toBe(0);
  });

  it("reveals back-to-top only after the scroll threshold", () => {
    expect(isPastScrollThreshold(350)).toBe(false);
    expect(isPastScrollThreshold(351)).toBe(true);
  });

  it("uses instant scrolling when reduced motion is requested", () => {
    expect(scrollBehavior(true)).toBe("auto");
    expect(scrollBehavior(false)).toBe("smooth");
  });

  it("centers a tab inside its scroller without a negative offset", () => {
    expect(centeredScrollLeft(300, 40, 120)).toBe(0);
    expect(centeredScrollLeft(200, 400, 80)).toBe(340);
  });
});

describe("homepage mobile layout contracts", () => {
  const home = source("pages/lovable-home.tsx");
  const reviews = source("components/home/organizer-video-reviews.tsx");
  const simulator = source("components/home/auction-experience-simulator.tsx");
  const css = source("styles/lovable-homepage.css");

  it("keeps one mobile trial bar with safe-area clearance and a measured offset", () => {
    expect(home.match(/Start Free Trial \(2 Teams\)/g)).toHaveLength(1);
    expect(home).toContain("has-mobile-sticky-cta");
    expect(home).toContain("env(safe-area-inset-bottom)");
    expect(home).toContain("data-home-sticky-cta");
    expect(css).toContain("--bw-sticky-cta-offset");
    expect(css).toContain("has-mobile-sticky-cta");
  });

  it("bounds horizontal tab and review scrollers instead of fixed overflowing cards", () => {
    expect(home).toContain("data-surface-tab");
    expect(home).toContain("min-w-0 flex-1 overflow-x-auto");
    expect(reviews).not.toContain("w-[300px]");
    expect(reviews).toContain("data-review-card");
    expect(reviews).toContain("w-full");
  });

  it("shows a phone auction summary and keeps the wide LED for larger screens", () => {
    expect(simulator).toContain("data-mobile-auction-preview");
    expect(simulator).toContain("hidden md:block");
    expect(simulator).toContain("min-h-11");
  });
});
