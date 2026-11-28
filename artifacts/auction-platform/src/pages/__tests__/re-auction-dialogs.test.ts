import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Re-auction Opening Bid Options across Operator V1 & V2", () => {
  const dialogsSrc = readFileSync(
    path.resolve(__dirname, "../../components/auction/re-auction-dialogs.tsx"),
    "utf8",
  );
  const operatorV1Src = readFileSync(
    path.resolve(__dirname, "../auction-operator.tsx"),
    "utf8",
  );
  const operatorV2Src = readFileSync(
    path.resolve(__dirname, "../auction-operator-v2.tsx"),
    "utf8",
  );

  it("exposes all 3 batch unsold strategies and all 3 single-player starting point options", () => {
    expect(dialogsSrc).toContain("Keep Existing Base Values");
    expect(dialogsSrc).toContain("Reset Using Configured Defaults");
    expect(dialogsSrc).toContain("Use Fixed Starting Bid For All");

    expect(dialogsSrc).toContain("Start from Base Point");
    expect(dialogsSrc).toContain("Start from Last Sold Point");
    expect(dialogsSrc).toContain("Same / Custom Starting Point");
  });

  it("mounts both PrepareReAuctionDialog and SinglePlayerReAuctionDialog in Operator V1 and V2", () => {
    for (const src of [operatorV1Src, operatorV2Src]) {
      expect(src).toContain("<PrepareReAuctionDialog");
      expect(src).toContain("<SinglePlayerReAuctionDialog");
      expect(src).toContain("openSingleReAuctionDialog");
    }
  });

  it("routes queue player re-auction buttons in V2 through openSingleReAuctionDialog instead of bypassing with hardcoded true", () => {
    expect(operatorV2Src).toContain("onClick={() => openSingleReAuctionDialog(player.id)}");
    expect(operatorV2Src).not.toContain("handleReAuction(player.id, true)");
    expect(operatorV2Src).not.toContain("handleReAuction(targetId, true)");
    expect(operatorV1Src).not.toContain("handleReAuction(targetId, true)");
  });
});
