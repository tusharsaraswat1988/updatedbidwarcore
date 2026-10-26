/**
 * In-process guard so auction writes and demo cleanup cannot interleave
 * on this API instance. Released in a finally block by the reset handler.
 */

const cleanupInProgress = new Set<number>();

export function isAuctionCleanupInProgress(tournamentId: number): boolean {
  return cleanupInProgress.has(tournamentId);
}

export function tryBeginAuctionCleanup(
  tournamentId: number,
): { release: () => void } | null {
  if (cleanupInProgress.has(tournamentId)) return null;
  cleanupInProgress.add(tournamentId);
  return {
    release: () => {
      cleanupInProgress.delete(tournamentId);
    },
  };
}

export function rejectIfAuctionCleanupInProgress(
  tournamentId: number,
  res: { status: (code: number) => { json: (body: object) => void } },
): boolean {
  if (!cleanupInProgress.has(tournamentId)) return false;
  res.status(409).json({
    error: "A reset is cleaning up this tournament. Try again in a moment.",
  });
  return true;
}

/** Test hook. Production resets always release via the handle returned above. */
export function _resetAuctionCleanupLocksForTests(): void {
  cleanupInProgress.clear();
}
