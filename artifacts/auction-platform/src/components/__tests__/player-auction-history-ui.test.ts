import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

describe("PlayerAuctionHistorySection UI Specification", () => {
  const componentPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../player-auction-history.tsx",
  );
  const src = readFileSync(componentPath, "utf8");

  it("contains the exact required premium badge: '🏆 TOP 5 STAR'", () => {
    expect(src).toContain("🏆 TOP 5 STAR");
  });

  it("prominently renders sold price with formatIndianRupee and unit support", () => {
    expect(src).toContain("formatIndianRupee(record.soldPrice, unit)");
    expect(src).toContain("font-mono tabular-nums text-emerald-600");
  });

  it("renders tournament name and optional buying team name with team color dot", () => {
    expect(src).toContain("record.tournamentName");
    expect(src).toContain("record.buyingTeamName");
    expect(src).toContain("record.buyingTeamColor");
    expect(src).toContain("Sold to");
  });

  it("handles empty states gracefully without showing negative unsold history", () => {
    expect(src).toContain("No prior sold auction history");
    expect(src).toContain('if (emptyState === "hidden") return null');
    // Negative unsold history must not appear
    expect(src).not.toContain("UNSOLD");
    expect(src).not.toContain("unsold count");
  });

  it("exports usePlayerAuctionHistory query hook querying the backend endpoint", () => {
    expect(src).toContain("usePlayerAuctionHistory");
    expect(src).toContain("/api/tournaments/${tournamentId}/players/${playerId}/auction-history");
    expect(src).toContain("/api/tournaments/${tournamentId}/player-auction-history");
  });
});

describe("Organizer Player Management Flow Wiring", () => {
  const playersPagePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../pages/players.tsx",
  );
  const src = readFileSync(playersPagePath, "utf8").replace(/\r\n/g, "\n");

  it("mounts PlayerAuctionHistorySection in PlayerDetailPanel for selected player inspection", () => {
    expect(src).toContain('PlayerAuctionHistorySection');
    expect(src).toContain('usePlayerAuctionHistory');
    expect(src).toContain("<PlayerAuctionHistorySection");
    expect(src).toContain("history={auctionHistory}");
    expect(src).toContain("isLoading={isHistoryLoading}");
  });

  it("mounts PlayerAuctionHistorySection in PlayerForm for add/edit player flow", () => {
    expect(src).toContain("history={formAuctionHistory}");
    expect(src).toContain("isLoading={isFormHistoryLoading}");
    expect(src).toContain('emptyState={player || pendingMobileProfile ? "subtle" : "hidden"}');
  });
});

describe("OBS V2 Live Player Auction History Chip", () => {
  const scenesPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../broadcast/obs-v2/lower/Scenes.tsx",
  );
  const src = readFileSync(scenesPath, "utf8");

  it("exports and mounts ObsPlayerHistoryChip inside AuctionScene", () => {
    expect(src).toContain("export function ObsPlayerHistoryChip");
    expect(src).toContain("<ObsPlayerHistoryChip");
    expect(src).toContain("data-obs-player-history-chip");
  });

  it("evaluates isObsHistoryEnabled and supports Top 5 badge and previous best sold price", () => {
    expect(src).toContain("isObsHistoryEnabled");
    expect(src).toContain("🏆 TOP 5");
    expect(src).toContain("PREV BEST:");
  });
});

describe("Live LED Screen Player Auction History Banner", () => {
  const portraitPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../display/v1/PlayerPortrait.tsx",
  );
  const src = readFileSync(portraitPath, "utf8");

  it("exports and mounts LedPlayerHistoryBanner in PlayerPortrait", () => {
    expect(src).toContain("export function LedPlayerHistoryBanner");
    expect(src).toContain("<LedPlayerHistoryBanner");
    expect(src).toContain("data-led-player-history-banner");
  });

  it("evaluates isLedHistoryEnabled and renders PREVIOUS BEST, LAST SOLD, and TOP 5 STAR badge", () => {
    expect(src).toContain("isLedHistoryEnabled");
    expect(src).toContain("PREVIOUS BEST:");
    expect(src).toContain("LAST SOLD:");
    expect(src).toContain("🏆 TOP 5 STAR");
  });
});

describe("Tournament Settings Live Auction Features Toggles", () => {
  const settingsPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../pages/tournament-settings.tsx",
  );
  const src = readFileSync(settingsPath, "utf8");

  it("renders Live Auction Features card with master and granular sub-toggles", () => {
    expect(src).toContain("Live Auction Features");
    expect(src).toContain("Player Auction History (Master)");
    expect(src).toContain("Owner Panel Display");
    expect(src).toContain("OBS Broadcast Overlay");
    expect(src).toContain("Live LED Stage Screen");
    expect(src).toContain("liveAuctionHistory");
    expect(src).toContain("ownerAppHistory");
    expect(src).toContain("obsHistory");
    expect(src).toContain("ledHistory");
  });
});
