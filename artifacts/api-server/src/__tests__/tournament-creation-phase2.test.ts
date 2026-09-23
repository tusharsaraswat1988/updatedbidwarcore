import { describe, expect, it } from "vitest";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
  tryResolveTournamentProductMode,
  InvalidTournamentModuleStateError,
  isScoringSupportedSport,
  type TournamentProductMode,
} from "@workspace/platform-core";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import {
  publicTournamentSerializer,
  privateTournamentSerializer,
} from "../lib/serializers/tournament";
import { resolveAuctionCreateCatalogBindings } from "../../../auction-platform/src/components/tournament-creation/auction-create-bindings";
import { WIZARD_STEPS } from "../../../auction-platform/src/components/tournament-creation/types";

function makeMinimalTournamentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    name: "Phase 2 Tournament",
    sport: "cricket",
    sportId: 1,
    auctionCode: "P2123456",
    venue: "Wankhede Stadium",
    city: "Mumbai",
    auctionDate: "2026-11-01",
    auctionTime: "11:00",
    organizerName: "Test Organizer",
    organizerMobile: "9876543210",
    organizerEmail: "organizer@test.com",
    organizerId: 1,
    logoUrl: null,
    logoPublicId: null,
    sponsorLogos: null,
    auctionUnit: "rupee",
    basePurse: 10000000,
    minBid: 100000,
    bidIncrement: 100000,
    bidTier1UpTo: null,
    bidTier1Increment: null,
    bidTier2UpTo: null,
    bidTier2Increment: null,
    bidTier3Increment: null,
    bidTiers: null,
    timerSeconds: 30,
    bidTimerSeconds: 15,
    bidExtensionEnabled: false,
    bidExtensionThresholdSeconds: 3,
    bidExtensionSeconds: 5,
    playerSelectionMode: "sequential",
    status: "setup",
    licenseStatus: "trial",
    adminLocked: false,
    registrationDeadline: null,
    registrationLimit: null,
    autoApproveWithdrawnReRegistration: false,
    enableRegistrationPayment: false,
    registrationFee: null,
    enableRegistrationDeclaration: false,
    registrationDeclarationText: null,
    bidValueMode: "system",
    bidValueOptions: null,
    minimumSquadSize: 0,
    maximumSquadSize: 0,
    audioEnabled: true,
    masterVolume: 80,
    countdownSoundEnabled: true,
    countdownSoundUrl: null,
    countdownSoundVolume: 70,
    soldSoundEnabled: true,
    soldSoundUrl: null,
    soldSoundVolume: 80,
    cheerMessagesEnabled: true,
    cheerMessagePresets: null,
    breakEndMusicEnabled: false,
    breakEndMusicUrl: null,
    breakEndMusicVolume: 80,
    mainBannerUrl: null,
    mainBannerPublicId: null,
    mainBannerEnabled: false,
    mainBannerFit: "cover",
    matchDates: null,
    registrationFieldsJson: null,
    playerRegistrationMode: "auction",
    registrationCategoryMode: null,
    auctionEnabled: true,
    scoringEnabled: false,
    scoringPhase: "disabled",
    scoringPin: null,
    scoringSettingsJson: null,
    featuresJson: null,
    variantId: null,
    competitionTypeId: null,
    ruleProfileId: null,
    ruleProfileVersion: null,
    presentationProfileId: null,
    presentationProfileVersion: null,
    registrationModeId: null,
    teamFormationStrategyId: null,
    squadRulesJson: null,
    businessStageId: "registration_planning",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    ...overrides,
  } as any;
}

