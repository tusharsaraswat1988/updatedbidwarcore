/**
 * Feature flag: sport-neutral global identity with player_sport_profiles.
 * When enabled, sync writes identity-only to global_players and upserts per-sport profiles.
 *
 * Defaults to ON for multi-sport global search and identity-only sync.
 * Set PLAYER_SPORT_PROFILES_ENABLED=false to opt out.
 */
export function isPlayerSportProfilesEnabled(): boolean {
  const raw = process.env.PLAYER_SPORT_PROFILES_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}
