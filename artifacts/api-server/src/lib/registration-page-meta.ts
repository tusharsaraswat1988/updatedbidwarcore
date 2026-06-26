import { playerRegistrationPublicUrl } from "@workspace/api-base/registration-url";
import { getPlatformOpenGraphImageUrl } from "./branding-service.js";
import { loadTournamentByRegistrationCode } from "./registration-context-service.js";
import {
  buildRegistrationShareDescription,
  parseRegistrationCodeFromPath,
  resolveRegistrationOgImage,
  tournamentRowToRegistrationMetaFields,
} from "./registration-meta-builders.js";
import { BASE_URL, DEFAULT_OG_IMAGE_URL, type PageMeta } from "./page-meta.js";

export {
  buildRegistrationShareDescription,
  isRegistrationPublicPath,
  parseRegistrationCodeFromPath,
  resolveRegistrationOgImage,
} from "./registration-meta-builders.js";

function resolvePlatformOgImage(): string {
  return getPlatformOpenGraphImageUrl() ?? DEFAULT_OG_IMAGE_URL;
}

function buildRegistrationNotFoundMeta(code: string): PageMeta {
  const canonical = playerRegistrationPublicUrl(BASE_URL, code);
  const title = "Player Registration | BidWar";
  const description = "Register for this tournament on BidWar. Player registrations may be open — open the link to check availability.";
  const ogImage = resolvePlatformOgImage();

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    twitterTitle: title,
    twitterDescription: description,
    robots: "noindex, follow",
    schemas: [],
  };
}

/** Async SSR meta for public player registration pages (WhatsApp / link previews). */
export async function resolveRegistrationPageMeta(pathname: string): Promise<PageMeta | null> {
  const code = parseRegistrationCodeFromPath(pathname);
  if (!code) return null;

  const tournament = await loadTournamentByRegistrationCode(code);
  if (!tournament) {
    return buildRegistrationNotFoundMeta(code);
  }

  const fields = tournamentRowToRegistrationMetaFields(tournament);
  const canonical = playerRegistrationPublicUrl(BASE_URL, code);
  const title = `${fields.tournamentName.trim()} | Player Registration`;
  const description = buildRegistrationShareDescription(fields);
  const ogImage = resolveRegistrationOgImage(fields);

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    twitterTitle: title,
    twitterDescription: description,
    robots: "noindex, follow",
    schemas: [],
    registration: fields,
  };
}