describe("Phase 2: Tournament Creation Architecture", () => {
  describe("Module State & Resolution Matrix", () => {
    it("resolves auction_only correctly (auctionEnabled: true, scoringEnabled: false)", () => {
      expect(isAuctionEnabled({ auctionEnabled: true, scoringEnabled: false })).toBe(true);
      expect(isScoringEnabled({ auctionEnabled: true, scoringEnabled: false })).toBe(false);
      expect(resolveTournamentProductMode({ auctionEnabled: true, scoringEnabled: false })).toBe(
        "auction_only",
      );
    });

    it("resolves scoring_only correctly (auctionEnabled: false, scoringEnabled: true)", () => {
      expect(isAuctionEnabled({ auctionEnabled: false, scoringEnabled: true })).toBe(false);
      expect(isScoringEnabled({ auctionEnabled: false, scoringEnabled: true })).toBe(true);
      expect(resolveTournamentProductMode({ auctionEnabled: false, scoringEnabled: true })).toBe(
        "scoring_only",
      );
    });

    it("resolves both correctly (auctionEnabled: true, scoringEnabled: true)", () => {
      expect(isAuctionEnabled({ auctionEnabled: true, scoringEnabled: true })).toBe(true);
      expect(isScoringEnabled({ auctionEnabled: true, scoringEnabled: true })).toBe(true);
      expect(resolveTournamentProductMode({ auctionEnabled: true, scoringEnabled: true })).toBe(
        "both",
      );
    });

    it("rejects invalid state (auctionEnabled: false, scoringEnabled: false) with InvalidTournamentModuleStateError", () => {
      expect(() =>
        resolveTournamentProductMode({ auctionEnabled: false, scoringEnabled: false }),
      ).toThrow(InvalidTournamentModuleStateError);

      expect(
        tryResolveTournamentProductMode({ auctionEnabled: false, scoringEnabled: false }),
      ).toBeNull();
    });
  });

  describe("Mandatory Correction 1: Product Mode vs Competition Type Decoupling", () => {
    it("does NOT invent a new hybrid competition type when productMode === 'both'", () => {
      const bindingsBothCricket = resolveAuctionCreateCatalogBindings("cricket", "both");
      expect("error" in bindingsBothCricket).toBe(false);
      if (!("error" in bindingsBothCricket)) {
        expect(bindingsBothCricket.competitionTypeId).toBe("auction");
        expect(bindingsBothCricket.competitionTypeId).not.toBe("hybrid");
        const comp = CatalogRegistry.getCompetitionType(bindingsBothCricket.competitionTypeId);
        expect(comp?.requiresAuctionEconomics).toBe(true);
      }

      const bindingsBothBadminton = resolveAuctionCreateCatalogBindings("badminton", "both");
      expect("error" in bindingsBothBadminton).toBe(false);
      if (!("error" in bindingsBothBadminton)) {
        expect(bindingsBothBadminton.competitionTypeId).toBe("auction");
        expect(bindingsBothBadminton.competitionTypeId).not.toBe("hybrid");
        const comp = CatalogRegistry.getCompetitionType(bindingsBothBadminton.competitionTypeId);
        expect(comp?.requiresAuctionEconomics).toBe(true);
      }
    });

    it("resolves scoring_only to registered_teams without requiring auction economics", () => {
      const bindingsScoringCricket = resolveAuctionCreateCatalogBindings("cricket", "scoring_only");
      expect("error" in bindingsScoringCricket).toBe(false);
      if (!("error" in bindingsScoringCricket)) {
        expect(bindingsScoringCricket.competitionTypeId).toBe("registered_teams");
        const comp = CatalogRegistry.getCompetitionType(bindingsScoringCricket.competitionTypeId);
        expect(comp?.requiresAuctionEconomics).toBe(false);
      }

      const bindingsScoringBadminton = resolveAuctionCreateCatalogBindings("badminton", "scoring_only");
      expect("error" in bindingsScoringBadminton).toBe(false);
      if (!("error" in bindingsScoringBadminton)) {
        expect(bindingsScoringBadminton.competitionTypeId).toBe("registered_teams");
        const comp = CatalogRegistry.getCompetitionType(bindingsScoringBadminton.competitionTypeId);
        expect(comp?.requiresAuctionEconomics).toBe(false);
      }
    });

    it("resolves auction_only to auction with auction economics required", () => {
      const bindingsAuctionCricket = resolveAuctionCreateCatalogBindings("cricket", "auction_only");
      expect("error" in bindingsAuctionCricket).toBe(false);
      if (!("error" in bindingsAuctionCricket)) {
        expect(bindingsAuctionCricket.competitionTypeId).toBe("auction");
        const comp = CatalogRegistry.getCompetitionType(bindingsAuctionCricket.competitionTypeId);
        expect(comp?.requiresAuctionEconomics).toBe(true);
      }
    });
  });

  describe("Sport Scoring Eligibility Rules", () => {
    it("allows sports scoring only on stabilized cricket and badminton", () => {
      expect(isScoringSupportedSport("cricket")).toBe(true);
      expect(isScoringSupportedSport("Cricket")).toBe(true);
      expect(isScoringSupportedSport("badminton")).toBe(true);
      expect(isScoringSupportedSport("Badminton")).toBe(true);
      expect(isScoringSupportedSport("BADMINTON")).toBe(true);
    });

    it("disallows sports scoring on other sports (football, kabaddi, volleyball, tennis, etc.)", () => {
      expect(isScoringSupportedSport("football")).toBe(false);
      expect(isScoringSupportedSport("kabaddi")).toBe(false);
      expect(isScoringSupportedSport("volleyball")).toBe(false);
      expect(isScoringSupportedSport("tennis")).toBe(false);
      expect(isScoringSupportedSport("basketball")).toBe(false);
      expect(isScoringSupportedSport(null)).toBe(false);
      expect(isScoringSupportedSport(undefined)).toBe(false);
    });
  });

  describe("Creation Wizard Workflow Contract", () => {
    it("defines exactly 3 wizard steps: details -> products -> configuration", () => {
      expect(WIZARD_STEPS.map((s) => s.id)).toEqual(["details", "products", "configuration"]);
      expect(WIZARD_STEPS).toHaveLength(3);
    });
  });

  describe("Endpoint Module Resolution & Backward Compatibility Precedence", () => {
    // Replicates the unified resolution helper used across all 3 creation routes
    function resolveCreationModules(d: {
      sport: string;
      auctionEnabled?: boolean;
      scoringEnabled?: boolean;
      licenseType?: string;
    }) {
      const explicitScoring = d.scoringEnabled;
      const explicitAuction = d.auctionEnabled;

      let scoringEnabled = false;
      if (explicitScoring !== undefined) {
        scoringEnabled = explicitScoring;
      } else if (d.licenseType === "scoring" || d.licenseType === "all") {
        scoringEnabled = isScoringSupportedSport(d.sport);
      }

      let auctionEnabled = true;
      if (explicitAuction !== undefined) {
        auctionEnabled = explicitAuction;
      } else if (d.licenseType === "scoring") {
        auctionEnabled = false;
      }

      if (!auctionEnabled && !scoringEnabled) {
        return {
          ok: false,
          error: "A tournament must have at least one enabled product module (auction or scoring).",
        };
      }

      if (scoringEnabled && !isScoringSupportedSport(d.sport)) {
        return {
          ok: false,
          error: "Sports scoring is only supported for cricket and badminton currently.",
        };
      }

      return {
        ok: true,
        auctionEnabled,
        scoringEnabled,
        productMode: resolveTournamentProductMode({ auctionEnabled, scoringEnabled }),
      };
    }

    it("preserves explicit false for auctionEnabled (scoring_only) and does NOT default to true", () => {
      const res = resolveCreationModules({
        sport: "badminton",
        auctionEnabled: false,
        scoringEnabled: true,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.auctionEnabled).toBe(false);
        expect(res.scoringEnabled).toBe(true);
        expect(res.productMode).toBe("scoring_only");
      }
    });

    it("gives explicit module flags complete precedence over legacy licenseType", () => {
      // Caller sends licenseType: 'auction' but explicitly passes auctionEnabled: false, scoringEnabled: true
      const res = resolveCreationModules({
        sport: "cricket",
        licenseType: "auction",
        auctionEnabled: false,
        scoringEnabled: true,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.auctionEnabled).toBe(false);
        expect(res.scoringEnabled).toBe(true);
        expect(res.productMode).toBe("scoring_only");
      }
    });

    it("rejects false + false module state with 400 validation error", () => {
      const res = resolveCreationModules({
        sport: "cricket",
        auctionEnabled: false,
        scoringEnabled: false,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe(
          "A tournament must have at least one enabled product module (auction or scoring).",
        );
      }
    });

    it("rejects scoringEnabled = true for unsupported sports", () => {
      const res = resolveCreationModules({
        sport: "football",
        auctionEnabled: false,
        scoringEnabled: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe(
          "Sports scoring is only supported for cricket and badminton currently.",
        );
      }
    });

    it("allows auction_only for unsupported scoring sports (e.g. football)", () => {
      const res = resolveCreationModules({
        sport: "football",
        auctionEnabled: true,
        scoringEnabled: false,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.auctionEnabled).toBe(true);
        expect(res.scoringEnabled).toBe(false);
        expect(res.productMode).toBe("auction_only");
      }
    });

    it("supports legacy payloads omitting module flags", () => {
      // Legacy payload with licenseType === "scoring"
      const resScoring = resolveCreationModules({
        sport: "badminton",
        licenseType: "scoring",
      });
      expect(resScoring.ok).toBe(true);
      if (resScoring.ok) {
        expect(resScoring.auctionEnabled).toBe(false);
        expect(resScoring.scoringEnabled).toBe(true);
        expect(resScoring.productMode).toBe("scoring_only");
      }

      // Legacy payload with no licenseType (defaults to auction)
      const resDefault = resolveCreationModules({
        sport: "badminton",
      });
      expect(resDefault.ok).toBe(true);
      if (resDefault.ok) {
        expect(resDefault.auctionEnabled).toBe(true);
        expect(resDefault.scoringEnabled).toBe(false);
        expect(resDefault.productMode).toBe("auction_only");
      }

      // Legacy payload with licenseType === "all"
      const resAll = resolveCreationModules({
        sport: "cricket",
        licenseType: "all",
      });
      expect(resAll.ok).toBe(true);
      if (resAll.ok) {
        expect(resAll.auctionEnabled).toBe(true);
        expect(resAll.scoringEnabled).toBe(true);
        expect(resAll.productMode).toBe("both");
      }
    });
  });

  describe("Serialization of Newly Created Tournaments", () => {
    it("correctly derives productMode in serializers without storing productMode column", () => {
      const scoringOnlyRow = makeMinimalTournamentRow({
        auctionEnabled: false,
        scoringEnabled: true,
        scoringPhase: "active",
        playerRegistrationMode: "scoring",
      });

      const pub = publicTournamentSerializer(scoringOnlyRow);
      expect(pub.productMode).toBe("scoring_only");
      expect(pub.auctionEnabled).toBe(false);
      expect(pub.scoringEnabled).toBe(true);

      const priv = privateTournamentSerializer(scoringOnlyRow);
      expect(priv.productMode).toBe("scoring_only");
      expect(priv.auctionEnabled).toBe(false);
      expect(priv.scoringEnabled).toBe(true);
    });

    it("correctly derives both productMode in serializers for hybrid tournaments", () => {
      const bothRow = makeMinimalTournamentRow({
        auctionEnabled: true,
        scoringEnabled: true,
        scoringPhase: "active",
      });

      const pub = publicTournamentSerializer(bothRow);
      expect(pub.productMode).toBe("both");
      expect(pub.auctionEnabled).toBe(true);
      expect(pub.scoringEnabled).toBe(true);

      const priv = privateTournamentSerializer(bothRow);
      expect(priv.productMode).toBe("both");
      expect(priv.auctionEnabled).toBe(true);
      expect(priv.scoringEnabled).toBe(true);
    });
  });
});
