import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadmintonServiceError,
  buildScoringSideFromBadmintonSide,
  ensureBadmintonTournament,
} from "../lib/badminton-service";
import { ensureScoringEnabled } from "../lib/scoring-standings";
import { ScoringServiceError } from "../lib/scoring-service";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fromArgs: unknown[]) => {
          mockFrom(...fromArgs);
          return {
            where: (...whereArgs: unknown[]) => {
              mockWhere(...whereArgs);
              return {
                limit: (...limitArgs: unknown[]) => mockLimit(...limitArgs),
              };
            },
          };
        },
      };
    },
  },
  scoringMatchesTable: {},
  scoringEventsTable: {},
  badmintonMatchDetailsTable: {},
  badmintonFixturesTable: {},
  tournamentsTable: {},
  scoringStandingsTable: {},
  teamsTable: {},
  playersTable: {},
}));

describe("P0 — badminton side JSON on scoring_matches", () => {
  it("maps playerIds and label into homeSideJson shape", () => {
    const side = buildScoringSideFromBadmintonSide({
      label: "Player A",
      shortLabel: "A",
      playerIds: [10, 11],
    });

    expect(side).toEqual({
      teamId: 0,
      playerIds: [10, 11],
      displayName: "Player A",
    });
  });

  it("falls back to shortLabel for displayName", () => {
    const side = buildScoringSideFromBadmintonSide({
      shortLabel: "B",
      playerIds: [2],
    });

    expect(side.displayName).toBe("B");
    expect(side.playerIds).toEqual([2]);
  });
});

describe("P0 — badminton tournament sport guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-badminton tournaments", async () => {
    mockLimit.mockResolvedValueOnce([{ sport: "cricket" }]);

    await expect(ensureBadmintonTournament(42)).rejects.toMatchObject({
      code: "BADMINTON_SPORT_REQUIRED",
      status: 400,
    });
  });

  it("allows badminton tournaments", async () => {
    mockLimit.mockResolvedValueOnce([{ sport: "badminton" }]);

    await expect(ensureBadmintonTournament(42)).resolves.toBeUndefined();
  });
});

describe("P0 — cricket scoring sport guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-cricket tournaments when scoring is enabled", async () => {
    mockLimit.mockResolvedValueOnce([
      { scoringEnabled: true, sport: "badminton" },
    ]);

    await expect(ensureScoringEnabled(99)).rejects.toMatchObject({
      code: "UNSUPPORTED_SPORT",
      status: 400,
    });
  });

  it("allows cricket tournaments when scoring is enabled", async () => {
    mockLimit.mockResolvedValueOnce([
      { scoringEnabled: true, sport: "cricket" },
    ]);

    await expect(ensureScoringEnabled(99)).resolves.toBeUndefined();
  });
});

describe("P0 — badminton service error shape", () => {
  it("carries HTTP status for route handlers", () => {
    const err = new BadmintonServiceError("BADMINTON_SPORT_REQUIRED", "Tournament sport must be badminton", 400);
    expect(err.status).toBe(400);
    expect(err.code).toBe("BADMINTON_SPORT_REQUIRED");
  });
});
