import type { LedPlayerSpec } from "./types";

export type PortraitInfoRow = {
  /** Full label from role_spec_groups (e.g. "Playing Hand"). */
  label: string;
  /** Compact broadcast label (e.g. "HAND"). */
  shortLabel: string;
  value: string;
};

/** Known sport spec labels → compact broadcast tokens. Sport-neutral fallbacks use acronyms. */
const BROADCAST_LABEL_ALIASES: Record<string, string> = {
  age: "AGE",
  "playing hand": "HAND",
  "playing style": "STYLE",
  experience: "EXP",
  "court preference": "COURT",
  "batting hand": "BAT",
  "bowling style": "BOWL",
  specialization: "SPEC",
  "preferred position": "POS",
  "dominant foot": "FOOT",
};

/** Compact broadcast label for multi-row LED footer (no cricket-specific hardcoding in UI). */
export function broadcastSpecLabel(fullLabel: string): string {
  const normalized = fullLabel.toLowerCase().trim();
  const alias = BROADCAST_LABEL_ALIASES[normalized];
  if (alias) return alias;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) {
    const word = words[0]!;
    return word.length <= 6 ? word.toUpperCase() : word.slice(0, 6).toUpperCase();
  }
  return words
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 6);
}

function normalizeValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

/** Age + all specs in display order — no cap. */
export function buildPortraitInfoRows(
  age: number,
  specs: LedPlayerSpec[],
): PortraitInfoRow[] {
  const ageValue = age > 0 ? String(age) : "—";
  const rows: PortraitInfoRow[] = [
    { label: "Age", shortLabel: "AGE", value: ageValue },
  ];

  for (const spec of specs) {
    rows.push({
      label: spec.label,
      shortLabel: broadcastSpecLabel(spec.label),
      value: normalizeValue(spec.value),
    });
  }

  return rows;
}

/**
 * Responsive grid columns for spec rows inside the portrait footer.
 * 1–2 items: single column. 3+: two columns so rows wrap naturally.
 */
export function portraitSpecGridClass(itemCount: number): string {
  if (itemCount <= 2) return "grid-cols-1";
  return "grid-cols-2";
}

/** @deprecated Use buildPortraitInfoRows — kept for import stability during migration. */
export function buildPortraitFooterStats(
  age: number,
  specs: LedPlayerSpec[],
): { label: string; value: string }[] {
  return buildPortraitInfoRows(age, specs).map((row) => ({
    label: row.label,
    value: row.value,
  }));
}
