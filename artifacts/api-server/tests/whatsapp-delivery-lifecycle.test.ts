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
    process.env.KV_WEBHOOK_VERIFY_TOKEN = "test_verify_token_123";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("Phase 2 — Provider Webhook Contract & Challenge Handshake", () => {
    it("responds to KVtMedia custom webhook challenge query (?challange=...) as documented", async () => {
      const app = createTestApp();
      const res = await request(app)
        .get("/webhooks/kv-meta")
        .query({ challange: "kvtmedia_challange_token_999" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("kvtmedia_challange_token_999");
    });

    it("responds to standard challenge query (?challenge=...)", async () => {
      const app = createTestApp();
      const res = await request(app)
        .get("/webhooks/kv-meta")
        .query({ challenge: "standard_challenge_token_888" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("standard_challenge_token_888");
    });

    it("responds to Meta standard GET hub.challenge verification", async () => {
      const app = createTestApp();
      const res = await request(app)
        .get("/webhooks/kv-meta")
        .query({
          "hub.mode": "subscribe",
          "hub.verify_token": "test_verify_token_123",
          "hub.challenge": "meta_hub_challenge_777",
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe("meta_hub_challenge_777");
    });

    it("rejects challenge request when verify_token is incorrect", async () => {
      const app = createTestApp();
      const res = await request(app)
        .get("/webhooks/kv-meta")
        .query({
          challange: "test_challenge",
          token: "wrong_token",
        });

      expect(res.status).toBe(403);
    });

    it("works via /webhooks/whatsapp alias", async () => {
      const app = createTestApp();
      const res = await request(app)
        .get("/webhooks/whatsapp")
        .query({ challange: "whatsapp_alias_challenge" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("whatsapp_alias_challenge");
    });
  });

  describe("Phase 3 & 5 — Delivery Receipts End-to-End Scenarios", () => {
    it("Scenario 1 & 2: Provider sends 'sent' webhook event", async () => {
      const app = createTestApp();
      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ deliveryStatus: "pending" }]),
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
                        id: "wamid.TEST_MSG_SENT",
                        status: "sent",
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
          deliveryStatus: "sent",
        }),
      );
    });

    it("Scenario 3: Provider sends 'delivered' webhook event -> transitions from 'sent' to 'delivered'", async () => {
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
                        id: "wamid.TEST_MSG_001",
                        status: "delivered",
                        timestamp: "1730000010",
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

    it("Scenario 4: Provider sends 'read' webhook event -> transitions from 'delivered' to 'read'", async () => {
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

    it("Scenario 5: Duplicate webhook delivery is idempotently skipped without DB write", async () => {
      const app = createTestApp();
      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ deliveryStatus: "delivered" }]),
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
                        id: "wamid.TEST_MSG_DUP",
                        status: "delivered", // Same as current status
                        timestamp: "1730000010",
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
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("Scenario 6: Unknown provider message ID acknowledged with 200 without error", async () => {
      const app = createTestApp();
      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No record found
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
                        id: "wamid.UNKNOWN_ID_999",
                        status: "delivered",
                        timestamp: "1730000010",
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
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("Scenario 7: Malformed or empty payload is handled safely", async () => {
      const app = createTestApp();
      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      const res1 = await request(app).post("/webhooks/kv-meta").send({});
      expect(res1.status).toBe(200);

      const res2 = await request(app).post("/webhooks/kv-meta").send({ random_junk: 12345 });
      expect(res2.status).toBe(200);
    });

    it("Scenario 8: Read status cannot regress to Delivered (monotonic guard)", async () => {
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
                        id: "wamid.TEST_MSG_REGRESS",
                        status: "delivered", // Delayed/out-of-order delivered receipt
                        timestamp: "1730000010",
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
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("Scenario 8b: Delivered status cannot regress to Sent or Failed", async () => {
      const app = createTestApp();
      vi.spyOn(kvTechMediaProvider, "verifyWebhookSignature").mockReturnValue(true);

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ deliveryStatus: "delivered" }]),
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
                        id: "wamid.TEST_MSG_REGRESS_FAIL",
                        status: "failed", // Late failure should not overwrite delivered
                        timestamp: "1730000020",
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
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("Scenario 9: Handles KVtMedia flat status payload and arrays", async () => {
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

      // Top-level flat object
      const res = await request(app)
        .post("/webhooks/kv-meta")
        .send({
          id: "wamid.FLAT_TEST_001",
          status: "delivered",
          timestamp: 1730000030,
          recipient_id: "919876543210",
        });

      expect(res.status).toBe(200);
      expect(updateSpy).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryStatus: "delivered",
        }),
      );
    });

    it("Scenario 10: Persists error message on failed delivery status receipt", async () => {
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
                        id: "wamid.TEST_MSG_FAIL",
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

  describe("Admin Simulation Endpoint (/auth/admin/communicate/simulate-receipt)", () => {
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

    it("prevents simulate-receipt from regressing 'read' to 'delivered'", async () => {
      const app = createTestApp();

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: 42, metaMessageId: "wamid.TEST_SIM", deliveryStatus: "read" },
            ]),
          }),
        }),
      } as any);

      const updateSpy = vi.spyOn(db, "update");

      const res = await request(app)
        .post("/auth/admin/communicate/simulate-receipt")
        .send({
          commLogId: 42,
          status: "delivered",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.updated).toBe(false);
      expect(updateSpy).not.toHaveBeenCalled();
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
