import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import {
  buildSchedulingConfigurationHistoryPayload,
  encodeSchedulingId,
  isValidSchedulingLifecycleTransition,
  lifecycleAfterSchedulingLock,
  mapBadmintonFixturesToSchedule,
  mapDrawToSchedulingConfiguration,
  mapDrawToSchedulingIdentity,
  parseSchedulingId,
  validateScheduling,
} from "@workspace/platform-core/scheduling";

describe("EPIC-07 scheduling foundation", () => {
  it("exposes resource and strategy catalogs", () => {
    expect(CatalogRegistry.getResourceKind("court")).toBeTruthy();
    expect(CatalogRegistry.getSchedulingStrategy("manual")).toBeTruthy();
  });

  it("keeps identity independent of execution fields", () => {
    const identity = mapDrawToSchedulingIdentity(
      {
        id: 4,
        tournamentId: 1,
        source: "badminton",
        schedulingStrategyId: "sequential",
      },
      "knockout",
    );
    expect(identity.id).toBe("bd-4");
    expect(identity.fixtureId).toBe("bd-4");
    expect(identity).not.toHaveProperty("scheduledAt");
    expect(parseSchedulingId(encodeSchedulingId("cricket", 8))).toEqual({
      source: "cricket",
      runtimeId: 8,
    });
  });

  it("configuration omits slots and resources", () => {
    const config = mapDrawToSchedulingConfiguration({
      id: 1,
      tournamentId: 1,
      source: "badminton",
      schedulingStrategyId: "manual",
    });
    expect(config).not.toHaveProperty("slots");
    expect(config).not.toHaveProperty("assignments");
    expect(Object.keys(config)).not.toContain("lifecycleStatus");
  });

  it("slots and assignments are separate", () => {
    const { slots, assignments } = mapBadmintonFixturesToSchedule(
      [
        {
          id: 1,
          drawId: 1,
          courtId: 2,
          scheduledAt: "2026-08-10T09:00:00.000Z",
        },
      ],
      [{ id: 2, name: "Court 2" }],
    );
    expect(slots[0]?.blueprintId).toBe("bp-bf-1");
    expect(assignments[0]?.resourceKindId).toBe("court");
    expect(JSON.stringify(slots)).not.toMatch(/courtId|scoringMatchId/);
  });

  it("requires competition and fixture ready", () => {
    const config = mapDrawToSchedulingConfiguration({
      id: 1,
      tournamentId: 1,
      source: "badminton",
      schedulingStrategyId: "manual",
    });
    const { slots, assignments } = mapBadmintonFixturesToSchedule(
      [{ id: 1, drawId: 1, courtId: 1, scheduledAt: "2026-08-10T09:00:00.000Z" }],
      [{ id: 1, name: "C1" }],
    );
    const blocked = validateScheduling(
      config,
      slots,
      assignments,
      { competitionLocked: false },
      { fixtureLocked: true, fixtureReady: true },
    );
    expect(blocked.issues.some((i) => i.code === "COMPETITION_NOT_READY")).toBe(true);
  });

  it("history includes slots and assignments only", () => {
    const config = mapDrawToSchedulingConfiguration({
      id: 1,
      tournamentId: 1,
      source: "badminton",
      schedulingStrategyId: "manual",
    });
    const { slots, assignments } = mapBadmintonFixturesToSchedule(
      [{ id: 1, drawId: 1, courtId: 1, scheduledAt: "2026-08-10T09:00:00.000Z" }],
      [{ id: 1, name: "C1" }],
    );
    const validation = validateScheduling(
      config,
      slots,
      assignments,
      { competitionLocked: true, competitionReadiness: "ready" },
      { fixtureLocked: true, fixtureReady: true },
    );
    const payload = buildSchedulingConfigurationHistoryPayload(
      config,
      slots,
      assignments,
      validation,
      "2026-08-05T00:00:00.000Z",
    );
    expect(payload.slots).toHaveLength(1);
    expect(payload.assignments).toHaveLength(1);
    expect(payload).not.toHaveProperty("matches");
    expect(payload).not.toHaveProperty("actualStart");
  });

  it("keeps Generated distinct from Ready", () => {
    expect(isValidSchedulingLifecycleTransition("generated", "ready")).toBe(false);
    expect(lifecycleAfterSchedulingLock("validated")).toBe("ready");
  });
});
