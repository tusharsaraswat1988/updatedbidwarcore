/** Normalize tournament auction code from URL or user input. */
export function normalizeRegistrationCode(code: string): string {
  return decodeURIComponent(code).trim().toUpperCase();
}

const CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

export function isValidRegistrationCodeFormat(code: string): boolean {
  return CODE_PATTERN.test(normalizeRegistrationCode(code));
}

/** Public player self-registration path (opaque — no sequential tournament ID). */
export function playerRegistrationPath(auctionCode: string): string {
  const normalized = normalizeRegistrationCode(auctionCode);
  if (!normalized) return "/register";
  return `/register/${encodeURIComponent(normalized)}`;
}

/** Absolute registration URL (canonical — no query string). */
export function playerRegistrationPublicUrl(origin: string, auctionCode: string): string {
  return `${origin.replace(/\/+$/, "")}${playerRegistrationPath(auctionCode)}`;
}

/** WhatsApp/Meta cache-bust version — bump when OG metadata changes need a fresh scrape. */
export const REGISTRATION_SHARE_CACHE_VERSION = "3";

/** Shareable registration URL with cache-bust query for WhatsApp link previews. */
export function playerRegistrationShareUrl(origin: string, auctionCode: string): string {
  const base = playerRegistrationPublicUrl(origin, auctionCode);
  return `${base}?v=${REGISTRATION_SHARE_CACHE_VERSION}`;
}
