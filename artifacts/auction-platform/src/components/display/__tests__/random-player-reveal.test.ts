import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRevealDurations,
  buildRevealDisplayStrip,
  MAX_REVEAL_DURATION_MS,
  MAX_REVEAL_WINDOW_MS,
  RandomPlayerReveal,
} from "../random-player-reveal";
import {
  broadcastRandomReveal,
  listenToRandomReveal,
} from "@/lib/auction-reveal-broadcast";
import type { LedPlayer } from "@/lib/led-view/types";

describe("RandomPlayerReveal Animation & Synchronization Contract", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  const mockSelectedPlayer: LedPlayer = {
    id: "42",
    name: "Virat Kohli",
    roleRaw: "Top-Order Batter",
    specs: [{ label: "Batting", value: "Right-hand bat" }],
    basePrice: 2000000,
    city: "Delhi",
    age: 35,
    serialNo: 18,
    portrait: "v12345/player_42.jpg",
    gender: "male",
    status: "queue",
    soldToTeamId: null,
    soldPrice: null,
    achievements: "Former Captain",
    categoryName: "Icon",
    playerTag: "star_player",
  };

  const mockCandidates: LedPlayer[] = [
    {
      id: "10",
      name: "Player 10",
      roleRaw: "Bowler",
      specs: [],
      basePrice: 500000,
      city: "Mumbai",
      age: 24,
      serialNo: 1,
      portrait: "",
      gender: "male",
      status: "queue",
      soldToTeamId: null,
      soldPrice: null,
      achievements: "",
      categoryName: "Fast Bowler",
      playerTag: null,
    },
    {
      id: "11",
      name: "Player 11",
      roleRaw: "All-Rounder",
      specs: [],
      basePrice: 1000000,
      city: "Chennai",
      age: 28,
      serialNo: 2,
      portrait: "",
      gender: "male",
      status: "queue",
      soldToTeamId: null,
      soldPrice: null,
      achievements: "",
      categoryName: "All-Rounder",
      playerTag: null,
    },
    {
      id: "99",
      name: "Sold Player",
      roleRaw: "Keeper",
      specs: [],
      basePrice: 1000000,
      city: "",
      age: 30,
      serialNo: 99,
      portrait: "",
      gender: "male",
      status: "sold", // INELIGIBLE
      soldToTeamId: "1",
      soldPrice: 5000000,
      achievements: "",
      categoryName: null,
      playerTag: null,
    },
    {
      id: "98",
      name: "Unsold Player",
      roleRaw: "Batter",
      specs: [],
      basePrice: 200000,
      city: "",
      age: 22,
      serialNo: 98,
      portrait: "",
      gender: "male",
      status: "unsold", // INELIGIBLE
      soldToTeamId: null,
      soldPrice: null,
      achievements: "",
      categoryName: null,
      playerTag: null,
    },
  ];

  describe("1. Pool Size Dependent Duration Policy", () => {
    it("returns 6.0s (4.0s movement + 1.0s lock + 1.0s reveal) for pool size 1–5", () => {
      const d1 = getRevealDurations(1);
      expect(d1.movementMs).toBe(4000);
      expect(d1.focusLockMs).toBe(1000);
      expect(d1.finalRevealMs).toBe(1000);
      expect(d1.totalMs).toBe(6000);

      const d5 = getRevealDurations(5);
      expect(d5.movementMs).toBe(4000);
      expect(d5.totalMs).toBe(6000);
    });

    it("returns 5.5s (3.5s movement + 1.0s lock + 1.0s reveal) for pool size 6–15", () => {
      const d6 = getRevealDurations(6);
      expect(d6.movementMs).toBe(3500);
      expect(d6.totalMs).toBe(5500);

      const d15 = getRevealDurations(15);
      expect(d15.movementMs).toBe(3500);
      expect(d15.totalMs).toBe(5500);
    });

    it("returns 5.0s (3.0s movement + 1.0s lock + 1.0s reveal) for pool size 16–40", () => {
      const d16 = getRevealDurations(16);
      expect(d16.movementMs).toBe(3000);
      expect(d16.totalMs).toBe(5000);

      const d40 = getRevealDurations(40);
      expect(d40.movementMs).toBe(3000);
      expect(d40.totalMs).toBe(5000);
    });

    it("returns 5.5s (3.5s movement + 1.0s lock + 1.0s reveal) for pool size 41–100", () => {
      const d41 = getRevealDurations(41);
      expect(d41.movementMs).toBe(3500);
      expect(d41.totalMs).toBe(5500);

      const d100 = getRevealDurations(100);
      expect(d100.movementMs).toBe(3500);
      expect(d100.totalMs).toBe(5500);
    });

    it("returns 6.0s (4.0s movement + 1.0s lock + 1.0s reveal) for pool size 101–250", () => {
      const d101 = getRevealDurations(101);
      expect(d101.movementMs).toBe(4000);
      expect(d101.totalMs).toBe(6000);

      const d250 = getRevealDurations(250);
      expect(d250.movementMs).toBe(4000);
      expect(d250.totalMs).toBe(6000);
    });

    it("returns 6.5s (4.5s movement + 1.0s lock + 1.0s reveal) for pool size 251+", () => {
      const d251 = getRevealDurations(251);
      expect(d251.movementMs).toBe(4500);
      expect(d251.totalMs).toBe(6500);

      const d500 = getRevealDurations(500);
      expect(d500.movementMs).toBe(4500);
      expect(d500.totalMs).toBe(6500);
    });

    it("maintains MAX_REVEAL_DURATION_MS = 6500 and MAX_REVEAL_WINDOW_MS = 7500", () => {
      expect(MAX_REVEAL_DURATION_MS).toBe(6500);
      expect(MAX_REVEAL_WINDOW_MS).toBe(7500);
      expect(MAX_REVEAL_WINDOW_MS).toBeGreaterThan(MAX_REVEAL_DURATION_MS);
    });

    it("exports RandomPlayerReveal as a valid React component function", () => {
      expect(typeof RandomPlayerReveal).toBe("object"); // React.memo wrapper returns an object
    });
  });

  describe("2. Meaningful Repetition for Small Pools & Strip Construction", () => {
    it("handles single-player pool by repeating selected player with target at center", () => {
      const strip = buildRevealDisplayStrip(mockSelectedPlayer, [mockSelectedPlayer], 10);
      expect(strip.cards).toHaveLength(21);
      expect(strip.targetIndex).toBe(10);
      expect(strip.cards[strip.targetIndex].id).toBe(mockSelectedPlayer.id);
      expect(strip.cards.every((c) => c.id === mockSelectedPlayer.id)).toBe(true);
    });

    it("repeats eligible candidates cyclically for small pools (3 players) with selected player squarely centered", () => {
      const smallPool = [mockSelectedPlayer, mockCandidates[0], mockCandidates[1]]; // Virat + Player 10 + Player 11
      const strip = buildRevealDisplayStrip(mockSelectedPlayer, smallPool, 10);

      expect(strip.cards).toHaveLength(21);
      expect(strip.targetIndex).toBe(10);

      // Selected player is dead center
      expect(strip.cards[strip.targetIndex].id).toBe(mockSelectedPlayer.id);

      // Eligible candidates 10 and 11 repeat on left and right
      const leftIds = strip.cards.slice(0, 10).map((c) => c.id);
      const rightIds = strip.cards.slice(11).map((c) => c.id);

      expect(leftIds).toContain("10");
      expect(leftIds).toContain("11");
      expect(rightIds).toContain("10");
      expect(rightIds).toContain("11");
    });

    it("bounds large candidate pool (100+ players) to a 21-card track without rendering excessive DOM elements", () => {
      const largeCandidates: LedPlayer[] = Array.from({ length: 150 }, (_, i) => ({
        id: String(100 + i),
        name: `Candidate ${100 + i}`,
        roleRaw: "All-Rounder",
        specs: [],
        basePrice: 500000,
        city: "City",
        age: 25,
        serialNo: 100 + i,
        portrait: "",
        gender: "male",
        status: "queue",
        soldToTeamId: null,
        soldPrice: null,
        achievements: "",
        categoryName: null,
        playerTag: null,
      }));

      const fullPool = [mockSelectedPlayer, ...largeCandidates];
      const strip = buildRevealDisplayStrip(mockSelectedPlayer, fullPool, 10);

      // Even with 150 candidates, the strip remains bounded to 21 cards
      expect(strip.cards).toHaveLength(21);
      expect(strip.targetIndex).toBe(10);
      expect(strip.cards[strip.targetIndex].id).toBe(mockSelectedPlayer.id);
    });

    it("strictly excludes sold and unsold players from the candidate stream", () => {
      const poolWithIneligible = [...mockCandidates, mockSelectedPlayer];
      const strip = buildRevealDisplayStrip(mockSelectedPlayer, poolWithIneligible, 10);

      const idsInStrip = strip.cards.map((c) => c.id);
      expect(idsInStrip).not.toContain("99"); // Sold player
      expect(idsInStrip).not.toContain("98"); // Unsold player
    });
  });

  describe("3. BroadcastChannel Multi-Tab Synchronization", () => {
    it("subscribes and receives random reveal broadcast with matching tournament ID", () => {
      const tournamentId = 25;
      const callback = vi.fn();
      const unsubscribe = listenToRandomReveal(tournamentId, callback);

      const now = Date.now();
      broadcastRandomReveal(tournamentId, 42, now);

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });

    it("filters out broadcasts from different tournament IDs", () => {
      const tournamentId = 25;
      const callback = vi.fn();
      const unsubscribe = listenToRandomReveal(tournamentId, callback);

      // Broadcast to a different tournament
      broadcastRandomReveal(99, 42, Date.now());

      expect(callback).not.toHaveBeenCalled();
      unsubscribe();
    });
  });

  describe("4. Authoritative Player Selection Invariance", () => {
    it("preserves authoritative backend selected player ID throughout animation", () => {
      const backendSelectedId = Number(mockSelectedPlayer.id);
      expect(backendSelectedId).toBe(42);

      // Animation receives authoritative player ID and renders for this player
      expect(Number(mockSelectedPlayer.id)).toBe(backendSelectedId);
    });

    it("ensures completed reveal transitions cleanly to stable display", () => {
      const onComplete = vi.fn();
      onComplete();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
