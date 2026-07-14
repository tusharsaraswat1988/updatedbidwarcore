import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectBadmintonTournamentMode,
  getBadmintonHubNavLayout,
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

describe("getBadmintonHubNavLayout", () => {
  it("prioritizes setup modules in setup mode", () => {
    const layout = getBadmintonHubNavLayout({ mode: "setup" });
    assert.deepEqual(
      layout.primary.map((i) => i.label),
      [
        "Tournament Information",
        "Players",
        "Teams / Events",
        "Scoring Format",
        "Venues & Courts",
        "Fixtures",
        "Match Schedule",
      ],
    );
    assert.deepEqual(layout.secondary.map((i) => i.label), [
      "Operator Panel",
      "Results",
    ]);
    assert.equal(layout.setupCollapsed.length, 0);
    assert.equal(layout.setupReadOnly, false);
  });

  it("prioritizes ops modules in live mode and collapses setup", () => {
    const layout = getBadmintonHubNavLayout({
      mode: "live",
      broadcastEnabled: true,
    });
    assert.deepEqual(
      layout.primary.map((i) => i.label),
      [
        "Operator Panel",
        "Match Control",
        "Live Scoring",
        "Results",
        "Display & Broadcast",
      ],
    );
    assert.deepEqual(
      layout.setupCollapsed.map((i) => i.id),
      [
        "branding",
        "players",
        "categories",
        "scoring_format",
        "courts",
        "fixtures",
        "schedule",
      ],
    );
    assert.equal(layout.setupReadOnly, false);
  });

  it("omits broadcast from live primary when disabled", () => {
    const layout = getBadmintonHubNavLayout({
      mode: "live",
      broadcastEnabled: false,
    });
    assert.equal(
      layout.primary.map((i) => i.label).includes("Display & Broadcast"),
      false,
    );
    assert.equal(
      layout.more.some((i) => i.id === "broadcast"),
      true,
    );
  });

  it("prioritizes results and summary in completed mode with read-only setup", () => {
    const layout = getBadmintonHubNavLayout({ mode: "completed" });
    assert.deepEqual(
      layout.primary.map((i) => i.label),
      ["Results", "Tournament Summary", "Analytics", "Archive"],
    );
    assert.ok(layout.setupCollapsed.length > 0);
    assert.equal(layout.setupReadOnly, true);
  });
});
