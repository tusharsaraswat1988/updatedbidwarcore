import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import {
  buildMatchConfigurationHistoryPayload,
  isValidMatchLifecycleTransition,
  mapScoringMatchToConfiguration,
  mapScoringMatchToIdentity,
  mapScoringMatchToSides,
  validateMatch,
} from "@workspace/platform-core/match";

describe("EPIC-05 match foundation", () => {
  it("exposes match type catalog including custom", () => {
    expect(CatalogRegistry.listMatchTypes().some((t) => t.id === "custom")).toBe(true);
    expect(CatalogRegistry.getMatchRole("home")).toBeUndefined();
    expect(CatalogRegistry.getMatchRole("competitor")?.scope).toBe("side");
  });

  it("keeps identity independent of sides", () => {
    const row = {
      id: 9,
      tournamentId: 1,
      matchLabel: "M1",
      matchTypeId: "league",
      homeTeamId: 1,
      awayTeamId: 2,
    };
    const identity = mapScoringMatchToIdentity(row);
    const empty = mapScoringMatchToSides({
      ...row,
      homeTeamId: 0,
      awayTeamId: 0,
    });
    expect(identity.id).toBe("9");
    expect(empty.every((s) => !s.subject)).toBe(true);
    expect(mapScoringMatchToIdentity(row)).toEqual(identity);
  });

  it("configuration omits lifecycle status", () => {
    const config = mapScoringMatchToConfiguration({
      id: 1,
      tournamentId: 1,
      matchLabel: "A",
      lifecycleStatus: "live",
    } as never);
    expect(config).not.toHaveProperty("status");
    expect(Object.keys(config)).not.toContain("lifecycleStatus");
  });

  it("requires competition locked before ready", () => {
    const config = mapScoringMatchToConfiguration({
      id: 1,
      tournamentId: 1,
      matchLabel: "A",
      matchTypeId: "league",
    });
    const sides = mapScoringMatchToSides(
      { id: 1, tournamentId: 1, homeTeamId: 1, awayTeamId: 2 },
      {
        sideA: { teamId: 1, teamDisplayName: "A" },
        sideB: { teamId: 2, teamDisplayName: "B" },
      },
    );
    const blocked = validateMatch(config, sides, [], { competitionLocked: false });
    expect(blocked.issues.some((i) => i.code === "COMPETITION_NOT_READY")).toBe(true);
  });

  it("history has configuration only", () => {
    const config = mapScoringMatchToConfiguration({
      id: 1,
      tournamentId: 1,
      matchLabel: "A",
      matchTypeId: "league",
    });
    const sides = mapScoringMatchToSides(
      { id: 1, tournamentId: 1, homeTeamId: 1, awayTeamId: 2 },
      {
        sideA: { teamId: 1, teamDisplayName: "A" },
        sideB: { teamId: 2, teamDisplayName: "B" },
      },
    );
    const validation = validateMatch(config, sides, [], {
      competitionLocked: true,
      competitionReadiness: "ready",
      ruleProfileId: "x",
    });
    const payload = buildMatchConfigurationHistoryPayload(
      config,
      validation,
      "2026-08-05T00:00:00.000Z",
    );
    expect(payload).not.toHaveProperty("score");
    expect(payload).not.toHaveProperty("officials");
    expect(isValidMatchLifecycleTransition("verified", "archived")).toBe(true);
  });
});
