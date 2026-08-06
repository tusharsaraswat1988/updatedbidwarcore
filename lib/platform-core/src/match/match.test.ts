import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "../catalog/registry.ts";
import {
  mapScoringMatchToConfiguration,
  mapScoringMatchToIdentity,
  mapScoringMatchToLifecycle,
  mapScoringMatchToOfficials,
  mapScoringMatchToSides,
} from "./bridges.ts";
import { isValidMatchLifecycleTransition, lifecycleAfterMatchLock } from "./lifecycle.ts";
import { buildMatchConfigurationHistoryPayload } from "./plan.ts";
import { validateMatch } from "./validation.ts";

const baseRow = {
  id: 42,
  tournamentId: 1,
  matchLabel: "Semi Final",
  displayName: "SF-1",
  matchTypeId: "knockout",
  venue: "Court 1",
  surface: "indoor",
  scheduledAt: "2026-08-10T14:30:00.000Z",
  visibility: "tournament",
  homeTeamId: 10,
  awayTeamId: 11,
  homeSideJson: { teamId: 10, displayName: "Kings" },
  awaySideJson: { teamId: 11, displayName: "Queens" },
  officialsJson: { scorers: [5], matchReferee: 7 },
};

describe("Match Identity", () => {
  it("is independent of sides and schedule", () => {
    const identity = mapScoringMatchToIdentity(baseRow);
    expect(identity).toEqual({
      id: "42",
      tournamentId: 1,
      typeId: "knockout",
    });
    const emptySides = mapScoringMatchToSides({
      ...baseRow,
      homeTeamId: 0,
      awayTeamId: 0,
      homeSideJson: null,
      awaySideJson: null,
    });
    expect(emptySides.every((s) => s.subject == null)).toBe(true);
    expect(mapScoringMatchToIdentity(baseRow)).toEqual(identity);
  });

  it("configuration excludes lifecycle and officials", () => {
    const config = mapScoringMatchToConfiguration(baseRow);
    expect(config.name).toBe("Semi Final");
    expect(config.scheduledDate).toBe("2026-08-10");
    expect(config.scheduledTime).toBe("14:30");
    expect(config).not.toHaveProperty("status");
    expect(config).not.toHaveProperty("lifecycleStatus");
    expect(config).not.toHaveProperty("officials");
    expect(config).not.toHaveProperty("homeTeamId");
  });

  it("lifecycle is a separate module", () => {
    const lifecycle = mapScoringMatchToLifecycle({
      ...baseRow,
      lifecycleStatus: "scheduled",
      configurationLocked: false,
    });
    expect(lifecycle.status).toBe("scheduled");
    expect(lifecycle.locked).toBe(false);
  });
});

describe("Match Sides", () => {
  it("is first-class: Match → Side → Team|Participant, never home/away", () => {
    const sides = mapScoringMatchToSides(baseRow, {
      sideA: { teamId: 10, teamDisplayName: "Kings" },
      sideB: { teamId: 11, teamDisplayName: "Queens" },
    });
    expect(sides.map((s) => s.sideId)).toEqual(["side_a", "side_b"]);
    expect(sides[0]?.subject?.kind).toBe("team");
    expect(sides[0]?.roles).toContain("competitor");
    expect(JSON.stringify(sides)).not.toMatch(/home|away/i);
    // Identity has no teams/participants — sides own those relationships.
    const identity = mapScoringMatchToIdentity(baseRow);
    expect(identity).not.toHaveProperty("teams");
    expect(identity).not.toHaveProperty("participants");
    expect(identity).not.toHaveProperty("homeTeamId");
  });
});

describe("Match Officials", () => {
  it("maps officials separately from sides", () => {
    const officials = mapScoringMatchToOfficials(baseRow);
    expect(officials.some((o) => o.roleId === "scorer")).toBe(true);
    expect(officials.some((o) => o.roleId === "referee")).toBe(true);
  });
});

describe("Match Validation", () => {
  it("blocks ready when competition not locked", () => {
    const config = mapScoringMatchToConfiguration(baseRow);
    const sides = mapScoringMatchToSides(baseRow, {
      sideA: { teamId: 10, teamDisplayName: "Kings" },
      sideB: { teamId: 11, teamDisplayName: "Queens" },
    });
    const result = validateMatch(config, sides, [], {
      competitionLocked: false,
    });
    expect(result.issues.some((i) => i.code === "COMPETITION_NOT_READY")).toBe(true);
  });

  it("passes when competition locked and sides filled", () => {
    const config = mapScoringMatchToConfiguration(baseRow);
    const sides = mapScoringMatchToSides(baseRow, {
      sideA: { teamId: 10, teamDisplayName: "Kings" },
      sideB: { teamId: 11, teamDisplayName: "Queens" },
    });
    const result = validateMatch(config, sides, [], {
      competitionLocked: true,
      competitionReadiness: "ready",
      ruleProfileId: "cricket.outdoor.standard",
    });
    expect(result.errorCount).toBe(0);
  });

  it("history payload has no score or officials", () => {
    const config = mapScoringMatchToConfiguration(baseRow);
    const sides = mapScoringMatchToSides(baseRow, {
      sideA: { teamId: 10, teamDisplayName: "A" },
      sideB: { teamId: 11, teamDisplayName: "B" },
    });
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
    expect(payload).not.toHaveProperty("sides");
    expect(payload).not.toHaveProperty("officials");
    expect(payload).not.toHaveProperty("score");
    expect(payload).not.toHaveProperty("events");
  });
});

describe("Match catalogs", () => {
  it("includes custom type and rejects home/away roles", () => {
    expect(CatalogRegistry.listMatchTypes().some((t) => t.id === "custom")).toBe(true);
    expect(CatalogRegistry.getMatchRole("home")).toBeUndefined();
    expect(CatalogRegistry.getMatchRole("away")).toBeUndefined();
    expect(CatalogRegistry.getMatchRole("competitor")?.scope).toBe("side");
  });
});

describe("Match Lifecycle", () => {
  it("archives only after verified", () => {
    expect(isValidMatchLifecycleTransition("completed", "archived")).toBe(false);
    expect(isValidMatchLifecycleTransition("verified", "archived")).toBe(true);
    expect(lifecycleAfterMatchLock("ready")).toBe("locked");
  });
});
