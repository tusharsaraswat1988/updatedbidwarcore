export const LOWER_SIZE_VALUES = [
  "24",
  "26",
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
] as const;

export type LowerSize = (typeof LOWER_SIZE_VALUES)[number];

export function isLowerSize(value: string | null | undefined): value is LowerSize {
  if (!value) return false;
  return (LOWER_SIZE_VALUES as readonly string[]).includes(value.trim());
}

export function normalizeLowerSize(value: string | null | undefined): LowerSize | null {
  if (!value?.trim()) return null;
  const cleaned = value.trim().replace(/[^0-9]/g, "");
  return isLowerSize(cleaned) ? cleaned : null;
}

export function lowerSizeLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const normalized = normalizeLowerSize(value);
  return normalized ?? value.trim();
}
