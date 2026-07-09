import {
  db,
  brandingSettingsTable,
  playersTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  formatAuctionAmount,
  normalizeAuctionUnit,
  type AuctionUnit,
} from "@workspace/api-base/auction-unit";
import {
  parseSponsorLogos,
  resolveSponsorPriorityType,
  SponsorPriorityType,
} from "@workspace/api-base/sponsor-priority";
import { eq } from "drizzle-orm";
import { brandingService } from "../branding-service.js";
import { getPublicOrigin } from "../runtime-env.js";

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
  if (logoUrl?.startsWith("https://") || logoUrl?.startsWith("http://")) return logoUrl;
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

function buildRoundAvatarHtml(initials: string): string {
  const safe = escapeHtml(initials.slice(0, 2).toUpperCase());
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="width:88px;height:88px;border-radius:44px;background:linear-gradient(135deg,#F4B400 0%,#B8860B 100%);font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:32px;font-weight:700;color:#0B0B0B;line-height:88px;text-align:center;">${safe}</td></tr></table>`;
}

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PL";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`;
}

function formatCoSponsorsLine(names: string[]): string {
  const filtered = names.map((n) => n.trim()).filter(Boolean);
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  const last = filtered[filtered.length - 1];
  return `${filtered.slice(0, -1).join(", ")} and ${last}`;
}

function formatAuctionDate(
  auctionDate: string | null | undefined,
  auctionTime: string | null | undefined,
): string {
  const datePart = auctionDate?.trim() ?? "";
  const timePart = auctionTime?.trim() ?? "";
  if (datePart && timePart) return `${datePart} at ${timePart}`;
  return datePart || timePart;
}

function formatAmountDisplay(amount: number, unit: AuctionUnit): string {
  if (unit === "points") {
    return Math.round(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  const formatted = formatAuctionAmount(amount, unit);
  return formatted.startsWith("₹") ? formatted : `₹${formatted.replace(/^₹?/, "")}`;
}

export async function buildPlayerSoldMergeData(params: {
  playerId: number;
  teamId: number;
  amount: number;
  tournamentId: number;
}): Promise<Record<string, string>> {
  const baseUrl = appUrl();

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, params.playerId))
    .limit(1);

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, params.teamId))
    .limit(1);

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, params.tournamentId))
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
    `${baseUrl.replace(/\/$/, "")}/bidwar-primary-logo.png`;

  const bidwarLogo = buildLogoImgHtml(bidwarLogoUrl, brandName, 140, 48);

  const playerPhotoUrl = resolveLogoUrl(baseUrl, player?.photoUrl ?? null);
  const playerAvatar = playerPhotoUrl
    ? buildLogoImgHtml(playerPhotoUrl, player?.name ?? "Player", 88, 88)
    : buildRoundAvatarHtml(playerInitials(player?.name ?? "Player"));

  const teamLogoUrl = resolveLogoUrl(baseUrl, team?.logoUrl ?? null);
  const teamLogo = teamLogoUrl
    ? buildLogoImgHtml(teamLogoUrl, team?.name ?? "Team", 96, 96)
    : "";

  const sponsors = parseSponsorLogos(tournament?.sponsorLogos);
  const titleSponsor = sponsors.find(
    (s) => resolveSponsorPriorityType(s) === SponsorPriorityType.TITLE,
  );
  const coSponsors = sponsors.filter(
    (s) => resolveSponsorPriorityType(s) === SponsorPriorityType.CO_SPONSOR,
  );
  const coSponsorNames = coSponsors
    .map((s) => s.name?.trim())
    .filter((n): n is string => Boolean(n));

  const unit = normalizeAuctionUnit(tournament?.auctionUnit);
  const amountDisplay = formatAmountDisplay(params.amount, unit);

  const mergeData: Record<string, string> = {
    player_name: player?.name?.trim() ?? "Player",
    team_name: team?.name?.trim() ?? "Team",
    tournament_name: tournament?.name?.trim() ?? "",
    auction_name: tournament?.name?.trim() ?? "",
    auction_date: formatAuctionDate(tournament?.auctionDate, tournament?.auctionTime),
    organiser_name: tournament?.organizerName?.trim() ?? "",
    organiser_email: tournament?.organizerEmail?.trim() ?? "",
    amount_display: amountDisplay,
    player_avatar: playerAvatar,
    bidwar_logo: bidwarLogo,
    current_year: String(new Date().getFullYear()),
    app_url: baseUrl,
    brand_name: brandName,
    powered_by_text: branding?.poweredByText ?? "Powered by BidWar",
    email: player?.email?.trim() ?? "",
  };

  if (titleSponsor?.name?.trim()) {
    mergeData.title_sponsor = titleSponsor.name.trim();
  }

  const coLine = formatCoSponsorsLine(coSponsorNames);
  if (coLine) {
    mergeData.co_sponsors_line = coLine;
  }

  if (teamLogo) {
    mergeData.team_logo = teamLogo;
  }

  if (unit === "points") {
    mergeData.amount_points = "1";
  } else {
    mergeData.amount_money = "1";
  }

  return mergeData;
}
