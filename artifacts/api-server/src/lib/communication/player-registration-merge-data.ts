import {
  db,
  brandingSettingsTable,
  playersTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { resolvePlatformPrimaryLogoUrl } from "@workspace/api-base/branding-assets";
import { eq } from "drizzle-orm";
import { brandingService } from "../branding-service.js";
import { buildPublicUrl, getPublicOrigin } from "../runtime-env.js";

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

function formatDisplayDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value.trim() : "";
  }
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTournamentDates(
  auctionDate: string | null | undefined,
  auctionTime: string | null | undefined,
): string {
  const datePart = auctionDate?.trim() ?? "";
  const timePart = auctionTime?.trim() ?? "";
  if (datePart && timePart) return `${datePart} at ${timePart}`;
  return datePart || timePart;
}

function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  return str;
}

export async function buildPlayerRegistrationMergeData(
  playerId: number,
): Promise<Record<string, string>> {
  const baseUrl = appUrl();

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, playerId))
    .limit(1);

  if (!player) {
    return { app_url: baseUrl };
  }

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, player.tournamentId))
    .limit(1);

  let teamName = "";
  if (player.teamId) {
    const [team] = await db
      .select({ name: teamsTable.name })
      .from(teamsTable)
      .where(eq(teamsTable.id, player.teamId))
      .limit(1);
    teamName = team?.name?.trim() ?? "";
  }

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

  const tournamentDates = formatTournamentDates(
    tournament?.auctionDate,
    tournament?.auctionTime,
  );

  return {
    player_name: player.name,
    tournament_name: tournament?.name ?? "",
    sport_name: formatSportName(tournament?.sport),
    registration_id: player.serialNo != null ? `#${player.serialNo}` : "",
    registration_date: formatDisplayDate(player.createdAt),
    venue: stringOrEmpty(tournament?.venue),
    tournament_dates: tournamentDates,
    organiser_name: stringOrEmpty(tournament?.organizerName),
    organiser_phone: stringOrEmpty(tournament?.organizerMobile),
    organiser_email: stringOrEmpty(tournament?.organizerEmail),
    team_name: teamName,
    email: stringOrEmpty(player.email),
    bidwar_logo: bidwarLogo,
    tournament_logo: tournamentLogo,
    app_url: baseUrl,
    brand_name: brandName,
    powered_by_text: branding?.poweredByText ?? "Powered by BidWar",
    support_number: "+91 8707488250",
    login_link: baseUrl,
    auction_name: tournament?.name ?? "",
    auction_date: stringOrEmpty(tournament?.auctionDate),
    phone: stringOrEmpty(player.mobileNumber),
  };
}
