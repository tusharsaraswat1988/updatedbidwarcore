/**
 * Buzz Studio — Contract branding builder
 *
 * Maps tournament identity and feature flags into BuzzBranding for all contracts.
 */

import { resolveTournamentFeatures } from "@workspace/api-base/tournament-features";
import { getPrimarySponsor, parseSponsorLogos } from "@workspace/api-base/sponsor-priority";
import type { Tournament } from "@workspace/api-client-react";
import type { BuzzBranding } from "../contracts/branding";

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

/** Build BuzzBranding from tournament snapshot branding context. */
export function buildContractBranding(context: BuzzStudioBrandingContext): BuzzBranding {
  const sponsors = parseSponsorLogos(context.sponsorLogosJson);
  const sponsor = getPrimarySponsor(sponsors);

  return {
    tournamentLogoUrl: context.tournamentLogoUrl,
    sponsorLogoUrl: sponsor?.url,
    sponsorName: sponsor?.name,
    watermarkEnabled: context.watermarkRequired,
    tagline: context.tournamentName,
  };
}
