/**
 * Buzz Studio — Contract branding builder
 *
 * Maps tournament identity and feature flags into BuzzBranding for all contracts.
 */

import { resolveTournamentFeatures } from "@workspace/api-base/tournament-features";
import {
  getPrimarySponsor,
  getSponsorsByPriority,
  parseSponsorLogos,
  SponsorPriorityType,
} from "@workspace/api-base/sponsor-priority";
import type { Tournament } from "@workspace/api-client-react";
import type { BuzzBranding, BuzzSponsorMark } from "../contracts/branding";

export interface BuzzStudioBrandingContext {
  tournamentName: string;
  tournamentLogoUrl?: string;
  sponsorLogosJson?: string | null;
  watermarkRequired: boolean;
}

function optionalUrl(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export function brandingContextFromTournament(tournament: Tournament): BuzzStudioBrandingContext {
  const features = resolveTournamentFeatures(tournament.features);
  return {
    tournamentName: tournament.name,
    tournamentLogoUrl: optionalUrl(tournament.logoUrl),
    sponsorLogosJson: tournament.sponsorLogos ?? null,
    watermarkRequired: features.watermarkRequired === true,
  };
}

function toSponsorMark(sponsor: { url: string; name?: string }): BuzzSponsorMark {
  return {
    url: sponsor.url,
    name: sponsor.name?.trim() || undefined,
  };
}

/** Build BuzzBranding from tournament snapshot branding context. */
export function buildContractBranding(context: BuzzStudioBrandingContext): BuzzBranding {
  const sponsors = parseSponsorLogos(context.sponsorLogosJson);
  const ordered = getSponsorsByPriority(sponsors);
  const sponsor = getPrimarySponsor(sponsors);
  const title = ordered.find((s) => s.priorityType === SponsorPriorityType.TITLE);
  const coSponsors = ordered
    .filter((s) => s.priorityType === SponsorPriorityType.CO_SPONSOR)
    .slice(0, 3)
    .map(toSponsorMark);

  return {
    tournamentLogoUrl: context.tournamentLogoUrl,
    sponsorLogoUrl: sponsor?.url,
    sponsorName: sponsor?.name,
    titleSponsor: title ? toSponsorMark(title) : undefined,
    coSponsors: coSponsors.length > 0 ? coSponsors : undefined,
    watermarkEnabled: context.watermarkRequired,
    tagline: context.tournamentName,
  };
}
