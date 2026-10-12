export type PowerplayRules = {
  powerplayEnabled?: boolean;
  powerplayOvers?: number[];
} | null | undefined;

/** Overs that are actually in the powerplay for this match. */
export function resolvePowerplayOvers(rules: PowerplayRules, oversLimit: number): number[] {
  if (!rules || rules.powerplayEnabled === false) return [];
  const limit = Number.isFinite(oversLimit) && oversLimit > 0 ? Math.floor(oversLimit) : 0;
  if (limit < 1) return [];

  const listed = (rules.powerplayOvers ?? []).filter(
    (over) => Number.isInteger(over) && over >= 1 && over <= limit,
  );
  if (listed.length > 0) {
    return Array.from(new Set(listed)).sort((a, b) => a - b);
  }
  if (rules.powerplayEnabled !== true) return [];

  const defaultCount = Math.min(6, Math.max(1, Math.ceil(limit * 0.3)));
  return Array.from({ length: defaultCount }, (_, index) => index + 1);
}

/** Umpire-facing label, for example "Powerplay: Ov 1, 2, 3, 4, 5, 6". */
export function formatPowerplayOvers(overs: readonly number[]): string | null {
  if (overs.length === 0) return null;
  return `Powerplay: Ov ${overs.join(", ")}`;
}
