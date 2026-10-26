/**
 * Ephemeral in-memory tracking for Random Player Reveal sequences.
 * Zero database migration required; lives strictly within the reveal TTL window.
 */

export type RandomPlayerRevealEntry = {
  playerId: number;
  startedAt: number; // epoch timestamp (ms)
};

const activeReveals = new Map<number, RandomPlayerRevealEntry>();

/** Reveal animation duration window in milliseconds (7.5 seconds = 6.5s max animation + 1.0s safety margin). */
export const REVEAL_WINDOW_MS = 7500;

/**
 * Record that a random player selection has just been committed by the backend.
 */
export function recordRandomPlayerReveal(
  tournamentId: number,
  playerId: number,
): RandomPlayerRevealEntry {
  const entry: RandomPlayerRevealEntry = {
    playerId,
    startedAt: Date.now(),
  };
  activeReveals.set(tournamentId, entry);
  return entry;
}

/**
 * Retrieve the active random reveal for a tournament if still within the TTL window.
 */
export function getRandomPlayerReveal(
  tournamentId: number,
): RandomPlayerRevealEntry | null {
  const entry = activeReveals.get(tournamentId);
  if (!entry) return null;
  if (Date.now() - entry.startedAt > REVEAL_WINDOW_MS) {
    activeReveals.delete(tournamentId);
    return null;
  }
  return entry;
}

/**
 * Clear any active reveal for a tournament (e.g. when timer starts, bid placed, player sold, or reset).
 */
export function clearRandomPlayerReveal(tournamentId: number): void {
  activeReveals.delete(tournamentId);
}

/** Reset all active reveals - used in test teardown. */
export function resetRandomPlayerRevealsForTests(): void {
  activeReveals.clear();
}
