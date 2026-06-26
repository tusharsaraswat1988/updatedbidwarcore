import { describe, expect, it } from "vitest";
import { buildRegistrationOgCacheKey } from "../lib/og-image/cache.js";
import { wrapTitleLines, titleFontSize, formatRegistrationDeadline } from "../lib/og-image/text-layout.js";
import { resolveRegistrationOgImage } from "../lib/registration-meta-builders.js";
import type { RegistrationOgCardInput } from "../lib/og-image/types.js";

describe("og-image text layout", () => {
  it("wraps long tournament names without exceeding max lines", () => {
    const lines = wrapTitleLines("Vyapari Network Badminton League Season Three Championship");
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.join(" ")).toContain("Vyapari");
  });

  it("scales font size down as line count increases", () => {
    expect(titleFontSize(1)).toBeGreaterThan(titleFontSize(3));
    expect(titleFontSize(3)).toBeGreaterThan(titleFontSize(4));
  });

  it("formats registration deadline for display", () => {
    expect(formatRegistrationDeadline("2026-07-15")).toMatch(/Register by/);
    expect(formatRegistrationDeadline(null)).toBeNull();
  });
});

describe("og-image cache key", () => {
  const baseInput: RegistrationOgCardInput = {
    registrationCode: "VN410108",
    tournamentName: "Test League",
    sport: "badminton",
    backgroundImageUrl: "https://cdn.example/banner.jpg",
    backgroundKind: "banner",
    registrationStatus: "open",
    brand: {
      brandName: "BidWar",
      poweredByText: "Powered by BidWar",
      primaryColor: "#F59E0B",
      secondaryColor: "#1E293B",
      accentColor: "#3B82F6",
      backgroundColor: "#080A0F",
      dangerColor: "#EF4444",
      logoUrl: "https://cdn.example/bidwar-logo.svg",
    },
    generatorVersion: 3,
    contentVersion: "2026-06-26T00:00:00.000Z",
  };

  it("changes when content version changes", () => {
    const a = buildRegistrationOgCacheKey(baseInput);
    const b = buildRegistrationOgCacheKey({ ...baseInput, contentVersion: "2026-06-27T00:00:00.000Z" });
    expect(a).not.toBe(b);
  });

  it("changes when generator version changes", () => {
    const a = buildRegistrationOgCacheKey(baseInput);
    const b = buildRegistrationOgCacheKey({ ...baseInput, generatorVersion: 99 });
    expect(a).not.toBe(b);
  });

  it("is stable for identical input", () => {
    expect(buildRegistrationOgCacheKey(baseInput)).toBe(buildRegistrationOgCacheKey({ ...baseInput }));
  });
});

describe("registration OG image URL", () => {
  it("points to generated PNG endpoint", () => {
    expect(resolveRegistrationOgImage("vn410108")).toBe("https://bidwar.in/og/register/VN410108.png");
  });
});
