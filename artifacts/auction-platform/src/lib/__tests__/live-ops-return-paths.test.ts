import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auctionOverviewPath,
  displayScreenPath,
  resolveReturnPath,
  returnPathBackLabel,
  scoringPath,
  setupAreaPath,
  sportsMissionControlPath,
  tournamentMissionControlPath,
} from "../tournament-navigation.ts";
import {
  badmintonHubPath,
  getBadmintonHubBackNav,
  sportsHomePath,
} from "../badminton-routes.ts";

const TID = 42;
const AUCTION_OVERVIEW = auctionOverviewPath(TID);
const SPORTS_TMC = sportsHomePath(TID);
const HUB = badmintonHubPath(TID);

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
    assert.equal(resolveReturnPath(AUCTION_OVERVIEW, TID), AUCTION_OVERVIEW);
    assert.equal(resolveReturnPath("//evil.example", TID), AUCTION_OVERVIEW);
    assert.equal(resolveReturnPath("https://evil.example", TID), AUCTION_OVERVIEW);
  });

  it("returnPathBackLabel names Auction Overview for auction hub paths", () => {
    assert.match(returnPathBackLabel(AUCTION_OVERVIEW), /Auction Overview/i);
  });

  it("returnPathBackLabel names Tournament Dashboard for Sports home paths", () => {
    assert.match(returnPathBackLabel(SPORTS_TMC), /Tournament Dashboard/i);
  });

  it("setupAreaPath aliases Auction Overview (not Sports Tournament Dashboard)", () => {
    assert.equal(setupAreaPath(TID), AUCTION_OVERVIEW);
    assert.equal(tournamentMissionControlPath(TID), AUCTION_OVERVIEW);
    assert.notEqual(setupAreaPath(TID), SPORTS_TMC);
  });

  it("sportsMissionControlPath is Sports product home", () => {
    assert.equal(sportsMissionControlPath(TID), `/tournament/${TID}/mission-control`);
    assert.equal(SPORTS_TMC, `/tournament/${TID}/mission-control`);
  });
});

describe("Product boundary — badminton hub is not Sports home", () => {
  it("hub root back nav returns to Tournament Dashboard", () => {
    const back = getBadmintonHubBackNav(TID, HUB);
    assert.equal(back.kind, "link");
    if (back.kind === "link") {
      assert.equal(back.href, SPORTS_TMC);
      assert.match(back.label, /Tournament Dashboard/i);
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
