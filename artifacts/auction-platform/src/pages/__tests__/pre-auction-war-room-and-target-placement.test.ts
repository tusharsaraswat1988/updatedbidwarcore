import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  getOwnerTargetsStorageKey,
  readOwnerTargets,
  writeOwnerTargets,
  toggleOwnerTarget,
  isOwnerTarget,
  readAiRadarEnabled,
  writeAiRadarEnabled,
  toggleAiRadarEnabled,
  AI_RADAR_STORAGE_KEY,
} from "../../../../owner-app/src/lib/owner-targets";
import {
  isRecognizedRole,
  normalizeSportRole,
  getSportBlueprintRules,
  calculatePurseDistribution40_40_20,
  computeDraftPoolScarcity,
  detectProvenStars,
  computeBudgetSimulation,
  computeBluffRadar,
  computePlanBPivot,
} from "../../../../owner-app/src/lib/war-room-engine";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Pre-Auction AI Strategy War Room & Live Precision Placement", () => {
  const warRoomSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/screens/PreAuctionWarRoom.tsx"),
    "utf8"
  );
  const liveBidSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/screens/LiveBid.tsx"),
    "utf8"
  );
  const ownerRouteSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/screens/OwnerRoute.tsx"),
    "utf8"
  );
  const scoutSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/screens/Scout.tsx"),
    "utf8"
  );
  const warmupSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/screens/Warmup.tsx"),
    "utf8"
  );
  const interLotSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/components/InterLotCommandCenter.tsx"),
    "utf8"
  );
  const targetsLibSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/lib/owner-targets.ts"),
    "utf8"
  );
  const engineSrc = readFileSync(
    path.resolve(__dirname, "../../../../owner-app/src/lib/war-room-engine.ts"),
    "utf8"
  );

  describe("1. Pure Engine & Mathematical Logic (war-room-engine.ts)", () => {
    describe("isRecognizedRole helper & Silent Tolerance", () => {
      it("rejects null, undefined, empty, and whitespace roles", () => {
        expect(isRecognizedRole(null)).toBe(false);
        expect(isRecognizedRole(undefined)).toBe(false);
        expect(isRecognizedRole("")).toBe(false);
        expect(isRecognizedRole("   ")).toBe(false);
      });

      it("rejects Excel placeholder strings silently without breaking", () => {
        expect(isRecognizedRole("unknown")).toBe(false);
        expect(isRecognizedRole("UNKNOWN")).toBe(false);
        expect(isRecognizedRole("n/a")).toBe(false);
        expect(isRecognizedRole("N/A")).toBe(false);
        expect(isRecognizedRole("na")).toBe(false);
        expect(isRecognizedRole("-")).toBe(false);
        expect(isRecognizedRole("--")).toBe(false);
        expect(isRecognizedRole("none")).toBe(false);
        expect(isRecognizedRole("null")).toBe(false);
        expect(isRecognizedRole("undefined")).toBe(false);
      });

      it("accepts valid sports roles", () => {
        expect(isRecognizedRole("Batter")).toBe(true);
        expect(isRecognizedRole("Bowler")).toBe(true);
        expect(isRecognizedRole("All-Rounder")).toBe(true);
        expect(isRecognizedRole("Wicketkeeper")).toBe(true);
        expect(isRecognizedRole("Goalkeeper")).toBe(true);
        expect(isRecognizedRole("Singles Specialist")).toBe(true);
      });
    });

    describe("normalizeSportRole across sports", () => {
      it("normalizes cricket roles into canonical categories", () => {
        expect(normalizeSportRole("wk", "cricket")).toBe("Wicketkeeper");
        expect(normalizeSportRole("Wicket-Keeper", "cricket")).toBe("Wicketkeeper");
        expect(normalizeSportRole("Wicket Keeper Batsman", "cricket")).toBe("Wicketkeeper");
        expect(normalizeSportRole("All Rounder", "cricket")).toBe("All-Rounder");
        expect(normalizeSportRole("allrounder", "cricket")).toBe("All-Rounder");
        expect(normalizeSportRole("Fast Bowler", "cricket")).toBe("Bowler");
        expect(normalizeSportRole("Leg Spinner", "cricket")).toBe("Bowler");
        expect(normalizeSportRole("Opening Batsman", "cricket")).toBe("Batter");
        expect(normalizeSportRole("Top-order Batter", "cricket")).toBe("Batter");
        expect(normalizeSportRole("unknown", "cricket")).toBe("General Player");
      });

      it("normalizes football and badminton roles accurately", () => {
        expect(normalizeSportRole("Goalkeeper", "football")).toBe("Goalkeeper");
        expect(normalizeSportRole("Center Back", "football")).toBe("Defender");
        expect(normalizeSportRole("Central Midfield", "football")).toBe("Midfielder");
        expect(normalizeSportRole("Striker", "football")).toBe("Forward");
        expect(normalizeSportRole("Singles", "badminton")).toBe("Singles Specialist");
        expect(normalizeSportRole("Men's Doubles", "badminton")).toBe("Doubles Specialist");
        expect(normalizeSportRole("Mixed", "badminton")).toBe("Mixed Doubles");
      });
    });

    describe("getSportBlueprintRules", () => {
      it("returns sport-aware targets for Cricket (3-4 Batters, 1-2 Keepers, 3-4 All-Rounders, 4-5 Bowlers)", () => {
        const rules = getSportBlueprintRules("cricket");
        expect(rules).toHaveLength(4);
        expect(rules.find((r) => r.role === "Batter")).toEqual(
          expect.objectContaining({ min: 3, max: 4 })
        );
        expect(rules.find((r) => r.role === "Wicketkeeper")).toEqual(
          expect.objectContaining({ min: 1, max: 2 })
        );
        expect(rules.find((r) => r.role === "All-Rounder")).toEqual(
          expect.objectContaining({ min: 3, max: 4 })
        );
        expect(rules.find((r) => r.role === "Bowler")).toEqual(
          expect.objectContaining({ min: 4, max: 5 })
        );
      });
    });

    describe("40-40-20 Purse Distribution Rule", () => {
      it("computes exact 40% Anchor, 40% Core XI, 20% Value Bench with exact purse conservation", () => {
        const purse1Cr = 10_000_000;
        const res1 = calculatePurseDistribution40_40_20(purse1Cr);
        expect(res1.anchorStars).toBe(4_000_000);
        expect(res1.coreXI).toBe(4_000_000);
        expect(res1.valueBench).toBe(2_000_000);
        expect(res1.anchorStars + res1.coreXI + res1.valueBench).toBe(purse1Cr);

        // Edge case: Odd purse amount with non-trivial rounding
        const oddPurse = 7_777_777;
        const res2 = calculatePurseDistribution40_40_20(oddPurse);
        expect(res2.anchorStars + res2.coreXI + res2.valueBench).toBe(oddPurse);

        // Boundary case: 0 purse
        const resZero = calculatePurseDistribution40_40_20(0);
        expect(resZero).toEqual({ anchorStars: 0, coreXI: 0, valueBench: 0 });
      });
    });

    describe("computeDraftPoolScarcity (FOMO Engine)", () => {
      it("raises critical squeeze alert when role supply is less than competing teams count", () => {
        const pool = [
          { id: 1, name: "WK 1", role: "Wicketkeeper" },
          { id: 2, name: "WK 2", role: "Wicketkeeper" },
          { id: 3, name: "WK 3", role: "Wicketkeeper" },
          { id: 4, name: "WK 4", role: "Wicketkeeper" },
          { id: 5, name: "WK 5", role: "Wicketkeeper" },
          // 8 Batters
          ...Array.from({ length: 8 }, (_, i) => ({ id: 10 + i, name: `Bat ${i}`, role: "Batter" })),
          // 8 Bowlers
          ...Array.from({ length: 8 }, (_, i) => ({ id: 20 + i, name: `Bowl ${i}`, role: "Bowler" })),
          // 8 All-Rounders
          ...Array.from({ length: 8 }, (_, i) => ({ id: 30 + i, name: `AR ${i}`, role: "All-Rounder" })),
        ];

        // 8 teams competing, only 5 Wicketkeepers available -> deficit of 3
        const alerts = computeDraftPoolScarcity({
          availablePlayers: pool,
          teamsCount: 8,
          sportName: "cricket",
        });

        const wkAlert = alerts.find((a) => a.role === "Wicketkeeper");
        expect(wkAlert).toBeDefined();
        expect(wkAlert?.isCritical).toBe(true);
        expect(wkAlert?.deficit).toBe(3);
        expect(wkAlert?.message).toContain("Only 5 Wicketkeepers available in draft pool across 8 teams! (3 teams will face a deficit).");
      });

      it("silently suppresses role alarms when player pool has no assigned roles (Excel raw import fallback)", () => {
        const rawPool = [
          { id: 1, name: "Player A", role: "" },
          { id: 2, name: "Player B", role: "unknown" },
          { id: 3, name: "Player C", role: "n/a" },
        ];
        const alerts = computeDraftPoolScarcity({
          availablePlayers: rawPool,
          teamsCount: 4,
          sportName: "cricket",
        });
        expect(alerts).toEqual([]);
      });
    });

    describe("detectProvenStars", () => {
      it("detects players with tags, high base valuations, and historical achievements", () => {
        const pool = [
          { id: 1, name: "Icon Star", role: "Batter", playerTag: "star_player", basePrice: 50_000 },
          { id: 2, name: "Captain Legend", role: "Bowler", playerTag: "captain", basePrice: 50_000 },
          { id: 3, name: "Expensive Ace", role: "All-Rounder", basePrice: 250_000 }, // >= 2 * 100k
          { id: 4, name: "Top-5 Veteran", role: "Batter", basePrice: 50_000, achievements: "Season 1 Top 5 MVP" },
          { id: 5, name: "Ordinary Player", role: "Bowler", basePrice: 50_000 },
          { id: 6, name: "Coach Non-Playing", role: "Coach", playerTag: "star_player", isNonPlayingMember: true },
        ];

        const stars = detectProvenStars(pool, 100_000);
        expect(stars.map((p) => p.id)).toEqual([1, 2, 3, 4]);
        expect(stars.some((p) => p.id === 5)).toBe(false);
        expect(stars.some((p) => p.id === 6)).toBe(false); // Non-playing excluded
      });
    });

    describe("computeBudgetSimulation", () => {
      it("evaluates healthy squad plan with adequate purse reserve", () => {
        const res = computeBudgetSimulation({
          purseRemaining: 5_000_000,
          targetedAvailablePlayers: [
            { id: 1, name: "Target 1", basePrice: 500_000 },
            { id: 2, name: "Target 2", basePrice: 500_000 },
          ],
          remainingMandatorySlots: 5,
          minBasePrice: 100_000,
        });

        expect(res.targetedCount).toBe(2);
        expect(res.estimatedTargetSpend).toBe(1_000_000);
        expect(res.purseAfterTargets).toBe(4_000_000);
        expect(res.unfilledSlotsAfterTargets).toBe(3); // 5 - 2 = 3
        expect(res.remainingPursePerSlot).toBe(Math.floor(4_000_000 / 3)); // 1,333,333
        expect(res.status.level).toBe("healthy");
        expect(res.status.badge).toBe("Plan Balanced");
      });

      it("evaluates quota fulfillment when shortlisted targets cover all remaining mandatory slots", () => {
        const res = computeBudgetSimulation({
          purseRemaining: 3_000_000,
          targetedAvailablePlayers: [
            { id: 1, name: "T1", basePrice: 200_000 },
            { id: 2, name: "T2", basePrice: 200_000 },
            { id: 3, name: "T3", basePrice: 200_000 },
          ],
          remainingMandatorySlots: 3,
          minBasePrice: 100_000,
        });

        expect(res.targetedCount).toBe(3);
        expect(res.unfilledSlotsAfterTargets).toBe(0);
        expect(res.isQuotaCoveredByTargets).toBe(true);
        expect(res.surplusPurse).toBe(2_400_000); // 3M - 600k
        expect(res.status.level).toBe("healthy");
        expect(res.status.badge).toBe("Plan Balanced");
        expect(res.status.message).toContain("All 3 squad slot requirements covered");
      });

      it("evaluates quota deficit risk when remaining purse is insufficient for base prices", () => {
        const res = computeBudgetSimulation({
          purseRemaining: 1_200_000,
          targetedAvailablePlayers: [
            { id: 1, name: "T1", basePrice: 1_000_000 },
          ],
          remainingMandatorySlots: 5, // 4 unfilled slots left
          minBasePrice: 100_000,
        });

        // purseAfterTargets = 200k for 4 slots = 50k/slot < 100k min base price!
        expect(res.purseAfterTargets).toBe(200_000);
        expect(res.unfilledSlotsAfterTargets).toBe(4);
        expect(res.remainingPursePerSlot).toBe(50_000);
        expect(res.status.level).toBe("deficit");
        expect(res.status.badge).toBe("Tight Reserve");
      });

      it("evaluates critical overdraft when shortlisted targets exceed purse", () => {
        const res = computeBudgetSimulation({
          purseRemaining: 500_000,
          targetedAvailablePlayers: [
            { id: 1, name: "T1", basePrice: 800_000 },
          ],
          remainingMandatorySlots: 2,
          minBasePrice: 100_000,
        });

        expect(res.purseAfterTargets).toBe(-300_000);
        expect(res.status.level).toBe("overdraft");
        expect(res.status.badge).toBe("Budget Exceeded");
      });
    });
  });

  describe("2. Personal Target Shortlist & Private LocalStorage Storage", () => {
    it("generates correct private localStorage key scoped to tournament and team", () => {
      expect(getOwnerTargetsStorageKey(42, 7)).toBe("bidwar_owner_targets_42_7");
      expect(targetsLibSrc).toContain("bidwar_owner_targets_${tournamentId}_${teamId}");
    });

    it("provides robust JSON parse and serialization handling numbers, objects, and malformed inputs", () => {
      const storage: Record<string, string> = {};
      const mockStorage = {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
        removeItem: (k: string) => { delete storage[k]; },
      };
      const origWindow = globalThis.window;
      // @ts-ignore
      globalThis.window = { localStorage: mockStorage, dispatchEvent: () => true };
      // @ts-ignore
      globalThis.localStorage = mockStorage;

      try {
        // Empty read
        expect(readOwnerTargets(99, 1)).toEqual([]);

        // Write array
        writeOwnerTargets(99, 1, [10, 20, 30]);
        expect(storage["bidwar_owner_targets_99_1"]).toBe("[10,20,30]");
        expect(readOwnerTargets(99, 1)).toEqual([10, 20, 30]);
        expect(isOwnerTarget(99, 1, 20)).toBe(true);
        expect(isOwnerTarget(99, 1, 999)).toBe(false);

        // Toggle target (remove 20)
        const updated1 = toggleOwnerTarget(99, 1, 20);
        expect(updated1).toEqual([10, 30]);

        // Toggle target (add 40)
        const updated2 = toggleOwnerTarget(99, 1, 40);
        expect(updated2).toEqual([10, 30, 40]);

        // Parse legacy/object format: { ids: [5, 6] }
        storage["bidwar_owner_targets_99_1"] = JSON.stringify({ ids: [5, 6] });
        expect(readOwnerTargets(99, 1)).toEqual([5, 6]);

        // Parse key-value object: { "12": true, "34": true }
        storage["bidwar_owner_targets_99_1"] = JSON.stringify({ "12": true, "34": true });
        expect(readOwnerTargets(99, 1)).toEqual([12, 34]);

        // Malformed JSON falls back gracefully to empty array without exception
        storage["bidwar_owner_targets_99_1"] = "invalid json {";
        expect(readOwnerTargets(99, 1)).toEqual([]);
      } finally {
        globalThis.window = origWindow;
      }
    });

    it("persists 1-click AI Radar preference under bidwar_owner_ai_radar_enabled and toggles state", () => {
      const storage: Record<string, string> = {};
      const mockStorage = {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
        removeItem: (k: string) => { delete storage[k]; },
      };
      const origWindow = globalThis.window;
      // @ts-ignore
      globalThis.window = { localStorage: mockStorage, dispatchEvent: () => true };
      // @ts-ignore
      globalThis.localStorage = mockStorage;

      try {
        expect(AI_RADAR_STORAGE_KEY).toBe("bidwar_owner_ai_radar_enabled");
        expect(readAiRadarEnabled()).toBe(true); // Default true

        writeAiRadarEnabled(false);
        expect(storage[AI_RADAR_STORAGE_KEY]).toBe("false");
        expect(readAiRadarEnabled()).toBe(false);

        const next = toggleAiRadarEnabled();
        expect(next).toBe(true);
        expect(storage[AI_RADAR_STORAGE_KEY]).toBe("true");
        expect(readAiRadarEnabled()).toBe(true);
      } finally {
        globalThis.window = origWindow;
      }
    });
  });

  describe("3. Live Auction Precision Placement & AI UI Controls (LiveBid.tsx)", () => {
    it("renders sleek gold badge '⭐ YOUR TARGET PLAYER' in mobile PlayerCard", () => {
      expect(liveBidSrc).toContain("⭐ YOUR TARGET PLAYER");
      expect(liveBidSrc).toContain("isTargetPlayer &&");
      expect(liveBidSrc).toContain("bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300");
    });

    it("renders sleek gold badge '⭐ YOUR TARGET PLAYER' in tablet/desktop PlayerCard", () => {
      expect(liveBidSrc).toContain("isTargetPlayer");
      expect(liveBidSrc).toContain("⭐ YOUR TARGET PLAYER");
    });

    it("renders sleek gold badge '⭐ YOUR TARGET PLAYER' in PlayerBioSideDrawer dossier", () => {
      expect(liveBidSrc).toContain("isTargetPlayer = false");
      expect(liveBidSrc).toContain("⭐ YOUR TARGET PLAYER");
    });

    it("implements 1-click AI Radar toggle in TacticalWarRoomStrip", () => {
      expect(liveBidSrc).toContain("aiRadarEnabled = true");
      expect(liveBidSrc).toContain("onToggleAiRadar");
      expect(liveBidSrc).toContain("🎯 Strategy: Full");
      expect(liveBidSrc).toContain("🎯 Strategy: Min");
    });

    it("collapses TacticalWarRoomStrip into a compact 24px micro-pill when AI Radar is OFF", () => {
      expect(liveBidSrc).toContain("h-6 min-h-[24px]");
      expect(liveBidSrc).toContain("Strategy: Min");
      expect(liveBidSrc).toContain("· Tap to expand");
    });

    it("hides LivePursePreservationSimulator completely when AI Radar is turned OFF", () => {
      expect(liveBidSrc).toContain("if (aiRadarEnabled === false) return null;");
    });

    it("keeps Header actionBlock streamlined for session controls without duplicate drawer triggers", () => {
      expect(liveBidSrc).toContain("onSync");
      expect(liveBidSrc).toContain("onLeave");
    });
  });

  describe("4. Screen Integration & Screen Return Flow (OwnerRoute.tsx & Scout.tsx)", () => {
    it("tracks warRoomReturnScreen so closing War Room returns to Warmup when opened from Warmup", () => {
      expect(ownerRouteSrc).toContain("warRoomReturnScreen");
      expect(ownerRouteSrc).toContain('handleViewWarRoom("warmup")');
      expect(ownerRouteSrc).toContain('handleViewWarRoom("scout")');
      expect(ownerRouteSrc).toContain('handleViewWarRoom("live")');
      expect(ownerRouteSrc).toContain("setScreen(warRoomReturnScreen)");
    });

    it("passes auctionStarted prop to PreAuctionWarRoom for live block auto-return alerts", () => {
      expect(ownerRouteSrc).toContain("auctionStarted={scoutAutoReturn}");
      expect(warRoomSrc).toContain("auctionStarted = false");
      expect(warRoomSrc).toContain("Player on stage — returning to live bidding");
    });

    it("provides direct War Room entry points from Warmup, Scout, and InterLotCommandCenter", () => {
      expect(warmupSrc).toContain("onOpenWarRoom");
      expect(warmupSrc).toContain("Open Strategy Desk");
      expect(scoutSrc).toContain("onViewWarRoom");
      expect(scoutSrc).toContain("STRATEGY DESK");
      expect(interLotSrc).toContain("onViewWarRoom");
      expect(interLotSrc).toContain("STRATEGY DESK");
    });

    it("integrates target player toggling and indicators in Scout.tsx unsold list", () => {
      expect(scoutSrc).toContain("useOwnerTargets");
      expect(scoutSrc).toContain("toggleTarget");
      expect(scoutSrc).toContain("⭐ TARGET");
    });

    it("integrates OwnerPlayerAuctionHistory into PreAuctionWarRoom for past Top-5 badges and auction dossier", () => {
      expect(warRoomSrc).toContain("OwnerPlayerAuctionHistory");
      expect(warRoomSrc).toContain("expandedHistoryPlayerId");
      expect(warRoomSrc).toContain("Toggle Player Auction History");
    });

    it("guards role breakdown in InterLotCommandCenter against raw Excel placeholders", () => {
      expect(interLotSrc).toContain("isRecognizedRole");
    });
  });

  describe("5. Tactical Bluff Radar & Post-Lot Plan-B Recovery (Option A)", () => {
    const mockAllPlayers = [
      { id: 1, name: "Batter 1", role: "Batter", status: "sold", teamId: 2 },
      { id: 2, name: "Batter 2", role: "Batter", status: "sold", teamId: 2 },
      { id: 3, name: "Batter 3", role: "Batter", status: "sold", teamId: 2 },
      { id: 4, name: "Batter 4", role: "Batter", status: "sold", teamId: 2 },
      { id: 5, name: "Bowler 1", role: "Bowler", status: "sold", teamId: 2 },
      { id: 10, name: "Target Batter", role: "Batter", status: "available" },
      { id: 11, name: "Pool Batter B", role: "Batter", status: "available" },
      { id: 12, name: "Pool Batter C", role: "Batter", status: "available" },
    ];

    const mockTeamPurses = [
      { teamId: 1, slotsRequired: 5, spendablePurse: 500000 },
      { teamId: 2, slotsRequired: 1, minimumSquadSize: 11, playersBought: 10, spendablePurse: 600000 },
    ];

    it("evaluates high-risk bluff when rival already over-saturated in role with <= 2 slots open", () => {
      const result = computeBluffRadar({
        currentBidTeamId: 2,
        currentBidTeamName: "Rival Titans",
        myTeamId: 1,
        currentPlayerRole: "Batter",
        currentPlayerBasePrice: 50000,
        currentBidAmount: 180000,
        sportName: "cricket",
        allPlayers: mockAllPlayers,
        teamPurses: mockTeamPurses,
        walkAwayPrice: 200000,
      });

      expect(result.isBluffRisk).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.rivalRoleCount).toBe(4);
      expect(result.rivalRemainingSlots).toBe(1);
      expect(result.headline).toContain("HIGH PRICE-BUMPING RISK");
      expect(result.message).toContain("Rival Titans already has 4 Batters");
    });

    it("evaluates caution bluff when rival met basic quota and bid is approaching walk-away limit", () => {
      const result = computeBluffRadar({
        currentBidTeamId: 2,
        currentBidTeamName: "Rival Titans",
        myTeamId: 1,
        currentPlayerRole: "Bowler",
        currentPlayerBasePrice: 50000,
        currentBidAmount: 175000,
        sportName: "cricket",
        allPlayers: [
          { id: 5, name: "Bowler 1", role: "Bowler", status: "sold", teamId: 2 },
          { id: 6, name: "Bowler 2", role: "Bowler", status: "sold", teamId: 2 },
          { id: 7, name: "Bowler 3", role: "Bowler", status: "sold", teamId: 2 },
          { id: 8, name: "Bowler 4", role: "Bowler", status: "sold", teamId: 2 },
        ],
        teamPurses: [
          { teamId: 2, slotsRequired: 3, minimumSquadSize: 11, playersBought: 8, spendablePurse: 400000 },
        ],
        walkAwayPrice: 190000,
      });

      expect(result.isBluffRisk).toBe(true);
      expect(result.severity).toBe("caution");
      expect(result.headline).toContain("RIVAL BLUFF RADAR");
    });

    it("silently skips bluff detection when role is unrecognized or raw Excel placeholder", () => {
      const result = computeBluffRadar({
        currentBidTeamId: 2,
        currentBidTeamName: "Rival Titans",
        myTeamId: 1,
        currentPlayerRole: "n/a",
        currentPlayerBasePrice: 50000,
        currentBidAmount: 100000,
        sportName: "cricket",
        allPlayers: mockAllPlayers,
        teamPurses: mockTeamPurses,
      });

      expect(result.isBluffRisk).toBe(false);
      expect(result.severity).toBe("none");
    });

    it("does not flag bluff when my own team is leading or no current bidder exists", () => {
      const selfLeading = computeBluffRadar({
        currentBidTeamId: 1,
        currentBidTeamName: "My Team",
        myTeamId: 1,
        currentPlayerRole: "Batter",
        currentPlayerBasePrice: 50000,
        currentBidAmount: 100000,
        sportName: "cricket",
        allPlayers: mockAllPlayers,
        teamPurses: mockTeamPurses,
      });
      expect(selfLeading.isBluffRisk).toBe(false);

      const noBidder = computeBluffRadar({
        currentBidTeamId: null,
        myTeamId: 1,
        currentPlayerRole: "Batter",
      });
      expect(noBidder.isBluffRisk).toBe(false);
    });

    it("computes Plan-B Pivot when a shortlisted target is sold to a rival team", () => {
      const result = computePlanBPivot({
        lastSoldPlayer: {
          id: 10,
          name: "Target Batter",
          role: "Batter",
          soldToTeamId: 2,
          soldToTeamName: "Rival Titans",
          soldAmount: 220000,
        },
        myTeamId: 1,
        targetPlayerIds: [10, 99],
        allPlayers: mockAllPlayers,
        sportName: "cricket",
        purseRemaining: 800000,
        remainingMandatorySlots: 4,
      });

      expect(result.isTargetLost).toBe(true);
      expect(result.lostPlayerName).toBe("Target Batter");
      expect(result.lostPlayerRole).toBe("Batter");
      expect(result.soldToTeamName).toBe("Rival Titans");
      expect(result.remainingSimilarCount).toBe(2);
      expect(result.remainingSimilarPlayers.length).toBe(2);
      expect(result.headline).toContain("Target Acquired by Rival");
      expect(result.message).toContain("2 other Batters remain available in the draft pool");
      expect(result.suggestedHeadroomPct).toBe(15);
    });

    it("indicates pool exhaustion when lost target was the last available specialist of that role", () => {
      const exhaustedPool = [
        { id: 10, name: "Lone Wicketkeeper", role: "Wicketkeeper", status: "sold", teamId: 2 },
        { id: 11, name: "Batter A", role: "Batter", status: "available" },
      ];

      const result = computePlanBPivot({
        lastSoldPlayer: {
          id: 10,
          name: "Lone Wicketkeeper",
          role: "Wicketkeeper",
          soldToTeamId: 2,
          soldToTeamName: "Rival Titans",
          soldAmount: 150000,
        },
        myTeamId: 1,
        targetPlayerIds: [10],
        allPlayers: exhaustedPool,
        sportName: "cricket",
        purseRemaining: 600000,
        remainingMandatorySlots: 3,
      });

      expect(result.isTargetLost).toBe(true);
      expect(result.remainingSimilarCount).toBe(0);
      expect(result.headline).toContain("Position Exhausted in Pool");
      expect(result.message).toContain("No further Wicketkeeper lots remain in the available draft pool");
      expect(result.suggestedHeadroomPct).toBe(15);
    });

    it("does not trigger Plan-B Pivot when my team won the target or target was not shortlisted", () => {
      const myTeamWon = computePlanBPivot({
        lastSoldPlayer: { id: 10, name: "Target Batter", role: "Batter", soldToTeamId: 1, soldAmount: 100000 },
        myTeamId: 1,
        targetPlayerIds: [10],
        allPlayers: mockAllPlayers,
      });
      expect(myTeamWon.isTargetLost).toBe(false);

      const notTargeted = computePlanBPivot({
        lastSoldPlayer: { id: 77, name: "Random Player", role: "Batter", soldToTeamId: 2, soldAmount: 100000 },
        myTeamId: 1,
        targetPlayerIds: [10],
        allPlayers: mockAllPlayers,
      });
      expect(notTargeted.isTargetLost).toBe(false);
    });

    it("verifies LiveBid and InterLotCommandCenter UI integration of Bluff Radar & Plan-B Pivot", () => {
      expect(liveBidSrc).toContain("computeBluffRadar");
      expect(liveBidSrc).toContain("computePlanBPivot");
      expect(liveBidSrc).toContain("bluffAlert={bluffAlert}");
      expect(liveBidSrc).toContain("planBPivot={planBPivot}");
      expect(liveBidSrc).toContain("ShieldAlert");
      expect(interLotSrc).toContain("computePlanBPivot");
      expect(interLotSrc).toContain("planBPivot?.isTargetLost");
      expect(interLotSrc).toContain("Adjust Plan");
    });
  });

  describe("Pre-Auction Strategy Hub & Intelligent Orientation", () => {
    const countdownCardSrc = readFileSync(
      path.resolve(__dirname, "../../../../owner-app/src/components/PreAuctionCountdownCard.tsx"),
      "utf8"
    );

    it("verifies PreAuctionCountdownCard exists and implements live ticking countdown and event schedule", () => {
      expect(countdownCardSrc).toContain("export function PreAuctionCountdownCard");
      expect(countdownCardSrc).toContain("calculateTimeRemaining");
      expect(countdownCardSrc).toContain("Time Remaining Until Auction Starts");
      expect(countdownCardSrc).toContain("formattedDate");
      expect(countdownCardSrc).toContain("formattedTime");
      expect(countdownCardSrc).toContain("OPEN STRATEGY DESK");
    });

    it("verifies LiveBid detects pre-auction state and avoids misleading LIVE badge or waiting spinner", () => {
      expect(liveBidSrc).toContain("const hasAuctionCommenced =");
      expect(liveBidSrc).toContain("const isFutureSchedule =");
      expect(liveBidSrc).toContain("const isPreAuction =");
      expect(liveBidSrc).toContain("isPreAuction ? \"PRE-AUCTION\"");
      expect(liveBidSrc).toContain("<PreAuctionCountdownCard");
      expect(liveBidSrc).toContain("key=\"pre-auction-countdown\"");
      expect(liveBidSrc).toContain("key=\"pre-auction-countdown-split\"");
    });

    it("verifies InterLotCommandCenter switches to Pre-Auction Strategy HQ during pre-auction mode", () => {
      expect(interLotSrc).toContain("isPreAuction");
      expect(interLotSrc).toContain("PRE-AUCTION STRATEGY HQ");
      expect(interLotSrc).toContain("formattedAuctionDate");
    });
  });
});
