import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  isAuctionEnabled,
  isScoringEnabled,
  type TournamentModuleFlags,
} from "@workspace/platform-core";
import {
  CORE_SETTINGS_TABS,
  AUCTION_SETTINGS_TABS,
  SETTINGS_TABS,
  getAvailableSettingsTabs,
  parseSettingsTab,
  resolveSettingsTabFromSearch,
} from "../../lib/settings-navigation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Phase 4E: Tournament Settings Module Purity", () => {
  const settingsPageSrc = readFileSync(
    path.resolve(__dirname, "../tournament-settings.tsx"),
    "utf8",
  );
  const navigationSrc = readFileSync(
    path.resolve(__dirname, "../../lib/settings-navigation.ts"),
    "utf8",
  );

  describe("1. Settings Navigation Tab Classification & Availability", () => {
    it("defines canonical CORE_SETTINGS_TABS containing only core surfaces", () => {
      expect(CORE_SETTINGS_TABS).toEqual(["identity", "playerRegistration", "sponsors"]);
      expect(CORE_SETTINGS_TABS).not.toContain("auction");
      expect(CORE_SETTINGS_TABS).not.toContain("broadcast");
      expect(CORE_SETTINGS_TABS).not.toContain("recovery");
    });

    it("defines canonical AUCTION_SETTINGS_TABS containing only auction surfaces", () => {
      expect(AUCTION_SETTINGS_TABS).toEqual(["auction", "broadcast", "recovery"]);
      expect(AUCTION_SETTINGS_TABS).not.toContain("identity");
      expect(AUCTION_SETTINGS_TABS).not.toContain("playerRegistration");
      expect(AUCTION_SETTINGS_TABS).not.toContain("sponsors");
    });

    it("getAvailableSettingsTabs returns all 6 tabs for auction_only tournament", () => {
      const auctionOnly: TournamentModuleFlags = { auctionEnabled: true, scoringEnabled: false };
      const tabs = getAvailableSettingsTabs(auctionOnly);
      expect(tabs).toEqual(SETTINGS_TABS);
      expect(tabs).toContain("identity");
      expect(tabs).toContain("playerRegistration");
      expect(tabs).toContain("auction");
      expect(tabs).toContain("sponsors");
      expect(tabs).toContain("broadcast");
      expect(tabs).toContain("recovery");
    });

    it("getAvailableSettingsTabs returns ONLY core tabs for scoring_only tournament", () => {
      const scoringOnly: TournamentModuleFlags = { auctionEnabled: false, scoringEnabled: true };
      const tabs = getAvailableSettingsTabs(scoringOnly);
      expect(tabs).toEqual(CORE_SETTINGS_TABS);
      expect(tabs).toContain("identity");
      expect(tabs).toContain("playerRegistration");
      expect(tabs).toContain("sponsors");
      expect(tabs).not.toContain("auction");
      expect(tabs).not.toContain("broadcast");
      expect(tabs).not.toContain("recovery");
    });

    it("getAvailableSettingsTabs returns all 6 tabs for both tournament", () => {
      const both: TournamentModuleFlags = { auctionEnabled: true, scoringEnabled: true };
      const tabs = getAvailableSettingsTabs(both);
      expect(tabs).toEqual(SETTINGS_TABS);
      expect(tabs).toContain("identity");
      expect(tabs).toContain("playerRegistration");
      expect(tabs).toContain("auction");
      expect(tabs).toContain("sponsors");
      expect(tabs).toContain("broadcast");
      expect(tabs).toContain("recovery");
    });

    it("getAvailableSettingsTabs returns default tabs when tournament is undefined or legacy", () => {
      expect(getAvailableSettingsTabs(null)).toEqual(SETTINGS_TABS);
      expect(getAvailableSettingsTabs(undefined)).toEqual(SETTINGS_TABS);
      expect(getAvailableSettingsTabs({})).toEqual(SETTINGS_TABS);
    });
  });

  describe("2. Direct URL & Tab Search Parsing / Fallback Behavior", () => {
    const scoringOnly: TournamentModuleFlags = { auctionEnabled: false, scoringEnabled: true };
    const auctionOnly: TournamentModuleFlags = { auctionEnabled: true, scoringEnabled: false };
    const both: TournamentModuleFlags = { auctionEnabled: true, scoringEnabled: true };

    it("parseSettingsTab rejects auction tabs for scoring_only tournaments", () => {
      expect(parseSettingsTab("auction", scoringOnly)).toBeNull();
      expect(parseSettingsTab("broadcast", scoringOnly)).toBeNull();
      expect(parseSettingsTab("recovery", scoringOnly)).toBeNull();
    });

    it("parseSettingsTab allows core tabs for scoring_only tournaments", () => {
      expect(parseSettingsTab("identity", scoringOnly)).toBe("identity");
      expect(parseSettingsTab("playerRegistration", scoringOnly)).toBe("playerRegistration");
      expect(parseSettingsTab("sponsors", scoringOnly)).toBe("sponsors");
    });

    it("parseSettingsTab allows auction tabs for auction_only and both tournaments", () => {
      expect(parseSettingsTab("auction", auctionOnly)).toBe("auction");
      expect(parseSettingsTab("broadcast", auctionOnly)).toBe("broadcast");
      expect(parseSettingsTab("recovery", auctionOnly)).toBe("recovery");
      expect(parseSettingsTab("auction", both)).toBe("auction");
      expect(parseSettingsTab("broadcast", both)).toBe("broadcast");
      expect(parseSettingsTab("recovery", both)).toBe("recovery");
    });

    it("resolveSettingsTabFromSearch falls back to identity when scoring_only requests auction tabs", () => {
      expect(resolveSettingsTabFromSearch("?tab=auction", scoringOnly)).toBe("identity");
      expect(resolveSettingsTabFromSearch("?tab=broadcast", scoringOnly)).toBe("identity");
      expect(resolveSettingsTabFromSearch("?tab=recovery", scoringOnly)).toBe("identity");
    });

    it("resolveSettingsTabFromSearch preserves requested valid tabs for scoring_only", () => {
      expect(resolveSettingsTabFromSearch("?tab=identity", scoringOnly)).toBe("identity");
      expect(resolveSettingsTabFromSearch("?tab=playerRegistration", scoringOnly)).toBe("playerRegistration");
      expect(resolveSettingsTabFromSearch("?tab=sponsors", scoringOnly)).toBe("sponsors");
      expect(resolveSettingsTabFromSearch("?focus=registration", scoringOnly)).toBe("playerRegistration");
    });

    it("resolveSettingsTabFromSearch resolves auction tabs for auction_only and both", () => {
      expect(resolveSettingsTabFromSearch("?tab=auction", auctionOnly)).toBe("auction");
      expect(resolveSettingsTabFromSearch("?tab=broadcast", both)).toBe("broadcast");
      expect(resolveSettingsTabFromSearch("?tab=recovery", auctionOnly)).toBe("recovery");
    });
  });

  describe("3. Static Verification of Frontend Tournament Settings", () => {
    it("imports canonical module helpers from @workspace/platform-core", () => {
      expect(settingsPageSrc).toContain("isAuctionEnabled");
      expect(settingsPageSrc).toContain("isScoringEnabled");
      expect(settingsPageSrc).toMatch(/from "@workspace\/platform-core"/);
    });

    it("computes isAuction using canonical isAuctionEnabled(tournament)", () => {
      expect(settingsPageSrc).toMatch(/const\s+isAuction\s*=\s*tournament\s*\?\s*isAuctionEnabled\(tournament\)\s*:\s*true/);
    });

    it("filters tabs based on isAuction so auction tabs do not exist in navigation for scoring-only", () => {
      expect(settingsPageSrc).toMatch(/tabs\s*=\s*allTabs\.filter\(.*?\bisAuction\b.*?\)/);
    });

    it("includes a redirect safety effect when an auction tab is selected on scoring-only", () => {
      expect(settingsPageSrc).toContain("activeSection === \"auction\" || activeSection === \"broadcast\" || activeSection === \"recovery\"");
      expect(settingsPageSrc).toContain("navigate(settingsPath(tournamentId, \"identity\"), { replace: true })");
    });

    it("conditions Event Details Auction Date and Auction Time rendering on isAuction", () => {
      expect(settingsPageSrc).toMatch(/\{isAuction\s*&&\s*\([\s\S]*?Auction Date[\s\S]*?Auction Time[\s\S]*?\)\}/);
    });

    it("conditions Player Base Price Mode card rendering on isAuction", () => {
      expect(settingsPageSrc).toMatch(/\{isAuction\s*&&\s*\([\s\S]*?Player Base Price Mode[\s\S]*?\)\}/);
    });

    it("guards Auction Rules, Screen & Sound, and Reset panels with isAuction", () => {
      expect(settingsPageSrc).toContain('{isAuction && activeSection === "auction" && (');
      expect(settingsPageSrc).toContain('{isAuction && activeSection === "broadcast" && (');
      expect(settingsPageSrc).toContain('{isAuction && activeSection === "recovery" && (');
    });

    it("conditions auction validations in getSaveBlockReason on isAuction", () => {
      expect(settingsPageSrc).toContain("if (isAuction) {");
      expect(settingsPageSrc).toMatch(/if\s*\(isAuction\)\s*\{[\s\S]*?basePurse[\s\S]*?minBid[\s\S]*?bidTiers[\s\S]*?\}/);
    });

    it("constructs clean Core payload in performSave when isAuction is false", () => {
      expect(settingsPageSrc).toMatch(/if\s*\(isAuction\)\s*\{[\s\S]*?dataPayload\.basePurse[\s\S]*?dataPayload\.minBid[\s\S]*?dataPayload\.bidTiers[\s\S]*?\}/);
    });
  });

  describe("4. Save Validation Simulation: Scoring-Only vs Auction-Enabled", () => {
    function simulateGetSaveBlockReason(params: {
      isAuction: boolean;
      editForm: Record<string, string | number | boolean>;
      bidTiers: Array<{ upTo?: number; increment: number }>;
      openingTimerError?: string | null;
      bidTimerError?: string | null;
      squadSizeError?: string | null;
    }): string | null {
      const { isAuction, editForm, bidTiers, openingTimerError, bidTimerError, squadSizeError } = params;

      if (!(editForm.name as string)?.trim()) {
        return "Tournament name is required";
      }
      if (!(editForm.city as string)?.trim()) {
        return "City is required";
      }
      if (isAuction) {
        if (!Number(editForm.basePurse) || Number(editForm.basePurse) <= 0) {
          return "Team budget is required";
        }
        if (!Number(editForm.minBid) || Number(editForm.minBid) <= 0) {
          return "Minimum player value is required";
        }
        if (!bidTiers.some((t) => t.increment > 0)) {
          return "Bid increase amount is required";
        }
        if (openingTimerError) {
          return openingTimerError;
        }
        if (bidTimerError) {
          return bidTimerError;
        }
        if (squadSizeError) {
          return squadSizeError;
        }
      }
      return null;
    }

    it("allows save for scoring_only tournament even when all auction economics are empty/0", () => {
      const result = simulateGetSaveBlockReason({
        isAuction: false,
        editForm: {
          name: "City Premier League",
          city: "Bengaluru",
          basePurse: "",
          minBid: "",
          timerSeconds: "0",
        },
        bidTiers: [{ increment: 0 }],
        openingTimerError: "Timer invalid",
        bidTimerError: "Timer invalid",
        squadSizeError: "Squad error",
      });

      expect(result).toBeNull();
    });

    it("still enforces name and city requirements for scoring_only tournaments", () => {
      expect(
        simulateGetSaveBlockReason({
          isAuction: false,
          editForm: { name: "", city: "Bengaluru" },
          bidTiers: [],
        }),
      ).toBe("Tournament name is required");

      expect(
        simulateGetSaveBlockReason({
          isAuction: false,
          editForm: { name: "City League", city: "" },
          bidTiers: [],
        }),
      ).toBe("City is required");
    });

    it("blocks save for auction-enabled tournament when basePurse or minBid is missing", () => {
      expect(
        simulateGetSaveBlockReason({
          isAuction: true,
          editForm: { name: "City League", city: "Bengaluru", basePurse: "", minBid: "1000" },
          bidTiers: [{ increment: 100 }],
        }),
      ).toBe("Team budget is required");

      expect(
        simulateGetSaveBlockReason({
          isAuction: true,
          editForm: { name: "City League", city: "Bengaluru", basePurse: "100000", minBid: "0" },
          bidTiers: [{ increment: 100 }],
        }),
      ).toBe("Minimum player value is required");

      expect(
        simulateGetSaveBlockReason({
          isAuction: true,
          editForm: { name: "City League", city: "Bengaluru", basePurse: "100000", minBid: "1000" },
          bidTiers: [{ increment: 0 }],
        }),
      ).toBe("Bid increase amount is required");
    });
  });
});
