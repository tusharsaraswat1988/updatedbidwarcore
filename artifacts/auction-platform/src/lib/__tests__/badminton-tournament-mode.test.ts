import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  badmintonIaLiveControlPath,
  badmintonIaSetupCourtsPath,
  badmintonIaSetupRulesPath,
  badmintonIaStructureEventsPath,
  detectBadmintonTournamentMode,
} from "../badminton-routes.ts";

describe("detectBadmintonTournamentMode", () => {
  it("returns completed when tournament status is completed", () => {
    assert.equal(
      detectBadmintonTournamentMode({
        tournamentStatus: "completed",
        matchesLive: 2,
        matchesCompleted: 5,
      }),
      "completed",
    );
  });

  it("returns live when any match is live", () => {
    assert.equal(
      detectBadmintonTournamentMode({
        tournamentStatus: "active",
        matchesLive: 1,
        matchesCompleted: 0,
      }),
      "live",
    );
  });

  it("returns live when any match is completed but tournament is not", () => {
    assert.equal(
      detectBadmintonTournamentMode({
        tournamentStatus: "active",
        matchesLive: 0,
        matchesCompleted: 3,
      }),
      "live",
    );
  });

  it("returns setup when no match has started", () => {
    assert.equal(
      detectBadmintonTournamentMode({
        tournamentStatus: "draft",
        matchesLive: 0,
        matchesCompleted: 0,
      }),
      "setup",
    );
  });

  it("treats missing match counts as zero", () => {
    assert.equal(
      detectBadmintonTournamentMode({
        tournamentStatus: "active",
      }),
      "setup",
    );
  });
});

describe("badminton IA destination helpers", () => {
  it("points legacy chapters at Live Control / Structure / Setup hosts", () => {
    assert.equal(badmintonIaLiveControlPath(7), "/tournament/7/badminton/control");
    assert.equal(
      badmintonIaLiveControlPath(7, "broadcast"),
      "/tournament/7/badminton/control?focus=broadcast",
    );
    assert.equal(
      badmintonIaStructureEventsPath(7),
      "/tournament/7/badminton/fixtures?section=events",
    );
    assert.equal(
      badmintonIaSetupCourtsPath(7),
      "/tournament/7/badminton/branding?section=courts",
    );
    assert.equal(
      badmintonIaSetupRulesPath(7),
      "/tournament/7/badminton/branding?section=rules",
    );
  });
});
