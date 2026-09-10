import {
  db,
  brandingSettingsTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { resolvePlatformPrimaryLogoUrl } from "@workspace/api-base/branding-assets";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import { eq } from "drizzle-orm";
import { brandingService } from "../branding-service.js";
import { buildPublicUrl, getPublicOrigin } from "../runtime-env.js";
import {
  formatAuctionDateTimeDisplay,
  formatMatchDatesDdMmYyyy,
} from "./player-registration-dates.js";

function appUrl(): string {
  return process.env.APP_URL?.trim() || getPublicOrigin();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveLogoUrl(appBase: string, logoUrl?: string | null): string | null {
  if (logoUrl?.startsWith("https://")) return logoUrl;
  if (logoUrl?.startsWith("http://")) return logoUrl;
  if (logoUrl?.startsWith("/")) return `${appBase.replace(/\/$/, "")}${logoUrl}`;
  return null;
}

function buildLogoImgHtml(
  url: string,
  alt: string,
  width: number,
  height: number,
): string {
  const safeUrl = escapeHtml(url);
  const safeAlt = escapeHtml(alt);
  return `<img src="${safeUrl}" width="${width}" height="${height}" alt="${safeAlt}" style="display:block;border:0;outline:none;text-decoration:none;max-width:${width}px;height:auto;" />`;
}

function formatSportName(sport: string | null | undefined): string {
  if (!sport?.trim()) return "";
  const normalized = sport.trim().replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  return str;
}

function formatVenueDisplay(
  venue: string | null | undefined,
  city: string | null | undefined,
): string {
  const v = stringOrEmpty(venue);
  const c = stringOrEmpty(city);
  if (v && c) {
    if (v.toLowerCase().includes(c.toLowerCase())) return v;
    return `${v}, ${c}`;
  }
  return v || c;
}

export async function buildTeamOwnerWelcomeMergeData(
  teamId: number,
): Promise<Record<string, string>> {
  const baseUrl = appUrl();

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId))
    .limit(1);

  if (!team) {
    return { app_url: baseUrl };
  }

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, team.tournamentId))
    .limit(1);

  const [branding] = await db
    .select({
      brandName: brandingSettingsTable.brandName,
      poweredByText: brandingSettingsTable.poweredByText,
    })
    .from(brandingSettingsTable)
    .limit(1);

  const brandName = branding?.brandName ?? "BidWar";
  const bidwarLogoAssetUrl = await brandingService.resolveEmailLogoAssetUrl();
  const bidwarLogoUrl =
    resolveLogoUrl(baseUrl, bidwarLogoAssetUrl) ??
    resolvePlatformPrimaryLogoUrl(baseUrl.replace(/\/$/, ""));

  const tournamentLogoUrl = resolveLogoUrl(baseUrl, tournament?.logoUrl ?? null);

  const bidwarLogo = buildLogoImgHtml(bidwarLogoUrl, brandName, 140, 48);
  const tournamentLogo = tournamentLogoUrl
    ? buildLogoImgHtml(tournamentLogoUrl, tournament?.name ?? "Tournament", 72, 72)
    : "";

  const auctionDateDisplay = formatAuctionDateTimeDisplay(
    tournament?.auctionDate,
    tournament?.auctionTime,
  );
  const tournamentDates = formatMatchDatesDdMmYyyy(tournament?.matchDates);
  const venueDisplay = formatVenueDisplay(tournament?.venue, tournament?.city);

  const loginLink = buildPublicUrl(ownerJoinPath(team.tournamentId, team.id));

  return {
    team_name: stringOrEmpty(team.name),
    owner_name: stringOrEmpty(team.ownerName),
    owner_mobile: stringOrEmpty(team.ownerMobile),
    phone: stringOrEmpty(team.ownerMobile),
    email: stringOrEmpty(team.ownerEmail),
    access_code: stringOrEmpty(team.accessCode),
    tournament_name: stringOrEmpty(tournament?.name),
    sport_name: formatSportName(tournament?.sport),
    venue: venueDisplay,
    auction_name: stringOrEmpty(tournament?.name),
    auction_date: auctionDateDisplay,
    tournament_dates: tournamentDates,
    organiser_name: stringOrEmpty(tournament?.organizerName),
    organiser_phone: stringOrEmpty(tournament?.organizerMobile),
    organiser_email: stringOrEmpty(tournament?.organizerEmail),
    login_link: loginLink,
    owner_app_link: loginLink,
    bidwar_logo: bidwarLogo,
    tournament_logo: tournamentLogo,
    app_url: baseUrl,
    brand_name: brandName,
    powered_by_text: branding?.poweredByText ?? "Powered by BidWar",
    support_number: "+91 8707488250",
    team_budget: team.purse != null ? String(team.purse) : "",
    current_year: String(new Date().getFullYear()),
  };
}
