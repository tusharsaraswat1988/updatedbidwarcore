/**
 * Resolve operator spotlight / pin sponsor selections for Venue + OBS.
 */

import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { ScoreBoardSponsor } from "@/hooks/use-badminton-branding";

export function findSponsorByUrl(
  sponsors: SponsorLogo[],
  url: string | null | undefined,
): SponsorLogo | null {
  if (!url?.trim()) return null;
  const key = url.trim();
  return sponsors.find((s) => s.url === key) ?? null;
}

/** Full-screen Sponsor moment — spotlight one logo, or fall back to full list. */
export function resolveSpotlightSponsors(
  sponsors: SponsorLogo[],
  spotlightUrl: string | null | undefined,
): SponsorLogo[] {
  const hit = findSponsorByUrl(sponsors, spotlightUrl);
  return hit ? [hit] : sponsors;
}

/** Live chrome — pin replaces rotating list with a single logo. */
export function resolvePinnedSponsorLogos(
  sponsors: SponsorLogo[],
  pinnedUrl: string | null | undefined,
): SponsorLogo[] {
  const hit = findSponsorByUrl(sponsors, pinnedUrl);
  return hit ? [hit] : sponsors;
}

/** Live crest slot — pin overrides fixed scoreboard sponsor while active. */
export function resolvePinnedScoreBoardSponsor(
  scoreBoardSponsor: ScoreBoardSponsor | null | undefined,
  sponsors: SponsorLogo[],
  pinnedUrl: string | null | undefined,
): ScoreBoardSponsor | null {
  const hit = findSponsorByUrl(sponsors, pinnedUrl);
  if (!hit) return scoreBoardSponsor ?? null;
  return {
    logoUrl: hit.url || null,
    name: hit.name?.trim() || null,
    title: hit.type?.trim() || (hit.isTitleSponsor ? "Title Sponsor" : "Featured Sponsor"),
  };
}
