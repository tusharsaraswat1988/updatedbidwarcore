/**
 * Auction player selection helpers — shared by cloud and local API servers.
 *
 * When the available pool is small (late auction), a naive independent random
 * draw can surface the same player repeatedly and feels unfair. For pools at or
 * below FAIR_RANDOM_POOL_THRESHOLD we walk a shuffled queue so every remaining
 * player gets a turn before anyone repeats.
 */

export const FAIR_RANDOM_POOL_THRESHOLD = 5;

export type PlayerPoolEntry = { id: number };

export type FairRandomState = {
  queueJson: string | null | undefined;
  lastPlayerId: number | null | undefined;
};

export type RandomPickResult = {
  playerId: number;
  queueJson: string | null;
};

function shuffleInPlace(ids: number[]): number[] {
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function avoidLeadingRepeat(queue: number[], lastPlayerId: number | null | undefined): void {
  if (lastPlayerId == null || queue.length <= 1 || queue[0] !== lastPlayerId) return;
  const swapIdx = 1 + Math.floor(Math.random() * (queue.length - 1));
  [queue[0], queue[swapIdx]] = [queue[swapIdx], queue[0]];
}

function parseQueue(
  queueJson: string | null | undefined,
  poolIdSet: Set<number>,
): number[] {
  if (!queueJson) return [];
  try {
    const parsed = JSON.parse(queueJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is number => typeof id === "number" && poolIdSet.has(id),
    );
  } catch {
    return [];
  }
}

export function pickRandomPlayerFromPool(
  pool: PlayerPoolEntry[],
  state: FairRandomState,
): RandomPickResult {
  if (pool.length === 0) {
    throw new Error("Cannot pick from an empty player pool");
  }

  if (pool.length > FAIR_RANDOM_POOL_THRESHOLD) {
    return {
      playerId: pool[Math.floor(Math.random() * pool.length)].id,
      queueJson: null,
    };
  }

  const poolIdSet = new Set(pool.map((p) => p.id));
  let queue = parseQueue(state.queueJson, poolIdSet);

  const queuedIds = new Set(queue);
  const poolChanged = pool.some((p) => !queuedIds.has(p.id));

  if (queue.length === 0 || poolChanged) {
    queue = shuffleInPlace(pool.map((p) => p.id));
    avoidLeadingRepeat(queue, state.lastPlayerId);
  }

  const playerId = queue.shift()!;
  return {
    playerId,
    queueJson: queue.length > 0 ? JSON.stringify(queue) : null,
  };
}
