import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getIstTodayDateString,
  validateAuctionDate,
  AUCTION_DATE_PAST_ERROR,
} from "../auction-date";

describe("getIstTodayDateString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns IST calendar date", () => {
    // 2026-06-09 22:00 UTC = 2026-06-10 03:30 IST
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T22:00:00.000Z"));
    expect(getIstTodayDateString()).toBe("2026-06-10");
  });
});

describe("validateAuctionDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows empty optional date", () => {
    expect(validateAuctionDate("")).toEqual({ ok: true });
    expect(validateAuctionDate(undefined)).toEqual({ ok: true });
  });

  it("rejects invalid format", () => {
    expect(validateAuctionDate("15 March 2026")).toEqual({
      ok: false,
      error: "Enter a valid auction date.",
    });
  });

  it("rejects past dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00+05:30"));
    expect(validateAuctionDate("2026-06-09")).toEqual({
      ok: false,
      error: AUCTION_DATE_PAST_ERROR,
    });
  });

  it("allows today and future dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00+05:30"));
    expect(validateAuctionDate("2026-06-10")).toEqual({ ok: true });
    expect(validateAuctionDate("2026-12-31")).toEqual({ ok: true });
  });
});
