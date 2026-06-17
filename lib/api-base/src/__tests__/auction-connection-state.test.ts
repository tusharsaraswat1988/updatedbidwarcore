import { describe, expect, it } from "vitest";
import {
  DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS,
  isAuctionActivityEventType,
  recordAuctionActivity,
  resolveAuctionFeedState,
} from "../auction-connection-state.ts";

describe("resolveAuctionFeedState", () => {
  const now = 1_000_000;
  const recent = now - 5_000;

  it("returns disconnected when socket is disconnected", () => {
    expect(
      resolveAuctionFeedState({
        connectionStatus: "disconnected",
        lastActivityAt: recent,
        now,
      }).state,
    ).toBe("disconnected");
  });

  it("returns reconnecting when socket is reconnecting", () => {
    expect(
      resolveAuctionFeedState({
        connectionStatus: "reconnecting",
        lastActivityAt: recent,
        now,
      }).state,
    ).toBe("reconnecting");
  });

  it("returns live when connected and activity is recent", () => {
    expect(
      resolveAuctionFeedState({
        connectionStatus: "connected",
        lastActivityAt: recent,
        now,
      }).state,
    ).toBe("live");
  });

  it("returns awaiting_operator_response when connected but idle past threshold", () => {
    const stale = now - DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS - 1;
    const result = resolveAuctionFeedState({
      connectionStatus: "connected",
      lastActivityAt: stale,
      now,
    });
    expect(result.state).toBe("awaiting_operator_response");
    expect(result.secondsSinceLastActivity).toBeGreaterThanOrEqual(18);
  });

  it("does not treat idle feed as disconnected", () => {
    const stale = now - 60_000;
    expect(
      resolveAuctionFeedState({
        connectionStatus: "connected",
        lastActivityAt: stale,
        now,
      }).state,
    ).not.toBe("disconnected");
  });
});

describe("auction activity tracker", () => {
  it("tracks activity event types", () => {
    expect(isAuctionActivityEventType("bid")).toBe(true);
    expect(isAuctionActivityEventType("auction_state")).toBe(true);
    expect(isAuctionActivityEventType("cheer")).toBe(false);
  });

  it("keeps the newest activity timestamp", () => {
    recordAuctionActivity(99, 100);
    recordAuctionActivity(99, 50);
    expect(resolveAuctionFeedState({
      connectionStatus: "connected",
      lastActivityAt: 100,
      now: 110,
    }).state).toBe("live");
  });
});
