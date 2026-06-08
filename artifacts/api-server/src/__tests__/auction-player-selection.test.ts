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
});
