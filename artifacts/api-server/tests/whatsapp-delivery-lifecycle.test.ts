import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter from "../src/routes/comm";
import webhookRouter from "../src/routes/webhooks";
import { db, commLogsTable } from "@workspace/db";
import { kvTechMediaProvider } from "../src/lib/communication/providers";

function createTestApp() {
  const app = express();
  app.use(express.json());
  // Mock authenticated admin session
  app.use((req, _res, next) => {
    (req as any).jwtUser = {
      id: "admin_test",
      isAdmin: true,
      email: "admin@bidwar.com",
    };
    next();
  });
  app.use(commRouter);
  app.use(webhookRouter);
  return app;
}

describe("WhatsApp Delivery & Read Receipts Lifecycle Engine", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "test";
    process.env.BIDWAR_ALLOW_INSECURE_TEST_WEBHOOK = "true";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("1. Meta / KV TechMedia Webhook Delivery & Read Receipts", () => {
    it("transitions delivery status from 'sent' to 'delivered'", async () => {
      const app = createTestApp();

      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      const selectSpy = vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ deliveryStatus: "sent" }]),
          }),
        }),
      } as any);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });
      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: setMock,
      } as any);

      const res = await request(app)
        .post("/webhooks/kv-meta")
        .send({
          object: "whatsapp_business_account",
          entry: [
            {
              id: "WABA_ID_TEST",
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    statuses: [
                      {
                        id: "wamid.TEST_MSG_001",
                        status: "delivered",
                        timestamp: "1730000000",
                        recipient_id: "919876543210",
                      },
                    ],
                  },
                  field: "messages",
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: "delivered",
        }),
      );
    });

    it("transitions delivery status from 'delivered' to 'read'", async () => {
      const app = createTestApp();

      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ deliveryStatus: "delivered" }]),
          }),
        }),
      } as any);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });
      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: setMock,
      } as any);

      const res = await request(app)
        .post("/webhooks/kv-meta")
        .send({
          object: "whatsapp_business_account",
          entry: [
            {
              id: "WABA_ID_TEST",
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    statuses: [
                      {
                        id: "wamid.TEST_MSG_002",
                        status: "read",
                        timestamp: "1730000060",
                        recipient_id: "919876543210",
                      },
                    ],
                  },
                  field: "messages",
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: "read",
        }),
      );
    });

    it("enforces monotonic rank guard: does not demote 'read' back to 'delivered'", async () => {
      const app = createTestApp();

      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ deliveryStatus: "read" }]),
          }),
        }),
      } as any);

      const updateSpy = vi.spyOn(db, "update");

      const res = await request(app)
        .post("/webhooks/kv-meta")
        .send({
          object: "whatsapp_business_account",
          entry: [
            {
              id: "WABA_ID_TEST",
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    statuses: [
                      {
                        id: "wamid.TEST_MSG_003",
                        status: "delivered", // out-of-order delivered receipt
                        timestamp: "1730000050",
                        recipient_id: "919876543210",
                      },
                    ],
                  },
                  field: "messages",
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(200);
      // updateSpy should NOT be called to demote 'read' back to 'delivered'
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("persists error message on failed delivery status receipt", async () => {
      const app = createTestApp();

      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ deliveryStatus: "sent" }]),
          }),
        }),
      } as any);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });
      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: setMock,
      } as any);

      const res = await request(app)
        .post("/webhooks/kv-meta")
        .send({
          object: "whatsapp_business_account",
          entry: [
            {
              id: "WABA_ID_TEST",
              changes: [
                {
                  value: {
                    messaging_product: "whatsapp",
                    statuses: [
                      {
                        id: "wamid.TEST_MSG_004",
                        status: "failed",
                        timestamp: "1730000070",
                        recipient_id: "919876543210",
                        errors: [
                          {
                            code: 131026,
                            title: "Receiver is incapable of receiving this message",
                            message: "Receiver is incapable of receiving this message",
                          },
                        ],
                      },
                    ],
                  },
                  field: "messages",
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: "failed",
          errorMessage: "Receiver is incapable of receiving this message",
        }),
      );
    });
  });

  describe("2. Admin Simulation Endpoint (/auth/admin/communicate/simulate-receipt)", () => {
    it("allows admin to simulate status progression from sent to read", async () => {
      const app = createTestApp();

      vi.spyOn(db, "select")
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 42, metaMessageId: "wamid.TEST_SIM", deliveryStatus: "sent" },
              ]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 42, metaMessageId: "wamid.TEST_SIM", deliveryStatus: "read" },
            ]),
          }),
        } as any);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      });
      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: setMock,
      } as any);

      const res = await request(app)
        .post("/auth/admin/communicate/simulate-receipt")
        .send({
          commLogId: 42,
          status: "read",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updated).toBe(true);
      expect(res.body.log.deliveryStatus).toBe("read");
      expect(updateSpy).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: "read",
        }),
      );
    });

    it("rejects non-admin requests with 403", async () => {
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      nonAdminApp.use((req, _res, next) => {
        (req as any).jwtUser = { id: "user_normal", isAdmin: false };
        next();
      });
      nonAdminApp.use(commRouter);

      const res = await request(nonAdminApp)
        .post("/auth/admin/communicate/simulate-receipt")
        .send({
          commLogId: 42,
          status: "delivered",
        });

      expect(res.status).toBe(403);
    });
  });
});
