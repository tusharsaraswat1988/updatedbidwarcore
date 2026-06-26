import {
  isValidRegistrationCodeFormat,
  normalizeRegistrationCode,
} from "@workspace/api-base/registration-url";
import { BASE_URL, type RegistrationMetaFields } from "./page-meta.js";

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

function formatDeadline(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isRegistrationClosed(deadline: string | null | undefined): boolean {
  const trimmed = deadline?.trim();
  if (!trimmed) return false;
  return new Date().toISOString().slice(0, 10) > trimmed;
}

function absolutizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${BASE_URL.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
}

/** Public URL for dynamically generated 1200×630 registration OG card. */
export function resolveRegistrationOgImage(code: string): string {
  const normalized = normalizeRegistrationCode(code);
  return `${BASE_URL.replace(/\/+$/, "")}/og/register/${encodeURIComponent(normalized)}.png`;
}

/** Build crawler-facing description for registration link previews. */
export function buildRegistrationShareDescription(fields: RegistrationMetaFields): string {
  const closed = isRegistrationClosed(fields.registrationDeadline);
  const lines = [closed ? "Registration is closed." : "Registration is now open."];

  const deadline = formatDeadline(fields.registrationDeadline);
  if (deadline) lines.push(`${closed ? "Closed after" : "Register before"} ${deadline}.`);

  const venue = fields.venue?.trim();
  if (venue) lines.push(`Venue: ${venue}.`);

  const sport = formatSportLabel(fields.sport);
  if (sport) lines.push(`Sport: ${sport}.`);

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
  registrationDeadline?: string | null;
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
    registrationDeadline: tournament.registrationDeadline ?? null,
  };
}
