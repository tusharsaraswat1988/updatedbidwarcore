import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "../catalog/registry.ts";
import {
  buildFixtureAdvancementView,
  mapBadmintonDrawToConfiguration,
  mapBadmintonDrawToIdentity,
  mapBadmintonDrawToLifecycle,
  mapBadmintonFixturesToNodes,
  mapScoringDrawToIdentity,
  mapScoringFixturesToNodes,
} from "./bridges.ts";
import { encodeFixtureId, parseFixtureId } from "./ids.ts";
import {
  isValidFixtureLifecycleTransition,
  lifecycleAfterFixtureLock,
} from "./lifecycle.ts";
import { buildFixtureConfigurationHistoryPayload } from "./plan.ts";
import { validateFixture } from "./validation.ts";

const badmintonDraw = {
  id: 7,
  tournamentId: 1,
  roundName: "Main Draw",
  totalRounds: 3,
  drawKind: "generated",
  fixtureTypeId: "knockout",
  configurationLocked: false,
  metaJson: {
    platformFixture: {
      thirdPlaceMatch: true,
      legs: 1,
    },
  },
};

describe("Fixture Identity", () => {
  it("is independent of matches, schedule, courts, time, results", () => {
    const identity = mapBadmintonDrawToIdentity(badmintonDraw);
    expect(identity).toEqual({
      id: "bd-7",
      tournamentId: 1,
      typeId: "knockout",
      source: "badminton",
    });
    expect(identity).not.toHaveProperty("scheduledAt");
    expect(identity).not.toHaveProperty("courtId");
    expect(identity).not.toHaveProperty("scoringMatchId");
    expect(identity).not.toHaveProperty("results");
  });

  it("configuration excludes execution fields", () => {
    const config = mapBadmintonDrawToConfiguration(badmintonDraw);
    expect(config.name).toBe("Main Draw");
    expect(config.thirdPlaceMatch).toBe(true);
    expect(config).not.toHaveProperty("status");
    expect(config).not.toHaveProperty("court");
    expect(config).not.toHaveProperty("scheduledAt");
    expect(config).not.toHaveProperty("officials");
    expect(config).not.toHaveProperty("matches");
  });

  it("lifecycle keeps Generated distinct from Ready", () => {
    const generated = mapBadmintonDrawToLifecycle(badmintonDraw, true);
    expect(generated.status).toBe("generated");
    expect(lifecycleAfterFixtureLock("validated")).toBe("ready");
    expect(lifecycleAfterFixtureLock("generated")).toBe("ready");
    expect(isValidFixtureLifecycleTransition("generated", "ready")).toBe(false);
    expect(isValidFixtureLifecycleTransition("locked", "ready")).toBe(true);
  });
});

describe("Fixture Nodes and Match Blueprints", () => {
  it("maps contests, byes, and placeholders — not runtime matches", () => {
    const nodes = mapBadmintonFixturesToNodes([
      {
        id: 1,
        drawId: 7,
        slotNumber: 1,
        registrationAId: 10,
        registrationBId: 11,
        winnerAdvancesTo: 3,
      },
      {
        id: 2,
        drawId: 7,
        slotNumber: 2,
        registrationAId: 12,
        registrationBId: null,
      },
      {
        id: 3,
        drawId: 7,
        slotNumber: 3,
        registrationAId: null,
        registrationBId: null,
        loserAdvancesTo: null,
      },
    ]);
    expect(nodes[0]?.kindId).toBe("contest");
    expect(nodes[0]?.blueprint?.blueprintId).toBe("bp-bf-1");
    expect(nodes[0]?.blueprint).not.toHaveProperty("courtId");
    expect(nodes[0]?.blueprint).not.toHaveProperty("scheduledAt");
    expect(nodes[1]?.kindId).toBe("bye");
    expect(nodes[1]?.blueprint).toBeNull();
    expect(nodes[2]?.kindId).toBe("placeholder");
    expect(nodes[0]?.advancements.some((a) => a.ruleId === "winner_advances")).toBe(true);
  });

  it("advancement view uses catalog rule ids", () => {
    const nodes = mapBadmintonFixturesToNodes([
      {
        id: 1,
        drawId: 7,
        registrationAId: 1,
        registrationBId: 2,
        winnerAdvancesTo: 2,
      },
      { id: 2, drawId: 7, registrationAId: null, registrationBId: null },
    ]);
    const view = buildFixtureAdvancementView("bd-7", 1, nodes);
    expect(view.rules[0]?.ruleId).toBe("winner_advances");
    expect(CatalogRegistry.getAdvancementRule("winner_advances")).toBeTruthy();
  });
});

