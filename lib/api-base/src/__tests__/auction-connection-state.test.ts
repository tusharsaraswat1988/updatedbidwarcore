import { describe, expect, it } from "vitest";
import {
  CONNECTION_BANNER_REMIND_INTERVAL_MS,
  CONNECTION_BANNER_VISIBLE_MS,
  DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS,
  INITIAL_CONNECTION_BANNER_PULSE,
  advanceConnectionBannerPulse,
  isAuctionActivityEventType,
  nextConnectionBannerPulseDelayMs,
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
    expect(result.secondsSinceLastActivity).toBeGreaterThanOrEqual(60);
  });

  it("keeps operator console live while connected even when auction is idle", () => {
    const stale = now - DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS - 1;
    expect(
      resolveAuctionFeedState({
        connectionStatus: "connected",
        lastActivityAt: stale,
        now,
        audience: "operator",
      }).state,
    ).toBe("live");
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

describe("connection banner pulse", () => {
  it("shows briefly then hides until remind interval", () => {
    const start = 1_000_000;
    const first = advanceConnectionBannerPulse(
      "awaiting_operator_response",
      start,
      INITIAL_CONNECTION_BANNER_PULSE,
    );
    expect(first.visible).toBe(true);
    expect(first.pulse.visibleUntil).toBe(start + CONNECTION_BANNER_VISIBLE_MS);

    const mid = advanceConnectionBannerPulse(
      "awaiting_operator_response",
      start + 1_000,
      first.pulse,
    );
    expect(mid.visible).toBe(true);

    const hidden = advanceConnectionBannerPulse(
      "awaiting_operator_response",
      start + CONNECTION_BANNER_VISIBLE_MS + 1,
      first.pulse,
    );
    expect(hidden.visible).toBe(false);

    const remind = advanceConnectionBannerPulse(
      "awaiting_operator_response",
      start + CONNECTION_BANNER_REMIND_INTERVAL_MS + 1,
      hidden.pulse,
    );
    expect(remind.visible).toBe(true);
  });

  it("resets when feed returns live", () => {
    const result = advanceConnectionBannerPulse(
      "live",
      2_000_000,
      { lastShownAt: 1_000_000, visibleUntil: 1_005_000 },
    );
    expect(result.visible).toBe(false);
    expect(result.pulse).toEqual(INITIAL_CONNECTION_BANNER_PULSE);
  });

  it("schedules next tick at visible-until or remind interval", () => {
    const now = 5_000;
    const pulse = { lastShownAt: now, visibleUntil: now + CONNECTION_BANNER_VISIBLE_MS };
    expect(nextConnectionBannerPulseDelayMs("awaiting_operator_response", pulse, now)).toBe(
      CONNECTION_BANNER_VISIBLE_MS,
    );
    expect(
      nextConnectionBannerPulseDelayMs(
        "awaiting_operator_response",
        { lastShownAt: now, visibleUntil: now - 1 },
        now + CONNECTION_BANNER_REMIND_INTERVAL_MS,
      ),
    ).toBe(0);
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
