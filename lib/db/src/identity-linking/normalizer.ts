/**
 * Read-only normalization and identity signal detection utilities.
 *
 * NOTE: Normalization is used strictly for in-memory comparisons.
 * It NEVER mutates legacy database records.
 */

const PLACEHOLDER_MOBILES = new Set([
  "0000000000",
  "1111111111",
  "2222222222",
  "3333333333",
  "4444444444",
  "5555555555",
  "6666666666",
  "7777777777",
  "8888888888",
  "9999999999",
  "1234567890",
  "9876543210",
]);

const GENERIC_NAMES = new Set([
  "player",
  "player 1",
  "player 2",
  "guest",
  "test",
  "admin",
  "user",
  "organizer",
  "scorer",
  "official",
  "dummy",
  "tba",
  "unknown",
  "na",
  "n/a",
]);

/**
 * Normalizes a phone number to standard digits-only format.
 * Strips international prefixes (+91, 0091) if applicable for Indian 10-digit standard.
 */
export function normalizeMobile(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  const raw = String(value).trim();
  if (/e/i.test(raw)) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return String(Math.trunc(parsed));
  }
  let digits = raw.replace(/\D/g, "");
  // Handle +91 or 91 country code prefix on 12-digit Indian numbers
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Checks if a mobile number is a known dummy/placeholder or invalid format.
 */
export function isPlaceholderMobile(mobile: string): boolean {
  const digits = normalizeMobile(mobile);
  if (digits.length < 10) return true;
  if (PLACEHOLDER_MOBILES.has(digits)) return true;
  // All repeating same digits check (e.g. 1111111111)
  if (/^(\d)\1{9,}$/.test(digits)) return true;
  return false;
}

/**
 * Normalizes email by trimming and converting to lowercase.
 */
export function normalizeEmail(value: unknown): string {
  if (value == null) return "";
  const str = String(value).trim().toLowerCase();
  // Basic sanity check
  if (!str.includes("@") || !str.includes(".")) return "";
  return str;
}

/**
 * Normalizes names for comparison: converts to lowercase, collapses whitespace,
 * strips special characters.
 */
export function normalizeName(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Checks if a name is generic or placeholder.
 */
export function isGenericName(name: string): boolean {
  const normalized = normalizeName(name);
  if (normalized.length < 2) return true;
  if (GENERIC_NAMES.has(normalized)) return true;
  if (/^player\s*\d+$/i.test(normalized)) return true;
  if (/^test\s*/i.test(normalized)) return true;
  return false;
}

/**
 * Normalizes federation codes (e.g. BWF Code "INPV 0123" -> "INPV0123")
 */
export function normalizeFederationCode(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Computes simple name similarity (0 to 1).
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  if (a.includes(b) || b.includes(a)) {
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    return minLen / maxLen;
  }
  return 0.0;
}
