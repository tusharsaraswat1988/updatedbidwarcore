import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { STANDARD_FORMAT } from "@workspace/badminton-core";

type StatsRow = {
  id: number;
  playerId: string;
  sport: string;
  tournamentId: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  gamesWon: number;
  gamesLost: number;
  pointsScored: number;
  pointsConceded: number;
};

const statsStore = new Map<string, StatsRow>();
let nextId = 1;
const selectPlayerIdQueue: string[] = [];
let lastSelectedPlayerId: string | null = null;

const { mockDbLimit, mockDbUpdateSet, mockDbUpdateWhere, mockDbInsertValues } = vi.hoisted(() => ({
  mockDbLimit: vi.fn(),
  mockDbUpdateSet: vi.fn(),
  mockDbUpdateWhere: vi.fn(),
  mockDbInsertValues: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockDbLimit,
        }),
      }),
    }),
    update: () => ({
      set: mockDbUpdateSet,
    }),
    insert: () => ({
      values: mockDbInsertValues,
    }),
  },
  globalPlayersTable: {},
  masterTeamsTable: {},
  masterSponsorsTable: {},
  badmintonPlayersTable: {},
  playerTeamAssignmentsTable: {},
  playerStatisticsTable: { id: {} },
  masterPlayerIdMappingsTable: {},
  tournamentsTable: {},
}));

import {
  extractMasterPlayerIdsFromSideJson,
  updateBadmintonStatisticsFromMatch,
} from "../lib/master-sports/badminton";

function baseState(
  overrides: Partial<BadmintonMatchState> = {},
): BadmintonMatchState {
  return {
    matchId: 1,
    tournamentId: 42,
    matchKind: "singles",
    format: STANDARD_FORMAT,
    matchStatus: "completed",
    isPaused: false,
    matchNotes: [],
    leftSide: { label: "Left", shortLabel: "L", playerIds: [] },
    rightSide: { label: "Right", shortLabel: "R", playerIds: [] },
    gamesLeft: 2,
    gamesRight: 1,
    currentGame: 3,
    leftScore: 21,
    rightScore: 18,
    games: [
      {
        gameNumber: 1,
        leftScore: 21,
        rightScore: 15,
        servingSide: "left",
        intervalReached: false,
        phase: "completed",
        winner: "left",
      },
      {
        gameNumber: 2,
        leftScore: 18,
        rightScore: 21,
        servingSide: "right",
        intervalReached: false,
        phase: "completed",
        winner: "right",
      },
      {
        gameNumber: 3,
        leftScore: 21,
        rightScore: 18,
        servingSide: "left",
        intervalReached: false,
        phase: "completed",
        winner: "left",
      },
    ],
    servingSide: "left",
    inInterval: false,
    activeTimeout: null,
    winnerSide: "left",
    lastSequence: 10,
    totalRallies: 0,
    ...overrides,
  };
}

function singlesSide(masterPlayerId: string, label: string) {
  return {
    label,
    shortLabel: label.slice(0, 1),
    masterPlayerId,
    playerIds: [1],
  };
}

function pairSide(
  players: Array<{ masterPlayerId: string; label: string; teamName?: string }>,
) {
  return {
    label: players.map((p) => p.label).join(" / "),
    shortLabel: players.map((p) => p.label.slice(0, 1)).join(" / "),
    playerIds: players.map((_, i) => i + 1),
    players: players.map((p) => ({
      label: p.label,
      shortLabel: p.label.slice(0, 1),
      masterPlayerId: p.masterPlayerId,
      teamName: p.teamName,
      playerIds: [],
    })),
  };
}

function getStats(playerId: string): StatsRow | undefined {
  return statsStore.get(playerId);
}

function queueSelects(...playerIds: string[]) {
  selectPlayerIdQueue.push(...playerIds);
}

describe("extractMasterPlayerIdsFromSideJson", () => {
  it("returns side-level masterPlayerId for singles", () => {
    expect(
      extractMasterPlayerIdsFromSideJson(
        { masterPlayerId: "gp_s1", playerIds: [1] },
        "singles",
      ),
    ).toEqual(["gp_s1"]);
  });

  it("returns all players[].masterPlayerId for doubles", () => {
    expect(
      extractMasterPlayerIdsFromSideJson(
        {
          label: "A / B",
          shortLabel: "A / B",
          playerIds: [1, 2],
          players: [
            { label: "A", shortLabel: "A", masterPlayerId: "gp_a" },
            { label: "B", shortLabel: "B", masterPlayerId: "gp_b" },
          ],
        },
        "doubles",
      ),
    ).toEqual(["gp_a", "gp_b"]);
  });
});

describe("updateBadmintonStatisticsFromMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statsStore.clear();
    selectPlayerIdQueue.length = 0;
    lastSelectedPlayerId = null;
    nextId = 1;

    mockDbLimit.mockImplementation(async () => {
      const playerId = selectPlayerIdQueue.shift();
      lastSelectedPlayerId = playerId ?? null;
      if (!playerId) return [];
      const row = statsStore.get(playerId);
      return row ? [row] : [];
    });

    mockDbInsertValues.mockImplementation(async (values: Omit<StatsRow, "id">) => {
      const row: StatsRow = { id: nextId++, ...values };
      statsStore.set(values.playerId, row);
      return [row];
    });

    mockDbUpdateSet.mockImplementation((patch: Partial<StatsRow>) => {
      if (lastSelectedPlayerId) {
        const existing = statsStore.get(lastSelectedPlayerId);
        if (existing) {
          statsStore.set(lastSelectedPlayerId, { ...existing, ...patch });
        }
        lastSelectedPlayerId = null;
      }
      return { where: mockDbUpdateWhere };
    });

    mockDbUpdateWhere.mockResolvedValue([]);
  });

  it("1. singles win — updates winner and loser", async () => {
    queueSelects("gp_left", "gp_right");

    await updateBadmintonStatisticsFromMatch(
      baseState({ matchKind: "singles" }),
      42,
      singlesSide("gp_left", "Left Player"),
      singlesSide("gp_right", "Right Player"),
    );

    expect(mockDbInsertValues).toHaveBeenCalledTimes(2);

    const left = getStats("gp_left")!;
    const right = getStats("gp_right")!;

    expect(left.matchesPlayed).toBe(1);
    expect(left.matchesWon).toBe(1);
    expect(left.matchesLost).toBe(0);
    expect(left.gamesWon).toBe(2);
    expect(left.gamesLost).toBe(1);
    expect(left.pointsScored).toBe(60);
    expect(left.pointsConceded).toBe(54);

    expect(right.matchesPlayed).toBe(1);
    expect(right.matchesWon).toBe(0);
    expect(right.matchesLost).toBe(1);
    expect(right.gamesWon).toBe(1);
    expect(right.gamesLost).toBe(2);
    expect(right.pointsScored).toBe(54);
    expect(right.pointsConceded).toBe(60);
  });

  it("2. doubles win — updates all four players", async () => {
    queueSelects("gp_l1", "gp_l2", "gp_r1", "gp_r2");

    await updateBadmintonStatisticsFromMatch(
      baseState({
        matchKind: "doubles",
        winnerSide: "left",
      }),
      42,
      pairSide([
        { masterPlayerId: "gp_l1", label: "Left One" },
        { masterPlayerId: "gp_l2", label: "Left Two" },
      ]),
      pairSide([
        { masterPlayerId: "gp_r1", label: "Right One" },
        { masterPlayerId: "gp_r2", label: "Right Two" },
      ]),
    );

    expect(mockDbInsertValues).toHaveBeenCalledTimes(4);

    for (const id of ["gp_l1", "gp_l2"]) {
      const row = getStats(id)!;
      expect(row.matchesWon).toBe(1);
      expect(row.matchesLost).toBe(0);
      expect(row.gamesWon).toBe(2);
      expect(row.pointsScored).toBe(60);
    }

    for (const id of ["gp_r1", "gp_r2"]) {
      const row = getStats(id)!;
      expect(row.matchesWon).toBe(0);
      expect(row.matchesLost).toBe(1);
      expect(row.gamesLost).toBe(2);
      expect(row.pointsConceded).toBe(60);
    }
  });

  it("3. mixed doubles win — updates all four players on winning side", async () => {
    queueSelects("gp_m1", "gp_f1", "gp_m2", "gp_f2");

    await updateBadmintonStatisticsFromMatch(
      baseState({
        matchKind: "mixed_doubles",
        winnerSide: "right",
        gamesLeft: 1,
        gamesRight: 2,
      }),
      42,
      pairSide([
        { masterPlayerId: "gp_m1", label: "Man A" },
        { masterPlayerId: "gp_f1", label: "Woman A" },
      ]),
      pairSide([
        { masterPlayerId: "gp_m2", label: "Man B" },
        { masterPlayerId: "gp_f2", label: "Woman B" },
      ]),
    );

    expect(mockDbInsertValues).toHaveBeenCalledTimes(4);

    for (const id of ["gp_m2", "gp_f2"]) {
      const row = getStats(id)!;
      expect(row.matchesWon).toBe(1);
      expect(row.matchesLost).toBe(0);
      expect(row.gamesWon).toBe(2);
    }

    for (const id of ["gp_m1", "gp_f1"]) {
      const row = getStats(id)!;
      expect(row.matchesWon).toBe(0);
      expect(row.matchesLost).toBe(1);
      expect(row.gamesLost).toBe(2);
    }
  });

  it("4. cross-franchise doubles win — each player gets full side stats", async () => {
    queueSelects("gp_a1", "gp_b1", "gp_c1", "gp_d1");

    await updateBadmintonStatisticsFromMatch(
      baseState({
        matchKind: "doubles",
        winnerSide: "left",
      }),
      42,
      pairSide([
        { masterPlayerId: "gp_a1", label: "Team A Player", teamName: "Franchise A" },
        { masterPlayerId: "gp_b1", label: "Team B Player", teamName: "Franchise B" },
      ]),
      pairSide([
        { masterPlayerId: "gp_c1", label: "Team C Player", teamName: "Franchise C" },
        { masterPlayerId: "gp_d1", label: "Team D Player", teamName: "Franchise D" },
      ]),
    );

    expect(mockDbInsertValues).toHaveBeenCalledTimes(4);

    const winnerA = getStats("gp_a1")!;
    const winnerB = getStats("gp_b1")!;
    expect(winnerA.matchesWon).toBe(1);
    expect(winnerB.matchesWon).toBe(1);
    expect(winnerA.pointsScored).toBe(winnerB.pointsScored);
    expect(winnerA.gamesWon).toBe(2);

    const loserC = getStats("gp_c1")!;
    const loserD = getStats("gp_d1")!;
    expect(loserC.matchesLost).toBe(1);
    expect(loserD.matchesLost).toBe(1);
    expect(loserC.pointsConceded).toBe(loserD.pointsConceded);
  });

  it("increments existing statistics rows on subsequent matches", async () => {
    statsStore.set("gp_left", {
      id: 1,
      playerId: "gp_left",
      sport: "badminton",
      tournamentId: 42,
      matchesPlayed: 3,
      matchesWon: 2,
      matchesLost: 1,
      gamesWon: 6,
      gamesLost: 4,
      pointsScored: 120,
      pointsConceded: 100,
    });
    statsStore.set("gp_right", {
      id: 2,
      playerId: "gp_right",
      sport: "badminton",
      tournamentId: 42,
      matchesPlayed: 3,
      matchesWon: 1,
      matchesLost: 2,
      gamesWon: 4,
      gamesLost: 6,
      pointsScored: 100,
      pointsConceded: 120,
    });

    queueSelects("gp_left", "gp_right");

    await updateBadmintonStatisticsFromMatch(
      baseState({ matchKind: "singles" }),
      42,
      singlesSide("gp_left", "Left Player"),
      singlesSide("gp_right", "Right Player"),
    );

    expect(mockDbInsertValues).not.toHaveBeenCalled();
    expect(mockDbUpdateSet).toHaveBeenCalledTimes(2);

    expect(getStats("gp_left")!.matchesPlayed).toBe(4);
    expect(getStats("gp_left")!.matchesWon).toBe(3);
    expect(getStats("gp_right")!.matchesLost).toBe(3);
  });

  it("skips non-terminal match status", async () => {
    await updateBadmintonStatisticsFromMatch(
      baseState({ matchStatus: "live" }),
      42,
      singlesSide("gp_left", "Left"),
      singlesSide("gp_right", "Right"),
    );

    expect(mockDbInsertValues).not.toHaveBeenCalled();
    expect(mockDbUpdateSet).not.toHaveBeenCalled();
  });
});
