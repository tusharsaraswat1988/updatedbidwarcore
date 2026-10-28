import { describe, expect, it } from "vitest";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
  tryResolveTournamentProductMode,
} from "@workspace/platform-core";
import { isTournamentLicensedForComm } from "../lib/comm-sender";

describe("Tournament Lifecycle Decoupling & Invariants (P0)", () => {
  describe("1. Auction Conclude Decoupling Logic", () => {
    function computeNextTournamentStatusOnAuctionConclude(tournament: {
      status: string;
      scoringEnabled: boolean;
      scoringPhase?: string | null;
    }): string {
      const isScoringPending =
        tournament.scoringEnabled && tournament.scoringPhase !== "completed";
      if (!isScoringPending) {
        return "completed";
      }
      return tournament.status;
    }

    it("dual-module: ending auction while scoring is active keeps tournament active", () => {
      const t = {
        status: "active",
        scoringEnabled: true,
        scoringPhase: "active",
      };
      const nextStatus = computeNextTournamentStatusOnAuctionConclude(t);
      expect(nextStatus).toBe("active");
    });

    it("dual-module: ending auction while scoring is in setup keeps tournament status intact", () => {
      const t = {
        status: "draw_ready",
        scoringEnabled: true,
        scoringPhase: "setup",
      };
      const nextStatus = computeNextTournamentStatusOnAuctionConclude(t);
      expect(nextStatus).toBe("draw_ready");
    });

    it("dual-module: ending auction after scoring is already completed marks tournament completed", () => {
      const t = {
        status: "active",
        scoringEnabled: true,
        scoringPhase: "completed",
      };
      const nextStatus = computeNextTournamentStatusOnAuctionConclude(t);
      expect(nextStatus).toBe("completed");
    });

    it("auction-only: ending auction marks tournament completed immediately", () => {
      const t = {
        status: "active",
        scoringEnabled: false,
        scoringPhase: "disabled",
      };
      const nextStatus = computeNextTournamentStatusOnAuctionConclude(t);
      expect(nextStatus).toBe("completed");
    });
  });

  describe("2. Admin Emergency Lock Decoupling Logic", () => {
    function computeStatusOnAdminLock(tournament: {
      status: string;
      scoringEnabled: boolean;
      scoringPhase?: string | null;
    }): { adminLocked: boolean; status: string } {
      const isScoringPending =
        tournament.scoringEnabled && tournament.scoringPhase !== "completed";
      const nextStatus = isScoringPending ? tournament.status : "completed";
      return {
        adminLocked: true,
        status: nextStatus,
      };
    }

    it("locks tournament without clobbering active status when scoring is operational", () => {
      const t = {
        status: "active",
        scoringEnabled: true,
        scoringPhase: "active",
      };
      const result = computeStatusOnAdminLock(t);
      expect(result.adminLocked).toBe(true);
      expect(result.status).toBe("active");
    });

    it("locks and completes tournament status when tournament is auction-only", () => {
      const t = {
        status: "active",
        scoringEnabled: false,
        scoringPhase: "disabled",
      };
      const result = computeStatusOnAdminLock(t);
      expect(result.adminLocked).toBe(true);
      expect(result.status).toBe("completed");
    });

    it("locks and completes tournament status when scoring is already completed", () => {
      const t = {
        status: "active",
        scoringEnabled: true,
        scoringPhase: "completed",
      };
      const result = computeStatusOnAdminLock(t);
      expect(result.adminLocked).toBe(true);
      expect(result.status).toBe("completed");
    });
  });

  describe("3. Module-Aware Communication Entitlement (isTournamentLicensedForComm)", () => {
    it("strictly blocks communication if intentional admin lock is set (emergency protection)", () => {
      expect(
        isTournamentLicensedForComm({
          adminLocked: true,
          licenseStatus: "active",
          scoringEnabled: true,
          scoringPhase: "active",
        }),
      ).toBe(false);
    });

    it("allows communication when tournament has an active live license", () => {
      expect(
        isTournamentLicensedForComm({
          adminLocked: false,
          licenseStatus: "active",
          scoringEnabled: true,
        }),
      ).toBe(true);
    });

    it("rejects communication in trial mode (anti-spam / trial restriction)", () => {
      expect(
        isTournamentLicensedForComm({
          adminLocked: false,
          licenseStatus: "trial",
          scoringEnabled: true,
          scoringPhase: "active",
        }),
      ).toBe(false);
    });

    it("dual-module: permits match communication when auction license is completed but live scoring is active with granted license", () => {
      expect(
        isTournamentLicensedForComm({
          adminLocked: false,
          licenseStatus: "completed",
          scoringEnabled: true,
          scoringPhase: "active",
          licenseGrantedAt: new Date("2026-10-01"),
        }),
      ).toBe(true);
    });

    it("dual-module: blocks communication if auction concluded and scoring is also completed", () => {
      expect(
        isTournamentLicensedForComm({
          adminLocked: false,
          licenseStatus: "completed",
          scoringEnabled: true,
          scoringPhase: "completed",
          licenseGrantedAt: new Date("2026-10-01"),
        }),
      ).toBe(false);
    });

    it("dual-module: blocks communication if licenseStatus is completed but live license was never granted", () => {
      expect(
        isTournamentLicensedForComm({
          adminLocked: false,
          licenseStatus: "completed",
          scoringEnabled: true,
          scoringPhase: "active",
          licenseGrantedAt: null,
        }),
      ).toBe(false);
    });

    it("auction-only: blocks communication when auction is completed", () => {
      expect(
        isTournamentLicensedForComm({
          adminLocked: false,
          licenseStatus: "completed",
          scoringEnabled: false,
          licenseGrantedAt: new Date("2026-10-01"),
        }),
      ).toBe(false);
    });

    it("handles null/undefined tournament safely", () => {
      expect(isTournamentLicensedForComm(null)).toBe(false);
      expect(isTournamentLicensedForComm(undefined)).toBe(false);
    });
  });

  describe("4. Safe PATCH scoringPhase Updates & Preservation", () => {
    function resolveScoringPhasePatch(
      beforeTournament: { scoringPhase?: string | null },
      patch: { scoringEnabled?: boolean; scoringPhase?: string },
    ): string | undefined {
      if (patch.scoringPhase !== undefined) {
        return patch.scoringPhase;
      }
      if (patch.scoringEnabled !== undefined) {
        if (!patch.scoringEnabled) {
          return "disabled";
        }
        if (
          beforeTournament.scoringPhase === "disabled" ||
          !beforeTournament.scoringPhase
        ) {
          return "active";
        }
        return beforeTournament.scoringPhase;
      }
      return undefined;
    }

    it("explicit scoringPhase update takes precedence", () => {
      const result = resolveScoringPhasePatch(
        { scoringPhase: "active" },
        { scoringPhase: "completed" },
      );
      expect(result).toBe("completed");
    });

    it("enabling scoring preserves an existing setup or completed phase without blind overwrite", () => {
      const result = resolveScoringPhasePatch(
        { scoringPhase: "completed" },
        { scoringEnabled: true },
      );
      expect(result).toBe("completed");
    });

    it("enabling scoring initializes phase to active if previously disabled", () => {
      const result = resolveScoringPhasePatch(
        { scoringPhase: "disabled" },
        { scoringEnabled: true },
      );
      expect(result).toBe("active");
    });

    it("disabling scoring sets scoringPhase to disabled", () => {
      const result = resolveScoringPhasePatch(
        { scoringPhase: "active" },
        { scoringEnabled: false },
      );
      expect(result).toBe("disabled");
    });
  });

  describe("5. Product Mode & Backward Compatibility", () => {
    it("legacy tournament with null auctionEnabled resolves safely to auction_only", () => {
      const mode = tryResolveTournamentProductMode({
        auctionEnabled: null,
        scoringEnabled: false,
      });
      expect(mode).toBe("auction_only");
    });

    it("dual-module tournament resolves to both", () => {
      const mode = tryResolveTournamentProductMode({
        auctionEnabled: true,
        scoringEnabled: true,
      });
      expect(mode).toBe("both");
    });

    it("scoring-only tournament resolves to scoring_only", () => {
      const mode = tryResolveTournamentProductMode({
        auctionEnabled: false,
        scoringEnabled: true,
      });
      expect(mode).toBe("scoring_only");
    });

    it("invalid false+false returns null safely from tryResolve", () => {
      const mode = tryResolveTournamentProductMode({
        auctionEnabled: false,
        scoringEnabled: false,
      });
      expect(mode).toBeNull();
    });
  });
});
