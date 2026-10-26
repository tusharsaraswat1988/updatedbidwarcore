import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordRandomPlayerReveal,
  getRandomPlayerReveal,
  clearRandomPlayerReveal,
  resetRandomPlayerRevealsForTests,
  REVEAL_WINDOW_MS,
} from "../lib/random-player-reveal";

describe("random-player-reveal backend state", () => {
  beforeEach(() => {
    resetRandomPlayerRevealsForTests();
    vi.useRealTimers();
  });

  it("records a random player reveal and retrieves it within the TTL window", () => {
    const entry = recordRandomPlayerReveal(101, 42);
    expect(entry.playerId).toBe(42);
    expect(entry.startedAt).toBeGreaterThan(0);

    const retrieved = getRandomPlayerReveal(101);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.playerId).toBe(42);
    expect(retrieved?.startedAt).toBe(entry.startedAt);
  });

  it("returns null for tournaments with no active reveal", () => {
    expect(getRandomPlayerReveal(999)).toBeNull();
  });

  it("expires after the TTL window", () => {
    vi.useFakeTimers();
    recordRandomPlayerReveal(102, 55);

    expect(getRandomPlayerReveal(102)?.playerId).toBe(55);

    // Fast-forward past REVEAL_WINDOW_MS
    vi.advanceTimersByTime(REVEAL_WINDOW_MS + 100);

    expect(getRandomPlayerReveal(102)).toBeNull();
  });

  it("clears reveal on explicit clear call", () => {
    recordRandomPlayerReveal(103, 88);
    expect(getRandomPlayerReveal(103)?.playerId).toBe(88);

    clearRandomPlayerReveal(103);
    expect(getRandomPlayerReveal(103)).toBeNull();
  });

  it("isolates reveals across different tournaments", () => {
    recordRandomPlayerReveal(201, 10);
    recordRandomPlayerReveal(202, 20);

    expect(getRandomPlayerReveal(201)?.playerId).toBe(10);
    expect(getRandomPlayerReveal(202)?.playerId).toBe(20);

    clearRandomPlayerReveal(201);
    expect(getRandomPlayerReveal(201)).toBeNull();
    expect(getRandomPlayerReveal(202)?.playerId).toBe(20);
  });
});
