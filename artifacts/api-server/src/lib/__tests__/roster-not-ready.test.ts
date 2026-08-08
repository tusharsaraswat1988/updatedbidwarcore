import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../master-sports/cricket-roster", () => ({
  listCricketMasterTeams: vi.fn(),
}));

vi.mock("../master-sports/cricket-franchise-registry", () => ({
  cricketFranchiseTeamExists: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  scoringMatchesTable: {},
  scoringSessionsTable: {},
  tournamentsTable: { id: "id", sport: "sport", scoringEnabled: "scoringEnabled" },
}));

import { listCricketMasterTeams } from "../master-sports/cricket-roster";
import {
  assertCricketSportsRosterReady,
  ScoringServiceError,
} from "../scoring-service";

describe("assertCricketSportsRosterReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when fewer than 2 franchise teams with squads", async () => {
    vi.mocked(listCricketMasterTeams).mockResolvedValue([
      {
        auctionTeamId: 1,
        masterTeamId: "mt_1",
        name: "A",
        shortName: "A",
        logoUrl: null,
        primaryColor: null,
        squadCount: 8,
        syncedToMaster: true,
      },
    ]);

    await expect(assertCricketSportsRosterReady(4)).rejects.toMatchObject({
      code: "ROSTER_NOT_READY",
      status: 400,
    } satisfies Partial<ScoringServiceError>);
  });

  it("rejects when teams exist but squads are empty", async () => {
    vi.mocked(listCricketMasterTeams).mockResolvedValue([
      {
        auctionTeamId: 1,
        masterTeamId: "mt_1",
        name: "A",
        shortName: "A",
        logoUrl: null,
        primaryColor: null,
        squadCount: 0,
        syncedToMaster: true,
      },
      {
        auctionTeamId: 2,
        masterTeamId: "mt_2",
        name: "B",
        shortName: "B",
        logoUrl: null,
        primaryColor: null,
        squadCount: 0,
        syncedToMaster: true,
      },
    ]);

    await expect(assertCricketSportsRosterReady(4)).rejects.toMatchObject({
      code: "ROSTER_NOT_READY",
    });
  });

  it("passes when ≥2 teams have players", async () => {
    vi.mocked(listCricketMasterTeams).mockResolvedValue([
      {
        auctionTeamId: 1,
        masterTeamId: "mt_1",
        name: "A",
        shortName: "A",
        logoUrl: null,
        primaryColor: null,
        squadCount: 8,
        syncedToMaster: true,
      },
      {
        auctionTeamId: 2,
        masterTeamId: "mt_2",
        name: "B",
        shortName: "B",
        logoUrl: null,
        primaryColor: null,
        squadCount: 8,
        syncedToMaster: true,
      },
    ]);

    await expect(assertCricketSportsRosterReady(4)).resolves.toBeUndefined();
  });
});
