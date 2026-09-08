/**
 * Server-side age calculation. Client-supplied age must never be trusted.
 */

export type AgeCalculationResult =
  | { ok: true; age: number }
  | { ok: false; error: string };

const DOB_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse YYYY-MM-DD and return a UTC calendar date (no timezone shift).
 */
export function parseDateOfBirth(raw: string): Date | null {
  const trimmed = raw.trim();
  const match = DOB_RE.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Calculate completed years of age as of `asOf` (defaults to now).
 * Uses calendar DOB, not floating timestamps.
 */
export function calculateAgeFromDob(
  dobRaw: string,
  asOf: Date = new Date(),
): AgeCalculationResult {
  const dob = parseDateOfBirth(dobRaw);
  if (!dob) {
    return { ok: false, error: "Date of birth must be a valid date in YYYY-MM-DD format." };
  }

  const asOfUtc = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );

  if (dob.getTime() > asOfUtc.getTime()) {
    return { ok: false, error: "Date of birth cannot be in the future." };
  }

  let age = asOfUtc.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = asOfUtc.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOfUtc.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }

  if (age < 0 || age > 120) {
    return { ok: false, error: "Calculated age is out of acceptable range." };
  }

  return { ok: true, age };
}

/**
 * Reject any attempt to override server-calculated age from the client.
 */
export function assertClientAgeIgnored(
  clientAge: unknown,
  calculatedAge: number,
): { ok: true; age: number } {
  // Intentionally discard clientAge — documented for auditability.
  void clientAge;
  return { ok: true, age: calculatedAge };
}
