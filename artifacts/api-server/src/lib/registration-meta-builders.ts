import {
  isValidRegistrationCodeFormat,
  normalizeRegistrationCode,
} from "@workspace/api-base/registration-url";
import { getPlatformOpenGraphImageUrl } from "./branding-service.js";
import { BASE_URL, DEFAULT_OG_IMAGE_URL, type RegistrationMetaFields } from "./page-meta.js";

const REGISTRATION_PUBLIC_RE = /^\/register\/([^/?#]+)\/?$/;

export function isRegistrationPublicPath(pathname: string): boolean {
  return parseRegistrationCodeFromPath(pathname) !== null;
}

export function parseRegistrationCodeFromPath(pathname: string): string | null {
  const match = pathname.match(REGISTRATION_PUBLIC_RE);
  if (!match?.[1]) return null;

  const raw = decodeURIComponent(match[1]);
  if (!isValidRegistrationCodeFormat(raw)) return null;
  return normalizeRegistrationCode(raw);
}

function formatSportLabel(sport: string | null | undefined): string | null {
  const trimmed = sport?.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function absolutizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${BASE_URL.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
}

/** Resolve OG image using tournament assets first, then platform branding, then default. */
export function resolveRegistrationOgImage(fields: RegistrationMetaFields): string {
  if (fields.bannerUrl?.trim()) {
    return absolutizeImageUrl(fields.bannerUrl);
  }
  if (fields.logoUrl?.trim()) {
    return absolutizeImageUrl(fields.logoUrl);
  }
  const platformOg = getPlatformOpenGraphImageUrl();
  if (platformOg) return platformOg;
  return DEFAULT_OG_IMAGE_URL;
}

/** Build crawler-facing description for registration link previews. */
export function buildRegistrationShareDescription(fields: RegistrationMetaFields): string {
  const lines = ["Player registrations are now open.", "", "Tournament:", fields.tournamentName.trim()];

  const sport = formatSportLabel(fields.sport);
  if (sport) {
    lines.push("", "Sport:", sport);
  }

  const venue = fields.venue?.trim();
  if (venue) {
    lines.push("", "Venue:", venue);
  }

  lines.push("", "Register now.");
  return lines.join("\n");
}

export function tournamentRowToRegistrationMetaFields(tournament: {
  name: string;
  sport: string | null;
  venue: string | null;
  logoUrl: string | null;
  mainBannerUrl: string | null;
  mainBannerEnabled: boolean;
  organizerName: string | null;
  auctionCode: string | null;
}): RegistrationMetaFields {
  const bannerUrl =
    tournament.mainBannerEnabled && tournament.mainBannerUrl?.trim()
      ? tournament.mainBannerUrl
      : null;

  return {
    tournamentName: tournament.name,
    sport: tournament.sport,
    venue: tournament.venue,
    logoUrl: tournament.logoUrl,
    bannerUrl,
    organizerName: tournament.organizerName,
    registrationCode: tournament.auctionCode,
  };
}
