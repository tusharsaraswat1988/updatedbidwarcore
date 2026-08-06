import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "../catalog/registry.ts";
import {
  mapBadmintonFixturesToSchedule,
  mapDrawToSchedulingConfiguration,
  mapDrawToSchedulingIdentity,
  mapDrawToSchedulingLifecycle,
  mapScoringFixturesToSchedule,
} from "./bridges.ts";
import { encodeSchedulingId, parseSchedulingId } from "./ids.ts";
import {
  isValidSchedulingLifecycleTransition,
  lifecycleAfterSchedulingLock,
} from "./lifecycle.ts";
import { buildSchedulingConfigurationHistoryPayload } from "./plan.ts";
import { validateScheduling } from "./validation.ts";

const drawRow = {
  id: 7,
  tournamentId: 1,
  source: "badminton" as const,
  schedulingStrategyId: "manual",
  schedulingConfigurationLocked: false,
  metaOrConfigJson: {
    platformScheduling: {
      workingDays: ["mon", "tue"],
      operatingHours: { start: "09:00", end: "18:00" },
      bufferMinutes: 15,
      parallelLimit: 4,
    },
  },
};

describe("Scheduling Identity", () => {
  it("is independent of matches, resources, dates, slots, conflicts", () => {
    const identity = mapDrawToSchedulingIdentity(drawRow, "knockout");
    expect(identity).toEqual({
      id: "bd-7",
      tournamentId: 1,
      planKindId: "knockout",
      source: "badminton",
      fixtureId: "bd-7",
    });
    expect(identity).not.toHaveProperty("courtId");
    expect(identity).not.toHaveProperty("scheduledAt");
    expect(identity).not.toHaveProperty("conflicts");
  });

  it("configuration excludes slots, resources, matches, conflicts", () => {
    const config = mapDrawToSchedulingConfiguration(drawRow);
    expect(config.strategyId).toBe("manual");
    expect(config.bufferMinutes).toBe(15);
    expect(config).not.toHaveProperty("slots");
    expect(config).not.toHaveProperty("resources");
    expect(config).not.toHaveProperty("matches");
    expect(config).not.toHaveProperty("conflicts");
  });

  it("keeps Generated distinct from Ready", () => {
    const generated = mapDrawToSchedulingLifecycle(drawRow, true);
    expect(generated.status).toBe("generated");
    expect(lifecycleAfterSchedulingLock("validated")).toBe("ready");
    expect(isValidSchedulingLifecycleTransition("generated", "ready")).toBe(false);
    expect(isValidSchedulingLifecycleTransition("locked", "ready")).toBe(true);
  });
});

describe("Schedule Slots and Resource Assignments", () => {
  it("maps slots independently of resource assignment", () => {
    const { slots, assignments } = mapBadmintonFixturesToSchedule(
      [
        {
          id: 1,
          drawId: 7,
          courtId: 3,
          scheduledAt: "2026-08-10T10:00:00.000Z",
          slotNumber: 1,
        },
        { id: 2, drawId: 7, courtId: null, scheduledAt: null },
      ],
      [{ id: 3, name: "Court A" }],
    );
    expect(slots[0]?.slotId).toBe("slot-bf-1");
    expect(slots[0]?.blueprintId).toBe("bp-bf-1");
    expect(slots[0]).not.toHaveProperty("courtId");
    expect(assignments[0]?.resourceKindId).toBe("court");
    expect(assignments[0]?.slotId).toBe("slot-bf-1");
    expect(slots[1]?.status).toBe("available");
    expect(assignments.filter((a) => a.slotId === "slot-bf-2")).toHaveLength(0);
  });

  it("maps cricket venues as ground resources", () => {
    const { slots, assignments } = mapScoringFixturesToSchedule(
      [
        {
          id: 5,
          drawId: 9,
          venueId: 2,
          scheduledAt: "2026-08-11T14:00:00.000Z",
        },
      ],
      [{ id: 2, name: "Main Ground" }],
    );
    expect(slots[0]?.blueprintId).toBe("bp-sf-5");
    expect(assignments[0]?.resourceKindId).toBe("ground");
    expect(assignments[0]?.resourceDisplayName).toBe("Main Ground");
  });
});

describe("Scheduling Validation", () => {
  it("requires competition and fixture ready", () => {
    const config = mapDrawToSchedulingConfiguration(drawRow);
    const { slots, assignments } = mapBadmintonFixturesToSchedule(
      [{ id: 1, drawId: 7, courtId: 1, scheduledAt: "2026-08-10T10:00:00.000Z" }],
      [{ id: 1, name: "C1" }],
    );
    const blocked = validateScheduling(config, slots, assignments, {
      competitionLocked: false,
    }, { fixtureLocked: true, fixtureReady: true });
    expect(blocked.issues.some((i) => i.code === "COMPETITION_NOT_READY")).toBe(true);

    const fixtureBlocked = validateScheduling(
      config,
      slots,
      assignments,
      { competitionLocked: true, competitionReadiness: "ready" },
      { fixtureLocked: false, fixtureReady: false },
    );
    expect(fixtureBlocked.issues.some((i) => i.code === "FIXTURE_NOT_READY")).toBe(true);
  });

  it("history stores config + slots + assignments only", () => {
    const config = mapDrawToSchedulingConfiguration(drawRow);
    const { slots, assignments } = mapBadmintonFixturesToSchedule(
      [{ id: 1, drawId: 7, courtId: 1, scheduledAt: "2026-08-10T10:00:00.000Z" }],
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
    expect(payload).not.toHaveProperty("results");
    expect(payload).not.toHaveProperty("actualStart");
  });
});

describe("Scheduling catalogs and ids", () => {
  it("exposes resource kinds and strategies without algorithms", () => {
    expect(CatalogRegistry.getResourceKind("court")).toBeTruthy();
    expect(CatalogRegistry.getSchedulingStrategy("manual")).toBeTruthy();
    expect(CatalogRegistry.listSchedulingStrategies().some((s) => s.id === "parallel")).toBe(
      true,
    );
  });

  it("aligns scheduling id with fixture id", () => {
    expect(encodeSchedulingId("cricket", 9)).toBe("sd-9");
    expect(parseSchedulingId("bd-3")).toEqual({ source: "badminton", runtimeId: 3 });
  });
});
