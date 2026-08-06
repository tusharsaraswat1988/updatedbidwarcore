import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import {
  buildFixtureConfigurationHistoryPayload,
  encodeFixtureId,
  isValidFixtureLifecycleTransition,
  lifecycleAfterFixtureLock,
  mapBadmintonDrawToConfiguration,
  mapBadmintonDrawToIdentity,
  mapBadmintonFixturesToNodes,
  mapScoringDrawToIdentity,
  parseFixtureId,
  validateFixture,
} from "@workspace/platform-core/fixture";

describe("EPIC-06 fixture foundation", () => {
  it("exposes fixture / node / advancement catalogs", () => {
    expect(CatalogRegistry.listFixtureTypes().some((t) => t.id === "knockout")).toBe(true);
    expect(CatalogRegistry.getFixtureNodeKind("bye")).toBeTruthy();
    expect(CatalogRegistry.getAdvancementRule("winner_advances")).toBeTruthy();
  });

  it("keeps identity independent of execution", () => {
    const identity = mapBadmintonDrawToIdentity({
      id: 4,
      tournamentId: 1,
      roundName: "QF",
      drawKind: "generated",
      fixtureTypeId: "knockout",
    });
    expect(identity.id).toBe("bd-4");
    expect(identity).not.toHaveProperty("courtId");
    expect(identity).not.toHaveProperty("scheduledAt");
    expect(parseFixtureId(encodeFixtureId("cricket", 8))).toEqual({
      source: "cricket",
      runtimeId: 8,
    });
  });

  it("configuration omits schedule and matches", () => {
    const config = mapBadmintonDrawToConfiguration({
      id: 1,
      tournamentId: 1,
      roundName: "Main",
      fixtureTypeId: "league",
    });
    expect(config).not.toHaveProperty("scheduledAt");
    expect(config).not.toHaveProperty("court");
    expect(config).not.toHaveProperty("matches");
    expect(Object.keys(config)).not.toContain("lifecycleStatus");
  });

  it("nodes carry blueprints, not runtime matches", () => {
    const nodes = mapBadmintonFixturesToNodes([
      {
        id: 1,
        drawId: 1,
        registrationAId: 10,
        registrationBId: 11,
        winnerAdvancesTo: 2,
      },
      { id: 2, drawId: 1, registrationAId: null, registrationBId: null },
    ]);
    expect(nodes[0]?.blueprint?.blueprintId).toBe("bp-bf-1");
    expect(nodes[0]?.advancements[0]?.ruleId).toBe("winner_advances");
    expect(JSON.stringify(nodes)).not.toMatch(/scoringMatchId|courtId|scheduledAt/);
  });

  it("requires competition locked and structure before ready", () => {
    const config = mapBadmintonDrawToConfiguration({
      id: 1,
      tournamentId: 1,
      roundName: "Main",
      fixtureTypeId: "knockout",
    });
    const nodes = mapBadmintonFixturesToNodes([
      { id: 1, drawId: 1, registrationAId: 1, registrationBId: 2 },
    ]);
    const blocked = validateFixture(config, nodes, { competitionLocked: false });
    expect(blocked.issues.some((i) => i.code === "COMPETITION_NOT_READY")).toBe(true);
    const empty = validateFixture(config, [], {
      competitionLocked: true,
      competitionReadiness: "ready",
      ruleProfileId: "x",
    });
    expect(empty.issues.some((i) => i.code === "FIXTURE_STRUCTURE_EMPTY")).toBe(true);
  });

  it("history includes nodes and excludes schedules/results", () => {
    const config = mapBadmintonDrawToConfiguration({
      id: 1,
      tournamentId: 1,
      roundName: "Main",
      fixtureTypeId: "knockout",
    });
    const nodes = mapBadmintonFixturesToNodes([
      { id: 1, drawId: 1, registrationAId: 1, registrationBId: 2 },
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
    expect(payload).not.toHaveProperty("results");
    expect(payload).not.toHaveProperty("standings");
  });

  it("keeps Generated distinct from Ready; lock ends at Ready", () => {
    expect(isValidFixtureLifecycleTransition("generated", "ready")).toBe(false);
    expect(lifecycleAfterFixtureLock("validated")).toBe("ready");
    expect(mapScoringDrawToIdentity({
      id: 2,
      tournamentId: 1,
      name: "RR",
      format: "round_robin",
    }).source).toBe("cricket");
  });
});
