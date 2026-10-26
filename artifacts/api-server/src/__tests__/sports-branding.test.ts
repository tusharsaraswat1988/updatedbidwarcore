import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getSportsBranding,
  parseLiveStreamUrl,
  resolveSportsSponsorLogos,
  resolveVenueMusicUrl,
  resolveVenueBannerUrl,
  resolveVenueBannerFit,
  loadSportsBranding,
  updateSportsBranding,
  updateBroadcastPresentation,
  importTournamentBrandingToSports,
  importBrandingFromTournament,
} from "../lib/sports-branding";
import {
  loadBadmintonBranding,
  updateBadmintonBranding,
  importTournamentBrandingToBadminton,
} from "../lib/master-sports/badminton";
import { db, tournamentsTable } from "@workspace/db";

vi.mock("@workspace/db", () => {
  const fakeTournament = {
    id: 1,
    name: "Premier Cricket Championship",
    logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
    logoPublicId: "demo/logo",
    sponsorLogos: '[{"url":"https://res.cloudinary.com/demo/image/upload/sponsor.png"}]',
    venue: "Main Stadium",
    organizerName: "Cricket Board",
    breakEndMusicUrl: "https://example.com/break.mp3",
    mainBannerUrl: "https://example.com/banner.png",
    mainBannerFit: "cover",
    auctionEnabled: true,
    scoringEnabled: true,
    scoringSettingsJson: {
      branding: {
        displayName: "PCC 2026",
        primaryColor: "#112233",
        accentColor: "#445566",
      },
      broadcast: {
        overlayScene: "compact",
        venueScene: "live_score",
        primaryMatchId: 10,
        venueMusicPlaying: true,
        venueMusicUrl: "https://example.com/cricket-theme.mp3",
        venueMusicVolume: 90,
      },
    },
  };

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([fakeTournament])),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ ...fakeTournament }])),
        })),
      })),
    },
    tournamentsTable: {
      id: "id",
      name: "name",
      logoUrl: "logoUrl",
      logoPublicId: "logoPublicId",
      sponsorLogos: "sponsorLogos",
      venue: "venue",
      organizerName: "organizerName",
      breakEndMusicUrl: "breakEndMusicUrl",
      mainBannerUrl: "mainBannerUrl",
      mainBannerFit: "mainBannerFit",
      scoringSettingsJson: "scoringSettingsJson",
      auctionEnabled: "auctionEnabled",
      scoringEnabled: "scoringEnabled",
    },
  };
});

vi.mock("../lib/platform-audio-defaults", () => ({
  getPlatformDefaultAudioCached: vi.fn(() =>
    Promise.resolve({ breakEndMusicUrl: "https://platform/default.mp3" }),
  ),
}));

