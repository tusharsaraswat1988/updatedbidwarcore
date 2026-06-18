/**
 * Buzz Studio — Contract branding builder
 *
 * Maps tournament identity and feature flags into BuzzBranding for all contracts.
 */

import { resolveTournamentFeatures } from "@workspace/api-base/tournament-features";
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

export interface BuzzStudioBrandingContext {
  tournamentName: string;
  tournamentLogoUrl?: string;
  sponsorLogosJson?: string | null;
  watermarkRequired: boolean;
}

export function brandingContextFromTournament(tournament: Tournament): BuzzStudioBrandingContext {
  const features = resolveTournamentFeatures(tournament.features);
  return {
    tournamentName: tournament.name,
    tournamentLogoUrl: optionalUrl(tournament.logoUrl),
    sponsorLogosJson: tournament.sponsorLogos ?? null,
    watermarkRequired: features.watermarkRequired !== false,
  };
}

function parsePrimarySponsor(
  sponsorLogosJson: string | null | undefined,
): { url?: string; name?: string } {
  if (!sponsorLogosJson) return {};
  try {
    const raw = JSON.parse(sponsorLogosJson) as unknown;
    if (!Array.isArray(raw) || raw.length === 0) return {};
    const first = raw[0] as Record<string, unknown>;
    const url = typeof first.url === "string" ? first.url.trim() : "";
    const name = typeof first.name === "string" ? first.name.trim() : "";
    if (!url && !name) return {};
    return {
      url: url || undefined,
      name: name || undefined,
    };
  } catch {
    return {};
  }
}

/** Build BuzzBranding from tournament snapshot branding context. */
export function buildContractBranding(context: BuzzStudioBrandingContext): BuzzBranding {
  const sponsor = parsePrimarySponsor(context.sponsorLogosJson);

  return {
    tournamentLogoUrl: context.tournamentLogoUrl,
    sponsorLogoUrl: sponsor.url,
    sponsorName: sponsor.name,
    watermarkEnabled: context.watermarkRequired,
    tagline: context.tournamentName,
  };
}
