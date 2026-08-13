import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAYER_TAG_OPTIONS } from "../tag-theme.ts";
import {
  filterPlayerTagOptions,
  getSportCapabilities,
} from "../sport-capabilities.ts";

describe("sport-capabilities", () => {
  it("cricket declares cricket-specific capabilities", () => {
    const caps = getSportCapabilities("cricket");
    assert.equal(caps.hasPlayingXi, true);
    assert.equal(caps.hasBench, true);
    assert.equal(caps.hasOvers, true);
    assert.equal(caps.hasCaptain, true);
    assert.equal(caps.hasLBW, true);
    assert.equal(caps.hasSets, false);
    assert.equal(caps.hasCourts, false);
    assert.equal(caps.playingSquadLabel, "Playing XI");
    assert.equal(caps.hasLegacyCricketSpecs, true);
  });

  it("badminton does not declare cricket capabilities", () => {
    const caps = getSportCapabilities("badminton");
    assert.equal(caps.hasPlayingXi, false);
    assert.equal(caps.hasBench, false);
    assert.equal(caps.hasOvers, false);
    assert.equal(caps.hasCaptain, false);
    assert.equal(caps.hasLBW, false);
    assert.equal(caps.hasSets, true);
    assert.equal(caps.hasCourts, true);
    assert.equal(caps.hasServiceSide, true);
    assert.equal(caps.hasLegacyCricketSpecs, false);
    assert.equal(caps.playingSquadLabel, "Lineup");
  });

  it("badminton live ops links exclude cricket-only destinations", () => {
    const caps = getSportCapabilities("badminton");
    const ids = caps.liveOpsLinks.map((l) => l.id);
    assert.ok(ids.includes("mission_control"));
    assert.ok(ids.includes("broadcast"));
    assert.equal(ids.includes("match_center"), false);
    assert.equal(ids.includes("standings"), false);
    assert.equal(ids.includes("statistics"), false);
    assert.equal(ids.includes("public"), false);
  });

  it("mission control destinations stay sport-scoped", () => {
    const badminton = getSportCapabilities("badminton");
    const cricket = getSportCapabilities("cricket");
    assert.match(badminton.missionControlDestinations?.fixtures?.(3) ?? "", /\/badminton\/fixtures$/);
    assert.match(badminton.missionControlDestinations?.tournament?.(3) ?? "", /\/badminton\/branding$/);
    assert.match(cricket.missionControlDestinations?.tournament?.(3) ?? "", /\/score\/settings$/);
    assert.match(cricket.missionControlDestinations?.teams?.(3) ?? "", /\/score\/teams$/);
    assert.match(cricket.missionControlDestinations?.fixtures?.(3) ?? "", /\/score\/fixtures$/);
    assert.doesNotMatch(badminton.missionControlDestinations?.schedule?.(3) ?? "", /\/score\//);
    assert.doesNotMatch(cricket.missionControlDestinations?.schedule?.(3) ?? "", /badminton/);
  });

  it("cricket live ops links exclude badminton-only destinations", () => {
    const caps = getSportCapabilities("cricket");
    const ids = caps.liveOpsLinks.map((l) => l.id);
    assert.ok(ids.includes("live_control"));
    assert.ok(ids.includes("dashboard"));
    assert.ok(ids.includes("match_center"));
    assert.ok(ids.includes("broadcast"));
    assert.equal(ids.includes("mission_control"), false);
    const liveControl = caps.liveOpsLinks.find((l) => l.id === "live_control");
    assert.match(
      liveControl?.buildHref({ tournamentId: 3, encodedReturnTo: "" }) ?? "",
      /\/score\/live-control/,
    );
    const broadcast = caps.liveOpsLinks.find((l) => l.id === "broadcast");
    assert.match(broadcast?.buildHref({ tournamentId: 3, encodedReturnTo: "" }) ?? "", /\/cricket\/obs\/live$/);
    assert.doesNotMatch(broadcast?.buildHref({ tournamentId: 3, encodedReturnTo: "" }) ?? "", /\/obs$/);
  });

  it("filterPlayerTagOptions hides captain tags when sport lacks hasCaptain", () => {
    const cricketTags = filterPlayerTagOptions(
      getSportCapabilities("cricket"),
      PLAYER_TAG_OPTIONS,
    );
    assert.ok(cricketTags.some((t) => t.value === "captain"));
    assert.ok(cricketTags.some((t) => t.value === "vice_captain"));

    const badmintonTags = filterPlayerTagOptions(
      getSportCapabilities("badminton"),
      PLAYER_TAG_OPTIONS,
    );
    assert.equal(badmintonTags.some((t) => t.value === "captain"), false);
    assert.equal(badmintonTags.some((t) => t.value === "vice_captain"), false);
    assert.ok(badmintonTags.some((t) => t.value === "icon"));
  });

  it("unknown sport gets safe defaults with no cricket concepts", () => {
    const caps = getSportCapabilities("volleyball");
    assert.equal(caps.hasPlayingXi, false);
    assert.equal(caps.hasOvers, false);
    assert.equal(caps.hasCaptain, false);
    assert.equal(caps.liveOpsLinks.length, 0);
  });
});
