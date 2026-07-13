import { describe, expect, it } from "vitest";
import {
  evaluateBadmintonSetup,
  getFollowingSetupStep,
  getNextSetupStep,
  getPreviousSetupStep,
  isTournamentSetupReady,
  setupProgress,
  type BadmintonSetupSnapshot,
} from "../badminton-setup-workflow";

function snapshot(partial: Partial<BadmintonSetupSnapshot> = {}): BadmintonSetupSnapshot {
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

describe("evaluateBadmintonSetup", () => {
  it("marks branding as current when nothing is done", () => {
    const items = evaluateBadmintonSetup(snapshot());
    expect(getNextSetupStep(items)?.id).toBe("branding");
    expect(items.every((i) => i.id === "branding" || i.status === "upcoming")).toBe(true);
  });

  it("unlocks players after branding", () => {
    const items = evaluateBadmintonSetup(snapshot({ brandingComplete: true }));
    expect(getNextSetupStep(items)?.id).toBe("players");
    expect(items.find((i) => i.id === "branding")?.status).toBe("completed");
  });

  it("requires sequential completion through scheduling before ready", () => {
    const items = evaluateBadmintonSetup(
      snapshot({
        brandingComplete: true,
        totalPlayers: 2,
        totalCategories: 1,
        scoringFormatConfigured: true,
        totalCourts: 2,
        totalFixtures: 4,
        totalScheduledFixtures: 1,
      }),
    );
    expect(isTournamentSetupReady(items)).toBe(true);
    expect(getNextSetupStep(items)?.id).toBe("ready");
    expect(setupProgress(items).complete).toBe(false);
  });

  it("completes wizard only after ready is marked done", () => {
    const items = evaluateBadmintonSetup(
      snapshot({
        brandingComplete: true,
        totalPlayers: 2,
        totalCategories: 1,
        scoringFormatConfigured: true,
        totalCourts: 2,
        totalFixtures: 4,
        totalScheduledFixtures: 1,
        wizardCompleted: true,
      }),
    );
    expect(setupProgress(items).complete).toBe(true);
    expect(getNextSetupStep(items)).toBeNull();
  });

  it("does not mark draws done when fixtures exist but courts are missing", () => {
    const items = evaluateBadmintonSetup(
      snapshot({
        brandingComplete: true,
        totalPlayers: 1,
        totalCategories: 1,
        scoringFormatConfigured: true,
        totalCourts: 0,
        totalFixtures: 3,
      }),
    );
    expect(getNextSetupStep(items)?.id).toBe("courts");
    expect(items.find((i) => i.id === "draws")?.locked).toBe(true);
  });
});

describe("wizard step helpers", () => {
  it("walks previous and following steps", () => {
    expect(getPreviousSetupStep("branding")).toBeNull();
    expect(getPreviousSetupStep("players")?.id).toBe("branding");
    expect(getFollowingSetupStep("scheduling")?.id).toBe("ready");
    expect(getFollowingSetupStep("ready")).toBeNull();
  });
});
