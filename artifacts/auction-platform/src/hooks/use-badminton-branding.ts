import { useQuery } from "@tanstack/react-query";
import { badmintonFetch } from "@/lib/badminton-api";
import { parseSponsorLogos } from "@/lib/sponsor-logo";

export interface ScoreBoardSponsor {
  logoUrl: string | null;
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
}

export function useBadmintonBranding(tournamentId: number) {
  return useQuery<BadmintonBranding>({
    queryKey: ["badminton-branding", tournamentId],
    queryFn: () => badmintonFetch<BadmintonBranding>(tournamentId, `/branding`),
    enabled: !!tournamentId,
    staleTime: 30_000,
  });
}

export function sponsorUrlsFromBranding(branding: BadmintonBranding | undefined): string[] {
  if (!branding?.sponsorLogos) return [];
  return parseSponsorLogos(branding.sponsorLogos).map((l) => l.url).filter(Boolean);
}
