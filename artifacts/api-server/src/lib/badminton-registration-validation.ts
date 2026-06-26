import type { BadmintonCategory, BadmintonPlayer } from "@workspace/db";

export type BadmintonRegistrationValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string; code: string };

function normalizeGender(g: string | null | undefined): string | null {
  if (!g) return null;
  const upper = g.toUpperCase();
  if (upper === "M" || upper === "MALE") return "M";
  if (upper === "F" || upper === "FEMALE") return "F";
  if (upper === "MIXED") return "Mixed";
  return g;
}

/**
 * Badminton doubles withdrawal rule: category entries are atomic pairs (or singles).
 * Withdrawing a registration removes the entire entry from draws — both partners
 * are excluded until the entry is reinstated. Players cannot register a new entry
 * in the same category while a withdrawn entry still exists for them.
 */
export function validateBadmintonRegistrationReinstate(
  category: Pick<BadmintonCategory, "matchType" | "gender" | "maxPlayers">,
  player1: Pick<BadmintonPlayer, "id" | "gender">,
  player2: Pick<BadmintonPlayer, "id" | "gender"> | null,
  acceptedEntryCount: number,
  conflictingPlayerIds: number[],
): BadmintonRegistrationValidationResult {
  const entryValidation = validateBadmintonCategoryEntry(
    category,
    player1,
    player2,
    acceptedEntryCount,
  );
  if (!entryValidation.ok) return entryValidation;

  if (conflictingPlayerIds.length > 0) {
    const isDoubles =
      category.matchType === "doubles" || category.matchType === "mixed_doubles";
    return {
      ok: false,
      status: 409,
      code: "DUPLICATE_CATEGORY_ENTRY",
      error: isDoubles
        ? "One or both players already have an active entry in this category."
        : "Player already has an active entry in this category.",
    };
  }

  return { ok: true };
}

export function validateBadmintonCategoryEntry(
  category: Pick<BadmintonCategory, "matchType" | "gender" | "maxPlayers">,
  player1: Pick<BadmintonPlayer, "id" | "gender">,
  player2: Pick<BadmintonPlayer, "id" | "gender"> | null,
  acceptedEntryCount: number,
): BadmintonRegistrationValidationResult {
  const isDoubles =
    category.matchType === "doubles" || category.matchType === "mixed_doubles";

  if (isDoubles && !player2) {
    return {
      ok: false,
      status: 400,
      code: "DOUBLES_PARTNER_REQUIRED",
      error: "Doubles categories require two players.",
    };
  }

  if (!isDoubles && player2) {
    return {
      ok: false,
      status: 400,
      code: "SINGLES_NO_PARTNER",
      error: "Singles categories cannot include a second player.",
    };
  }

  if (player2 && player2.id === player1.id) {
    return {
      ok: false,
      status: 400,
      code: "DUPLICATE_PARTNER",
      error: "A player cannot be registered as their own partner.",
    };
  }

  const categoryGender = normalizeGender(category.gender);
  const p1Gender = normalizeGender(player1.gender);

  if (categoryGender && categoryGender !== "Mixed" && p1Gender && p1Gender !== categoryGender) {
    return {
      ok: false,
      status: 400,
      code: "GENDER_MISMATCH",
      error: `Player gender does not match category restriction (${categoryGender}).`,
    };
  }

  if (player2 && category.matchType === "doubles") {
    const p2Gender = normalizeGender(player2.gender);
    if (categoryGender && categoryGender !== "Mixed" && p2Gender && p2Gender !== categoryGender) {
      return {
        ok: false,
        status: 400,
        code: "GENDER_MISMATCH",
        error: `Partner gender does not match category restriction (${categoryGender}).`,
      };
    }
  }

  if (player2 && category.matchType === "mixed_doubles") {
    const p2Gender = normalizeGender(player2.gender);
    if (p1Gender && p2Gender && p1Gender === p2Gender) {
      return {
        ok: false,
        status: 400,
        code: "MIXED_DOUBLES_GENDER",
        error: "Mixed doubles requires one male and one female player.",
      };
    }
  }

  if (category.maxPlayers != null && acceptedEntryCount >= category.maxPlayers) {
    return {
      ok: false,
      status: 403,
      code: "CATEGORY_FULL",
      error: "This category has reached its maximum entry count.",
    };
  }

  return { ok: true };
}
