import { describe, expect, it } from "vitest";
import {
  calculateAgeFromDob,
  assertClientAgeIgnored,
  parseDateOfBirth,
} from "../age";
import { formatRegistrationId, parseRegistrationId } from "../registration-id";
import { resolveServerPaymentAmount } from "../payment-amount";
import { validateRegistrationPayload } from "../validation";
import {
  canTransitionRegistration,
  canTransitionPayment,
  canInitiatePaymentForRegistration,
} from "../transitions";
import { initialRegistrationStatus, isSrRegistrationStatus } from "../statuses";
import { buildSampleTournamentSeed, buildBplSampleSeed } from "../seed-defaults";

describe("age from DOB", () => {
  it("parses valid YYYY-MM-DD", () => {
    expect(parseDateOfBirth("2000-01-15")?.toISOString()).toBe("2000-01-15T00:00:00.000Z");
  });

  it("rejects invalid dates", () => {
    expect(parseDateOfBirth("2000-02-31")).toBeNull();
    expect(parseDateOfBirth("15-01-2000")).toBeNull();
  });

  it("calculates completed age on birthday boundary", () => {
    const asOf = new Date(Date.UTC(2026, 8, 8)); // 2026-09-08
    expect(calculateAgeFromDob("2000-09-08", asOf)).toEqual({ ok: true, age: 26 });
    expect(calculateAgeFromDob("2000-09-09", asOf)).toEqual({ ok: true, age: 25 });
  });

  it("rejects future DOB", () => {
    const asOf = new Date(Date.UTC(2026, 0, 1));
    expect(calculateAgeFromDob("2026-06-01", asOf).ok).toBe(false);
  });

  it("ignores client-supplied age", () => {
    expect(assertClientAgeIgnored(99, 26)).toEqual({ ok: true, age: 26 });
    expect(assertClientAgeIgnored("1", 26)).toEqual({ ok: true, age: 26 });
  });
});

describe("registration ID", () => {
  it("formats human-readable IDs from DB sequence", () => {
    expect(formatRegistrationId("BPL26", 123)).toEqual({
      ok: true,
      registrationId: "BPL26-000123",
    });
  });

  it("rejects non-positive sequences", () => {
    expect(formatRegistrationId("BPL26", 0).ok).toBe(false);
  });

  it("parses IDs", () => {
    expect(parseRegistrationId("bpl26-000123")).toEqual({
      ok: true,
      prefix: "BPL26",
      sequence: 123,
    });
  });

  it("produces unique IDs for distinct sequences", () => {
    const a = formatRegistrationId("BPL26", 1);
    const b = formatRegistrationId("BPL26", 2);
    expect(a.ok && b.ok && a.registrationId !== b.registrationId).toBe(true);
  });
});

describe("validation", () => {
  const base = {
    playerName: "Rohit Sharma",
    dateOfBirth: "1990-04-30",
    gender: "Male",
    mobile: "9876543210",
    playingRole: "Batsman",
    declarationAccepted: true,
  };

  it("accepts a valid registration and derives age server-side", () => {
    const asOf = new Date(Date.UTC(2026, 8, 8));
    const result = validateRegistrationPayload({ ...base, age: 1 }, { asOf });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.calculatedAge).toBe(36);
      expect(result.data.mobile).toBe("9876543210");
    }
  });

  it("rejects missing required fields", () => {
    const result = validateRegistrationPayload({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.issues.map((i) => i.field);
      expect(fields).toContain("playerName");
      expect(fields).toContain("dateOfBirth");
      expect(fields).toContain("mobile");
      expect(fields).toContain("playingRole");
    }
  });

  it("rejects invalid mobile", () => {
    const result = validateRegistrationPayload({ ...base, mobile: "12345" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = validateRegistrationPayload({ ...base, email: "not-an-email" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid DOB", () => {
    const result = validateRegistrationPayload({ ...base, dateOfBirth: "30-04-1990" });
    expect(result.ok).toBe(false);
  });
});

describe("payment amount is server/config driven", () => {
  it("uses tournament fee and rejects wrong client amount", () => {
    const ok = resolveServerPaymentAmount({ registrationFee: 500, currency: "INR" });
    expect(ok).toEqual({
      ok: true,
      amount: 500,
      currency: "INR",
      source: "tournament_config",
    });

    const rejected = resolveServerPaymentAmount(
      { registrationFee: 500, currency: "INR" },
      1,
    );
    expect(rejected.ok).toBe(false);
  });

  it("ignores matching client amount still sourcing from config", () => {
    const result = resolveServerPaymentAmount(
      { registrationFee: 500, currency: "INR" },
      500,
    );
    expect(result.ok && result.source === "tournament_config").toBe(true);
  });
});

describe("status / state validation", () => {
  it("validates registration status strings", () => {
    expect(isSrRegistrationStatus("PAYMENT_PENDING")).toBe(true);
    expect(isSrRegistrationStatus("pending")).toBe(false);
  });

  it("enforces registration transitions", () => {
    expect(canTransitionRegistration("PAYMENT_PENDING", "PAYMENT_INITIATED")).toBe(true);
    expect(canTransitionRegistration("CONFIRMED", "PAYMENT_PENDING")).toBe(false);
  });

  it("enforces payment transitions and retry path", () => {
    expect(canTransitionPayment("PAYMENT_INITIATED", "FAILED")).toBe(true);
    expect(canTransitionPayment("FAILED", "PENDING")).toBe(true);
    expect(canTransitionPayment("PAID", "PENDING")).toBe(false);
  });

  it("blocks re-charge for paid/confirmed", () => {
    expect(canInitiatePaymentForRegistration("PAID")).toBe(false);
    expect(canInitiatePaymentForRegistration("PAYMENT_FAILED")).toBe(true);
  });

  it("sets initial status from fee", () => {
    expect(initialRegistrationStatus(500)).toBe("PAYMENT_PENDING");
    expect(initialRegistrationStatus(0)).toBe("SUBMITTED");
  });
});

describe("tournament seed isolation / reusability", () => {
  it("builds sample configs for any slug without hard-coding BPL into the engine", () => {
    const alpha = buildSampleTournamentSeed("city-cup");
    const beta = buildSampleTournamentSeed("state-open");
    expect(alpha.slug).toBe("city-cup");
    expect(beta.slug).toBe("state-open");
    expect(alpha.slug).not.toBe(beta.slug);
    expect(alpha.registrationIdPrefix).not.toBe(beta.registrationIdPrefix);
  });

  it("offers an optional BPL sample for development", () => {
    const bpl = buildBplSampleSeed();
    expect(bpl.slug).toBe("bpl");
    expect(bpl.registrationIdPrefix.startsWith("BPL")).toBe(true);
  });
});
