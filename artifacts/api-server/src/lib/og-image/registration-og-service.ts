import { BASE_URL } from "../page-meta.js";
import { loadTournamentByRegistrationCode } from "../registration-context-service.js";
import { tournamentRowToRegistrationMetaFields } from "../registration-meta-builders.js";
import { REGISTRATION_OG_GENERATOR_VERSION } from "./constants.js";
import {
  buildRegistrationOgCacheKey,
  readCachedRegistrationOgImage,
  writeCachedRegistrationOgImage,
} from "./cache.js";
import { composeRegistrationOgCard, resolveRegistrationBackgroundImageUrl } from "./compose-registration-card.js";
import type { RegistrationOgCardInput, RegistrationOgImageResult } from "./types.js";

export function registrationOgImagePublicUrl(code: string): string {
  const origin = BASE_URL.replace(/\/+$/, "");
  return `${origin}/og/register/${encodeURIComponent(code)}.png`;
}

function buildInputFromTournament(
  tournament: NonNullable<Awaited<ReturnType<typeof loadTournamentByRegistrationCode>>>,
): RegistrationOgCardInput {
  const fields = tournamentRowToRegistrationMetaFields(tournament);
  const registrationCode = tournament.auctionCode?.trim().toUpperCase() ?? "";

  return {
    registrationCode,
    tournamentName: fields.tournamentName,
    sport: fields.sport ?? "sports",
    venue: fields.venue,
    organizerName: fields.organizerName,
    registrationDeadline: tournament.registrationDeadline,
    backgroundImageUrl: resolveRegistrationBackgroundImageUrl(fields),
    generatorVersion: REGISTRATION_OG_GENERATOR_VERSION,
    contentVersion: tournament.updatedAt?.toISOString() ?? tournament.createdAt.toISOString(),
    badges: [],
  };
}

/** Load from disk cache or generate a registration OG card PNG. */
export async function getOrCreateRegistrationOgImage(
  rawCode: string,
): Promise<RegistrationOgImageResult | null> {
  const tournament = await loadTournamentByRegistrationCode(rawCode);
  if (!tournament?.auctionCode) return null;

  const input = buildInputFromTournament(tournament);
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
