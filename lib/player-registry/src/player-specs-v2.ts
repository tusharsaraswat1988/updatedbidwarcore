/**
 * Feature flag: normalized player specification storage (player_spec_values).
 * When enabled, API dual-writes spec values and returns `specifications[]`.
 *
 * Defaults to ON so sports with 4+ spec groups (e.g. badminton Court Preference)
 * persist correctly. Set PLAYER_SPECS_V2_ENABLED=false to opt out.
 */
export function isPlayerSpecsV2Enabled(): boolean {
  const raw = process.env.PLAYER_SPECS_V2_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}
