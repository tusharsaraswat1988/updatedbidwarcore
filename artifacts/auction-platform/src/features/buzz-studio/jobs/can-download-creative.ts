/**
 * Buzz Studio — Download permission utility
 *
 * Foundation for organizer and player download gates.
 * No download UI in this phase.
 */

import {
  resolveTournamentFeatures,
  type TournamentFeatures,
} from "@workspace/api-base/tournament-features";

export type CreativeDownloadAudience = "organizer" | "player";

/**
 * Whether the given audience may download a completed creative.
 *
 * - organizer: requires allowCreativeDownloads
 * - player: requires allowPlayerDownloads (future share links)
 */
export function canDownloadCreative(
  features: Partial<TournamentFeatures> | null | undefined,
  audience: CreativeDownloadAudience = "organizer",
): boolean {
  const resolved = resolveTournamentFeatures(features);
  if (audience === "organizer") {
    return resolved.allowCreativeDownloads === true;
  }
  return resolved.allowPlayerDownloads === true;
}
