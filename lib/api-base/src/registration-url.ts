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

/** Absolute registration URL for QR codes, WhatsApp, and copy links. */
export function playerRegistrationPublicUrl(origin: string, auctionCode: string): string {
  return `${origin.replace(/\/+$/, "")}${playerRegistrationPath(auctionCode)}`;
}
