import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import {
  requireAuctionModule,
  requireScoringModule,
  requireSportModule,
  assertAuctionModule,
  assertScoringModule,
  assertSportModule,
  isAuctionModuleAllowed,
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

describe("normalizeSport", () => {
  it("normalizes sport strings cleanly", () => {
    expect(normalizeSport("cricket")).toBe("cricket");
    expect(normalizeSport("Cricket")).toBe("cricket");
    expect(normalizeSport("CRICKET ")).toBe("cricket");
    expect(normalizeSport("  badminton  ")).toBe("badminton");
    expect(normalizeSport("Badminton")).toBe("badminton");
    expect(normalizeSport("table tennis")).toBe("table_tennis");
    expect(normalizeSport("Table-Tennis")).toBe("table_tennis");
    expect(normalizeSport(null)).toBe("");
    expect(normalizeSport(undefined)).toBe("");
  });
});

describe("Module Authorization: Pure Boolean Checks", () => {
  describe("isAuctionModuleAllowed", () => {
    it("returns true for auction_only", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: true, scoringEnabled: false })).toBe(true);
    });

    it("returns false for scoring_only", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: false, scoringEnabled: true })).toBe(false);
    });

    it("returns true for both", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: true, scoringEnabled: true })).toBe(true);
    });

    it("returns false for invalid state (false + false)", () => {
      expect(isAuctionModuleAllowed({ auctionEnabled: false, scoringEnabled: false })).toBe(false);
    });

    it("returns false for null / undefined", () => {
      expect(isAuctionModuleAllowed(null)).toBe(false);
      expect(isAuctionModuleAllowed(undefined)).toBe(false);
    });

    it("returns true for legacy undefined flags (defaults to auctionEnabled: true)", () => {
      expect(isAuctionModuleAllowed({})).toBe(true);
    });
  });

  describe("isScoringModuleAllowed", () => {
    it("returns false for auction_only", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: true, scoringEnabled: false })).toBe(false);
    });

    it("returns true for scoring_only", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: false, scoringEnabled: true })).toBe(true);
    });

    it("returns true for both", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: true, scoringEnabled: true })).toBe(true);
    });

    it("returns false for invalid state (false + false)", () => {
      expect(isScoringModuleAllowed({ auctionEnabled: false, scoringEnabled: false })).toBe(false);
    });

    it("returns false for null / undefined", () => {
      expect(isScoringModuleAllowed(null)).toBe(false);
      expect(isScoringModuleAllowed(undefined)).toBe(false);
    });

    it("returns false for legacy undefined flags (defaults to scoringEnabled: false)", () => {
      expect(isScoringModuleAllowed({})).toBe(false);
    });
  });

  describe("isSportModuleAllowed", () => {
    it("returns true for matching sport with scoring enabled", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "cricket",
        ),
      ).toBe(true);
      expect(
        isSportModuleAllowed(
          { auctionEnabled: true, scoringEnabled: true, sport: "Badminton" },
          "badminton",
        ),
      ).toBe(true);
    });

    it("returns false for mismatched sport", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "badminton",
        ),
      ).toBe(false);
      expect(
        isSportModuleAllowed(
          { auctionEnabled: true, scoringEnabled: true, sport: "badminton" },
          "cricket",
        ),
      ).toBe(false);
    });

    it("returns false when scoring is disabled", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: true, scoringEnabled: false, sport: "cricket" },
          "cricket",
        ),
      ).toBe(false);
    });

    it("returns false for unsupported sport", () => {
      expect(
        isSportModuleAllowed(
          { auctionEnabled: false, scoringEnabled: true, sport: "football" },
          "football",
        ),
      ).toBe(false);
    });
  });
});

