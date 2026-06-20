import { validateAndSerializeSponsorLogos } from "@workspace/api-base/sponsor-priority";

/**
 * Validate tournament sponsor_logos JSON before persistence.
 * Used by auction tournament routes and badminton branding updates.
 */
export function parseValidatedSponsorLogos(
  json: string | undefined,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (json === undefined) {
    return { ok: true, value: undefined };
  }

  const result = validateAndSerializeSponsorLogos(json);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, value: result.serialized ?? undefined };
}
