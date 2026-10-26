import { describe, expect, it } from "vitest";
import { squadPlayersForTeam, type CricketScorerPlayer } from "../scoring-squad";

function player(overrides: Partial<CricketScorerPlayer>): CricketScorerPlayer {
  return {
    id: 1,
    name: "Tushar",
    teamId: 10,
    status: "available",
    photoUrl: null,
    role: "Batsman",
    gender: null,
    isNonPlayingMember: false,
    ...overrides,
  };
}

describe("squadPlayersForTeam", () => {
  it("includes scoring-only players assigned to a team with available status", () => {
    const squad = squadPlayersForTeam(
      [
        player({ id: 1, status: "available", teamId: 10 }),
        player({ id: 2, status: "available", teamId: 11 }),
      ],
      10,
    );
    expect(squad.map((p) => p.id)).toEqual([1]);
  });

  it("includes auction sold/retained and transfer assignments", () => {
    const squad = squadPlayersForTeam(
      [
        player({ id: 1, status: "sold" }),
        player({ id: 2, status: "retained" }),
        player({ id: 3, status: "transfer" }),
      ],
      10,
    );
    expect(squad.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("excludes withdrawn, unsold, and non-playing members", () => {
    const squad = squadPlayersForTeam(
      [
        player({ id: 1, status: "withdrawn" }),
        player({ id: 2, status: "unsold" }),
        player({ id: 3, status: "available", isNonPlayingMember: true }),
      ],
      10,
    );
    expect(squad).toEqual([]);
  });
});
