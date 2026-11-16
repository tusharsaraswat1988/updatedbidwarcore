import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

describe("Team Owner App — Mobile Zero-Scroll & Auto-Collapsing Popups Contract", () => {
  const liveBidPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../owner-app/src/screens/LiveBid.tsx",
  );
  const liveBidSrc = readFileSync(liveBidPath, "utf8");

  it("defines PlayerBioSideDrawer and compact mobile player card HUD", () => {
    expect(liveBidSrc).toContain("function PlayerBioSideDrawer");
    expect(liveBidSrc).toContain("Bio & Stats");
    expect(liveBidSrc).toContain("showPlayerBioDrawer");
    expect(liveBidSrc).toContain("setShowPlayerBioDrawer(false)");
  });

  it("implements 3-pillar essential purse strip and PurseBreakdownModal", () => {
    expect(liveBidSrc).toContain("function PurseBreakdownModal");
    expect(liveBidSrc).toContain("Purse Left");
    expect(liveBidSrc).toContain("Max Bid");
    expect(liveBidSrc).toContain("Spent • Info");
    expect(liveBidSrc).toContain("showBreakdown");
  });

  it("wires auto-collapsing signals (collapseSignal, biddingActive) on bidding start triggers", () => {
    expect(liveBidSrc).toContain("collapseSignal");
    expect(liveBidSrc).toContain("prevTimerActiveRef");
    expect(liveBidSrc).toContain("timerStarted");
    expect(liveBidSrc).toContain("bidChanged");
    expect(liveBidSrc).toContain("playerChanged");
    expect(liveBidSrc).toContain("biddingActive");
  });

  it("collapses TeamSquadSnapshot on bidding start or collapseSignal", () => {
    expect(liveBidSrc).toContain("if (biddingActive || collapseSignal > 0)");
    expect(liveBidSrc).toContain("setExpanded(null)");
  });

  it("collapses PurseBreakdownModal on bidding start or collapseSignal", () => {
    expect(liveBidSrc).toContain("if (biddingActive || collapseSignal > 0)");
    expect(liveBidSrc).toContain("setShowBreakdown(false)");
  });

  it("collapses side popups on bid execution", () => {
    expect(liveBidSrc).toContain("async function handleBidTap");
    expect(liveBidSrc).toContain("setShowPlayerBioDrawer(false)");
    expect(liveBidSrc).toContain("setCollapseSignal((s) => s + 1)");
  });
});
