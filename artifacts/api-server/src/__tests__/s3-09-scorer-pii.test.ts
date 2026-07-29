import { describe, it, expect, beforeEach } from "vitest";
import {
  publicBadmintonPlayerSerializer,
  serializeBadmintonPlayerForAudience,
} from "../lib/serializers/badminton-player";
import {
  SCORER_LOGIN_MAX_FAILURES,
  isScorerLoginRateLimited,
  recordScorerLoginFailure,
  resetScorerLoginRateLimitForTests,
  clearScorerLoginFailures,
} from "../lib/scorer-login-rate-limit";

describe("publicBadmintonPlayerSerializer", () => {
  const sample = {
    id: 1,
    tournamentId: 9,
    firstName: "Asha",
    lastName: "Rao",
    mobile: "919876543210",
    email: "asha@example.com",
    photoUrl: "https://cdn.example/p.jpg",
    status: "active",
    franchiseName: "Raptors",
  };

  it("omits mobile and email", () => {
    const pub = publicBadmintonPlayerSerializer(sample);
    expect(pub).not.toHaveProperty("mobile");
    expect(pub).not.toHaveProperty("email");
    expect(pub.firstName).toBe("Asha");
    expect(pub.franchiseName).toBe("Raptors");
  });

  it("keeps contact fields for organizers", () => {
    const priv = serializeBadmintonPlayerForAudience(sample, true);
    expect(priv).toHaveProperty("mobile", "919876543210");
    expect(priv).toHaveProperty("email", "asha@example.com");
  });

  it("strips contact fields for public audience", () => {
    const pub = serializeBadmintonPlayerForAudience(sample, false);
    expect(pub).not.toHaveProperty("mobile");
    expect(pub).not.toHaveProperty("email");
  });
});

describe("scorer login rate limit", () => {
  beforeEach(() => {
    resetScorerLoginRateLimitForTests();
  });

  it(`locks out after ${SCORER_LOGIN_MAX_FAILURES} failures for a mobile`, () => {
    const mobile = "919999999999";
    const ip = "203.0.113.50";
    for (let i = 0; i < SCORER_LOGIN_MAX_FAILURES; i++) {
      expect(isScorerLoginRateLimited(mobile, ip)).toBe(false);
      recordScorerLoginFailure(mobile, ip);
    }
    expect(isScorerLoginRateLimited(mobile, ip)).toBe(true);
    // Same mobile from another IP is also blocked (mobile-keyed).
    expect(isScorerLoginRateLimited(mobile, "198.51.100.1")).toBe(true);
  });

  it("clears the counter after successful login", () => {
    const mobile = "918888888888";
    for (let i = 0; i < SCORER_LOGIN_MAX_FAILURES; i++) {
      recordScorerLoginFailure(mobile, "10.0.0.1");
    }
    expect(isScorerLoginRateLimited(mobile, "10.0.0.1")).toBe(true);
    clearScorerLoginFailures(mobile, "10.0.0.1");
    expect(isScorerLoginRateLimited(mobile, "10.0.0.1")).toBe(false);
  });
});
