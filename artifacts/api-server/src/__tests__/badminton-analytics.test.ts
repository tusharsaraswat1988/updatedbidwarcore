import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { STANDARD_FORMAT } from "@workspace/badminton-core";

const terminalRows: unknown[] = [];
const pointEvents: unknown[] = [];
const existingRows: unknown[] = [];
const insertCalls: unknown[] = [];

let selectCall = 0;

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            innerJoin: () => ({
              where: async () => terminalRows,
            }),
          };
        }
        if (selectCall === 2) {
          return {
            where: async () => pointEvents,
          };
        }
        return {
          where: () => ({
            limit: async () => existingRows,
          }),
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
    insert: () => ({
      values: (row: unknown) => {
        insertCalls.push(row);
        return Promise.resolve();
      },
    }),
  },
  badmintonAnalyticsTable: {},
  badmintonMatchDetailsTable: {},
  scoringEventsTable: {},
  scoringMatchesTable: {},
}));

import { recomputeBadmintonAnalytics } from "../lib/badminton-analytics";

function terminalState(overrides: Partial<BadmintonMatchState> = {}): BadmintonMatchState {
  return {
    matchId: 10,
    tournamentId: 42,
    matchKind: "singles",
    format: STANDARD_FORMAT,
    matchStatus: "completed",
    isPaused: false,
    matchNotes: [],
    leftSide: { label: "L", shortLabel: "L", playerIds: [] },
    rightSide: { label: "R", shortLabel: "R", playerIds: [] },
    gamesLeft: 2,
    gamesRight: 0,
    currentGame: 2,
    leftScore: 21,
    rightScore: 18,
    games: [],
    servingSide: "left",
    inInterval: false,
    activeTimeout: null,
    winnerSide: "left",
    lastSequence: 5,
    totalRallies: 42,
    startedAt: "2026-07-29T10:00:00.000Z",
    endedAt: "2026-07-29T10:45:00.000Z",
    ...overrides,
  };
}

describe("recomputeBadmintonAnalytics", () => {
  beforeEach(() => {
    selectCall = 0;
    terminalRows.length = 0;
    pointEvents.length = 0;
    existingRows.length = 0;
    insertCalls.length = 0;
  });

  it("upserts tournament aggregates from terminal matches", async () => {
    terminalRows.push(
      {
        matchId: 10,
        status: "completed",
        stateSnapshotJson: terminalState(),
      },
      {
        matchId: 11,
        status: "walkover",
        stateSnapshotJson: terminalState({
          matchId: 11,
          matchStatus: "walkover",
          totalRallies: 0,
        }),
      },
    );
    pointEvents.push(
      { matchId: 10, payloadJson: { rallyLength: 18 } },
      { matchId: 10, payloadJson: { rallyLength: 24 } },
    );

    await recomputeBadmintonAnalytics(42);

    expect(insertCalls[0]).toMatchObject({
      tournamentId: 42,
      matchesCompleted: 2,
      totalRallies: 42,
      longestRally: 24,
      longestRallyMatchId: 10,
    });
  });
});
