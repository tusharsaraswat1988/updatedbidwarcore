/**
 * Human-readable registration IDs, e.g. BPL26-000123.
 * Sequence must come from the database (atomic tournament counter) — never the frontend.
 */

const PREFIX_RE = /^[A-Z0-9]{2,16}$/;

export type RegistrationIdFormatResult =
  | { ok: true; registrationId: string }
  | { ok: false; error: string };

export function normalizeRegistrationIdPrefix(raw: string): RegistrationIdFormatResult {
  const prefix = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PREFIX_RE.test(prefix)) {
    return {
      ok: false,
      error: "Registration ID prefix must be 2–16 alphanumeric characters.",
    };
  }
  return { ok: true, registrationId: prefix };
}

/**
 * Format a collision-safe ID from a DB-allocated sequence.
 * `sequence` must be a positive integer allocated by the server.
 */
export function formatRegistrationId(
  prefix: string,
  sequence: number,
  padWidth = 6,
): RegistrationIdFormatResult {
  const normalized = normalizeRegistrationIdPrefix(prefix);
  if (!normalized.ok) return normalized;

  if (!Number.isInteger(sequence) || sequence < 1) {
    return { ok: false, error: "Registration sequence must be a positive integer." };
  }

  const width = Math.max(padWidth, String(sequence).length);
  const serial = String(sequence).padStart(width, "0");
  return { ok: true, registrationId: `${normalized.registrationId}-${serial}` };
}

export function parseRegistrationId(
  raw: string,
): { ok: true; prefix: string; sequence: number } | { ok: false; error: string } {
  const trimmed = raw.trim().toUpperCase();
  const match = /^([A-Z0-9]{2,16})-(\d{1,12})$/.exec(trimmed);
  if (!match) {
    return { ok: false, error: "Invalid registration ID format." };
  }
  return {
    ok: true,
    prefix: match[1],
    sequence: Number(match[2]),
  };
}
