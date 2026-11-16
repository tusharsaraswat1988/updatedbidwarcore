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

  it("contains the exact required premium badge: '🏆 PAST TOURNAMENT TOP 5'", () => {
    expect(src).toContain("🏆 PAST TOURNAMENT TOP 5");
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

  it("evaluates isObsHistoryEnabled and supports dedicated two-line historical area with approved terminology and smart single-event consolidation", () => {
    expect(src).toContain("isObsHistoryEnabled");
    expect(src).toContain("PAST TOURNAMENT TOP 5");
    expect(src).toContain("HIGHEST PRICE IN PAST AUCTIONS:");
    expect(src).toContain("PRICE IN MOST RECENT AUCTION:");
    expect(src).toContain("isSameEvent");
    expect(src).toContain("PAST HIGHEST & LAST AUCTION:");
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

  it("evaluates isLedHistoryEnabled and renders smart consolidated or distinct cards with approved terminology", () => {
    expect(src).toContain("isLedHistoryEnabled");
    expect(src).toContain("HIGHEST PRICE IN PAST AUCTIONS:");
    expect(src).toContain("PRICE IN MOST RECENT AUCTION:");
    expect(src).toContain("PAST TOURNAMENT TOP 5");
    expect(src).toContain("BOUGHT BY:");
    expect(src).toContain("isSameEvent");
    expect(src).toContain("PAST HIGHEST &amp; LAST AUCTION:");
    // Ensure exact decimal precision (₹1.25 LAKH, never rounded to ₹1.3 LAKH)
    expect(src).toContain("l.toFixed(2).replace(/\\.?0+$/, \"\")");
    expect(src).not.toContain("l.toFixed(1)");
    // Ensure no rigid min-h-[220px] that breaks the 16:9 stage layout and pushes chyron off-screen
    expect(src).not.toContain("min-h-[220px]");
  });
});

describe("Organiser Auction Panel & Live Viewer Player Auction History", () => {
  const operatorPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../pages/auction-operator.tsx",
  );
  const operatorSrc = readFileSync(operatorPath, "utf8");

  it("mounts OperatorPlayerAuctionHistory in auction-operator with approved terminology and smart consolidation", () => {
    expect(operatorSrc).toContain("OperatorPlayerAuctionHistory");
    expect(operatorSrc).toContain("PAST HIGHEST:");
    expect(operatorSrc).toContain("LAST AUCTION PRICE:");
    expect(operatorSrc).toContain("PAST TOURNAMENT TOP 5");
    expect(operatorSrc).toContain("isSameEvent");
    expect(operatorSrc).toContain("PAST HIGHEST &amp; LAST AUCTION:");
  });

  const viewerPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../pages/liveviewer.tsx",
  );
  const viewerSrc = readFileSync(viewerPath, "utf8");

  it("mounts LiveViewerPlayerAuctionHistory in liveviewer with approved terminology and smart consolidation", () => {
    expect(viewerSrc).toContain("LiveViewerPlayerAuctionHistory");
    expect(viewerSrc).toContain("HIGHEST PRICE IN PAST AUCTIONS:");
    expect(viewerSrc).toContain("PRICE IN MOST RECENT AUCTION:");
    expect(viewerSrc).toContain("PAST TOURNAMENT TOP 5");
    expect(viewerSrc).toContain("isSameEvent");
    expect(viewerSrc).toContain("PAST HIGHEST &amp; LAST AUCTION:");
  });

  const ownerHistoryPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../owner-app/src/components/OwnerPlayerAuctionHistory.tsx",
  );
  const ownerSrc = readFileSync(ownerHistoryPath, "utf8");

  it("implements smart single-card consolidation in OwnerPlayerAuctionHistory when best == last", () => {
    expect(ownerSrc).toContain("PLAYER AUCTION HISTORY");
    expect(ownerSrc).toContain("PAST HIGHEST");
    expect(ownerSrc).toContain("LAST AUCTION PRICE");
    expect(ownerSrc).toContain("isSameEvent");
    expect(ownerSrc).toContain("PAST HIGHEST &amp; LAST AUCTION");
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
