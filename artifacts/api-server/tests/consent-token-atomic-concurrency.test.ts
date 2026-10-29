import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter from "../src/routes/comm";
import { db } from "@workspace/db";
import {
  consentTokensTable,
  commLogsTable,
  waConsentEventsTable,
  playersTable,
} from "@workspace/db";
import * as consentService from "../src/lib/communication/consent-service";
import { CURRENT_CONSENT_NOTICE_VERSION } from "@workspace/api-base";
import { ConversationRouter } from "../src/lib/communication/conversation-router";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    (req as any).cookies = { bidwar_auth: "mock_token" };
    (req as any).jwtUser = {
      isAdmin: false,
      role: "player",
      organizerAccountId: null,
    };
    next();
  });
  app.use(commRouter);
  return app;
}

describe("P2: Atomic Consent Token Concurrency & Idempotency", () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Concurrent Confirmation Requests
  // ───────────────────────────────────────────────────────────────────────────
  it("processes concurrent confirmations atomically: exactly one consumes token and calls recordConsentGranted", async () => {
    const token = "atomic_concurrent_test_token_123";
    const tokenRecord = {
      id: 88,
      token,
      recipientType: "player",
      recipientId: 42,
      mobile: "919876543210",
      tournamentId: 101,
      used: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h future
      createdAt: new Date(),
    };

    let tokenState = { ...tokenRecord };
    let recordConsentGrantedCalls = 0;
    const consentGrantedSpy = vi.spyOn(consentService, "recordConsentGranted").mockImplementation(async (opts) => {
      recordConsentGrantedCalls++;
      return { success: true, eventId: 999 };
    });

    // Mock transaction to simulate atomic database row-lock behavior
    vi.spyOn(db, "transaction").mockImplementation(async (callback: any) => {
      const mockTx = {
        update: (table: any) => ({
          set: (setData: any) => ({
            where: (whereClause: any) => ({
              returning: async () => {
                // Atomic condition: only update if used is false
                if (!tokenState.used) {
                  tokenState.used = true;
                  return [{ ...tokenState }];
                }
                return []; // Already used by winner
              },
            }),
          }),
        }),
        select: () => ({
          from: (table: any) => ({
            where: () => ({
              limit: async () => [tokenState],
            }),
          }),
        }),
        insert: () => ({
          values: async () => [],
        }),
      };
      return await callback(mockTx);
    });

    // Execute two concurrent requests simultaneously
    const [res1, res2] = await Promise.all([
      request(app).post(`/consent/${token}/confirm`).send({}),
      request(app).post(`/consent/${token}/confirm`).send({}),
    ]);

    // One request must succeed with { success: true }
    // The other must receive the idempotent { success: true, alreadyConfirmed: true }
    const statuses = [res1.status, res2.status];
    expect(statuses).toEqual([200, 200]);

    const bodies = [res1.body, res2.body];
    const initialConfirm = bodies.find((b) => b.success === true && !b.alreadyConfirmed);
    const idempotentReplay = bodies.find((b) => b.success === true && b.alreadyConfirmed === true);

    expect(initialConfirm).toBeDefined();
    expect(idempotentReplay).toBeDefined();

    // CRITICAL: recordConsentGranted must be called EXACTLY ONCE
    expect(recordConsentGrantedCalls).toBe(1);
    expect(consentGrantedSpy).toHaveBeenCalledTimes(1);
    expect(consentGrantedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientType: "player",
        recipientId: 42,
        mobile: "919876543210",
        tournamentId: 101,
        noticeVersion: CURRENT_CONSENT_NOTICE_VERSION,
        source: "consent_link",
        tokenUsed: token,
      }),
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Replayed Token (Idempotent Subsequent Confirmation)
  // ───────────────────────────────────────────────────────────────────────────
  it("replaying an already confirmed token returns success with alreadyConfirmed: true without re-granting consent", async () => {
    const token = "already_confirmed_token_456";
    const alreadyUsedToken = {
      id: 89,
      token,
      recipientType: "player",
      recipientId: 42,
      mobile: "919876543210",
      tournamentId: 101,
      used: true, // Already consumed
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const consentGrantedSpy = vi.spyOn(consentService, "recordConsentGranted");

    vi.spyOn(db, "transaction").mockImplementation(async (callback: any) => {
      const mockTx = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [], // where used = false matches nothing
            }),
          }),
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [alreadyUsedToken],
            }),
          }),
        }),
        insert: () => ({
          values: async () => [],
        }),
      };
      return await callback(mockTx);
    });

    const res = await request(app).post(`/consent/${token}/confirm`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, alreadyConfirmed: true });
    expect(consentGrantedSpy).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Expired Token Behavior
  // ───────────────────────────────────────────────────────────────────────────
  it("rejects an expired token with 410 and does not grant consent", async () => {
    const token = "expired_token_789";
    const expiredToken = {
      id: 90,
      token,
      recipientType: "player",
      recipientId: 42,
      mobile: "919876543210",
      tournamentId: 101,
      used: false,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
      createdAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
    };

    const consentGrantedSpy = vi.spyOn(consentService, "recordConsentGranted");

    vi.spyOn(db, "transaction").mockImplementation(async (callback: any) => {
      const mockTx = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [expiredToken],
            }),
          }),
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [expiredToken],
            }),
          }),
        }),
        insert: () => ({
          values: async () => [],
        }),
      };
      return await callback(mockTx);
    });

    const res = await request(app).post(`/consent/${token}/confirm`).send({});

    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: "Token expired" });
    expect(consentGrantedSpy).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Nonexistent / Malformed Token Behavior
  // ───────────────────────────────────────────────────────────────────────────
  it("rejects a nonexistent token with 404 and does not grant consent", async () => {
    const token = "nonexistent_token_999";
    const consentGrantedSpy = vi.spyOn(consentService, "recordConsentGranted");

    vi.spyOn(db, "transaction").mockImplementation(async (callback: any) => {
      const mockTx = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [],
            }),
          }),
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [], // Not found
            }),
          }),
        }),
        insert: () => ({
          values: async () => [],
        }),
      };
      return await callback(mockTx);
    });

    const res = await request(app).post(`/consent/${token}/confirm`).send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Token not found" });
    expect(consentGrantedSpy).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Database Failure During Consent Recording (Transaction Rollback)
  // ───────────────────────────────────────────────────────────────────────────
  it("handles failure during recordConsentGranted safely: rolls back and returns 500", async () => {
    const token = "rollback_token_321";
    const validToken = {
      id: 91,
      token,
      recipientType: "player",
      recipientId: 42,
      mobile: "919876543210",
      tournamentId: 101,
      used: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    // Simulate failure during consent recording (e.g. disk full, lock timeout, constraint violation)
    vi.spyOn(consentService, "recordConsentGranted").mockRejectedValue(
      new Error("Postgres write failed during audit append"),
    );

    vi.spyOn(db, "transaction").mockImplementation(async (callback: any) => {
      const mockTx = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [validToken],
            }),
          }),
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [validToken],
            }),
          }),
        }),
        insert: () => ({
          values: async () => [],
        }),
      };
      return await callback(mockTx);
    });

    const res = await request(app).post(`/consent/${token}/confirm`).send({});

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to confirm consent" });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Strict Recipient & Tuple Binding (Payload Tampering Immunity)
  // ───────────────────────────────────────────────────────────────────────────
  it("ignores spoofed body payload and binds strictly to token record in database", async () => {
    const token = "tamper_proof_token_111";
    const genuineToken = {
      id: 92,
      token,
      recipientType: "team_owner",
      recipientId: 10,
      mobile: "919876543210",
      tournamentId: 50,
      used: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const consentGrantedSpy = vi.spyOn(consentService, "recordConsentGranted").mockResolvedValue({
      success: true,
      eventId: 502,
    });

    vi.spyOn(db, "transaction").mockImplementation(async (callback: any) => {
      const mockTx = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [genuineToken],
            }),
          }),
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [genuineToken],
            }),
          }),
        }),
        insert: () => ({
          values: async () => [],
        }),
      };
      return await callback(mockTx);
    });

    // Attacker tries to inject a different mobile or recipient in POST body
    const res = await request(app)
      .post(`/consent/${token}/confirm`)
      .send({
        mobile: "919999999999",
        recipientType: "organizer",
        recipientId: 999,
        tournamentId: 888,
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // Must bind to genuineToken record from DB, NOT the spoofed payload
    expect(consentGrantedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientType: "team_owner",
        recipientId: 10,
        mobile: "919876543210",
        tournamentId: 50,
        tokenUsed: token,
      }),
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. No Regression to Inbound WhatsApp OTP Verification
  // ───────────────────────────────────────────────────────────────────────────
  it("verifies inbound WhatsApp OTP flow remains intact without regression", async () => {
    const router = new ConversationRouter();
    vi.spyOn(router as any, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router as any, "recordProcessedInboundMessage").mockResolvedValue(undefined);
    vi.spyOn(router as any, "resolveIdentity").mockResolvedValue({
      kind: "guest",
      displayName: "Rahul Sharma",
      targets: [],
    });
    vi.spyOn(router as any, "verifyOtp").mockResolvedValue(true);
    const setConsentSpy = vi.spyOn(router, "setConsentGranted").mockResolvedValue(undefined);
    const sendReplySpy = vi.spyOn(router as any, "sendReply").mockResolvedValue({ success: true });

    // Mock active OTP session and pending bot session
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: (table: any) => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [
              {
                id: 701,
                mobile: "919876543210",
                otpHash: "mock_hash",
                payload: JSON.stringify({ attempts: 0 }),
              },
            ],
          }),
          limit: async () => [
            {
              id: 801,
              mobile: "919876543210",
              pendingAction: "pending_otp",
              pendingData: JSON.stringify({
                recipientType: "player",
                recipientId: 42,
                tournamentId: 101,
                name: "Rahul Sharma",
              }),
            },
          ],
        }),
      }),
    })) as any);

    vi.spyOn(db, "update").mockImplementation((() => ({
      set: () => ({
        where: async () => [],
      }),
    })) as any);

    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => [],
    })) as any);

    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: async () => [],
    })) as any);

    const res = await router.processInboundMessage({
      from: "919876543210",
      channel: "whatsapp",
      text: "123456", // 6-digit OTP
    });

    expect(res.handled).toBe(true);
    expect(setConsentSpy).toHaveBeenCalledWith("player", 42, null);
    expect(sendReplySpy).toHaveBeenCalledWith(
      101,
      "whatsapp:+919876543210",
      expect.stringContaining("successfully subscribed hain"),
      "whatsapp",
    );
  });
});
