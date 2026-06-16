export const JERSEY_SIZE_VALUES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;
export type JerseySize = (typeof JERSEY_SIZE_VALUES)[number];

export function isJerseySize(value: string | null | undefined): value is JerseySize {
  if (!value) return false;
  return (JERSEY_SIZE_VALUES as readonly string[]).includes(value);
}

export function normalizeJerseySize(value: string | null | undefined): JerseySize | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, "");
  const normalized =
    trimmed === "XXL" ? "2XL"
    : trimmed === "XXXL" ? "3XL"
    : trimmed === "XXXXL" ? "4XL"
    : trimmed === "XXXXXL" ? "5XL"
    : trimmed;
  return isJerseySize(normalized) ? normalized : null;
}
