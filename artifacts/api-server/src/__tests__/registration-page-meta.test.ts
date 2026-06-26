import { describe, expect, it } from "vitest";
import {
  buildRegistrationShareDescription,
  isRegistrationPublicPath,
  parseRegistrationCodeFromPath,
  resolveRegistrationOgImage,
} from "../lib/registration-meta-builders.js";

describe("registration-page-meta", () => {
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

  it("resolves OG image URL to generated social card endpoint", () => {
    expect(resolveRegistrationOgImage("VN410108")).toBe("https://bidwar.in/og/register/VN410108.png");
  });
});
