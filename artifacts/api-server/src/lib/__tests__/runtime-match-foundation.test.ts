import { describe, expect, it } from "vitest";
import {
  buildRuntimeContextFromSnapshot,
  buildRuntimeSnapshot,
  buildSnapshotReferences,
  isPhaseAllowedForLifecycle,
  isValidExecutionPhaseTransition,
  mapRowToRuntimeIdentity,
  validateRuntimeMatch,
  RUNTIME_SNAPSHOT_SCHEMA_VERSION,
} from "@workspace/platform-core/runtime-match";

describe("EPIC-08 runtime match foundation", () => {
  it("reuses Match Identity — no second runtime id", () => {
    const identity = mapRowToRuntimeIdentity({
      id: 15,
      tournamentId: 2,
      matchTypeId: "league",
    });
    expect(identity).toEqual({ id: "15", tournamentId: 2, typeId: "league" });
  });

  it("snapshot is self-describing and reference-only", () => {
    const snapshot = buildRuntimeSnapshot({
      matchId: "15",
      tournamentId: 2,
      snapshotVersion: 3,
      createdAt: "2026-08-05T10:00:00.000Z",
      createdBy: "organizer:1",
      references: buildSnapshotReferences({
        matchId: "15",
        ruleProfileId: "rp",
        ruleProfileVersion: "2.0.0",
        matchConfigurationVersion: 1,
        sideIds: [{ id: "side_a" }, { id: "side_b" }],
      }),
    });
    expect(snapshot.snapshotSchemaVersion).toBe(RUNTIME_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.references.ruleProfile?.version).toBe("2.0.0");
    expect(JSON.stringify(snapshot)).not.toContain("overs");
  });

  it("context excludes scoring state", () => {
    const snapshot = buildRuntimeSnapshot({
      matchId: "1",
      tournamentId: 1,
      snapshotVersion: 1,
      createdAt: "2026-08-05T10:00:00.000Z",
      createdBy: null,
      references: buildSnapshotReferences({
        matchId: "1",
        matchConfigurationVersion: 1,
      }),
    });
    const context = buildRuntimeContextFromSnapshot(snapshot);
    expect(context).not.toHaveProperty("score");
    expect(Object.keys(context)).not.toContain("timer");
  });

  it("execution phase is linear and lifecycle-subordinate", () => {
    expect(isValidExecutionPhaseTransition("resources_ready", "officials_ready")).toBe(true);
    expect(isValidExecutionPhaseTransition("preparing", "finished")).toBe(false);
    expect(isPhaseAllowedForLifecycle("countdown", "locked")).toBe(true);
    expect(isPhaseAllowedForLifecycle("running", "locked")).toBe(false);
  });

  it("validation blocks without locked match configuration", () => {
    const result = validateRuntimeMatch(
      null,
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
      { configurationLocked: false },
      null,
    );
    expect(result.issues.some((i) => i.code === "MATCH_CONFIGURATION_NOT_LOCKED")).toBe(true);
    expect(result.readiness).toBe("not_ready");
  });
});
