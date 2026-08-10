import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModuleSnapshot } from "../../components/tournament-hub/module-registry.ts";
import type { ModuleWorkspaceId } from "../../components/platform/module-workspace.ts";
import { getSportCapabilities } from "../sport-capabilities.ts";
import {
  buildMissionControlPresenterView,
  isFreshTournamentSetup,
  isModuleStepComplete,
  isRuntimeReady,
  ORGANISER_JOURNEY_ORDER,
} from "../mission-control-presenter.ts";
import {
  assertNoForbiddenOrganiserTerms,
  translateOrganiserIssue,
} from "../tournament-dashboard-vocabulary.ts";

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

function collectOrganiserText(
  view: ReturnType<typeof buildMissionControlPresenterView>,
): string {
  return [
    view.nextStep.title,
    view.nextStep.description,
    view.nextStep.ctaLabel,
    view.scoring.label,
    view.liveOps.primaryTitle ?? "",
    ...view.journey.map((s) => s.label),
    ...view.remainingStepTitles,
    ...view.attention.flatMap((a) => [a.title, a.detail]),
  ].join("\n");
}

describe("mission-control-presenter", () => {
  it("organiser setup journey never includes Runtime or Live", () => {
    assert.deepEqual(
      ORGANISER_JOURNEY_ORDER.map((s) => s.id),
      ["competition", "teams", "fixtures", "schedule", "matches"],
    );
  });

  it("badminton empty tournament uses onboarding Start Setup to branding", () => {
    const snapshots = {
      competition: snap("competition"),
      teams: snap("teams"),
      fixtures: snap("fixtures"),
      scheduling: snap("scheduling"),
      matches: snap("matches"),
      runtime: snap("runtime"),
    };
    assert.equal(isFreshTournamentSetup(snapshots), true);
    const view = buildMissionControlPresenterView({
      tournamentId: 3,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "onboarding");
    assert.equal(view.nextStep.ctaLabel, "Start Setup");
    assert.equal(view.nextStep.continue.kind, "route");
    if (view.nextStep.continue.kind === "route") {
      assert.match(view.nextStep.continue.href, /\/badminton\/branding$/);
    }
    assert.equal(view.attention.length, 0);
    assert.equal(assertNoForbiddenOrganiserTerms(collectOrganiserText(view)).length, 0);
  });

  it("cricket empty tournament Start Setup routes to cricket dashboard (not a dead CTA)", () => {
    const snapshots = {
      competition: snap("competition"),
      teams: snap("teams"),
      fixtures: snap("fixtures"),
      scheduling: snap("scheduling"),
      matches: snap("matches"),
      runtime: snap("runtime"),
    };
    assert.equal(isFreshTournamentSetup(snapshots), true);
    const view = buildMissionControlPresenterView({
      tournamentId: 25,
      snapshots,
      capabilities: getSportCapabilities("cricket"),
    });
    assert.equal(view.mode, "onboarding");
    assert.equal(view.nextStep.ctaLabel, "Start Setup");
    assert.equal(view.nextStep.continue.kind, "route");
    if (view.nextStep.continue.kind === "route") {
      assert.equal(view.nextStep.continue.href, "/tournament/25/score/dashboard");
    }
  });

  it("badminton journey uses Players & Teams and Courts & Schedule", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.scheduling = snap("scheduling", { entityCount: 1, lockedCount: 0 });
    const view = buildMissionControlPresenterView({
      tournamentId: 1,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "setup");
    assert.deepEqual(
      view.journey.map((s) => s.label),
      ["Tournament", "Players & Teams", "Fixtures", "Courts & Schedule", "Match Setup"],
    );
    assert.equal(view.journey.find((s) => s.id === "schedule")?.state, "next");
    assert.match(view.nextStep.title, /courts and match timings/i);
    assert.equal(view.nextStep.continue.kind, "route");
    if (view.nextStep.continue.kind === "route") {
      assert.match(view.nextStep.continue.href, /\/badminton\/schedule$/);
    }
  });

  it("cricket journey keeps Teams & Players / Schedule labels", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.teams = snap("teams", { entityCount: 1, lockedCount: 0 });
    const view = buildMissionControlPresenterView({
      tournamentId: 9,
      snapshots,
      capabilities: getSportCapabilities("cricket"),
    });
    assert.equal(view.journey.find((s) => s.id === "teams")?.label, "Teams & Players");
    assert.equal(view.journey.find((s) => s.id === "schedule")?.label, "Schedule");
  });

  it("does not treat empty blockers as complete", () => {
    assert.equal(
      isModuleStepComplete(
        snap("teams", { entityCount: 3, lockedCount: 0, errorCount: 0 }),
      ),
      false,
    );
  });

  it("Matches complete + Runtime not ready → Match Setup without Runtime jargon", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.runtime = snap("runtime", {
      entityCount: 2,
      lockedCount: 0,
      errorCount: 1,
      validationIssues: [
        {
          severity: "ERROR",
          code: "RUNTIME_SNAPSHOT_REQUIRED",
          message: "Runtime Snapshot must reference a frozen Match Configuration version.",
        },
      ],
    });
    const view = buildMissionControlPresenterView({
      tournamentId: 1,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "setup");
    assert.equal(view.nextStep.stepId, "matches");
    assert.match(view.nextStep.description, /match setup still needs to be completed/i);
    assert.equal(view.nextStep.continue.kind, "route");
    if (view.nextStep.continue.kind === "route") {
      assert.match(view.nextStep.continue.href, /\/badminton\/matches$/);
    }
    const text = collectOrganiserText(view);
    assert.equal(assertNoForbiddenOrganiserTerms(text).length, 0);
    assert.doesNotMatch(text, /Runtime/i);
    assert.doesNotMatch(text, /Snapshot/i);
  });

  it("fully ready badminton tournament → Open Live Scoring", () => {
    const view = buildMissionControlPresenterView({
      tournamentId: 42,
      snapshots: allCompleteSnapshots(),
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.mode, "ready");
    assert.equal(view.nextStep.ctaLabel, "Open Live Scoring");
    assert.ok(view.scoring.href?.includes("/badminton/matches"));
    assert.equal(assertNoForbiddenOrganiserTerms(collectOrganiserText(view)).length, 0);
  });

  it("Runtime blocked keeps Live unavailable", () => {
    assert.equal(
      isRuntimeReady(snap("runtime", { entityCount: 1, lockedCount: 1, errorCount: 2 })),
      false,
    );
  });

  it("competition Continue for badminton routes to branding, not competition card", () => {
    const snapshots = allCompleteSnapshots();
    snapshots.competition = snap("competition", { locked: false, entityCount: 1, lockedCount: 0 });
    // Not fresh because other steps are complete — but competition is first incomplete
    // Wait - if competition incomplete, scan finds competition first even if others complete
    const view = buildMissionControlPresenterView({
      tournamentId: 1,
      snapshots,
      capabilities: getSportCapabilities("badminton"),
    });
    assert.equal(view.nextStep.stepId, "competition");
    assert.equal(view.nextStep.continue.kind, "route");
    if (view.nextStep.continue.kind === "route") {
      assert.match(view.nextStep.continue.href, /\/badminton\/branding$/);
    }
  });

  it("translates and suppresses technical engine issues for badminton", () => {
    const caps = getSportCapabilities("badminton");
    const registration = translateOrganiserIssue(
      { code: "REGISTRATION_MODE_REQUIRED", message: "Registration Mode must be confirmed before locking." },
      caps,
    );
    assert.ok(registration);
    assert.match(registration!.detail, /players or teams will be entered/i);
    assert.equal(assertNoForbiddenOrganiserTerms(registration!.detail).length, 0);

    const runtime = translateOrganiserIssue(
      {
        code: "RUNTIME_SNAPSHOT",
        message: "Runtime Snapshot must reference a frozen Match Configuration version.",
      },
      caps,
    );
    assert.ok(runtime);
    assert.match(runtime!.detail, /match setup/i);
    assert.equal(assertNoForbiddenOrganiserTerms(`${runtime!.title} ${runtime!.detail}`).length, 0);

    const lockOrder = translateOrganiserIssue(
      {
        code: "DEPENDENCY",
        message: "Competition Setup must be locked before locking Fixture Setup.",
      },
      caps,
    );
    assert.ok(lockOrder);
    assert.match(lockOrder!.detail, /before creating fixtures/i);

    const formation = translateOrganiserIssue(
      { code: "TEAM_FORMATION_STRATEGY_REQUIRED", message: "Team Formation Strategy is not set." },
      caps,
    );
    // Folded or suppressed — never leaks formation strategy wording.
    if (formation) {
      assert.equal(assertNoForbiddenOrganiserTerms(`${formation.title} ${formation.detail}`).length, 0);
      assert.doesNotMatch(formation.detail, /Team Formation/i);
    }
  });

  it("cricket Hybrid Continue still uses cricket destinations", () => {
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
});
