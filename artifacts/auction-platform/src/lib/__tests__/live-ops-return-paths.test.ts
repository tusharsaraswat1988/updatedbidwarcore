import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveReturnPath,
  returnPathBackLabel,
  scoringPath,
  setupAreaPath,
  tournamentMissionControlPath,
} from "../tournament-navigation.ts";
import {
  badmintonHubPath,
  getBadmintonHubBackNav,
} from "../badminton-routes.ts";

const TID = 42;
const TMC = tournamentMissionControlPath(TID);
const HUB = badmintonHubPath(TID);

describe("Live Ops return + cricket path helpers", () => {
  it("scoringPath uses /score under scoring-app (not /scoring)", () => {
    assert.equal(scoringPath(TID), `/scoring-app/tournament/${TID}/score`);
    assert.doesNotMatch(scoringPath(TID), /\/scoring$/);
  });

  it("resolveReturnPath accepts same-origin from= and rejects open redirects", () => {
    assert.equal(resolveReturnPath(TMC, TID), TMC);
    assert.equal(resolveReturnPath("//evil.example", TID), TMC);
    assert.equal(resolveReturnPath("https://evil.example", TID), TMC);
  });

  it("returnPathBackLabel names Tournament Mission Control for hub paths", () => {
    assert.match(returnPathBackLabel(TMC), /Mission Control/i);
  });

  it("setupAreaPath aliases Tournament Mission Control", () => {
    assert.equal(setupAreaPath(TID), TMC);
  });
});

describe("Phase 5 home cutover — badminton hub is not home", () => {
  it("hub root back nav returns to Tournament Mission Control", () => {
    const back = getBadmintonHubBackNav(TID, HUB);
    assert.equal(back.kind, "link");
    if (back.kind === "link") {
      assert.equal(back.href, TMC);
      assert.match(back.label, /Mission Control/i);
    }
  });

  it("control without from= returns to Operations workspace (not Dashboard home)", () => {
    const back = getBadmintonHubBackNav(TID, `${HUB}/control`);
    assert.equal(back.kind, "link");
    if (back.kind === "link") {
      assert.equal(back.href, HUB);
      assert.match(back.label, /Operations/i);
      assert.doesNotMatch(back.label, /Dashboard/i);
    }
  });

  it("default unknown badminton path returns to Operations, not Dashboard", () => {
    const back = getBadmintonHubBackNav(TID, `${HUB}/unknown-surface`);
    assert.equal(back.kind, "link");
    if (back.kind === "link") {
      assert.equal(back.href, HUB);
      assert.match(back.label, /Operations/i);
    }
  });
});
