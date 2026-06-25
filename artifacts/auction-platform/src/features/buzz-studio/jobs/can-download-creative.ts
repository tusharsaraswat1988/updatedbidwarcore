/**
 * Buzz Studio — Download permission utility
 *
 * Organizer downloads in Template Studio when Buzz Studio or allowCreativeDownloads is on.
 * Player downloads remain gated by allowPlayerDownloads (future share links).
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
    return resolved.allowCreativeDownloads === true || resolved.buzzStudio === true;
  }
  return resolved.allowPlayerDownloads === true;
}
