import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request } from "express";
import {
  LOGIN_CAPTCHA_THRESHOLD,
  LOGIN_COOLDOWN_THRESHOLD,
  buildLoginGuardKey,
  checkLoginAttemptAllowed,
  clearLoginFailures,
  getLoginGuardStatus,
  recordLoginFailure,
  _resetLoginAttemptsForTests,
} from "../lib/login-attempt-guard";
import { _clearCaptchaChallengesForTests } from "../lib/captcha-challenge";

vi.mock("../lib/runtime-env", () => ({
  getSessionSecret: () => "test-session-secret-minimum-32-characters-long",
}));

function mockReq(ip = "203.0.113.10"): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
  } as Request;
}

describe("login-attempt-guard", () => {
  beforeEach(() => {
    _resetLoginAttemptsForTests();
    _clearCaptchaChallengesForTests();
  });

  it("allows normal tier for first failures", () => {
    const req = mockReq();
    const status = getLoginGuardStatus(req, "user@example.com");
    expect(status.tier).toBe("normal");
    expect(status.captchaRequired).toBe(false);
  });

  it("requires captcha after threshold failures", () => {
    const req = mockReq();
    const id = "user@example.com";
    for (let i = 0; i < LOGIN_CAPTCHA_THRESHOLD; i++) {
      recordLoginFailure(req, id);
    }
    const status = getLoginGuardStatus(req, id, { includeCaptcha: true });
    expect(status.tier).toBe("captcha");
    expect(status.captchaRequired).toBe(true);
    expect(status.captcha?.question).toMatch(/What is \d+ \+ \d+\?/);
  });

  it("enforces cooldown after cooldown threshold", async () => {
    const req = mockReq();
    const id = "user@example.com";
    for (let i = 0; i < LOGIN_COOLDOWN_THRESHOLD; i++) {
      recordLoginFailure(req, id);
    }
    const status = getLoginGuardStatus(req, id);
    expect(status.tier).toBe("cooldown");
    expect(status.cooldownRemainingSec).toBeGreaterThan(0);

    const blocked = await checkLoginAttemptAllowed(req, id);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.status).toBe(429);
    }
  });

  it("blocks captcha tier without valid challenge", async () => {
    const req = mockReq();
    const id = "user@example.com";
    for (let i = 0; i < LOGIN_CAPTCHA_THRESHOLD; i++) {
      recordLoginFailure(req, id);
    }
    const blocked = await checkLoginAttemptAllowed(req, id);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.status).toBe(400);
    }
  });

  it("clears failures on successful login path", () => {
    const req = mockReq();
    const id = "user@example.com";
    recordLoginFailure(req, id);
    clearLoginFailures(req, id);
    const status = getLoginGuardStatus(req, id);
    expect(status.failures).toBe(0);
  });

  it("tracks by ip and identifier composite key", () => {
    const req = mockReq("198.51.100.2");
    const key = buildLoginGuardKey(req, "User@Example.com");
    expect(key).toBe("198.51.100.2|user@example.com");
  });
});
