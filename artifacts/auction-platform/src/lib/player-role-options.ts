export type PlayerRoleOption = {
  value: string;
  label: string;
};

const FALLBACK_ROLE = "Player";

/**
 * Sport-master roles stay the catalog. A saved player role that is not in that
 * catalog is kept as its own option so the edit form can show and resave it.
 * Radix Select renders a blank trigger when `value` matches no item.
 */
export function buildPlayerRoleSelectOptions(
  sportRoleNames: readonly string[],
  currentRole: string | null | undefined,
  savedRole?: string | null,
): PlayerRoleOption[] {
  const catalogNames = sportRoleNames.length > 0 ? sportRoleNames : [FALLBACK_ROLE];
  const catalog = catalogNames.map((name) => ({ value: name, label: name }));
  const seen = new Set(catalogNames);
  const preserved: PlayerRoleOption[] = [];

  for (const role of [currentRole, savedRole]) {
    if (!role || !role.trim() || seen.has(role)) continue;
    seen.add(role);
    preserved.push({ value: role, label: role });
  }

  return preserved.length > 0 ? [...preserved, ...catalog] : catalog;
}

/** Same rule as the edit form: omit an empty role so a save does not clear it. */
export function playerRoleUpdateValue(role: string | null | undefined): string | undefined {
  return role ? role : undefined;
}

/** LED profile label source. CSS uppercases the string; the stored role is unchanged. */
export function ledPlayerRoleRaw(role: string | null | undefined): string {
  return role?.trim() || FALLBACK_ROLE;
}
