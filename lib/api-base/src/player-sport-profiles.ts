/**
 * Feature flag: sport-neutral global identity with player_sport_profiles.
 * When enabled, sync writes identity-only to global_players and upserts per-sport profiles.
 */
export function isPlayerSportProfilesEnabled(): boolean {
  const raw = process.env.PLAYER_SPORT_PROFILES_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
