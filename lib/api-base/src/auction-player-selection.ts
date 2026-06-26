/**
 * Auction player selection helpers — shared by cloud and local API servers.
 *
 * When the available pool is small (late auction), a naive independent random
 * draw can surface the same player repeatedly and feels unfair. For pools at or
 * below FAIR_RANDOM_POOL_THRESHOLD we walk a shuffled queue so every remaining
 * player gets a turn before anyone repeats.
 */

export const FAIR_RANDOM_POOL_THRESHOLD = 5;

export const FAIR_QUEUE_PAYLOAD_VERSION = 1;

export type PlayerPoolEntry = { id: number };

export type FairRandomState = {
  queueJson: string | null | undefined;
  lastPlayerId: number | null | undefined;
};

export type RandomPickResult = {
  playerId: number;
  queueJson: string | null;
};

type FairQueuePayload = {
  v: typeof FAIR_QUEUE_PAYLOAD_VERSION;
  pool: number[];
  queue: number[];
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

function sortedPoolIds(pool: PlayerPoolEntry[]): number[] {
  return pool.map((p) => p.id).sort((a, b) => a - b);
}

function poolSnapshotsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function serializeFairQueue(poolSnapshot: number[], queue: number[]): string {
  return JSON.stringify({
    v: FAIR_QUEUE_PAYLOAD_VERSION,
    pool: poolSnapshot,
    queue,
  } satisfies FairQueuePayload);
}

function parseFairQueue(
  queueJson: string | null | undefined,
  poolIdSet: Set<number>,
): { poolSnapshot: number[] | null; queue: number[]; legacyInvalidIds: boolean } {
  if (!queueJson) {
    return { poolSnapshot: null, queue: [], legacyInvalidIds: false };
  }

  try {
    const parsed = JSON.parse(queueJson) as unknown;

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as FairQueuePayload).queue)
    ) {
      const payload = parsed as FairQueuePayload;
      const poolSnapshot = Array.isArray(payload.pool)
        ? payload.pool
            .filter((id): id is number => typeof id === "number")
            .sort((a, b) => a - b)
        : null;
      const queue = payload.queue.filter(
        (id): id is number => typeof id === "number" && poolIdSet.has(id),
      );
      return { poolSnapshot, queue, legacyInvalidIds: false };
    }

    if (Array.isArray(parsed)) {
      const queue = parsed.filter(
        (id): id is number => typeof id === "number" && poolIdSet.has(id),
      );
      const legacyInvalidIds = parsed.some(
        (id) => typeof id === "number" && !poolIdSet.has(id),
      );
      return { poolSnapshot: null, queue, legacyInvalidIds };
    }
  } catch {
    // fall through
  }

  return { poolSnapshot: null, queue: [], legacyInvalidIds: false };
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
  const currentPoolSnapshot = sortedPoolIds(pool);
  const parsed = parseFairQueue(state.queueJson, poolIdSet);

  const poolMembershipChanged =
    parsed.poolSnapshot !== null &&
    !poolSnapshotsEqual(parsed.poolSnapshot, currentPoolSnapshot);

  const needsReshuffle =
    parsed.queue.length === 0 || poolMembershipChanged || parsed.legacyInvalidIds;

  let queue = parsed.queue;

  if (needsReshuffle) {
    queue = shuffleInPlace(pool.map((p) => p.id));
    avoidLeadingRepeat(queue, state.lastPlayerId);
  }

  const playerId = queue.shift()!;
  const remaining = queue;

  return {
    playerId,
    queueJson:
      remaining.length > 0
        ? serializeFairQueue(currentPoolSnapshot, remaining)
        : null,
  };
}
