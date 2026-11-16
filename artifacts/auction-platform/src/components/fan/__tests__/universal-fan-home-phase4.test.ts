import { describe, expect, it, beforeEach } from "vitest";
import {
  resolveTournamentVisibility,
  mergeTournamentFeatures,
} from "@workspace/platform-core/tournament-features";

describe("Phase 4 — Universal Fan Home & Tournament Discovery Tests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Tournament Visibility Resolution", () => {
    it("treats missing or legacy features as public by default", () => {
      expect(resolveTournamentVisibility(null)).toBe("public");
      expect(resolveTournamentVisibility(undefined)).toBe("public");
      expect(resolveTournamentVisibility({})).toBe("public");
    });

    it("identifies explicit unlisted tournaments", () => {
      expect(resolveTournamentVisibility({ visibility: "unlisted" })).toBe("unlisted");
    });

    it("identifies explicit private tournaments", () => {
      expect(resolveTournamentVisibility({ visibility: "private" })).toBe("private");
    });

    it("merges visibility changes cleanly into existing features", () => {
      const initial = { liveAuctionHistory: true, ownerApp: false };
      const patched = mergeTournamentFeatures(initial, { visibility: "private" });
      expect(patched.visibility).toBe("private");
      expect(patched.liveAuctionHistory).toBe(true);
      expect(patched.ownerApp).toBe(false);
    });
  });

  describe("Favorites Storage Contract", () => {
    it("handles valid favorites in localStorage", () => {
      localStorage.setItem("bidwar_fan_favorites", JSON.stringify([1, 4, 10]));
      const raw = localStorage.getItem("bidwar_fan_favorites");
      const parsed = JSON.parse(raw || "[]");
      expect(parsed).toEqual([1, 4, 10]);
    });

    it("recovers safely from invalid or corrupted JSON in localStorage", () => {
      localStorage.setItem("bidwar_fan_favorites", "invalid-json{{[");
      let favorites: number[] = [];
      try {
        const raw = localStorage.getItem("bidwar_fan_favorites");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) favorites = parsed;
        }
      } catch {
        favorites = [];
      }
      expect(favorites).toEqual([]);
    });

    it("filters out negative or non-numeric entries safely", () => {
      localStorage.setItem("bidwar_fan_favorites", JSON.stringify([1, "bad", -5, 4, null, 10]));
      const raw = localStorage.getItem("bidwar_fan_favorites");
      const parsed = JSON.parse(raw || "[]");
      const clean = Array.isArray(parsed)
        ? parsed.filter((id): id is number => typeof id === "number" && id > 0)
        : [];
      expect(clean).toEqual([1, 4, 10]);
    });
  });

  describe("Discovery Endpoint Query Parameters", () => {
    it("constructs correct query strings for filtering", () => {
      const params = new URLSearchParams();
      params.set("search", "League");
      params.set("sport", "cricket");
      params.set("status", "live");
      params.set("module", "both");
      params.set("page", "1");
      params.set("limit", "24");

      const qs = params.toString();
      expect(qs).toContain("search=League");
      expect(qs).toContain("sport=cricket");
      expect(qs).toContain("status=live");
      expect(qs).toContain("module=both");
    });
  });
});