describe("Module Authorization: Assertions", () => {
  describe("assertAuctionModule", () => {
    it("passes for auction_only", () => {
      expect(() =>
        assertAuctionModule({ auctionEnabled: true, scoringEnabled: false }),
      ).not.toThrow();
    });

    it("passes for both", () => {
      expect(() =>
        assertAuctionModule({ auctionEnabled: true, scoringEnabled: true }),
      ).not.toThrow();
    });

    it("throws ModuleAuthorizationError (403 AUCTION_DISABLED) for scoring_only", () => {
      expect(() =>
        assertAuctionModule({ auctionEnabled: false, scoringEnabled: true }),
      ).toThrowError(ModuleAuthorizationError);

      try {
        assertAuctionModule({ auctionEnabled: false, scoringEnabled: true });
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(403);
        expect(err.code).toBe("AUCTION_DISABLED");
      }
    });

    it("throws InvalidTournamentModuleStateError (400 INVALID_MODULE_STATE) for false+false", () => {
      expect(() =>
        assertAuctionModule({ auctionEnabled: false, scoringEnabled: false }),
      ).toThrowError(InvalidTournamentModuleStateError);
    });

    it("throws ModuleAuthorizationError (404 TOURNAMENT_NOT_FOUND) for null", () => {
      try {
        assertAuctionModule(null);
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(404);
        expect(err.code).toBe("TOURNAMENT_NOT_FOUND");
      }
    });
  });

  describe("assertScoringModule", () => {
    it("passes for scoring_only", () => {
      expect(() =>
        assertScoringModule({ auctionEnabled: false, scoringEnabled: true }),
      ).not.toThrow();
    });

    it("passes for both", () => {
      expect(() =>
        assertScoringModule({ auctionEnabled: true, scoringEnabled: true }),
      ).not.toThrow();
    });

    it("throws ModuleAuthorizationError (403 SCORING_DISABLED) for auction_only", () => {
      expect(() =>
        assertScoringModule({ auctionEnabled: true, scoringEnabled: false }),
      ).toThrowError(ModuleAuthorizationError);

      try {
        assertScoringModule({ auctionEnabled: true, scoringEnabled: false });
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(403);
        expect(err.code).toBe("SCORING_DISABLED");
      }
    });

    it("throws InvalidTournamentModuleStateError for false+false", () => {
      expect(() =>
        assertScoringModule({ auctionEnabled: false, scoringEnabled: false }),
      ).toThrowError(InvalidTournamentModuleStateError);
    });

    it("throws ModuleAuthorizationError (404 TOURNAMENT_NOT_FOUND) for null", () => {
      try {
        assertScoringModule(null);
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(404);
        expect(err.code).toBe("TOURNAMENT_NOT_FOUND");
      }
    });
  });

  describe("assertSportModule", () => {
    it("passes for cricket + scoring enabled", () => {
      expect(() =>
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "cricket",
        ),
      ).not.toThrow();
    });

    it("passes for badminton + scoring enabled", () => {
      expect(() =>
        assertSportModule(
          { auctionEnabled: true, scoringEnabled: true, sport: "Badminton" },
          "badminton",
        ),
      ).not.toThrow();
    });

    it("throws ModuleAuthorizationError (403 SPORT_MISMATCH) for cricket requested on badminton", () => {
      try {
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "badminton" },
          "cricket",
        );
        expect.unreachable();
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(403);
        expect(err.code).toBe("SPORT_MISMATCH");
      }
    });

    it("throws ModuleAuthorizationError (403 SPORT_MISMATCH) for badminton requested on cricket", () => {
      try {
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
          "badminton",
        );
        expect.unreachable();
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(403);
        expect(err.code).toBe("SPORT_MISMATCH");
      }
    });

    it("throws ModuleAuthorizationError (403 SCORING_DISABLED) when scoring is disabled", () => {
      try {
        assertSportModule(
          { auctionEnabled: true, scoringEnabled: false, sport: "cricket" },
          "cricket",
        );
        expect.unreachable();
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(403);
        expect(err.code).toBe("SCORING_DISABLED");
      }
    });

    it("throws ModuleAuthorizationError (400 UNSUPPORTED_SPORT) for unsupported sport", () => {
      try {
        assertSportModule(
          { auctionEnabled: false, scoringEnabled: true, sport: "football" },
          "football",
        );
        expect.unreachable();
      } catch (e) {
        const err = e as ModuleAuthorizationError;
        expect(err.status).toBe(400);
        expect(err.code).toBe("UNSUPPORTED_SPORT");
      }
    });
  });
});

describe("Module Authorization: Express Guards", () => {
  describe("requireAuctionModule", () => {
    it("allows auction_only and returns true without writing error", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: true, scoringEnabled: false });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("allows both and returns true", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: true, scoringEnabled: true });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects scoring_only with 403 AUCTION_DISABLED and returns false", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: false, scoringEnabled: true });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Auction module is not enabled for this tournament",
        code: "AUCTION_DISABLED",
      });
    });

    it("rejects false+false with 400 INVALID_MODULE_STATE and returns false", () => {
      const res = createMockResponse();
      const allowed = requireAuctionModule(res, { auctionEnabled: false, scoringEnabled: false });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "A tournament must have at least one enabled product module (auction or scoring).",
        code: "INVALID_MODULE_STATE",
      });
    });

    it("rejects null tournament with 404 TOURNAMENT_NOT_FOUND and returns false", () => {
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

  describe("requireScoringModule", () => {
    it("allows scoring_only and returns true without writing error", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: false, scoringEnabled: true });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("allows both and returns true", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: true, scoringEnabled: true });
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects auction_only with 403 SCORING_DISABLED and returns false", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: true, scoringEnabled: false });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Sports scoring module is not enabled for this tournament",
        code: "SCORING_DISABLED",
      });
    });

    it("rejects false+false with 400 INVALID_MODULE_STATE and returns false", () => {
      const res = createMockResponse();
      const allowed = requireScoringModule(res, { auctionEnabled: false, scoringEnabled: false });
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "A tournament must have at least one enabled product module (auction or scoring).",
        code: "INVALID_MODULE_STATE",
      });
    });

    it("rejects null tournament with 404 TOURNAMENT_NOT_FOUND and returns false", () => {
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

  describe("requireSportModule", () => {
    it("allows cricket + scoring enabled for cricket request", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: false, scoringEnabled: true, sport: "cricket" },
        "cricket",
      );
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("allows badminton + scoring enabled for badminton request (case insensitive)", () => {
      const res = createMockResponse();
      const allowed = requireSportModule(
        res,
        { auctionEnabled: true, scoringEnabled: true, sport: "Badminton" },
        "badminton",
      );
      expect(allowed).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects cricket tournament requesting badminton with 403 SPORT_MISMATCH", () => {
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

    it("rejects badminton tournament requesting cricket with 403 SPORT_MISMATCH", () => {
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

    it("rejects scoring-disabled tournament with 403 SCORING_DISABLED", () => {
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

    it("rejects unsupported sport with 400 UNSUPPORTED_SPORT", () => {
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

    it("rejects null tournament with 404 TOURNAMENT_NOT_FOUND", () => {
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
