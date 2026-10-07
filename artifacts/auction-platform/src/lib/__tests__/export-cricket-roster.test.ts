import { describe, expect, it } from "vitest";
import type { Player, Team } from "@workspace/api-client-react";
import { orderPlayersByTeam } from "../export-cricket-roster";

function player(partial: Pick<Player, "id" | "name" | "serialNo"> & { teamId?: number | null }): Player {
  return partial as Player;
}

function team(partial: Pick<Team, "id" | "name">): Team {
  return partial as Team;
}

describe("orderPlayersByTeam", () => {
  it("groups players by team name, then serial, with unassigned last", () => {
    const teams = [
      team({ id: 2, name: "KASHI STRIKERS (Junior)" }),
      team({ id: 1, name: "BANARASI HITMEN (Junior)" }),
      team({ id: 3, name: "GANGA GIANTS (Senior)" }),
    ];
    const players = [
      player({ id: 10, serialNo: 1, name: "Shubh", teamId: 2 }),
      player({ id: 11, serialNo: 2, name: "Aditya", teamId: 1 }),
      player({ id: 12, serialNo: 3, name: "Arsh", teamId: 1 }),
      player({ id: 13, serialNo: 4, name: "Hardik", teamId: 2 }),
      player({ id: 14, serialNo: 5, name: "Shivam", teamId: 3 }),
      player({ id: 15, serialNo: 6, name: "Open", teamId: null }),
    ];

    expect(orderPlayersByTeam(players, teams).map((p) => p.name)).toEqual([
      "Aditya",
      "Arsh",
      "Shivam",
      "Shubh",
      "Hardik",
      "Open",
    ]);
  });
});
