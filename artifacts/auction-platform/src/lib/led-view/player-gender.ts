export type PlayerGender = "male" | "female" | null;

export function inferGenderFromCategoryName(name: string | null | undefined): PlayerGender {
  if (!name?.trim()) return null;
  const n = name.toLowerCase();
  if (/(women|woman|female|girls|ladies|womens|girl)/.test(n)) return "female";
  if (/(^men\b|\bmens\b|\bmale\b|\bboys\b|\bboy\b|men's)/.test(n)) return "male";
  return null;
}

export function mapStoredGenderToPortrait(stored: string | null | undefined): PlayerGender {
  if (!stored) return null;
  const g = stored.trim().toUpperCase();
  if (g === "F" || g === "FEMALE") return "female";
  if (g === "M" || g === "MALE") return "male";
  return null;
}

export function resolvePlayerPortraitGender(
  stored: string | null | undefined,
  categoryName?: string | null,
): PlayerGender {
  return mapStoredGenderToPortrait(stored) ?? inferGenderFromCategoryName(categoryName);
}

export function hasUsablePortrait(url: string | null | undefined): boolean {
  return Boolean(url?.trim());
}
