import { describe, expect, it } from "vitest";
import {
  formatAuctionAmount,
  formatAuctionAmountWords,
  formatLedAuctionAmount,
  formatShortAuctionAmount,
  formatSoldForBroadcast,
  normalizeAuctionUnit,
} from "../auction-unit";

describe("auction-unit", () => {
  it("normalizes auction unit", () => {
    expect(normalizeAuctionUnit("points")).toBe("points");
    expect(normalizeAuctionUnit("rupee")).toBe("rupee");
    expect(normalizeAuctionUnit(undefined)).toBe("rupee");
  });

  it("formats rupee amounts", () => {
    expect(formatAuctionAmount(100000, "rupee")).toBe("₹1,00,000");
    expect(formatShortAuctionAmount(10000000, "rupee")).toBe("₹1.00Cr");
  });

  it("formats points amounts", () => {
    expect(formatAuctionAmount(100000, "points")).toBe("1,00,000 Pt.");
    expect(formatShortAuctionAmount(10000000, "points")).toBe("1.00 Cr Pt.");
  });

  it("formats LED broadcast amounts per unit", () => {
    expect(formatLedAuctionAmount(150000, "rupee")).toBe("₹1.50 L");
    expect(formatLedAuctionAmount(150000, "points")).toBe("1.50 L PT.");
  });

  it("formats sold-for broadcast per unit", () => {
    expect(formatSoldForBroadcast(500000, "rupee")).toBe("SOLD FOR ₹5 LAKH");
    expect(formatSoldForBroadcast(500000, "points")).toBe("SOLD FOR 5 LAKH PT.");
  });

  it("formats amount words with optional Pt suffix", () => {
    expect(formatAuctionAmountWords(11000000, "rupee")).toBe("1 Cr 10 lakh");
    expect(formatAuctionAmountWords(11000000, "points")).toBe("1 Cr 10 lakh Pt.");
  });
});
