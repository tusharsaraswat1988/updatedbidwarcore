import { describe, expect, it } from "vitest";
import {
  FAIR_RANDOM_POOL_THRESHOLD,
  pickRandomPlayerFromPool,
} from "@workspace/api-base/auction-player-selection";

describe("pickRandomPlayerFromPool", () => {
  it("uses independent random draw when the pool is larger than the fair threshold", () => {
    const pool = Array.from({ length: FAIR_RANDOM_POOL_THRESHOLD + 1 }, (_, i) => ({
      id: i + 1,
    }));

    const result = pickRandomPlayerFromPool(pool, {
      queueJson: JSON.stringify([99]),
      lastPlayerId: 3,
    });

    expect(pool.some((p) => p.id === result.playerId)).toBe(true);
    expect(result.queueJson).toBeNull();
  });

  it("alternates between two players without immediate repeats", () => {
    const pool = [{ id: 10 }, { id: 20 }];

    const first = pickRandomPlayerFromPool(pool, {
      queueJson: null,
      lastPlayerId: 10,
    });
    const second = pickRandomPlayerFromPool(pool, {
      queueJson: first.queueJson,
      lastPlayerId: first.playerId,
    });
    const third = pickRandomPlayerFromPool(pool, {
      queueJson: second.queueJson,
      lastPlayerId: second.playerId,
    });

    expect(first.playerId).not.toBe(10);
    expect(second.playerId).not.toBe(first.playerId);
    expect(third.playerId).not.toBe(second.playerId);
    expect(new Set([first.playerId, second.playerId, third.playerId]).size).toBe(2);
  });

  it("covers every player in a three-player pool before repeating", () => {
    const pool = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const seen: number[] = [];
    let queueJson: string | null = null;
    let lastPlayerId: number | null = null;

    for (let i = 0; i < 3; i++) {
      const result = pickRandomPlayerFromPool(pool, { queueJson, lastPlayerId });
      seen.push(result.playerId);
      queueJson = result.queueJson;
      lastPlayerId = result.playerId;
    }

    expect(new Set(seen)).toEqual(new Set([1, 2, 3]));
  });

  it("reshuffles when the pool membership changes", () => {
    const initial = pickRandomPlayerFromPool([{ id: 1 }, { id: 2 }, { id: 3 }], {
      queueJson: null,
      lastPlayerId: null,
    });

    const afterRemoval = pickRandomPlayerFromPool([{ id: 1 }, { id: 3 }], {
      queueJson: initial.queueJson,
      lastPlayerId: initial.playerId,
    });

    expect([1, 3]).toContain(afterRemoval.playerId);
  });

  it("stores structured fair-queue payload across picks", () => {
    const first = pickRandomPlayerFromPool(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      { queueJson: null, lastPlayerId: null },
    );
    expect(first.queueJson).toMatch(/"pool"/);
    expect(first.queueJson).toMatch(/"queue"/);

    const second = pickRandomPlayerFromPool(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      { queueJson: first.queueJson, lastPlayerId: first.playerId },
    );
    expect(second.playerId).not.toBe(first.playerId);
    const payload = JSON.parse(second.queueJson!);
    expect(payload.queue).toHaveLength(1);
  });

  it("reshuffles legacy queue when a queued player leaves the pool", () => {
    const legacy = pickRandomPlayerFromPool([{ id: 1 }, { id: 2 }, { id: 3 }], {
      queueJson: null,
      lastPlayerId: null,
    });
    const afterSold = pickRandomPlayerFromPool([{ id: 1 }, { id: 3 }], {
      queueJson: JSON.stringify([2, 3]),
      lastPlayerId: 1,
    });
    expect([1, 3]).toContain(afterSold.playerId);
    expect(afterSold.queueJson).toMatch(/"pool"/);
  });
});
