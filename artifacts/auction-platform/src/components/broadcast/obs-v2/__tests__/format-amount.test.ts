import { describe, expect, it } from "vitest";
import { economy, formatAmount, strikeRate } from "../format";

describe("OBS formatAmount", () => {
  it("keeps one decimal place for partial lakhs and drops a trailing zero", () => {
    expect(formatAmount(150_000)).toBe("₹1.5 L");
    expect(formatAmount(140_000)).toBe("₹1.4 L");
    expect(formatAmount(100_000)).toBe("₹1 L");
    expect(formatAmount(200_000)).toBe("₹2 L");
  });

  it("leaves amounts below one lakh, zero, and crore values on their existing paths", () => {
    expect(formatAmount(0)).toBe("₹0");
    expect(formatAmount(1_000)).toBe("₹1,000");
    expect(formatAmount(99_999)).toBe("₹99,999");
    expect(formatAmount(10_000_000)).toBe("₹1.00 Cr");
  });

  it("keeps negative amounts in the locale format instead of rounding them into lakhs", () => {
    expect(formatAmount(-150_000)).toBe("₹-1,50,000");
  });

  it("does not change score formatting", () => {
    expect(strikeRate(40, 20)).toBe("200.0");
    expect(economy(12, "2")).toBe("6.0");
  });
});
