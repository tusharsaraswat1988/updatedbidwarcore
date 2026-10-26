import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import {
  requireAuctionModule,
  assertAuctionModule,
  isAuctionModuleAllowed,
  ModuleAuthorizationError,
} from "../middleware/require-module";
import { InvalidTournamentModuleStateError } from "@workspace/platform-core";

function createMockResponse() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status: vi.fn(function (code: number) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function (data: unknown) {
      res.body = data;
      return res;
    }),
  } as unknown as Response & { statusCode: number; body: unknown };
  return res;
}

describe("Auction Module Authorization Matrix", () => {
  describe("isAuctionModuleAllowed", () => {
    it("allows auction_only tournaments (auctionEnabled: true, scoringEnabled: false)", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: true, scoringEnabled: false })).toBe(true);
    });

    it("allows both tournaments (auctionEnabled: true, scoringEnabled: true)", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: true, scoringEnabled: true })).toBe(true);
    });

    it("rejects scoring_only tournaments (auctionEnabled: false, scoringEnabled: true)", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: false, scoringEnabled: true })).toBe(false);
    });

    it("rejects invalid state tournaments (auctionEnabled: false, scoringEnabled: false)", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: false, scoringEnabled: false })).toBe(false);
    });

    it("rejects null / undefined tournament", () => {
      expect(isAuctionModuleAllowed(null)).toBe(false);
      expect(isAuctionModuleAllowed(undefined)).toBe(false);
    });
  });

  describe("assertAuctionModule", () => {
    it("does not throw for auction_only tournament", () => {
      expect(() =>
        assertAuctionModule({ auctionEnabled: true, scoringEnabled: false }),
      ).not.toThrow();
    });

    it("does not throw for both tournament", () => {
      expect(() =>
        assertAuctionModule({ auctionEnabled: true, scoringEnabled: true }),
      ).not.toThrow();
    });

    it("throws 403 AUCTION_DISABLED for scoring_only tournament", () => {
      try {
        assertAuctionModule({ auctionEnabled: false, scoringEnabled: true });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(403);
        expect(authErr.code).toBe("AUCTION_DISABLED");
        expect(authErr.message).toBe("Auction module is not enabled for this tournament");
      }
    });

    it("throws 400 InvalidTournamentModuleStateError for false + false tournament", () => {
      expect(() =>
        assertAuctionModule({ auctionEnabled: false, scoringEnabled: false }),
      ).toThrow(InvalidTournamentModuleStateError);
    });

    it("throws 404 TOURNAMENT_NOT_FOUND for null / undefined tournament", () => {
      try {
        assertAuctionModule(null);
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(404);
        expect(authErr.code).toBe("TOURNAMENT_NOT_FOUND");
      }
    });
  });

  describe("requireAuctionModule HTTP middleware response guard", () => {
    it("returns true and leaves status 200 for auction_only tournament", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: true, scoringEnabled: false });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("returns true and leaves status 200 for both tournament", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: true, scoringEnabled: true });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("returns false with 403 and AUCTION_DISABLED payload for scoring_only tournament", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: false, scoringEnabled: true });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Auction module is not enabled for this tournament",
        code: "AUCTION_DISABLED",
      });
    });

    it("returns false with 400 and INVALID_MODULE_STATE payload for false + false tournament", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: false, scoringEnabled: false });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "A tournament must have at least one enabled product module (auction or scoring).",
        code: "INVALID_MODULE_STATE",
      });
    });

    it("returns false with 404 and TOURNAMENT_NOT_FOUND payload for null tournament", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, null);
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Tournament not found",
        code: "TOURNAMENT_NOT_FOUND",
      });
    });
  });

  describe("Simulated Endpoint Module Guards", () => {
    const scoringOnlyTournament = {
      id: 101,
      name: "Badminton Open",
      sport: "badminton",
      auctionEnabled: false,
      scoringEnabled: true,
    };

    const auctionOnlyTournament = {
      id: 102,
      name: "Premier League Auction",
      sport: "cricket",
      auctionEnabled: true,
      scoringEnabled: false,
    };

    const invalidTournament = {
      id: 103,
      name: "Broken Tournament",
      sport: "cricket",
      auctionEnabled: false,
      scoringEnabled: false,
    };

    const sampleEndpoints = [
      "GET /tournaments/:id/auction/events",
      "GET /tournaments/:id/auction",
      "POST /tournaments/:id/auction/start",
      "POST /tournaments/:id/auction/pause",
      "POST /tournaments/:id/auction/bid",
      "POST /tournaments/:id/auction/sell",
      "POST /tournaments/:id/auction/undo",
      "POST /tournaments/:id/auction/conclude",
      "POST /tournaments/:id/auction/settings",
      "GET /tournaments/:id/purse-boosters",
      "POST /tournaments/:id/purse-boosters",
      "GET /tournaments/:id/teams/scout",
      "GET /tournaments/:id/auction-rules.pdf",
      "GET /tournaments/:id/auction-data/export",
      "POST /tournaments/:id/auction-data/import/preview",
    ];

    sampleEndpoints.forEach((endpoint) => {
      it(`blocks ${endpoint} with 403 AUCTION_DISABLED for scoring_only tournament`, () => {
        const res = createMockResponse();
        const allowed = requireAuctionModule(res, scoringOnlyTournament);
        expect(allowed).toBe(false);
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({
          error: "Auction module is not enabled for this tournament",
          code: "AUCTION_DISABLED",
        });
      });

      it(`blocks ${endpoint} with 400 INVALID_MODULE_STATE for invalid tournament`, () => {
        const res = createMockResponse();
        const allowed = requireAuctionModule(res, invalidTournament);
        expect(allowed).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({
          error: "A tournament must have at least one enabled product module (auction or scoring).",
          code: "INVALID_MODULE_STATE",
        });
      });

      it(`blocks ${endpoint} with 404 TOURNAMENT_NOT_FOUND for non-existent tournament`, () => {
        const res = createMockResponse();
        const allowed = requireAuctionModule(res, null);
        expect(allowed).toBe(false);
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({
          error: "Tournament not found",
          code: "TOURNAMENT_NOT_FOUND",
        });
      });

      it(`allows ${endpoint} for auction_only tournament`, () => {
        const res = createMockResponse();
        const allowed = requireAuctionModule(res, auctionOnlyTournament);
        expect(allowed).toBe(true);
        expect(res.statusCode).toBe(200);
      });
    });
  });
});
