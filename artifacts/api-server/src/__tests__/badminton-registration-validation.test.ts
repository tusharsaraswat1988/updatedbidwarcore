import { describe, expect, it } from "vitest";
import {
  validateBadmintonCategoryEntry,
  validateBadmintonRegistrationReinstate,
} from "../lib/badminton-registration-validation";

const baseCategory = {
  matchType: "singles",
  gender: "M",
  maxPlayers: 16,
};

const malePlayer = { id: 1, gender: "M" };
const femalePlayer = { id: 2, gender: "F" };

describe("validateBadmintonCategoryEntry", () => {
  it("requires partner for doubles", () => {
    const result = validateBadmintonCategoryEntry(
      { ...baseCategory, matchType: "doubles", gender: "M" },
      malePlayer,
      null,
      0,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DOUBLES_PARTNER_REQUIRED");
  });

  it("rejects mixed doubles with same gender partners", () => {
    const result = validateBadmintonCategoryEntry(
      { ...baseCategory, matchType: "mixed_doubles", gender: "Mixed" },
      malePlayer,
      { id: 3, gender: "M" },
      0,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MIXED_DOUBLES_GENDER");
  });

  it("accepts valid mixed doubles pair", () => {
    const result = validateBadmintonCategoryEntry(
      { ...baseCategory, matchType: "mixed_doubles", gender: "Mixed" },
      malePlayer,
      femalePlayer,
      0,
    );
    expect(result.ok).toBe(true);
  });

  it("blocks when category is full", () => {
    const result = validateBadmintonCategoryEntry(
      { ...baseCategory, maxPlayers: 2 },
      malePlayer,
      null,
      2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CATEGORY_FULL");
  });
});

describe("validateBadmintonRegistrationReinstate", () => {
  it("blocks reinstate when partner already has another active entry", () => {
    const result = validateBadmintonRegistrationReinstate(
      { matchType: "doubles", gender: "M", maxPlayers: 16 },
      { id: 1, gender: "M" },
      { id: 2, gender: "M" },
      0,
      [1],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DUPLICATE_CATEGORY_ENTRY");
      expect(result.error).toContain("active entry");
    }
  });

  it("allows reinstate when no conflicting entries", () => {
    const result = validateBadmintonRegistrationReinstate(
      { matchType: "mixed_doubles", gender: "Mixed", maxPlayers: 16 },
      { id: 1, gender: "M" },
      { id: 2, gender: "F" },
      0,
      [],
    );
    expect(result.ok).toBe(true);
  });
});
