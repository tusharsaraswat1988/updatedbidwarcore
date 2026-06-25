import { describe, it, expect } from "vitest";
import {
  normalizeRegistrationCode,
  playerRegistrationPath,
  playerRegistrationPublicUrl,
  isValidRegistrationCodeFormat,
} from "@workspace/api-base/registration-url";

describe("registration-url", () => {
  it("normalizes codes to uppercase", () => {
    expect(normalizeRegistrationCode("cu1234")).toBe("CU1234");
    expect(normalizeRegistrationCode(" cu1234 ")).toBe("CU1234");
  });

  it("builds opaque registration paths without tournament IDs", () => {
    expect(playerRegistrationPath("CU1234")).toBe("/register/CU1234");
    expect(playerRegistrationPublicUrl("https://bidwar.in", "CU1234")).toBe(
      "https://bidwar.in/register/CU1234",
    );
  });
});

describe("registration-code format", () => {
  it("accepts auction-style codes", () => {
    expect(isValidRegistrationCodeFormat("CU421506")).toBe(true);
  });

  it("rejects empty or invalid codes", () => {
    expect(isValidRegistrationCodeFormat("")).toBe(false);
    expect(isValidRegistrationCodeFormat("ab")).toBe(false);
    expect(isValidRegistrationCodeFormat("bad code!")).toBe(false);
  });
});
