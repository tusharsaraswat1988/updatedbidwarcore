import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildRegistrationShareDescription,
  isRegistrationPublicPath,
  parseRegistrationCodeFromPath,
  resolveRegistrationOgImage,
} from "../lib/registration-meta-builders.js";
import type { RegistrationMetaFields } from "../lib/page-meta.js";

vi.mock("../lib/branding-service.js", () => ({
  getPlatformOpenGraphImageUrl: vi.fn(() => null),
}));

import { getPlatformOpenGraphImageUrl } from "../lib/branding-service.js";
import { DEFAULT_OG_IMAGE_URL } from "../lib/page-meta.js";

describe("registration-page-meta", () => {
  beforeEach(() => {
    vi.mocked(getPlatformOpenGraphImageUrl).mockReturnValue(null);
  });

  it("detects valid registration paths", () => {
    expect(isRegistrationPublicPath("/register/VN410108")).toBe(true);
    expect(parseRegistrationCodeFromPath("/register/vn410108")).toBe("VN410108");
    expect(isRegistrationPublicPath("/register/abc")).toBe(false);
    expect(isRegistrationPublicPath("/register/")).toBe(false);
    expect(isRegistrationPublicPath("/")).toBe(false);
  });

  it("builds description with sport and venue", () => {
    const description = buildRegistrationShareDescription({
      tournamentName: "Varanasi Premier League",
      sport: "cricket",
      venue: "BHU Ground",
    });

    expect(description).toContain("Player registrations are now open.");
    expect(description).toContain("Varanasi Premier League");
    expect(description).toContain("Sport:");
    expect(description).toContain("Cricket");
    expect(description).toContain("Venue:");
    expect(description).toContain("BHU Ground");
    expect(description).toContain("Register now.");
  });

  it("omits missing sport and venue", () => {
    const description = buildRegistrationShareDescription({
      tournamentName: "Summer Cup",
      sport: null,
      venue: null,
    });

    expect(description).not.toContain("Sport:");
    expect(description).not.toContain("Venue:");
  });

  it("resolves OG image with banner → logo → platform → default priority", () => {
    const base: RegistrationMetaFields = {
      tournamentName: "Test",
      bannerUrl: "https://cdn.example/banner.png",
      logoUrl: "https://cdn.example/logo.png",
    };

    expect(resolveRegistrationOgImage(base)).toBe("https://cdn.example/banner.png");

    expect(
      resolveRegistrationOgImage({
        tournamentName: "Test",
        logoUrl: "https://cdn.example/logo.png",
      }),
    ).toBe("https://cdn.example/logo.png");

    vi.mocked(getPlatformOpenGraphImageUrl).mockReturnValue("https://cdn.example/og.png");
    expect(
      resolveRegistrationOgImage({
        tournamentName: "Test",
      }),
    ).toBe("https://cdn.example/og.png");

    vi.mocked(getPlatformOpenGraphImageUrl).mockReturnValue(null);
    expect(
      resolveRegistrationOgImage({
        tournamentName: "Test",
      }),
    ).toBe(DEFAULT_OG_IMAGE_URL);
  });
});
