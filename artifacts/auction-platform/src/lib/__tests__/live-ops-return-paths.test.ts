import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayScreenPath,
  resolveReturnPath,
  returnPathBackLabel,
  scoringPath,
  setupAreaPath,
} from "../tournament-navigation.ts";

const TID = 42;
const TMC = setupAreaPath(TID);

describe("Live Ops return + cricket path helpers", () => {
  it("scoringPath uses /score under scoring-app (not /scoring)", () => {
    assert.equal(scoringPath(TID), `/scoring-app/tournament/${TID}/score`);
    assert.doesNotMatch(scoringPath(TID), /\/scoring$/);
  });

  it("displayScreenPath has no from= (fullscreen LED cannot consume return)", () => {
    assert.equal(displayScreenPath(TID), `/tournament/${TID}/display`);
    assert.doesNotMatch(displayScreenPath(TID), /from=/);
  });

  it("resolveReturnPath accepts same-origin from= and rejects open redirects", () => {
    assert.equal(resolveReturnPath(TMC, TID), TMC);
    assert.equal(resolveReturnPath("//evil.example", TID), TMC);
    assert.equal(resolveReturnPath("https://evil.example", TID), TMC);
  });

  it("returnPathBackLabel names Tournament Mission Control for hub paths", () => {
    assert.match(returnPathBackLabel(TMC), /Mission Control/i);
  });
});
