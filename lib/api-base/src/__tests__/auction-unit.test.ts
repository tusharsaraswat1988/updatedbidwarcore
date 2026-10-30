import { describe, expect, it } from "vitest";
import {
  formatAuctionAmount,
  formatAuctionAmountWords,
  formatLedAuctionAmount,
  formatPdfSafeAuctionAmount,
  formatShortAuctionAmount,
  formatSoldForBroadcast,
  normalizeAuctionUnit,
  DEFAULT_AUCTION_UNIT,
} from "../auction-unit";

describe("auction-unit", () => {
  it("normalizes auction unit with default as points", () => {
    expect(DEFAULT_AUCTION_UNIT).toBe("points");
    expect(normalizeAuctionUnit("points")).toBe("points");
    expect(normalizeAuctionUnit("rupee")).toBe("rupee");
    expect(normalizeAuctionUnit(undefined)).toBe("points");
    expect(normalizeAuctionUnit(null)).toBe("points");
  });

  it("formats rupee amounts when rupee is specified", () => {
    expect(formatAuctionAmount(100000, "rupee")).toBe("₹1,00,000");
    expect(formatShortAuctionAmount(10000000, "rupee")).toBe("₹1.00Cr");
    expect(formatPdfSafeAuctionAmount(10000000, "rupee")).toBe("Rs. 1,00,00,000");
    expect(formatPdfSafeAuctionAmount(100000, "points")).toBe("1,00,000 Pt.");
  });

  it("formats points amounts by default and when points is specified", () => {
    expect(formatAuctionAmount(100000)).toBe("1,00,000 Pt.");
    expect(formatAuctionAmount(100000, "points")).toBe("1,00,000 Pt.");
    expect(formatShortAuctionAmount(10000000)).toBe("1.00 Cr Pt.");
    expect(formatShortAuctionAmount(10000000, "points")).toBe("1.00 Cr Pt.");
  });

  it("formats LED broadcast amounts per unit", () => {
    expect(formatLedAuctionAmount(150000, "rupee")).toBe("₹1.50 L");
    expect(formatLedAuctionAmount(150000, "points")).toBe("1.50 L PT.");
    expect(formatLedAuctionAmount(150000)).toBe("1.50 L PT.");
  });

  it("formats sold-for broadcast per unit", () => {
    expect(formatSoldForBroadcast(500000, "rupee")).toBe("SOLD FOR ₹5 LAKH");
    expect(formatSoldForBroadcast(500000, "points")).toBe("SOLD FOR 5 LAKH PT.");
    expect(formatSoldForBroadcast(500000)).toBe("SOLD FOR 5 LAKH PT.");
  });

  it("formats amount words with optional Pt suffix", () => {
    expect(formatAuctionAmountWords(11000000, "rupee")).toBe("1 Cr 10 lakh");
    expect(formatAuctionAmountWords(11000000, "points")).toBe("1 Cr 10 lakh Pt.");
    expect(formatAuctionAmountWords(11000000)).toBe("1 Cr 10 lakh Pt.");
  });
});
