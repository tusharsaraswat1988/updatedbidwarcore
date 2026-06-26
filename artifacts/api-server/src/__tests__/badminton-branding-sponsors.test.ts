import { describe, expect, it } from "vitest";
import {
  getBadmintonBranding,
  resolveBadmintonSponsorLogos,
} from "../lib/master-sports/badminton-branding";

describe("badminton sponsor logo isolation", () => {
  it("prefers scoring-settings sponsors over tournament auction sponsors", () => {
    expect(
      resolveBadmintonSponsorLogos(
        { sponsorLogos: '[{"url":"https://badminton"}]' },
        '[{"url":"https://auction"}]',
      ),
    ).toBe('[{"url":"https://badminton"}]');
  });

  it("falls back to tournament sponsors until badminton branding is saved", () => {
    expect(resolveBadmintonSponsorLogos({}, '[{"url":"https://auction"}]')).toBe(
      '[{"url":"https://auction"}]',
    );
  });

  it("treats an explicit empty badminton list as empty, not auction fallback", () => {
    expect(
      resolveBadmintonSponsorLogos({ sponsorLogos: "[]" }, '[{"url":"https://auction"}]'),
    ).toBe("[]");
  });

  it("exposes isolated sponsors via getBadmintonBranding", () => {
    const branding = getBadmintonBranding(
      { name: "League", sponsorLogos: '[{"url":"https://auction"}]' },
      { branding: { sponsorLogos: '[{"url":"https://badminton"}]' } },
    );

    expect(branding.sponsorLogos).toBe('[{"url":"https://badminton"}]');
  });
});
