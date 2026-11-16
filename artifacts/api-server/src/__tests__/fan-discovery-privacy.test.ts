import { describe, expect, it } from "vitest";
import fanDiscoveryRouter, { fanDiscoveryQuerySchema } from "../routes/fan-discovery";
import {
  resolveTournamentVisibility,
  mergeTournamentFeatures,
  resolveTournamentFeatures,
} from "@workspace/platform-core/tournament-features";

describe("Fan Discovery Router & Privacy Specification", () => {
  it("exports an Express router with discovery and fan context endpoints", () => {
    expect(fanDiscoveryRouter).toBeDefined();
    const stack = (fanDiscoveryRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
    const paths = stack.filter((layer) => layer.route).map((layer) => layer.route?.path);

    expect(paths).toContain("/fan/tournaments");
    expect(paths).toContain("/tournaments/:tournamentId/fan/context");
  });

  describe("Validation Schema (fanDiscoveryQuerySchema)", () => {
    it("applies safe defaults for query parameters", () => {
      const parsed = fanDiscoveryQuerySchema.parse({});
      expect(parsed.sport).toBe("all");
      expect(parsed.status).toBe("all");
      expect(parsed.module).toBe("all");
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortBy).toBe("live_first");
    });

    it("accepts valid search, sport, status, and module filters", () => {
      const parsed = fanDiscoveryQuerySchema.parse({
        search: "Premier League",
        sport: "cricket",
        status: "live",
        module: "both",
        page: "2",
        limit: "15",
        sortBy: "newest",
      });
      expect(parsed.search).toBe("Premier League");
      expect(parsed.sport).toBe("cricket");
      expect(parsed.status).toBe("live");
      expect(parsed.module).toBe("both");
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(15);
      expect(parsed.sortBy).toBe("newest");
    });

    it("rejects invalid page or limit parameters", () => {
      expect(() => fanDiscoveryQuerySchema.parse({ page: "0" })).toThrow();
      expect(() => fanDiscoveryQuerySchema.parse({ limit: "100" })).toThrow();
    });
  });

  describe("Tournament Visibility Resolution & Progressive Feature Merging", () => {
    it("defaults legacy tournaments without featuresJson to public visibility", () => {
      expect(resolveTournamentVisibility(null)).toBe("public");
      expect(resolveTournamentVisibility(undefined)).toBe("public");
      expect(resolveTournamentVisibility({})).toBe("public");
      expect(resolveTournamentVisibility({ ownerApp: false })).toBe("public");
    });

    it("resolves explicit unlisted and private visibility correctly", () => {
      expect(resolveTournamentVisibility({ visibility: "unlisted" })).toBe("unlisted");
      expect(resolveTournamentVisibility({ visibility: "private" })).toBe("private");
      expect(resolveTournamentVisibility({ visibility: "public" })).toBe("public");
    });

    it("falls back to public on unrecognized visibility strings", () => {
      expect(resolveTournamentVisibility({ visibility: "unknown_value" as any })).toBe("public");
    });

    it("merges visibility changes into existing featuresJson without mutating other flags", () => {
      const existing = {
        whatsappNotifications: false,
        liveAuctionHistory: true,
        weddingBroadcast: false,
      };

      const unlisted = mergeTournamentFeatures(existing, { visibility: "unlisted" });
      expect(unlisted.visibility).toBe("unlisted");
      expect(unlisted.whatsappNotifications).toBe(false);
      expect(unlisted.liveAuctionHistory).toBe(true);

      const priv = mergeTournamentFeatures(unlisted, { visibility: "private" });
      expect(priv.visibility).toBe("private");
      expect(priv.whatsappNotifications).toBe(false);

      const pub = mergeTournamentFeatures(priv, { visibility: "public" });
      expect(pub.visibility).toBe("public");
    });
  });

  describe("API Endpoint Integration", () => {
    it("fetches public tournaments from /api/fan/tournaments", async () => {
      const res = await fetch("http://localhost:8081/api/fan/tournaments");
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("pagination");
      expect(data).toHaveProperty("summary");
      expect(Array.isArray(data.items)).toBe(true);

      if (data.items.length > 0) {
        const item = data.items[0];
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("sport");
        expect(item).toHaveProperty("productMode");
        expect(item).toHaveProperty("isLive");

        // Sensitive fields must never be exposed on discovery cards
        expect(item).not.toHaveProperty("organizerMobile");
        expect(item).not.toHaveProperty("organizerEmail");
        expect(item).not.toHaveProperty("scoringPin");
        expect(item).not.toHaveProperty("exportToken");
      }
    });

    it("fetches tournament fan context from /api/tournaments/:id/fan/context", async () => {
      const res = await fetch("http://localhost:8081/api/tournaments/1/fan/context");
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveProperty("tournament");
      expect(data).toHaveProperty("liveState");
      expect(data.tournament.id).toBe(1);
      expect(data.liveState).toHaveProperty("recommendedTab");

      // Verify privacy masking
      expect(data.tournament).not.toHaveProperty("organizerMobile");
      expect(data.tournament).not.toHaveProperty("scoringPin");
    });
  });
});
