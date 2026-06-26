import { BASE_URL } from "../page-meta.js";
import { db, brandingSettingsTable } from "@workspace/db";
import { getAsset } from "../branding-service.js";
import { loadTournamentByRegistrationCode } from "../registration-context-service.js";
import { tournamentRowToRegistrationMetaFields } from "../registration-meta-builders.js";
import { REGISTRATION_OG_GENERATOR_VERSION } from "./constants.js";
import {
  buildRegistrationOgCacheKey,
  readCachedRegistrationOgImage,
  writeCachedRegistrationOgImage,
} from "./cache.js";
import {
  composeRegistrationOgCard,
  resolveRegistrationBackgroundImageUrl,
} from "./compose-registration-card.js";
import type { RegistrationOgCardInput, RegistrationOgImageResult } from "./types.js";

export function registrationOgImagePublicUrl(code: string): string {
  const origin = BASE_URL.replace(/\/+$/, "");
  return `${origin}/og/register/${encodeURIComponent(code)}.png`;
}

async function resolveBrandingForOgCard(): Promise<RegistrationOgCardInput["brand"]> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);
  const reverseLogo = await getAsset("REVERSE_LOGO");
  const primaryLogo = await getAsset("PRIMARY_LOGO");
  const symbolLogo = await getAsset("SYMBOL_LOGO");

  const logoUrl = reverseLogo?.fileUrl ?? primaryLogo?.fileUrl ?? symbolLogo?.fileUrl ?? null;

  return {
    brandName: settings?.brandName ?? "BidWar",
    poweredByText: settings?.poweredByText ?? "Powered by BidWar",
    primaryColor: settings?.primaryColor ?? "#F59E0B",
    secondaryColor: settings?.secondaryColor ?? "#1E293B",
    accentColor: settings?.accentColor ?? "#3B82F6",
    backgroundColor: settings?.backgroundColor ?? "#080A0F",
    dangerColor: settings?.dangerColor ?? "#EF4444",
    logoUrl: logoUrl ? absolutizeLogoUrl(logoUrl) : null,
  };
}

function resolveRegistrationStatus(deadline: string | null | undefined): "open" | "closed" {
  const trimmed = deadline?.trim();
  if (!trimmed) return "open";
  const today = new Date().toISOString().slice(0, 10);
  return today > trimmed ? "closed" : "open";
}

async function buildInputFromTournament(
  tournament: NonNullable<Awaited<ReturnType<typeof loadTournamentByRegistrationCode>>>,
): Promise<RegistrationOgCardInput> {
  const fields = tournamentRowToRegistrationMetaFields(tournament);
  const registrationCode = tournament.auctionCode?.trim().toUpperCase() ?? "";
  const bannerUrl = fields.bannerUrl?.trim() ? resolveRegistrationBackgroundImageUrl(fields) : null;

  return {
    registrationCode,
    tournamentName: fields.tournamentName,
    sport: fields.sport ?? "sports",
    venue: fields.venue,
    organizerName: fields.organizerName,
    registrationDeadline: tournament.registrationDeadline,
    registrationStatus: resolveRegistrationStatus(tournament.registrationDeadline),
    backgroundImageUrl: bannerUrl,
    backgroundKind: bannerUrl ? "banner" : "generated",
    brand: await resolveBrandingForOgCard(),
    generatorVersion: REGISTRATION_OG_GENERATOR_VERSION,
    contentVersion: tournament.updatedAt?.toISOString() ?? tournament.createdAt.toISOString(),
    badges: [],
  };
}

function absolutizeLogoUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${BASE_URL.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
}

/** Load from disk cache or generate a registration OG card PNG. */
export async function getOrCreateRegistrationOgImage(
  rawCode: string,
): Promise<RegistrationOgImageResult | null> {
  const tournament = await loadTournamentByRegistrationCode(rawCode);
  if (!tournament?.auctionCode) return null;

  const input = await buildInputFromTournament(tournament);
  const etag = buildRegistrationOgCacheKey(input);

  const cached = await readCachedRegistrationOgImage(input.registrationCode, etag);
  if (cached) {
    return { buffer: cached, cacheHit: true, etag };
  }

  const buffer = await composeRegistrationOgCard(input);
  await writeCachedRegistrationOgImage(input.registrationCode, etag, buffer);

  return { buffer, cacheHit: false, etag };
}

export function resolveRegistrationOgImageUrl(code: string): string {
  return registrationOgImagePublicUrl(code);
}
