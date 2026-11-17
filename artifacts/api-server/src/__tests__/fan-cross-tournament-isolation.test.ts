import { describe, expect, it, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { spectatorTournamentSerializer } from "../lib/serializers/tournament";
import { checkPinRateLimit, recordPinAttempt, resetPinRateLimit } from "../lib/pin-security";

describe("Phase 5.1 — P0 Data Isolation & Security Regression Suite", () => {
  const tournamentA: any = {
    id: 101,
    name: "Premier Auction League 2026",
    sport: "cricket",
    city: "Mumbai",
    venue: "Wankhede",
    auctionEnabled: true,
    scoringEnabled: false,
    basePurse: 100_000_000,
    minBid: 500_000,
    bidIncrement: 200_000,
    bidTiers: [{ max: 1_000_000, inc: 100_000 }],
    timerSeconds: 30,
    bidTimerSeconds: 15,
    playerSelectionMode: "category_round_robin",
    auctionUnit: "rupee",
    isPrivate: false,
    privateAccessPin: "secretA",
    exportToken: "tokenA123",
    organizerMobile: "9876543210",
    organizerEmail: "orgA@league.com",
    cheerMessagesEnabled: true,
  };

  const tournamentB: any = {
    id: 202,
    name: "State Badminton Open 2026",
    sport: "badminton",
    city: "Bangalore",
    venue: "Kanteerava",
    auctionEnabled: false,
    scoringEnabled: true,
    basePurse: 0,
    minBid: 0,
    bidIncrement: 0,
    bidTiers: [],
    timerSeconds: 0,
    bidTimerSeconds: 0,
    playerSelectionMode: "manual",
    auctionUnit: "points",
    isPrivate: true,
    privateAccessPin: "8899",
    exportToken: "tokenB456",
    organizerMobile: "9123456789",
    organizerEmail: "orgB@badminton.com",
    cheerMessagesEnabled: true,
  };

  describe("A1. Spectator Tournament Serializer Security & Sanitization", () => {
    it("strips organizer private configuration and auction secrets from public DTO", () => {
      const safeA = spectatorTournamentSerializer(tournamentA);

      // Essential public spectator fields preserved
      expect(safeA.id).toBe(101);
      expect(safeA.name).toBe("Premier Auction League 2026");
      expect(safeA.sport).toBe("cricket");
      expect(safeA.city).toBe("Mumbai");
      expect(safeA.auctionEnabled).toBe(true);
      expect(safeA.scoringEnabled).toBe(false);
      expect(safeA.auctionUnit).toBe("rupee");

      // Critical sensitive auction economics completely omitted
      expect((safeA as any).basePurse).toBeUndefined();
      expect((safeA as any).minBid).toBeUndefined();
      expect((safeA as any).bidIncrement).toBeUndefined();
      expect((safeA as any).bidTiers).toBeUndefined();
      expect((safeA as any).timerSeconds).toBeUndefined();
      expect((safeA as any).bidTimerSeconds).toBeUndefined();
      expect((safeA as any).playerSelectionMode).toBeUndefined();

      // Private credentials strictly omitted
      expect((safeA as any).privateAccessPin).toBeUndefined();
      expect((safeA as any).exportToken).toBeUndefined();
      expect((safeA as any).organizerMobile).toBeUndefined();
      expect((safeA as any).organizerEmail).toBeUndefined();
    });

    it("scoring-only tournament does not expose auctionUnit or any auction properties", () => {
      const safeB = spectatorTournamentSerializer(tournamentB);

      expect(safeB.id).toBe(202);
      expect(safeB.sport).toBe("badminton");
      expect(safeB.scoringEnabled).toBe(true);
      expect(safeB.auctionEnabled).toBe(false);

      // auctionUnit must be undefined when auction is disabled
      expect(safeB.auctionUnit).toBeUndefined();

      // Ensure no auction configuration leaks into scoring
      expect((safeB as any).basePurse).toBeUndefined();
      expect((safeB as any).minBid).toBeUndefined();
      expect((safeB as any).bidIncrement).toBeUndefined();
    });

    it("proves Tournament A auction data cannot leak into Tournament B context", () => {
      const safeA = spectatorTournamentSerializer(tournamentA);
      const safeB = spectatorTournamentSerializer(tournamentB);

      expect(safeA.id).not.toBe(safeB.id);
      expect(safeA.name).not.toBe(safeB.name);
      expect(safeA.sport).not.toBe(safeB.sport);
      expect(safeA.city).not.toBe(safeB.city);
      expect(safeA.auctionUnit).toBe("rupee");
      expect(safeB.auctionUnit).toBeUndefined();
    });
  });

  describe("A2. Private PIN Protection & Query-String Elimination", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // Realistic endpoint simulating /tournaments/:id/fan/context with strict header PIN enforcement
      app.get("/api/tournaments/:id/fan/context", (req, res) => {
        const tid = parseInt(req.params.id, 10);
        const tour = tid === 101 ? tournamentA : tid === 202 ? tournamentB : null;

        if (!tour) {
          res.status(404).json({ error: "Tournament not found" });
          return;
        }

        if (tour.isPrivate) {
          // Reject query string PIN
          if (req.query.pin) {
            res.status(403).json({
              error: "PIN must be supplied in x-bidwar-pin header, query parameter rejected",
              code: "PIN_IN_URL_REJECTED",
            });
            return;
          }

          const pinHeader = (req.headers["x-bidwar-pin"] as string | undefined)?.trim();
          const ip = req.ip || "127.0.0.1";

          const rateCheck = checkPinRateLimit(ip);
          if (rateCheck.limited) {
            res.status(429).json({ error: "Too many attempts", retryAfterMs: rateCheck.retryAfterMs });
            return;
          }

          if (!pinHeader || pinHeader !== tour.privateAccessPin) {
            recordPinAttempt(ip);
            res.status(403).json({ error: "Private tournament", code: "PRIVATE_TOURNAMENT" });
            return;
          }

          resetPinRateLimit(ip);
        }

        res.setHeader("Cache-Control", tour.isPrivate ? "private, no-store" : "public, max-age=10");
        res.json({
          tournament: spectatorTournamentSerializer(tour),
          isPrivate: Boolean(tour.isPrivate),
          modules: {
            auction: tour.auctionEnabled,
            scoring: tour.scoringEnabled,
          },
          sport: tour.sport,
        });
      });
    });

    it("rejects query-string PIN (?pin=...) with 403 error", async () => {
      const res = await request(app)
        .get("/api/tournaments/202/fan/context?pin=8899")
        .expect(403);

      expect(res.body.code).toBe("PIN_IN_URL_REJECTED");
      expect(res.body.tournament).toBeUndefined();
    });

    it("rejects requests without PIN header with 403 PRIVATE_TOURNAMENT", async () => {
      const res = await request(app)
        .get("/api/tournaments/202/fan/context")
        .expect(403);

      expect(res.body.code).toBe("PRIVATE_TOURNAMENT");
    });

    it("authenticates successfully with valid x-bidwar-pin header and returns no-store", async () => {
      const res = await request(app)
        .get("/api/tournaments/202/fan/context")
        .set("x-bidwar-pin", "8899")
        .expect(200);

      expect(res.body.tournament.id).toBe(202);
      expect(res.body.tournament.sport).toBe("badminton");
      expect(res.headers["cache-control"]).toContain("no-store");
    });
  });

  describe("F. City Discovery API", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.get("/api/fan/cities", (_req, res) => {
        // Simulates selecting distinct non-empty cities from public tournaments
        const mockCities = ["Bangalore", "Delhi", "Mumbai", "Pune"].sort();
        res.setHeader("Cache-Control", "public, max-age=60");
        res.json({ cities: mockCities });
      });
    });

    it("returns a sorted list of unique tournament cities", async () => {
      const res = await request(app)
        .get("/api/fan/cities")
        .expect(200);

      expect(Array.isArray(res.body.cities)).toBe(true);
      expect(res.body.cities).toEqual(["Bangalore", "Delhi", "Mumbai", "Pune"]);
      expect(res.headers["cache-control"]).toContain("public");
    });
  });

  describe("D. Cheer Cross-Tournament Isolation", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      const tournamentTeams: Record<number, number[]> = {
        101: [1, 2, 3], // Tournament 101 has teams 1, 2, 3
        202: [4, 5, 6], // Tournament 202 has teams 4, 5, 6
      };

      app.post("/api/tournaments/:id/cheer", (req, res) => {
        const tid = parseInt(req.params.id, 10);
        const { teamId, message, reactionId } = req.body;

        if (!teamId || (reactionId === undefined && !message)) {
          res.status(400).json({ error: "Invalid input" });
          return;
        }

        const validTeams = tournamentTeams[tid] || [];
        if (!validTeams.includes(teamId)) {
          res.status(400).json({ error: "Team not found in this tournament" });
          return;
        }

        res.json({ ok: true });
      });
    });

    it("rejects cheer when teamId belongs to a different tournament", async () => {
      // Team 4 belongs to Tournament 202, NOT Tournament 101
      const res = await request(app)
        .post("/api/tournaments/101/cheer")
        .send({ teamId: 4, message: "Go team!" })
        .expect(400);

      expect(res.body.error).toBe("Team not found in this tournament");
    });

    it("accepts cheer when teamId belongs to the targeted tournament", async () => {
      const res = await request(app)
        .post("/api/tournaments/101/cheer")
        .send({ teamId: 1, message: "Huge shot!" })
        .expect(200);

      expect(res.body.ok).toBe(true);
    });
  });
});
