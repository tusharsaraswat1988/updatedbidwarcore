import { describe, expect, it } from "vitest";

/** Mirrors production Fast2SMS error text for regression coverage. */
function isFast2SmsAlreadyVerified(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("already verified") || msg.includes("not found or already verified");
}

describe("Fast2SMS already-verified recovery guard", () => {
  it("detects the OTP consumed message shown in production", () => {
    expect(isFast2SmsAlreadyVerified("OTP not found or already verified")).toBe(true);
  });

  it("ignores unrelated OTP errors", () => {
    expect(isFast2SmsAlreadyVerified("Invalid OTP")).toBe(false);
  });
});