describe("Cricket bridge", () => {
  it("maps scoring draw identity without elevating cricket model", () => {
    const identity = mapScoringDrawToIdentity({
      id: 9,
      tournamentId: 2,
      name: "League",
      format: "round_robin",
    });
    expect(identity.id).toBe("sd-9");
    expect(identity.source).toBe("cricket");
    expect(identity.typeId).toBe("round_robin");
  });

  it("scoring fixtures become nodes/blueprints, not matches", () => {
    const nodes = mapScoringFixturesToNodes([
      {
        id: 5,
        drawId: 9,
        homeTeamId: 1,
        awayTeamId: 2,
        roundName: "RR",
        fixtureNumber: 1,
      },
    ]);
    expect(nodes[0]?.blueprint?.sides).toHaveLength(2);
    expect(JSON.stringify(nodes)).not.toMatch(/scoring_matches|homeTeamId/);
  });
});

describe("Fixture Validation", () => {
  it("blocks ready when competition not locked", () => {
    const config = mapBadmintonDrawToConfiguration(badmintonDraw);
    const nodes = mapBadmintonFixturesToNodes([
      {
        id: 1,
        drawId: 7,
        registrationAId: 1,
        registrationBId: 2,
      },
    ]);
    const result = validateFixture(config, nodes, { competitionLocked: false });
    expect(result.issues.some((i) => i.code === "COMPETITION_NOT_READY")).toBe(true);
  });

  it("requires structure before ready", () => {
    const config = mapBadmintonDrawToConfiguration(badmintonDraw);
    const result = validateFixture(config, [], {
      competitionLocked: true,
      competitionReadiness: "ready",
      ruleProfileId: "x",
    });
    expect(result.issues.some((i) => i.code === "FIXTURE_STRUCTURE_EMPTY")).toBe(true);
  });

  it("history stores config + nodes only — never schedules/matches/results", () => {
    const config = mapBadmintonDrawToConfiguration(badmintonDraw);
    const nodes = mapBadmintonFixturesToNodes([
      {
        id: 1,
        drawId: 7,
        registrationAId: 1,
        registrationBId: 2,
      },
    ]);
    const validation = validateFixture(config, nodes, {
      competitionLocked: true,
      competitionReadiness: "ready",
      ruleProfileId: "x",
    });
    const payload = buildFixtureConfigurationHistoryPayload(
      config,
      nodes,
      validation,
      "2026-08-05T00:00:00.000Z",
    );
    expect(payload.nodes).toHaveLength(1);
    expect(payload).not.toHaveProperty("schedules");
    expect(payload).not.toHaveProperty("matches");
    expect(payload).not.toHaveProperty("results");
    expect(payload).not.toHaveProperty("standings");
  });
});

describe("Fixture catalogs and ids", () => {
  it("includes fixture types and advancement rules", () => {
    expect(CatalogRegistry.listFixtureTypes().some((t) => t.id === "custom")).toBe(true);
    expect(CatalogRegistry.getAdvancementRule("group_qualification")).toBeTruthy();
    expect(CatalogRegistry.getFixtureNodeKind("placeholder")).toBeTruthy();
  });

  it("encodes and parses product fixture ids", () => {
    expect(encodeFixtureId("badminton", 3)).toBe("bd-3");
    expect(parseFixtureId("sd-12")).toEqual({ source: "cricket", runtimeId: 12 });
    expect(parseFixtureId("nope")).toBeNull();
  });
});
