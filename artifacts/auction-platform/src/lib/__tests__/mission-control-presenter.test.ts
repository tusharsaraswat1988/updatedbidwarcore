import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModuleSnapshot } from "../../components/tournament-hub/module-registry.ts";
import type { ModuleWorkspaceId } from "../../components/platform/module-workspace.ts";
import { getSportCapabilities } from "../sport-capabilities.ts";
import {
  buildMissionControlPresenterView,
  isModuleStepComplete,
  isRuntimeReady,
  ORGANISER_JOURNEY_ORDER,
} from "../mission-control-presenter.ts";

function snap(
  id: ModuleWorkspaceId,
  partial: Partial<ModuleSnapshot> = {},
): ModuleSnapshot {
  return {
    id,
    health: "healthy",
    errorCount: 0,
    warningCount: 0,
    validationIssues: [],
    recommendations: [],
    attentionItems: [],
    peekSummary: { title: id, lines: [] },
    entityCount: 0,
    lockedCount: 0,
    loading: false,
    ...partial,
  };
}

function allCompleteSnapshots(): Partial<Record<ModuleWorkspaceId, ModuleSnapshot>> {
  return {
    competition: snap("competition", { locked: true, lockedCount: 1, entityCount: 1 }),
    teams: snap("teams", { entityCount: 2, lockedCount: 2 }),
    fixtures: snap("fixtures", { entityCount: 1, lockedCount: 1 }),
    scheduling: snap("scheduling", { entityCount: 1, lockedCount: 1 }),
    matches: snap("matches", { entityCount: 2, lockedCount: 2 }),
    runtime: snap("runtime", { entityCount: 2, lockedCount: 2 }),
    live_operations: snap("live_operations", { entityCount: 1 }),
  };
}

describe("mission-control-presenter", () => {
  it("organiser setup journey never includes Runtime or Live", () => {
    assert.deepEqual(
      ORGANISER_JOURNEY_ORDER.map((s) => s.id),
      ["competition", "teams", "fixtures", "schedule", "matches"],
    );
    assert.deepEqual(
      ORGANISER_JOURNEY_ORDER.map((s) => s.label),
      ["Competition", "Teams & Players", "Fixtures", "Schedule", "Match Setup"],
    );
  });

  it("does not treat empty blockers as complete", () => {
    assert.equal(
      isModuleStepComplete(
        snap("teams", { entityCount: 3, lockedCount: 0, errorCount: 0 }),
      ),
      false,
    );
  });

  it("uses locked / lockedCount completeness signals", () => {
    assert.equal(
      isModuleStepComplete(snap("competition", { locked: true, entityCount: 1, lockedCount: 1 })),
      true,
    );
    assert.equal(
      isModuleStepComplete(snap("teams", { entityCount: 2, lockedCount: 2 })),
      true,
    );
    assert.equal(
      isModuleStepComplete(snap("teams", { entityCount: 2, lockedCount: 1 })),
      false,
    );
  });

  it("while loading: setup mode, Competition is Next", () => {
    const view = buildMissionControlPresenterView({
      tournamentId: 1,
      snapshots: {
        competition: snap("competition", { loading: true }),
      },
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "setup");
    assert.equal(view.journey[0]?.state, "next");
    assert.ok(view.journey.slice(1).every((s) => s.state === "upcoming"));
    assert.equal(view.nextStep.stepId, "competition");
    assert.equal(view.nextStep.ctaLabel, "Continue Setup");
    assert.equal(view.liveOps.available, false);
  });

  it("first incomplete setup step wins", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.fixtures = snap("fixtures", { entityCount: 2, lockedCount: 0 });
    const view = buildMissionControlPresenterView({
      tournamentId: 1,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "setup");
    assert.equal(view.nextStep.stepId, "fixtures");
    assert.equal(view.journey.find((s) => s.id === "fixtures")?.state, "next");
    assert.equal(view.journey.find((s) => s.id === "competition")?.state, "complete");
    assert.equal(view.journey.find((s) => s.id === "schedule")?.state, "upcoming");
  });

  it("Matches complete + Runtime not ready → setup Match Setup with Continue Setup", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.runtime = snap("runtime", { entityCount: 2, lockedCount: 0, errorCount: 1 });
    const view = buildMissionControlPresenterView({
      tournamentId: 1,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "setup");
    assert.equal(view.nextStep.stepId, "matches");
    assert.equal(view.nextStep.ctaLabel, "Continue Setup");
    assert.equal(view.liveOps.available, false);
    assert.equal(view.nextStep.continue.kind, "focus-module");
    if (view.nextStep.continue.kind === "focus-module") {
      assert.equal(view.nextStep.continue.moduleId, "runtime");
    }
    assert.equal(
      view.journey.some((s) => (s.id as string) === "runtime"),
      false,
    );
  });

  it("Matches + Runtime ready → ready mode with Open Scoring", () => {
    const view = buildMissionControlPresenterView({
      tournamentId: 42,
      snapshots: allCompleteSnapshots(),
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "ready");
    assert.deepEqual(view.journey, []);
    assert.equal(view.nextStep.stepId, "ready");
    assert.equal(view.nextStep.ctaLabel, "Open Scoring");
    assert.equal(view.liveOps.available, true);
    assert.ok(view.scoring.href?.includes("/badminton/matches"));
    assert.ok(view.liveOps.primaryHref?.includes("/badminton/control"));
  });

  it("Runtime blocked keeps Live unavailable", () => {
    assert.equal(
      isRuntimeReady(snap("runtime", { entityCount: 1, lockedCount: 1, errorCount: 2 })),
      false,
    );
  });

  it("badminton Hybrid Continue uses capability destinations, not cricket routes", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.teams = snap("teams", { entityCount: 1, lockedCount: 0 });
    const view = buildMissionControlPresenterView({
      tournamentId: 7,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.nextStep.continue.kind, "route");
    if (view.nextStep.continue.kind === "route") {
      assert.match(view.nextStep.continue.href, /\/badminton\/players$/);
      assert.doesNotMatch(view.nextStep.continue.href, /\/score\//);
    }
  });

  it("cricket Hybrid Continue uses cricket destinations without badminton paths", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.fixtures = snap("fixtures", { entityCount: 1, lockedCount: 0 });
    const view = buildMissionControlPresenterView({
      tournamentId: 9,
      snapshots,
      capabilities: getSportCapabilities("cricket"),
    });
    assert.equal(view.nextStep.continue.kind, "route");
    if (view.nextStep.continue.kind === "route") {
      assert.match(view.nextStep.continue.href, /\/score\/fixtures$/);
      assert.doesNotMatch(view.nextStep.continue.href, /badminton/);
    }
  });

  it("competition Continue focuses in-page module", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.competition = snap("competition", { locked: false, entityCount: 1, lockedCount: 0 });
    const view = buildMissionControlPresenterView({
      tournamentId: 1,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.deepEqual(view.nextStep.continue, {
      kind: "focus-module",
      moduleId: "competition",
    });
  });
});
