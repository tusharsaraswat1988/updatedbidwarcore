import { describe, expect, it } from "vitest";
import { formatIndianAmountWords } from "../format";

describe("formatIndianAmountWords", () => {
  it("formats crore and lakh combinations", () => {
    expect(formatIndianAmountWords(11000000)).toBe("1 Cr 10 lakh");
    expect(formatIndianAmountWords("10000000")).toBe("1 Cr");
  });

  it("formats lakh and thousand amounts", () => {
    expect(formatIndianAmountWords(100000)).toBe("1 lakh");
    expect(formatIndianAmountWords(10000)).toBe("10 thousand");
    expect(formatIndianAmountWords(1500)).toBe("1 thousand 500");
  });

  it("returns empty for invalid or zero values", () => {
    expect(formatIndianAmountWords(0)).toBe("");
    expect(formatIndianAmountWords("")).toBe("");
    expect(formatIndianAmountWords("abc")).toBe("");
  });
});
