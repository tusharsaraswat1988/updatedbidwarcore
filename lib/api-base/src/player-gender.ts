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

export function formatPlayerGender(code: string | null | undefined): string {
  const normalized = normalizeStoredGenderCode(code);
  if (normalized === "M") return "Male";
  if (normalized === "F") return "Female";
  return "";
}

/** Normalize DB / Excel values to M | F | null. */
export function normalizeStoredGenderCode(
  stored: string | null | undefined,
): PlayerGenderCode | null {
  if (!stored?.trim()) return null;
  const g = stored.trim().toUpperCase();
  if (g === "M" || g === "MALE") return "M";
  if (g === "F" || g === "FEMALE") return "F";
  return null;
}

/** Players page gender filter key — uses gender field, then category name (e.g. category "Male"). */
export function resolvePlayerGenderFilterKey(
  stored: string | null | undefined,
  categoryName?: string | null,
): PlayerGenderCode | "_unset" {
  const code = normalizeStoredGenderCode(stored);
  if (code === "M" || code === "F") return code;
  const inferred = inferGenderFromCategoryName(categoryName);
  if (inferred === "male") return "M";
  if (inferred === "female") return "F";
  return "_unset";
}

/** Labels shown in BMW Excel dropdowns — matches website PlayerGenderSelect. */
export const WORKBOOK_GENDER_LABELS = ["Male", "Female", "Not specified"] as const;

export function formatPlayerGenderForWorkbook(code: string | null | undefined): string {
  if (code === "M") return "Male";
  if (code === "F") return "Female";
  return "Not specified";
}

/**
 * Parse BMW / Excel gender cell → DB code.
 * Returns undefined when the cell is omitted (no update).
 */
export function parseWorkbookGenderLabel(
  label: unknown,
): PlayerGenderCode | null | undefined {
  if (label == null || label === "") return undefined;
  const s = String(label).trim();
  if (!s || /^not specified$/i.test(s) || /^none$/i.test(s) || /^-$/.test(s)) return null;
  const upper = s.toUpperCase();
  if (upper === "M" || upper === "MALE") return "M";
  if (upper === "F" || upper === "FEMALE") return "F";
  return undefined;
}
