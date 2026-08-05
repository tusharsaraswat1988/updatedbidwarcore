import { describe, expect, it } from "vitest";
import {
  buildRuntimeContextFromSnapshot,
  contextHasForbiddenExecutionState,
} from "./context.ts";
import {
  isPhaseAllowedForLifecycle,
  isValidExecutionPhaseTransition,
} from "./phase.ts";
import { mapRowToRuntimeIdentity, mapRowToRuntimeListItem } from "./bridges.ts";
import {
  buildRuntimeSnapshot,
  buildSnapshotReferences,
} from "./snapshot.ts";
import { validateRuntimeMatch } from "./validation.ts";
import { RUNTIME_SNAPSHOT_SCHEMA_VERSION } from "./types.ts";

describe("Runtime Match Identity", () => {
  it("reuses EPIC-05 Match Identity — no second id", () => {
    const identity = mapRowToRuntimeIdentity({
      id: 42,
      tournamentId: 1,
      matchTypeId: "knockout",
      executionPhase: "preparing",
      currentRuntimeVersion: null,
    });
    expect(identity).toEqual({ id: "42", tournamentId: 1, typeId: "knockout" });
    const item = mapRowToRuntimeListItem({
      id: 42,
      tournamentId: 1,
      matchTypeId: "knockout",
      lifecycleStatus: "ready",
      executionPhase: "preparing",
      currentRuntimeVersion: 1,
    });
    expect(item.identity.id).toBe("42");
    expect(item.currentRuntimeVersion).toBe(1);
  });
});

describe("Runtime Snapshot", () => {
  it("is self-describing and reference-only", () => {
    const refs = buildSnapshotReferences({
      matchId: "42",
      ruleProfileId: "rp-1",
      ruleProfileVersion: "1.0.0",
      presentationProfileId: "pp-1",
      presentationProfileVersion: 1,
      competitionId: "1",
      competitionVersion: 1,
      fixtureId: "bd-3",
      fixtureVersion: 1,
      schedulingPlanId: "bd-3",
      schedulingVersion: 1,
      scheduleSlotId: "slot:9",
      sideIds: [{ id: "side_a" }, { id: "side_b" }],
      matchConfigurationVersion: 1,
    });
    const snapshot = buildRuntimeSnapshot({
      matchId: "42",
      tournamentId: 1,
      snapshotVersion: 1,
      createdAt: "2026-08-05T12:00:00.000Z",
      createdBy: "organizer:1",
      references: refs,
    });
    expect(snapshot.snapshotSchemaVersion).toBe(RUNTIME_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.createdAt).toBeTruthy();
    expect(snapshot.references.ruleProfile?.version).toBe("1.0.0");
    expect(snapshot.references).not.toHaveProperty("ruleProfileConfig");
  });
});

describe("Runtime Context", () => {
  it("holds bindings not execution state", () => {
    const snapshot = buildRuntimeSnapshot({
      matchId: "42",
      tournamentId: 1,
      snapshotVersion: 1,
      createdAt: "2026-08-05T12:00:00.000Z",
      createdBy: null,
      references: buildSnapshotReferences({
        matchId: "42",
        ruleProfileId: "rp-1",
        ruleProfileVersion: 1,
        matchConfigurationVersion: 1,
      }),
    });
    const context = buildRuntimeContextFromSnapshot(snapshot, { note: "prep" });
    expect(context.ruleBinding?.id).toBe("rp-1");
    expect(context.snapshotVersion).toBe(1);
    expect(contextHasForbiddenExecutionState(context)).toBe(false);
    expect(
      contextHasForbiddenExecutionState({
        ...context,
        executionMetadata: { score: 10 },
      }),
    ).toBe(true);
  });
});

describe("Execution Phase", () => {
  it("is linear and subordinate to Match Lifecycle", () => {
    expect(isValidExecutionPhaseTransition("preparing", "resources_ready")).toBe(true);
    expect(isValidExecutionPhaseTransition("preparing", "running")).toBe(false);
    expect(isValidExecutionPhaseTransition("running", "paused")).toBe(true);
    expect(isValidExecutionPhaseTransition("paused", "running")).toBe(true);
    expect(isPhaseAllowedForLifecycle("preparing", "ready")).toBe(true);
    expect(isPhaseAllowedForLifecycle("running", "ready")).toBe(false);
    expect(isPhaseAllowedForLifecycle("running", "live")).toBe(true);
  });
});

describe("Runtime Validation", () => {
  it("reuses ValidationIssue severities and blocks when not ready", () => {
    const result = validateRuntimeMatch(
      null,
      {
        competitionLocked: false,
        ruleProfileId: null,
        presentationProfileId: null,
      },
      { fixtureReady: false, fixtureLocked: false },
      { schedulingReady: false, schedulingLocked: false },
      { configurationLocked: false },
      null,
    );
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.readiness).toBe("not_ready");
    expect(result.issues.every((i) => ["ERROR", "WARNING", "INFO"].includes(i.severity))).toBe(
      true,
    );
  });

  it("passes when upstream locked and snapshot complete", () => {
    const refs = buildSnapshotReferences({
      matchId: "42",
      ruleProfileId: "rp",
      ruleProfileVersion: 1,
      presentationProfileId: "pp",
      presentationProfileVersion: 1,
      competitionId: "1",
      competitionVersion: 1,
      fixtureId: "bd-1",
      fixtureVersion: 1,
      schedulingPlanId: "bd-1",
      schedulingVersion: 1,
      sideIds: [{ id: "side_a" }, { id: "side_b" }],
      matchConfigurationVersion: 1,
    });
    const snapshot = buildRuntimeSnapshot({
      matchId: "42",
      tournamentId: 1,
      snapshotVersion: 1,
      createdAt: "2026-08-05T12:00:00.000Z",
      createdBy: "admin",
      references: refs,
    });
    const result = validateRuntimeMatch(
      refs,
      {
        competitionLocked: true,
        competitionReadiness: "ready",
        ruleProfileId: "rp",
        ruleProfileVersion: 1,
        presentationProfileId: "pp",
        presentationProfileVersion: 1,
      },
      { fixtureReady: true, fixtureLocked: true },
      { schedulingReady: true, schedulingLocked: true, resourceAssignmentLocked: true },
      { configurationLocked: true, configurationVersion: 1 },
      snapshot,
    );
    expect(result.errorCount).toBe(0);
    expect(result.readiness).toBe("ready");
  });
});
