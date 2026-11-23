import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("P2 Stage Prompter & Tactical War Room UI Integration", () => {
  const operatorV2Src = readFileSync(path.resolve(__dirname, "../auction-operator-v2.tsx"), "utf8");
  const ownerLiveBidSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/screens/LiveBid.tsx"),
    "utf8"
  );

  describe("1. Operator Console (auction-operator-v2.tsx): Stage Prompter & Scarcity Radar", () => {
    it("defines StageAuctioneerPrompterRadar component with high-contrast AI talking points", () => {
      expect(operatorV2Src).toContain("function StageAuctioneerPrompterRadar(");
      expect(operatorV2Src).toContain("Stage Auctioneer Prompter & Scarcity Radar");
    });

    it("fetches stage prompter intelligence endpoint with fallback support", () => {
      expect(operatorV2Src).toContain("/api/intelligence/stage-prompter/");
      expect(operatorV2Src).toContain("/api/tournaments/");
      expect(operatorV2Src).toContain("/intelligence/stage-prompter");
    });

    it("renders category scarcity indicator with critical squeeze flag and deficit", () => {
      expect(operatorV2Src).toContain("categoryScarcity.isCriticalSqueeze");
      expect(operatorV2Src).toContain("⚠️ SQUEEZE:");
      expect(operatorV2Src).toContain("categoryScarcity.availableCategoryPlayers");
      expect(operatorV2Src).toContain("categoryScarcity.unfilledCategorySlots");
    });

    it("renders category inflation multiplier and room liquidity indicators", () => {
      expect(operatorV2Src).toContain("categoryInflation.multiplier");
      expect(operatorV2Src).toContain("Base Price");
      expect(operatorV2Src).toContain("roomLiquidity.ratio");
      expect(operatorV2Src).toContain("Liquidity:");
    });

    it("renders team distress alert pill when a team exceeds 80% purse with slots remaining", () => {
      expect(operatorV2Src).toContain("teamDistressAlerts.length > 0");
      expect(operatorV2Src).toContain("🚨 Distress:");
      expect(operatorV2Src).toContain("purseSpentPct");
    });

    it("embeds StageAuctioneerPrompterRadar on the main stage card when player is on block", () => {
      expect(operatorV2Src).toContain("<StageAuctioneerPrompterRadar");
      expect(operatorV2Src).toContain("tournamentId={tournamentId}");
      expect(operatorV2Src).toContain("playerId={currentPlayer.id}");
    });

    it("cascades auctioneer talk points to Price Dynamic, Distress, and Liquidity alerts when no rivalry duel exists", () => {
      expect(operatorV2Src).toContain("roomLiquidity?.isDeficit === true");
      expect(operatorV2Src).toContain("Price Dynamic:");
      expect(operatorV2Src).toContain("Distress Alert:");
      expect(operatorV2Src).toContain("Room Liquidity:");
    });
  });

  describe("2. Owner War Room & Tactical Bidding (LiveBid.tsx)", () => {
    it("implements Tactical AI Walk-Away Price formula with server maxAllowedBid safeguard", () => {
      // Walk-Away Price = PurseRemaining - (RemainingMandatorySlots - 1) * MinBasePrice
      expect(ownerLiveBidSrc).toContain("const remainingMandatorySlots = Math.max(0, minSquad - playersBought);");
      expect(ownerLiveBidSrc).toContain("const futureMandatoryReserve = Math.max(0, remainingMandatorySlots - 1) * minBasePrice;");
      expect(ownerLiveBidSrc).toContain("const rawWalkAway = Math.max(0, purseRemaining - futureMandatoryReserve);");
      expect(ownerLiveBidSrc).toContain("const walkAwayPrice =");
      expect(ownerLiveBidSrc).toContain("teamPurse?.maxAllowedBid !== undefined");
    });

    it("renders color-coded indicator ring/badge for safe, tight, and quota limit margins", () => {
      expect(ownerLiveBidSrc).toContain("marginStatus");
      expect(ownerLiveBidSrc).toContain("Safe Margin");
      expect(ownerLiveBidSrc).toContain("Tight Margin");
      expect(ownerLiveBidSrc).toContain("Quota Limit Reached");
      expect(ownerLiveBidSrc).toContain("TacticalWarRoomStrip");
    });

    it("implements Live Purse Preservation Simulator rendered under the Bid button", () => {
      expect(ownerLiveBidSrc).toContain("function LivePursePreservationSimulator(");
      expect(ownerLiveBidSrc).toContain("If you bid");
      expect(ownerLiveBidSrc).toContain("left");
      expect(ownerLiveBidSrc).toContain("Must average");
      expect(ownerLiveBidSrc).toContain("/player");
    });

    it("implements Rival Outbid Capacity Radar counting rivals with purse and category slot, excluding full squads", () => {
      expect(ownerLiveBidSrc).toContain("rivalOutbidCount");
      expect(ownerLiveBidSrc).toContain("can outbid");
      expect(ownerLiveBidSrc).toContain("tp.teamId === teamId");
      expect(ownerLiveBidSrc).toContain("tp.maximumSquadSize != null && tp.maximumSquadSize > 0 && (tp.playersBought ?? 0) >= tp.maximumSquadSize");
      expect(ownerLiveBidSrc).toContain("rivalMaxBid < nextBidAmount");
    });

    it("implements Squad Need Match badge with urgency based on current roster count and category fallback", () => {
      expect(ownerLiveBidSrc).toContain("High Priority: 0");
      expect(ownerLiveBidSrc).toContain("on roster");
      expect(ownerLiveBidSrc).toContain("Surplus: Already hold");
      expect(ownerLiveBidSrc).toContain("squadRoleCount");
      expect(ownerLiveBidSrc).toContain("state?.teamCategoryPlayerCounts");
    });

    it("embeds TacticalWarRoomStrip and LivePursePreservationSimulator across both stacked and split layouts", () => {
      // In stacked (dock) layout
      expect(ownerLiveBidSrc).toContain("<TacticalWarRoomStrip");
      expect(ownerLiveBidSrc).toContain("<LivePursePreservationSimulator");
      // Appears in multiple layout branches
      const stripMatches = (ownerLiveBidSrc.match(/<TacticalWarRoomStrip/g) || []).length;
      const simMatches = (ownerLiveBidSrc.match(/<LivePursePreservationSimulator/g) || []).length;
      expect(stripMatches).toBeGreaterThanOrEqual(2);
      expect(simMatches).toBeGreaterThanOrEqual(2);
    });
  });
});
