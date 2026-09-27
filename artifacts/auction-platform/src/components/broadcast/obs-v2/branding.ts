/**
 * BIDWAR — BROADCAST V2 BRANDING UTILITIES
 * Shared, domain-neutral branding mapping functions for Broadcast Overlays.
 */

import type { SponsorLogo as BidWarSponsorLogo } from "@/lib/sponsor-logo";
import type { TeamPurse as BidWarTeamPurse } from "@workspace/api-client-react";
import type {
  BroadcastBranding,
  SponsorLogo as LovableSponsorLogo,
  TeamPurse as LovableTeamPurse,
} from "./contracts";

/**
 * Splits a full tournament name (e.g. "Delhi Premier League") into
 * primary word (white italic) and accent words (gold).
 */
export function deriveBranding(
  tournamentName: string | null,
  tournamentLogoUrl: string | null,
  venue?: string | null,
): BroadcastBranding {
  const cleanName = (tournamentName || "BidWar Cricket").trim();
  const parts = cleanName.split(/\s+/);
  const firstWord = parts[0] || "BIDWAR";
  const accent = parts.slice(1).join(" ");
  const shortCode = parts.map((w) => w[0]).join("").slice(0, 4).toUpperCase() || "BPL";

  return {
    tournamentName: firstWord.toUpperCase(),
    tournamentAccent: accent ? accent.toUpperCase() : "",
    tournamentShort: shortCode,
    tournamentLogoUrl: tournamentLogoUrl || undefined,
    venue: venue || undefined,
  };
}

/**
 * Maps BidWar sponsor logos to Lovable SponsorLogo contracts.
 */
export function mapSponsors(sponsorLogos: BidWarSponsorLogo[]): LovableSponsorLogo[] {
  if (!sponsorLogos || sponsorLogos.length === 0) return [];

  return sponsorLogos.map((s, idx) => {
    const isTitle = Boolean(s.isTitleSponsor || s.priorityType === "title" || idx === 0);
    const name = s.name || s.type || `Sponsor ${idx + 1}`;
    const sponsorType = s.type || (s as any).label || (isTitle ? "Official Partner" : undefined);
    return {
      id: s.publicId || `sponsor-${idx}`,
      name,
      logoUrl: s.url || undefined,
      tier: isTitle ? ("title" as const) : ("associate" as const),
      label: sponsorType,
    };
  });
}

/**
 * Maps BidWar team purses to Lovable TeamPurse contracts.
 */
export function mapTeamPurses(purses?: BidWarTeamPurse[]): LovableTeamPurse[] {
  if (!purses || purses.length === 0) return [];

  return purses.map((t) => {
    const purse = t.purse ?? 0;
    const used = t.purseUsed ?? 0;
    const remaining = t.purseRemaining ?? Math.max(0, purse - used);
    const bought = t.playersBought ?? 0;
    const slots = t.slotsRequired ?? 0;
    const shortCode = t.shortCode?.trim() || t.teamName?.slice(0, 3).toUpperCase() || "TBD";

    return {
      teamId: String(t.teamId),
      name: t.teamName || `Team ${t.teamId}`,
      short: shortCode,
      logoUrl: t.logoUrl && !t.logoUrl.startsWith("data:") ? t.logoUrl : undefined,
      purseRemaining: remaining,
      playersBought: bought,
      slotsRemaining: slots,
    };
  });
}
