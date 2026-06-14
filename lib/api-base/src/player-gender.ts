/** Stored on players.gender — matches badminton / global_players convention. */
export const PLAYER_GENDER_VALUES = ["M", "F"] as const;
export type PlayerGenderCode = (typeof PLAYER_GENDER_VALUES)[number];

/** LED portrait: male | female | null */
export type PlayerPortraitGender = "male" | "female" | null;

export function mapStoredGenderToPortrait(
  stored: string | null | undefined,
): PlayerPortraitGender {
  if (!stored) return null;
  const g = stored.trim().toUpperCase();
  if (g === "F" || g === "FEMALE") return "female";
  if (g === "M" || g === "MALE") return "male";
  return null;
}

export function inferGenderFromCategoryName(
  name: string | null | undefined,
): PlayerPortraitGender {
  if (!name?.trim()) return null;
  const n = name.toLowerCase();
  if (/(women|woman|female|girls|ladies|womens|girl)/.test(n)) return "female";
  if (/(^men\b|\bmens\b|\bmale\b|\bboys\b|\bboy\b|men's)/.test(n)) return "male";
  return null;
}

export function resolvePlayerPortraitGender(
  stored: string | null | undefined,
  categoryName?: string | null,
): PlayerPortraitGender {
  return mapStoredGenderToPortrait(stored) ?? inferGenderFromCategoryName(categoryName);
}
