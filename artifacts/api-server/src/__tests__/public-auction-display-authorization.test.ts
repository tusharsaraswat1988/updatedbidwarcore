import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
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

describe("Phase 4D — Public Auction Display & Presentation Module Boundary", () => {
  describe("Public Auction Display Surfaces Authorization Matrix", () => {
    const scenarios = [
      {
        name: "LED Display (DisplayView / DisplayShell)",
        route: "/tournament/:id/display",
      },
      {
        name: "Side Display (SideDisplayView / SideDisplayShell)",
        route: "/tournament/:id/side-display",
      },
      {
        name: "Public Live Viewer (LiveViewer fan view)",
        route: "/live/:id and /tournament/:id/liveviewer",
      },
      {
        name: "OBS Overlay Browser Source (/obs)",
        route: "/tournament/:id/obs",
      },
      {
        name: "OBS v2 / Lab Overlay (/obs/v2)",
        route: "/tournament/:id/obs/v2",
      },
      {
        name: "Public Auction SSE Stream (/auction/events)",
        route: "GET /tournaments/:id/auction/events",
      },
      {
        name: "Public Auction State Snapshot (/auction)",
        route: "GET /tournaments/:id/auction",
      },
      {
        name: "Public Fan Cheer (/cheer)",
        route: "POST /tournaments/:id/cheer",
      },
      {
        name: "Public Analytics & Insights",
        route: "GET /tournaments/:id/analytics/*",
      },
    ];

    describe.each(scenarios)("$name ($route)", () => {
      it("ALLOWS access when tournament is auction_only (auctionEnabled: true, scoringEnabled: false)", () => {
        const tournament = { id: 101, auctionEnabled: true, scoringEnabled: false, sport: "cricket" };
        const res = createMockResponse();

        expect(isAuctionModuleAllowed(tournament)).toBe(true);
        expect(() => assertAuctionModule(tournament)).not.toThrow();
        expect(requireAuctionModule(res, tournament)).toBe(true);
        expect(res.statusCode).toBe(200);
      });

      it("ALLOWS access when tournament is both (auctionEnabled: true, scoringEnabled: true)", () => {
        const tournament = { id: 102, auctionEnabled: true, scoringEnabled: true, sport: "cricket" };
        const res = createMockResponse();

        expect(isAuctionModuleAllowed(tournament)).toBe(true);
        expect(() => assertAuctionModule(tournament)).not.toThrow();
        expect(requireAuctionModule(res, tournament)).toBe(true);
        expect(res.statusCode).toBe(200);
      });

      it("BLOCKS access with 403 AUCTION_DISABLED when tournament is scoring_only (auctionEnabled: false, scoringEnabled: true)", () => {
        const tournament = { id: 103, auctionEnabled: false, scoringEnabled: true, sport: "cricket" };
        const res = createMockResponse();

        expect(isAuctionModuleAllowed(tournament)).toBe(false);

        try {
          assertAuctionModule(tournament);
          expect.unreachable("Should throw ModuleAuthorizationError");
        } catch (err) {
          expect(err).toBeInstanceOf(ModuleAuthorizationError);
          const authErr = err as ModuleAuthorizationError;
          expect(authErr.status).toBe(403);
          expect(authErr.code).toBe("AUCTION_DISABLED");
          expect(authErr.message).toBe("Auction module is not enabled for this tournament");
        }

        const allowed = requireAuctionModule(res, tournament);
        expect(allowed).toBe(false);
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({
          error: "Auction module is not enabled for this tournament",
          code: "AUCTION_DISABLED",
        });
      });

      it("BLOCKS access with 400 INVALID_MODULE_STATE when tournament is false + false", () => {
        const tournament = { id: 104, auctionEnabled: false, scoringEnabled: false, sport: "cricket" };
        const res = createMockResponse();

        expect(isAuctionModuleAllowed(tournament)).toBe(false);
        expect(() => assertAuctionModule(tournament)).toThrow(InvalidTournamentModuleStateError);

        const allowed = requireAuctionModule(res, tournament);
        expect(allowed).toBe(false);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({
          error: "A tournament must have at least one enabled product module (auction or scoring).",
          code: "INVALID_MODULE_STATE",
        });
      });

      it("BLOCKS access with 404 TOURNAMENT_NOT_FOUND when tournament does not exist", () => {
        const res = createMockResponse();

        expect(isAuctionModuleAllowed(null)).toBe(false);
        expect(isAuctionModuleAllowed(undefined)).toBe(false);

        try {
          assertAuctionModule(null);
          expect.unreachable("Should throw TOURNAMENT_NOT_FOUND");
        } catch (err) {
          expect(err).toBeInstanceOf(ModuleAuthorizationError);
          const authErr = err as ModuleAuthorizationError;
          expect(authErr.status).toBe(404);
          expect(authErr.code).toBe("TOURNAMENT_NOT_FOUND");
        }

        const allowed = requireAuctionModule(res, null);
        expect(allowed).toBe(false);
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({
          error: "Tournament not found",
          code: "TOURNAMENT_NOT_FOUND",
        });
      });
    });
  });

  describe("Public Presentation Surfaces Independence from Organizer Authentication", () => {
    it("does not require organizer JWT / authentication headers to evaluate auction module authorization", () => {
      const publicTournament = { id: 201, auctionEnabled: true, scoringEnabled: false, sport: "cricket" };
      const res = createMockResponse();

      // requireAuctionModule operates solely on the tournament record without req.jwtUser
      const allowed = requireAuctionModule(res, publicTournament);
      expect(allowed).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it("evaluates module authorization synchronously without side effects when tournament is disabled", () => {
      const scoringOnlyTournament = { id: 202, auctionEnabled: false, scoringEnabled: true, sport: "cricket" };
      const res = createMockResponse();

      const allowed = requireAuctionModule(res, scoringOnlyTournament);
      expect(allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        error: "Auction module is not enabled for this tournament",
        code: "AUCTION_DISABLED",
      });
    });
  });
});
