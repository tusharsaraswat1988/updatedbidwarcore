import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isScoringSupportedSport,
  TOURNAMENT_LIFECYCLE_STATUSES,
} from "../lib/tournament-lifecycle";

const mockSelect = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
  sportsTable: {},
}));

import { isKnownActiveSportSlug } from "../routes/sports";

describe("tournament lifecycle constants", () => {
  it("defines the auction lifecycle statuses used across cloud and local", () => {
    expect(TOURNAMENT_LIFECYCLE_STATUSES).toEqual(["setup", "active", "paused", "completed"]);
  });

  it("only allows scoring on stabilized cricket and badminton modules", () => {
    expect(isScoringSupportedSport("cricket")).toBe(true);
    expect(isScoringSupportedSport("badminton")).toBe(true);
    expect(isScoringSupportedSport("football")).toBe(false);
    expect(isScoringSupportedSport("Cricket")).toBe(true);
  });
});

describe("isKnownActiveSportSlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockSportLookup(rows: Array<{ id: number }>) {
    mockSelect.mockReturnValue({
      from: () => ({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });
  }

  it("accepts slugs resolved from the active sports table", async () => {
    mockSportLookup([{ id: 7 }]);
    await expect(isKnownActiveSportSlug("badminton")).resolves.toBe(true);
  });

  it("falls back to built-in defaults when the sports table has no row", async () => {
    mockSportLookup([]);
    await expect(isKnownActiveSportSlug("kabaddi")).resolves.toBe(true);
  });

  it("rejects unknown slugs", async () => {
    mockSportLookup([]);
    await expect(isKnownActiveSportSlug("underwater-polo")).resolves.toBe(false);
    await expect(isKnownActiveSportSlug("")).resolves.toBe(false);
  });
});