describe("Sports Branding — Shared Service", () => {
  describe("Pure Resolution & Parsers", () => {
    it("resolves sponsor logos preferring sport branding over auction fallback", () => {
      expect(
        resolveSportsSponsorLogos(
          { sponsorLogos: '[{"url":"https://sport/sponsor.png"}]' },
          '[{"url":"https://auction/sponsor.png"}]',
        ),
      ).toBe('[{"url":"https://sport/sponsor.png"}]');

      expect(
        resolveSportsSponsorLogos({}, '[{"url":"https://auction/sponsor.png"}]'),
      ).toBe('[{"url":"https://auction/sponsor.png"}]');
    });

    it("resolves venue music url fallback chain correctly", () => {
      expect(
        resolveVenueMusicUrl("https://override.mp3", "https://break.mp3", "https://default.mp3"),
      ).toBe("https://override.mp3");

      expect(
        resolveVenueMusicUrl(null, "https://break.mp3", "https://default.mp3"),
      ).toBe("https://break.mp3");

      expect(
        resolveVenueMusicUrl(null, null, "https://default.mp3"),
      ).toBe("https://default.mp3");
    });

    it("keeps only http(s) fan-page live stream URLs", () => {
      expect(parseLiveStreamUrl("https://youtube.com/live/abc")).toBe(
        "https://youtube.com/live/abc",
      );
      expect(parseLiveStreamUrl("  http://example.com/watch  ")).toBe("http://example.com/watch");
      expect(parseLiveStreamUrl("javascript:alert(1)")).toBeNull();
      expect(parseLiveStreamUrl("")).toBeNull();
      expect(parseLiveStreamUrl(null)).toBeNull();
    });

    it("resolves venue banner url fallback chain correctly", () => {
      expect(
        resolveVenueBannerUrl("https://sport-banner.png", "https://auction-banner.png"),
      ).toBe("https://sport-banner.png");

      expect(
        resolveVenueBannerUrl(null, "https://auction-banner.png"),
      ).toBe("https://auction-banner.png");
    });

    it("computes full sports branding object properly", () => {
      const branding = getSportsBranding(
        {
          name: "Test League",
          logoUrl: "https://logo.png",
          breakEndMusicUrl: "https://break.mp3",
          mainBannerUrl: "https://main.png",
          mainBannerFit: "contain",
        },
        {
          branding: {
            displayName: "Custom League Display",
            primaryColor: "#001122",
            accentColor: "#334455",
          },
          broadcast: {
            overlayScene: "full",
            venueScene: "standby",
            primaryMatchId: 5,
            venueMusicPlaying: true,
            liveStreamUrl: "https://youtube.com/live/match",
          },
        },
        "https://platform-default.mp3",
      );

      expect(branding.displayName).toBe("Custom League Display");
      expect(branding.primaryColor).toBe("#001122");
      expect(branding.accentColor).toBe("#334455");
      expect(branding.overlayScene).toBe("full");
      expect(branding.venueScene).toBe("standby");
      expect(branding.primaryBroadcastMatchId).toBe(5);
      expect(branding.venueMusicPlaying).toBe(true);
      expect(branding.liveStreamUrl).toBe("https://youtube.com/live/match");
      expect(branding.resolvedVenueMusicUrl).toBe("https://break.mp3");
      expect(branding.resolvedVenueBannerUrl).toBe("https://main.png");
      expect(branding.resolvedVenueBannerFit).toBe("contain");
    });

    it("does not fall back to auction break music or auction banner when auction is disabled", () => {
      const branding = getSportsBranding(
        {
          name: "Scoring Only League",
          breakEndMusicUrl: "https://break.mp3",
          mainBannerUrl: "https://main.png",
          auctionEnabled: false,
          scoringEnabled: true,
        },
        {
          broadcast: {},
        },
        "https://platform-default.mp3",
      );

      expect(branding.resolvedVenueMusicUrl).toBeNull();
      expect(branding.resolvedVenueBannerUrl).toBeNull();
      expect(branding.auctionMainBannerUrl).toBeNull();
    });
  });

  describe("Shared Service Functions", () => {
    it("loads sports branding from database", async () => {
      const branding = await loadSportsBranding(1);
      expect(branding).not.toBeNull();
      expect(branding?.displayName).toBe("PCC 2026");
      expect(branding?.primaryColor).toBe("#112233");
      expect(branding?.overlayScene).toBe("compact");
      expect(branding?.primaryBroadcastMatchId).toBe(10);
    });

    it("badminton compatibility aliases delegate to sports-branding", async () => {
      const badmintonBranding = await loadBadmintonBranding(1);
      expect(badmintonBranding).not.toBeNull();
      expect(badmintonBranding?.displayName).toBe("PCC 2026");

      expect(loadBadmintonBranding).toBe(loadSportsBranding);
      expect(updateBadmintonBranding).toBe(updateSportsBranding);
      expect(importTournamentBrandingToBadminton).toBe(importTournamentBrandingToSports);
    });

    it("rejects importAuctionMusic and importAuctionBanner if tournament does not have both modules enabled", async () => {
      const originalSelect = db.select;
      (db.select as any) = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([
                {
                  id: 2,
                  breakEndMusicUrl: "https://break.mp3",
                  mainBannerUrl: "https://banner.png",
                  auctionEnabled: false,
                  scoringEnabled: true,
                },
              ]),
            ),
          })),
        })),
      }));

      await expect(
        updateBroadcastPresentation(2, { importAuctionMusic: true }),
      ).rejects.toThrow("Auction break music is only available when both auction and scoring are enabled");

      await expect(
        updateBroadcastPresentation(2, { importAuctionBanner: true }),
      ).rejects.toThrow("Auction banner is only available when both auction and scoring are enabled");

      db.select = originalSelect;
    });
  });
});
