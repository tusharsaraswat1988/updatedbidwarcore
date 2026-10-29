import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter from "../src/routes/comm";
import { db, commLogsTable, waTemplatesTable } from "@workspace/db";

function createAppWithUser(user: any) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    (req as any).cookies = { bidwar_auth: "test_token" };
    (req as any).jwtUser = user;
    next();
  });
  app.use(commRouter);
  return app;
}

describe("Phase 2A: WhatsApp Provider Status & Gate A Verification", () => {
  const originalEnv = { ...process.env };
  const adminApp = createAppWithUser({
    isAdmin: true,
    role: "admin",
    adminLevel: "master",
    email: "admin@bidwar.com",
  });
  const nonAdminApp = createAppWithUser({
    isAdmin: false,
    role: "player",
    email: "user@bidwar.com",
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();

    // Default db mock
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: vi.fn().mockImplementation((table: any) => {
        if (table === commLogsTable) {
          return {
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
        if (table === waTemplatesTable) {
          const res = [
            {
              id: 1,
              templateName: "player_sold",
              category: "utility",
              description: "Instant notification to player when sold",
              status: "approved",
            },
            {
              id: 2,
              templateName: "welcome_invite",
              category: "utility",
              description: "Welcome invitation to tournament player",
              status: "approved",
            },
          ];
          return {
            orderBy: vi.fn().mockResolvedValue(res),
            then: (resolve: any) => Promise.resolve(res).then(resolve),
          };
        }
        return {
          where: vi.fn().mockResolvedValue([]),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
        };
      }),
    })) as any);

    vi.spyOn(db, "insert").mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue({}),
      }),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Authorization Controls
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Provider Status Endpoint Authorization", () => {
    it("rejects non-admin access with HTTP 403", async () => {
      const res = await request(nonAdminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Admin required");
    });

    it("allows admin access with HTTP 200", async () => {
      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("provider");
      expect(res.body).toHaveProperty("status");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Truthful Status & Provider Mapping
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Truthful Provider Mapping & No Quality Fabrications", () => {
    it("reports 'none' and 'unconfigured' when WHATSAPP_PROVIDER is unset", async () => {
      delete process.env.WHATSAPP_PROVIDER;
      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe("none");
      expect(res.body.displayName).toBe("Not Configured");
      expect(res.body.configured).toBe(false);
      expect(res.body.status).toBe("unconfigured");
    });

    it("reports 'mock' provider truthfully in non-production", async () => {
      process.env.WHATSAPP_PROVIDER = "mock";
      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe("mock");
      expect(res.body.displayName).toBe("Mock Provider (Test/Dev Only)");
      expect(res.body.configured).toBe(true);
      expect(res.body.status).toBe("mock");
    });

    it("reports 'kv_techmedia' with configuration errors when missing API credentials", async () => {
      process.env.WHATSAPP_PROVIDER = "kv_techmedia";
      delete process.env.KV_META_ACCESS_TOKEN;
      delete process.env.KV_META_PHONE_NUMBER_ID;
      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe("kv_techmedia");
      expect(res.body.displayName).toBe("KV TechMedia");
      expect(res.body.configured).toBe(true);
      expect(res.body.configValid).toBe(false);
      expect(res.body.status).toBe("invalid_config");
      expect(res.body.configErrors.length).toBeGreaterThan(0);
      expect(res.body.configErrors.some((e: string) => e.includes("KV_META_"))).toBe(true);
    });

    it("reports 'twilio' with valid status when credentials are provided", async () => {
      process.env.WHATSAPP_PROVIDER = "twilio";
      process.env.TWILIO_ACCOUNT_SID = "AC_mock_sid_12345678901234567890";
      process.env.TWILIO_AUTH_TOKEN = "mock_auth_token_secret";
      process.env.TWILIO_WHATSAPP_FROM = "+14155238886";

      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe("twilio");
      expect(res.body.displayName).toBe("Twilio WhatsApp");
      expect(res.body.configured).toBe(true);
      expect(res.body.configValid).toBe(true);
      expect(res.body.status).toBe("configured");
      expect(res.body.configErrors).toHaveLength(0);
    });

    it("reports 'meta_direct' with valid status when credentials are provided", async () => {
      process.env.WHATSAPP_PROVIDER = "meta_direct";
      process.env.META_DIRECT_ACCESS_TOKEN = "EAAG_mock_token";
      process.env.META_DIRECT_PHONE_NUMBER_ID = "10987654321";

      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe("meta_direct");
      expect(res.body.displayName).toBe("Meta Direct Cloud API");
      expect(res.body.configured).toBe(true);
      expect(res.body.configValid).toBe(true);
      expect(res.body.status).toBe("configured");
      expect(res.body.configErrors).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Security Boundary & Redaction (Zero Leaked Secrets)
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Secret Redaction & Read-Only Security Boundary", () => {
    it("never returns credentials, tokens, or account SIDs in the response body", async () => {
      process.env.WHATSAPP_PROVIDER = "twilio";
      process.env.TWILIO_ACCOUNT_SID = "AC_very_secret_sid";
      process.env.TWILIO_AUTH_TOKEN = "super_secret_token";
      process.env.TWILIO_WHATSAPP_FROM = "+14155238886";

      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      const rawString = JSON.stringify(res.body);

      expect(rawString).not.toContain("AC_very_secret_sid");
      expect(rawString).not.toContain("super_secret_token");
      expect(res.body).not.toHaveProperty("apiKey");
      expect(res.body).not.toHaveProperty("authToken");
      expect(res.body).not.toHaveProperty("accountSid");
      expect(res.body).not.toHaveProperty("accessToken");
    });

    it("explicitly confirms verifiedConnectivity is false with explanation note", async () => {
      process.env.WHATSAPP_PROVIDER = "mock";
      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.verifiedConnectivity).toBe(false);
      expect(res.body.connectivityNote).toContain("not verified via live ping");
    });

    it("rejects attempts to change the active provider via POST or PUT (read-only)", async () => {
      const postRes = await request(adminApp)
        .post("/auth/admin/communicate/provider-status")
        .send({ provider: "meta_direct" });
      expect([404, 405]).toContain(postRes.status);

      const putRes = await request(adminApp)
        .put("/auth/admin/communicate/provider-status")
        .send({ provider: "meta_direct" });
      expect([404, 405]).toContain(putRes.status);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Delivery Health Aggregation (Evidence-Based, No Fabrications)
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Delivery Health Reporting", () => {
    it("aggregates recent delivery logs truthfully when logs exist", async () => {
      const mockRecentLogs = [
        { id: 1, deliveryStatus: "sent", sentAt: new Date("2026-10-29T10:00:00Z") },
        { id: 2, deliveryStatus: "delivered", sentAt: new Date("2026-10-29T09:30:00Z") },
        { id: 3, deliveryStatus: "failed", sentAt: new Date("2026-10-29T09:00:00Z") },
      ];

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === commLogsTable) {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(mockRecentLogs),
                }),
              }),
            };
          }
          return {
            where: vi.fn().mockResolvedValue([]),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
          };
        }),
      })) as any);

      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.deliveryHealth).toBeDefined();
      expect(res.body.deliveryHealth.totalLogged).toBe(3);
      expect(res.body.deliveryHealth.deliveredCount).toBe(2);
      expect(res.body.deliveryHealth.failedCount).toBe(1);
      expect(res.body.deliveryHealth.lastDispatchedAt).toBe("2026-10-29T10:00:00.000Z");
      expect(res.body.deliveryHealth.lastDeliveryStatus).toBe("sent");
    });

    it("returns zero counts when no recent WhatsApp messages exist", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === commLogsTable) {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            };
          }
          return {
            where: vi.fn().mockResolvedValue([]),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
          };
        }),
      })) as any);

      const res = await request(adminApp).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);
      expect(res.body.deliveryHealth.totalLogged).toBe(0);
      expect(res.body.deliveryHealth.deliveredCount).toBe(0);
      expect(res.body.deliveryHealth.failedCount).toBe(0);
      expect(res.body.deliveryHealth.lastDispatchedAt).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Authoritative Template Catalog Loading
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Authoritative Template Catalog Loading", () => {
    it("requires admin authentication for GET /auth/admin/communicate/templates", async () => {
      const res = await request(nonAdminApp).get("/auth/admin/communicate/templates");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Admin required");
    });

    it("returns enriched canonical templates for admin", async () => {
      const res = await request(adminApp).get("/auth/admin/communicate/templates");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const first = res.body[0];
      expect(first).toHaveProperty("templateName");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("category");
      expect(first).toHaveProperty("description");
      expect(first).toHaveProperty("variables");
      expect(first).toHaveProperty("body");
    });
  });
});
