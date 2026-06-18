/**
 * Player Spotlight — Utilities
 *
 * Thin wrappers over the asset-engine for monogram resolution.
 *
 * Sport metadata (getSportMeta, getSportLabel, getSportEmoji) has moved to
 * the design system (design-system/badges.tsx) where SportBadge can consume
 * it directly. They are re-exported here unchanged to preserve the public API.
 */

import { playerMonogram, teamMonogram } from "../../asset-engine/monogram-generator";

/* ─── Monogram helpers ───────────────────────────────────────────────────── */

/**
 * Returns display initials for a player name.
 * Delegates entirely to the asset-engine's playerMonogram().
 *
 * @example
 * getPlayerDisplayInitials("Rahul Sharma") // → "RS"
 * getPlayerDisplayInitials("Sachin")       // → "SA"
 */
export function getPlayerDisplayInitials(playerName: string): string {
  return playerMonogram(playerName).initials;
}

/**
 * Returns display initials for a team name.
 * Delegates entirely to the asset-engine's teamMonogram().
 *
 * @example
 * getTeamDisplayInitials("Varanasi Warriors") // → "VW"
 * getTeamDisplayInitials("Mumbai Indians")    // → "MI"
 */
export function getTeamDisplayInitials(teamName: string): string {
  return teamMonogram(teamName).initials;
}

/* ─── Sport helpers (re-exported from design system for API compat) ──────── */

export {
  getSportMeta,
  getSportLabel,
  getSportEmoji,
} from "../../design-system/badges";
export type { SportMeta } from "../../design-system/badges";
