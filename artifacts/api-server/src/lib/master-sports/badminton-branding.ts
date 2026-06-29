/**
 * Pure badminton branding helpers (no database imports — safe for unit tests).
 */

export type BadmintonBranding = {
  displayName: string;
  logoUrl: string | null;
  sponsorLogos: string | null;
  venue: string | null;
  organizerName: string | null;
  primaryColor: string;
  accentColor: string;
  scoreBoardSponsor: ScoreBoardSponsor | null;
};

export type ScoreBoardSponsor = {
  logoUrl: string | null;
  logoPublicId?: string | null;
  name: string | null;
  title: string | null;
};

function parseScoreBoardSponsor(raw: unknown): ScoreBoardSponsor | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const logoUrl =
    typeof o.logoUrl === "string" && o.logoUrl.trim() ? o.logoUrl.trim() : null;
  const logoPublicId =
    typeof o.logoPublicId === "string" && o.logoPublicId.trim()
      ? o.logoPublicId.trim()
      : null;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : null;
  if (!logoUrl && !name && !title) return null;
  return { logoUrl, logoPublicId, name, title };
}

/** Badminton LED/OBS sponsors — stored separately from auction `tournaments.sponsor_logos`. */
export function resolveBadmintonSponsorLogos(
  brandingRaw: Record<string, unknown>,
  tournamentSponsorLogos: string | null | undefined,
): string | null {
  if ("sponsorLogos" in brandingRaw) {
    const value = brandingRaw.sponsorLogos;
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
  }
  return tournamentSponsorLogos ?? null;
}

export function getBadmintonBranding(
  tournament: {
    name: string;
    logoUrl?: string | null;
    sponsorLogos?: string | null;
    venue?: string | null;
    organizerName?: string | null;
  },
  scoringSettingsJson: Record<string, unknown> | null | undefined,
): BadmintonBranding {
  const raw = (scoringSettingsJson?.branding ?? {}) as Record<string, unknown>;
  return {
    displayName:
      typeof raw.displayName === "string" && raw.displayName.trim()
        ? raw.displayName.trim()
        : tournament.name,
    logoUrl: tournament.logoUrl ?? null,
    sponsorLogos: resolveBadmintonSponsorLogos(raw, tournament.sponsorLogos),
    venue: tournament.venue ?? null,
    organizerName: tournament.organizerName ?? null,
    primaryColor:
      typeof raw.primaryColor === "string" && raw.primaryColor.trim()
        ? raw.primaryColor.trim()
        : "#0070f3",
    accentColor:
      typeof raw.accentColor === "string" && raw.accentColor.trim()
        ? raw.accentColor.trim()
        : "#4fc3f7",
    scoreBoardSponsor: parseScoreBoardSponsor(raw.scoreBoardSponsor),
  };
}
