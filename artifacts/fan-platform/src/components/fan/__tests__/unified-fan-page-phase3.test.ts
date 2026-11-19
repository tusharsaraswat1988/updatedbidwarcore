import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Unified fan page stays inside fan-platform", () => {
  const fanDir = path.resolve(__dirname, "..");
  const pagesDir = path.resolve(__dirname, "../../../pages");

  const unifiedFanPageSrc = fs.readFileSync(path.join(pagesDir, "unified-fan-page.tsx"), "utf8");
  const auctionRendererSrc = fs.readFileSync(path.join(fanDir, "auction-fan-renderer.tsx"), "utf8");
  const cricketRendererSrc = fs.readFileSync(path.join(fanDir, "cricket-fan-renderer.tsx"), "utf8");
  const badmintonRendererSrc = fs.readFileSync(path.join(fanDir, "badminton-fan-renderer.tsx"), "utf8");

  it("does not import the legacy live viewer or scoring monolith", () => {
    expect(auctionRendererSrc).not.toContain("liveviewer");
    expect(cricketRendererSrc).not.toContain("ScoringPublicPage");
    expect(badmintonRendererSrc).not.toContain("subscribeBadmintonDashboardStream");
    expect(auctionRendererSrc).toContain("/api/tournaments/");
    expect(cricketRendererSrc).toContain("CricketFanExperience");
    expect(badmintonRendererSrc).toContain("LiveScoringBoard");
  });

  it("mounts only the active module", () => {
    expect(unifiedFanPageSrc).toContain('{activeTab === "auction" && showAuctionTab && (');
    expect(unifiedFanPageSrc).toContain("<AuctionFanRenderer tournamentId={tournamentId} />");
    expect(unifiedFanPageSrc).toContain("<CricketFanRenderer tournamentId={tournamentId} />");
    expect(unifiedFanPageSrc).toContain("<BadmintonFanRenderer tournamentId={tournamentId} />");
    expect(unifiedFanPageSrc).toContain("<UnsupportedSportFallback");
  });
});
