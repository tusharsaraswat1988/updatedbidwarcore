import { useQuery, useQueryClient } from "@tanstack/react-query";
import { badmintonFetch } from "@/lib/badminton-api";
import { parseSponsorLogos, getSponsorsByPriority } from "@/lib/sponsor-logo";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type {
  BadmintonOverlayScene,
  BadmintonVenueScene,
} from "@/lib/badminton-broadcast-director";
import {
  parseOverlayScene,
  parseVenueScene,
} from "@/lib/badminton-broadcast-director";
import { mergeFetchedBrandingWithLivePresentation } from "@/lib/badminton-presentation-mutation";

export interface ScoreBoardSponsor {
  logoUrl: string | null;
  logoPublicId?: string | null;
  name: string | null;
  title: string | null;
}

export type BadmintonBannerFit = "cover" | "contain";

export interface BadmintonBranding {
  displayName: string;
  logoUrl: string | null;
  sponsorLogos: string | null;
  venue: string | null;
  organizerName: string | null;
  primaryColor: string;
  accentColor: string;
  scoreBoardSponsor: ScoreBoardSponsor | null;
  /** Organizer-selected LIVE match for persistent Venue/OBS follow URLs. */
  primaryBroadcastMatchId?: number | null;
  /** Operator Broadcast Director — OBS scene (`auto` = URL type + live follow). */
  overlayScene?: BadmintonOverlayScene;
  /** Operator Broadcast Director — Venue Scoreboard scene. */
  venueScene?: BadmintonVenueScene;
  /** Control Center On/Pause for venue LED loop music. */
  venueMusicPlaying?: boolean;
  /** Badminton override track (null = auction/platform fallthrough). */
  venueMusicUrl?: string | null;
  /** Display name for the override track. */
  venueMusicFileName?: string | null;
  venueMusicVolume?: number;
  /** Resolved loop URL for venue LED playback. */
  resolvedVenueMusicUrl?: string | null;
  /** Badminton banner override (null = auction main banner fallthrough). */
  venueBannerUrl?: string | null;
  venueBannerPublicId?: string | null;
  venueBannerFit?: BadmintonBannerFit;
  auctionMainBannerUrl?: string | null;
  resolvedVenueBannerUrl?: string | null;
  resolvedVenueBannerFit?: BadmintonBannerFit;
  /**
   * Client-only: last SSE / optimistic presentation patch time.
   * Used so a racing GET /branding cannot wipe a fresher music/scene flag.
   */
  _presentationPatchedAt?: number;
}

function normalizeBannerFit(raw: unknown): BadmintonBannerFit {
  return raw === "contain" ? "contain" : "cover";
}

function normalizeBranding(raw: BadmintonBranding): BadmintonBranding {
  return {
    ...raw,
    overlayScene: parseOverlayScene(raw.overlayScene),
    venueScene: parseVenueScene(raw.venueScene),
    venueMusicPlaying: raw.venueMusicPlaying === true,
    venueMusicUrl: raw.venueMusicUrl?.trim() || null,
    venueMusicFileName: raw.venueMusicFileName?.trim() || null,
    venueMusicVolume:
      typeof raw.venueMusicVolume === "number" && Number.isFinite(raw.venueMusicVolume)
        ? Math.max(0, Math.min(100, Math.round(raw.venueMusicVolume)))
        : 80,
    resolvedVenueMusicUrl: raw.resolvedVenueMusicUrl?.trim() || null,
    venueBannerUrl: raw.venueBannerUrl?.trim() || null,
    venueBannerPublicId: raw.venueBannerPublicId?.trim() || null,
    venueBannerFit: normalizeBannerFit(raw.venueBannerFit),
    auctionMainBannerUrl: raw.auctionMainBannerUrl?.trim() || null,
    resolvedVenueBannerUrl: raw.resolvedVenueBannerUrl?.trim() || null,
    resolvedVenueBannerFit: normalizeBannerFit(raw.resolvedVenueBannerFit),
  };
}

type BrandingQueryOptions = {
  /** Override default staleTime (Mission Control keeps a short window). */
  staleTime?: number;
  /** Set false on Venue/OBS — presentation arrives via SSE cache patches. */
  refetchInterval?: number | false;
};

export function useBadmintonBranding(
  tournamentId: number,
  options?: BrandingQueryOptions,
) {
  const qc = useQueryClient();
  return useQuery<BadmintonBranding>({
    queryKey: ["badminton-branding", tournamentId],
    queryFn: async () => {
      const fresh = normalizeBranding(
        await badmintonFetch<BadmintonBranding>(tournamentId, `/branding`),
      );
      const live = qc.getQueryData<BadmintonBranding>([
        "badminton-branding",
        tournamentId,
      ]);
      return mergeFetchedBrandingWithLivePresentation(fresh, live);
    },
    enabled: !!tournamentId,
    // Scene chips must track play-safe auto-clears after the first rally.
    staleTime: options?.staleTime ?? 4_000,
    refetchInterval: options?.refetchInterval ?? 8_000,
    placeholderData: (prev) => prev,
  });
}

export function sponsorLogosFromBranding(
  branding: BadmintonBranding | undefined,
): SponsorLogo[] {
  if (!branding?.sponsorLogos) return [];
  return getSponsorsByPriority(parseSponsorLogos(branding.sponsorLogos));
}

export function sponsorUrlsFromBranding(branding: BadmintonBranding | undefined): string[] {
  return sponsorLogosFromBranding(branding).map((l) => l.url).filter(Boolean);
}
