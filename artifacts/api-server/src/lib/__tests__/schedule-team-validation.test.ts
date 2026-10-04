import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelectFrom, mockFranchiseTeamExists } = vi.hoisted(() => ({
  mockSelectFrom: vi.fn(),
  mockFranchiseTeamExists: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  return {
    createPgClient: () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      end: vi.fn(),
    }),
    db: {
      select: () => ({
        from: () => ({
          where: (...args: any[]) => {
            const res = mockSelectFrom(...args);
            return Object.assign(Promise.resolve(res), {
              limit: vi.fn(() => Promise.resolve(res)),
            });
          },
        }),
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 101, name: "Stage 1" }]),
        })),
      })),
    },
    scoringDrawsTable: { tournamentId: "tournamentId" },
    scoringFixturesTable: {},
    scoringGroupMembersTable: {},
    scoringGroupsTable: {},
    scoringMatchSquadsTable: {},
    scoringMatchesTable: {},
    scoringOfficialsTable: {},
    scoringSessionsTable: {},
    scoringVenuesTable: { id: "id", tournamentId: "tournamentId" },
    tournamentsTable: { id: "id" },
    teamsTable: { id: "id", tournamentId: "tournamentId" },
    scorerAccountsTable: {},
  };
});

vi.mock("../master-sports/cricket-franchise-registry", () => ({
  cricketFranchiseTeamExists: mockFranchiseTeamExists,
  listCricketFranchiseTeams: vi.fn().mockResolvedValue([]),
}));

vi.mock("../cricket-rule-presets-service", () => ({
  getCricketRulePreset: vi.fn().mockResolvedValue({ id: 1, name: "Default" }),
}));

vi.mock("../runtime-match-service", () => ({
  prepareRuntimeMatch: vi.fn().mockResolvedValue({ ok: true }),
}));

import { generateScoringDraw } from "../scoring-foundation-service";

describe("Schedule generation team validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds when teams exist in teamsTable even if franchise PTA rows are empty", async () => {
    // Tournament check: exists and scoring enabled
    mockSelectFrom
      .mockResolvedValueOnce([
        { id: 40, scoringEnabled: true, sport: "cricket" },
      ])
      // teamsTable check: returns both team 1 and team 2 for tournament 40
      .mockResolvedValueOnce([
        { id: 1 },
        { id: 2 },
      ]);

    // Franchise registry PTA has no rows for these teams yet
    mockFranchiseTeamExists.mockResolvedValue(false);

    const result = await generateScoringDraw({
      tournamentId: 40,
      name: "BPL Stage 1",
      format: "round_robin",
      teamIds: [1, 2],
      oversLimit: 20,
    });

    expect(result).toBeDefined();
    expect(result.draw).toBeDefined();
    expect(result.fixtureCount).toBe(1);
  });

  it("fails with INVALID_TEAM if a team does not exist in teamsTable or PTA", async () => {
    // Tournament check
    mockSelectFrom
      .mockResolvedValueOnce([
        { id: 40, scoringEnabled: true, sport: "cricket" },
      ])
      // teamsTable only has team 1, missing team 99
      .mockResolvedValueOnce([
        { id: 1 },
      ]);

    mockFranchiseTeamExists.mockResolvedValue(false);

    await expect(
      generateScoringDraw({
        tournamentId: 40,
        name: "BPL Stage 1",
        format: "round_robin",
        teamIds: [1, 99],
        oversLimit: 20,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_TEAM",
      status: 400,
    });
  });
});
