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
    expect(branding.primaryBroadcastMatchId).toBeNull();
  });

  it("exposes primary broadcast match from scoring settings broadcast block", () => {
    const branding = getBadmintonBranding(
      { name: "League" },
      {
        branding: {},
        broadcast: { primaryMatchId: 42 },
      },
    );
    expect(branding.primaryBroadcastMatchId).toBe(42);
    expect(branding.overlayScene).toBe("auto");
    expect(branding.venueScene).toBe("auto");
    expect(branding.venueMusicPlaying).toBe(false);
    expect(branding.venueMusicUrl).toBeNull();
    expect(branding.venueMusicVolume).toBe(80);
  });

  it("resolves venue music override → auction → platform", () => {
    const withOverride = getBadmintonBranding(
      { name: "League", breakEndMusicUrl: "https://auction/break.mp3" },
      { branding: {}, broadcast: { venueMusicUrl: "https://badminton/loop.mp3" } },
      "https://platform/break.mp3",
    );
    expect(withOverride.resolvedVenueMusicUrl).toBe("https://badminton/loop.mp3");

    const fromAuction = getBadmintonBranding(
      { name: "League", breakEndMusicUrl: "https://auction/break.mp3" },
      { branding: {}, broadcast: {} },
      "https://platform/break.mp3",
    );
    expect(fromAuction.resolvedVenueMusicUrl).toBe("https://auction/break.mp3");

    const fromPlatform = getBadmintonBranding(
      { name: "League" },
      { branding: {}, broadcast: {} },
      "https://platform/break.mp3",
    );
    expect(fromPlatform.resolvedVenueMusicUrl).toBe("https://platform/break.mp3");
  });

  it("exposes venueMusicPlaying from broadcast block", () => {
    const branding = getBadmintonBranding(
      { name: "League" },
      { branding: {}, broadcast: { venueMusicPlaying: true, venueMusicVolume: 55 } },
    );
    expect(branding.venueMusicPlaying).toBe(true);
    expect(branding.venueMusicVolume).toBe(55);
  });

  it("exposes director overlay and venue scenes from broadcast block", () => {
    const branding = getBadmintonBranding(
      { name: "League" },
      {
        branding: {},
        broadcast: {
          primaryMatchId: 7,
          overlayScene: "multi",
          venueScene: "multi",
        },
      },
    );
    expect(branding.overlayScene).toBe("multi");
    expect(branding.venueScene).toBe("multi");
  });

  it("parses venue moment scenes intro/winner/sponsor/next/results/leaderboards", () => {
    for (const venueScene of [
      "intro",
      "winner",
      "sponsor",
      "next",
      "results",
      "leaderboards",
    ] as const) {
      const branding = getBadmintonBranding(
        { name: "League" },
        { branding: {}, broadcast: { venueScene } },
      );
      expect(branding.venueScene).toBe(venueScene);
    }
  });

  it("parses overlay results and leaderboards scenes", () => {
    for (const overlayScene of ["results", "leaderboards"] as const) {
      const branding = getBadmintonBranding(
        { name: "League" },
        { branding: {}, broadcast: { overlayScene } },
      );
      expect(branding.overlayScene).toBe(overlayScene);
    }
  });
});
