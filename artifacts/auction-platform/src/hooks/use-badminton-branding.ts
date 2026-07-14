import { useQuery } from "@tanstack/react-query";
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

export interface ScoreBoardSponsor {
  logoUrl: string | null;
  logoPublicId?: string | null;
  name: string | null;
  title: string | null;
}

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
}

function normalizeBranding(raw: BadmintonBranding): BadmintonBranding {
  return {
    ...raw,
    overlayScene: parseOverlayScene(raw.overlayScene),
    venueScene: parseVenueScene(raw.venueScene),
  };
}

export function useBadmintonBranding(tournamentId: number) {
  return useQuery<BadmintonBranding>({
    queryKey: ["badminton-branding", tournamentId],
    queryFn: async () => normalizeBranding(await badmintonFetch<BadmintonBranding>(tournamentId, `/branding`)),
    enabled: !!tournamentId,
    staleTime: 15_000,
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
