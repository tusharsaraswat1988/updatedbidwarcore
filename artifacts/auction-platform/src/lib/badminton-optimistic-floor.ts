/**
 * While the scorer point queue is draining, ignore server/SSE snapshots that
 * report fewer rallies than the local optimistic floor (score regression).
 * Cleared when the queue empties so undo/SSE can still rewind.
 */

const floorByMatch = new Map<string, number>();

export function matchOptimisticKey(tournamentId: number, matchId: number): string {
  return `${tournamentId}:${matchId}`;
}

export function raiseOptimisticRallyFloor(key: string, totalRallies: number): void {
  const current = floorByMatch.get(key) ?? 0;
  if (totalRallies > current) {
    floorByMatch.set(key, totalRallies);
  }
}

export function clearOptimisticRallyFloor(key: string): void {
  floorByMatch.delete(key);
}

export function shouldRejectRallyRegression(
  key: string,
  prevRallies: number,
  incomingRallies: number,
): boolean {
  const floor = floorByMatch.get(key);
  if (floor == null) return false;
  return incomingRallies < prevRallies && incomingRallies < floor;
}
