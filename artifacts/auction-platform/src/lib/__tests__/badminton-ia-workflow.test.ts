import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BADMINTON_IA_STEPS,
  evaluateBadmintonIaContinueGate,
  isBadmintonIaChapterComplete,
  isBadmintonIaStepClickable,
  pathToBadmintonIaStep,
} from "../badminton-ia-workflow.ts";
import type { BadmintonSetupSnapshot } from "../badminton-setup-workflow.ts";

function snap(partial: Partial<BadmintonSetupSnapshot> = {}): BadmintonSetupSnapshot {
  return {
    brandingComplete: false,
    totalPlayers: 0,
    totalCategories: 0,
    scoringFormatConfigured: false,
    totalFixtures: 0,
    totalCourts: 0,
    totalScheduledFixtures: 0,
    wizardCompleted: false,
    ...partial,
  };
}

describe("badminton IA workflow — Phase 2 / 2.5", () => {
  it("defines exactly 6 operational chapters", () => {
    assert.equal(BADMINTON_IA_STEPS.length, 6);
    assert.deepEqual(
      BADMINTON_IA_STEPS.map((s) => s.id),
      ["setup", "participants", "structure", "schedule", "live", "results"],
    );
  });

  it("maps legacy routes into chapters", () => {
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/branding"), "setup");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/courts"), "setup");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/scoring-format"), "setup");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/players"), "participants");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/scorers"), "participants");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/fixtures"), "structure");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/categories"), "structure");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/schedule"), "schedule");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/control"), "live");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/matches"), "live");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/results"), "results");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/summary"), "results");
    assert.equal(pathToBadmintonIaStep("/tournament/1/badminton/analytics"), "results");
  });

  it("chains Continue destinations through the lifecycle", () => {
    const tid = 7;
    assert.match(BADMINTON_IA_STEPS[0]!.continueHref(tid), /\/players$/);
    assert.match(BADMINTON_IA_STEPS[1]!.continueHref(tid), /\/fixtures$/);
    assert.match(BADMINTON_IA_STEPS[2]!.continueHref(tid), /\/schedule$/);
    assert.match(BADMINTON_IA_STEPS[3]!.continueHref(tid), /\/control$/);
    assert.match(BADMINTON_IA_STEPS[4]!.continueHref(tid), /\/results$/);
    assert.match(BADMINTON_IA_STEPS[5]!.continueHref(tid), /\/summary$/);
  });

  it("blocks Continue when prerequisites are missing", () => {
    const setupGate = evaluateBadmintonIaContinueGate("setup", snap());
    assert.equal(setupGate.allowed, false);
    assert.match(setupGate.reason ?? "", /tournament name/i);

    const playersGate = evaluateBadmintonIaContinueGate(
      "participants",
      snap({ brandingComplete: true, totalCourts: 1, scoringFormatConfigured: true }),
    );
    assert.equal(playersGate.allowed, false);
    assert.match(playersGate.reason ?? "", /players/i);

    const structureGate = evaluateBadmintonIaContinueGate(
      "structure",
      snap({
        brandingComplete: true,
        totalCourts: 1,
        scoringFormatConfigured: true,
        totalPlayers: 4,
        totalCategories: 1,
      }),
    );
    assert.equal(structureGate.allowed, false);
    assert.match(structureGate.reason ?? "", /draw/i);
  });

  it("allows Continue when chapter work is complete", () => {
    const ready = snap({
      brandingComplete: true,
      totalCourts: 2,
      scoringFormatConfigured: true,
      totalPlayers: 8,
      totalCategories: 2,
      totalFixtures: 4,
      totalScheduledFixtures: 2,
    });
    assert.equal(evaluateBadmintonIaContinueGate("setup", ready).allowed, true);
    assert.equal(evaluateBadmintonIaContinueGate("participants", ready).allowed, true);
    assert.equal(evaluateBadmintonIaContinueGate("structure", ready).allowed, true);
    assert.equal(evaluateBadmintonIaContinueGate("schedule", ready).allowed, true);
    assert.equal(isBadmintonIaChapterComplete("setup", ready), true);
    assert.equal(isBadmintonIaChapterComplete("structure", ready), true);
  });

  it("locks progress clicks ahead of incomplete chapters", () => {
    const early = snap({ brandingComplete: true, totalCourts: 1, scoringFormatConfigured: true });
    assert.equal(isBadmintonIaStepClickable("setup", "setup", early), true);
    assert.equal(isBadmintonIaStepClickable("participants", "setup", early), true);
    assert.equal(isBadmintonIaStepClickable("structure", "setup", early), false);
    assert.equal(isBadmintonIaStepClickable("setup", "participants", early), true);
  });
});
