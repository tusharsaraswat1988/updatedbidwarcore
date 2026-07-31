import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("@workspace/api-base/mobile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/api-base/mobile")>();
  return {
    ...actual,
    organizerNeedsPhoneVerification: vi.fn(() => true),
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() =>
            Promise.resolve([
              {
                licenseStatus: "active",
                mobile: "9876543210",
                phoneVerified: false,
              },
            ]),
          ),
        })),
      })),
    })),
  },
  organizersTable: { id: "id" },
}));

import { organizerAccountStatusMiddleware } from "../middleware/organizer-account-status";

function mockReqRes(
  method: string,
  path: string,
  jwtUser?: Record<string, unknown>,
) {
  const req = {
    method,
    path,
    jwtUser,
  } as Request;
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })), json } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, json };
}

describe("organizerAccountStatusMiddleware — tournament session bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks badminton player write when account phone OTP is incomplete and no tournament JWT", async () => {
    const { req, res, next, json } = mockReqRes(
      "POST",
      "/api/tournaments/5/badminton/players",
      { organizerAccountId: 42 },
    );

    await organizerAccountStatusMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PHONE_VERIFICATION_REQUIRED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("allows badminton player write when tournament organizer JWT is present", async () => {
    const { req, res, next } = mockReqRes(
      "POST",
      "/api/tournaments/5/badminton/players",
      { organizerAccountId: 42, organizer: { "5": true } },
    );

    await organizerAccountStatusMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows per-tournament password login while account phone OTP is incomplete", async () => {
    const { req, res, next } = mockReqRes(
      "POST",
      "/api/auth/organizer/5/login",
      { organizerAccountId: 42 },
    );

    await organizerAccountStatusMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
