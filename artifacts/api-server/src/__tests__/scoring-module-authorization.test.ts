import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import {
  requireScoringModule,
  requireSportModule,
  assertScoringModule,
  assertSportModule,
  isScoringModuleAllowed,
  isSportModuleAllowed,
  normalizeSport,
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

describe("Phase 4C — Sports Scoring Module Authorization Matrix", () => {
  describe("isScoringModuleAllowed", () => {
    it("allows scoring_only tournaments (auctionEnabled: false, scoringEnabled: true)", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: false, scoringEnabled: true })).toBe(true);
    });

    it("allows both tournaments (auctionEnabled: true, scoringEnabled: true)", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: true, scoringEnabled: true })).toBe(true);
    });

    it("rejects auction_only tournaments (auctionEnabled: true, scoringEnabled: false)", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: true, scoringEnabled: false })).toBe(false);
    });

    it("rejects invalid state tournaments (auctionEnabled: false, scoringEnabled: false)", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: false, scoringEnabled: false })).toBe(false);
    });

    it("rejects null / undefined tournament", () => {
      expect(isScoringModuleAllowed(null)).toBe(false);
      expect(isScoringModuleAllowed(undefined)).toBe(false);
    });
  });

  describe("isSportModuleAllowed", () => {
    it("allows cricket when scoring is enabled and sport is cricket", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "cricket",
        ),
      ).toBe(true);
    });

    it("allows badminton when scoring is enabled and sport is badminton", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "badminton" },
          "badminton",
        ),
      ).toBe(true);
    });

    it("rejects cricket when tournament is badminton (sport mismatch)", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "badminton" },
          "cricket",
        ),
      ).toBe(false);
    });

    it("rejects badminton when tournament is cricket (sport mismatch)", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "badminton",
        ),
      ).toBe(false);
    });

    it("rejects cricket when scoring is disabled (auction_only)", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: true, scoringEnabled: false, sport: "cricket" },
          "cricket",
        ),
      ).toBe(false);
    });

    it("rejects unsupported sports for scoring (e.g. football)", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "football" },
          "football",
        ),
      ).toBe(false);
    });
  });

  describe("assertScoringModule", () => {
    it("does not throw for scoring_only tournament", () => {
      expect(() =>
        assertScoringModule({ auctionEnabled: false, scoringEnabled: true }),
      ).not.toThrow();
    });

    it("does not throw for both tournament", () => {
      expect(() =>
        assertScoringModule({ auctionEnabled: true, scoringEnabled: true }),
      ).not.toThrow();
    });

    it("throws 403 SCORING_DISABLED for auction_only tournament", () => {
      try {
        assertScoringModule({ auctionEnabled: true, scoringEnabled: false });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(403);
        expect(authErr.code).toBe("SCORING_DISABLED");
        expect(authErr.message).toBe("Sports scoring module is not enabled for this tournament");
      }
    });

    it("throws 400 InvalidTournamentModuleStateError for false + false tournament", () => {
      expect(() =>
        assertScoringModule({ auctionEnabled: false, scoringEnabled: false }),
      ).toThrow(InvalidTournamentModuleStateError);
    });

    it("throws 404 TOURNAMENT_NOT_FOUND for null / undefined tournament", () => {
      try {
        assertScoringModule(null);
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(404);
        expect(authErr.code).toBe("TOURNAMENT_NOT_FOUND");
      }
    });
  });

  describe("assertSportModule", () => {
    it("allows matching cricket scoring tournament", () => {
      expect(() =>
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "cricket",
        ),
      ).not.toThrow();
    });

    it("allows matching badminton scoring tournament", () => {
      expect(() =>
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "badminton" },
          "badminton",
        ),
      ).not.toThrow();
    });

    it("throws 403 SPORT_MISMATCH when requesting cricket on badminton tournament", () => {
      try {
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "badminton" },
          "cricket",
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(403);
        expect(authErr.code).toBe("SPORT_MISMATCH");
        expect(authErr.message).toBe(
          "Tournament sport 'badminton' does not match required sport 'cricket'",
        );
      }
    });

    it("throws 403 SPORT_MISMATCH when requesting badminton on cricket tournament", () => {
      try {
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "badminton",
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(403);
        expect(authErr.code).toBe("SPORT_MISMATCH");
        expect(authErr.message).toBe(
          "Tournament sport 'cricket' does not match required sport 'badminton'",
        );
      }
    });

    it("throws 403 SCORING_DISABLED when scoring is disabled (auction_only)", () => {
      try {
        assertSportModule(
          { auctionEnabled: true, scoringEnabled: false, sport: "cricket" },
          "cricket",
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(403);
        expect(authErr.code).toBe("SCORING_DISABLED");
      }
    });

    it("throws 400 UNSUPPORTED_SPORT when sport is not supported for scoring", () => {
      try {
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "football" },
          "football",
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(400);
        expect(authErr.code).toBe("UNSUPPORTED_SPORT");
        expect(authErr.message).toBe(
          "Sport 'football' is not supported for live sports scoring",
        );
      }
    });

    it("throws 400 InvalidTournamentModuleStateError for false + false tournament", () => {
      expect(() =>
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: false, sport: "cricket" },
          "cricket",
        ),
      ).toThrow(InvalidTournamentModuleStateError);
    });

    it("throws 404 TOURNAMENT_NOT_FOUND for null / undefined tournament", () => {
      try {
        assertSportModule(null, "cricket");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleAuthorizationError);
        const authErr = err as ModuleAuthorizationError;
        expect(authErr.status).toBe(404);
        expect(authErr.code).toBe("TOURNAMENT_NOT_FOUND");
      }
    });
  });

  describe("requireScoringModule HTTP middleware response guard", () => {
    it("returns true and leaves status 200 for scoring_only tournament", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: false, scoringEnabled: true });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("returns true and leaves status 200 for both tournament", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: true, scoringEnabled: true });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("returns false with 403 SCORING_DISABLED for auction_only tournament", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: true, scoringEnabled: false });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Sports scoring module is not enabled for this tournament",
        code: "SCORING_DISABLED",
      });
    });

    it("returns false with 400 INVALID_MODULE_STATE for false + false tournament", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: false, scoringEnabled: false });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "A tournament must have at least one enabled product module (auction or scoring).",
        code: "INVALID_MODULE_STATE",
      });
    });

    it("returns false with 404 TOURNAMENT_NOT_FOUND for null tournament", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, null);
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Tournament not found",
        code: "TOURNAMENT_NOT_FOUND",
      });
    });
  });

  describe("requireSportModule HTTP middleware response guard", () => {
    it("returns true for matching cricket tournament", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
        "cricket",
      );
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns true for matching badminton tournament", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: false, scoringEnabled: true, sport: "badminton" },
        "badminton",
      );
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns false with 403 SPORT_MISMATCH on cricket tournament when badminton is requested", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
        "badminton",
      );
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Tournament sport 'cricket' does not match required sport 'badminton'",
        code: "SPORT_MISMATCH",
      });
    });

    it("returns false with 403 SPORT_MISMATCH on badminton tournament when cricket is requested", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: false, scoringEnabled: true, sport: "badminton" },
        "cricket",
      );
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Tournament sport 'badminton' does not match required sport 'cricket'",
        code: "SPORT_MISMATCH",
      });
    });

    it("returns false with 403 SCORING_DISABLED for auction_only tournament", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: true, scoringEnabled: false, sport: "cricket" },
        "cricket",
      );
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Sports scoring module is not enabled for this tournament",
        code: "SCORING_DISABLED",
      });
    });

    it("returns false with 400 UNSUPPORTED_SPORT for unsupported scoring sport (football)", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: false, scoringEnabled: true, sport: "football" },
        "football",
      );
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Sport 'football' is not supported for live sports scoring",
        code: "UNSUPPORTED_SPORT",
      });
    });

    it("returns false with 400 INVALID_MODULE_STATE for false + false tournament", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: false, scoringEnabled: false, sport: "cricket" },
        "cricket",
      );
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "A tournament must have at least one enabled product module (auction or scoring).",
        code: "INVALID_MODULE_STATE",
      });
    });

    it("returns false with 404 TOURNAMENT_NOT_FOUND for null tournament", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(res, null, "cricket");
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Tournament not found",
        code: "TOURNAMENT_NOT_FOUND",
      });
    });
  });
});
