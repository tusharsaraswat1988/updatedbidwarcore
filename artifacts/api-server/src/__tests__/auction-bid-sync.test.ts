import { describe, expect, it } from "vitest";
import {
  BID_ACK_TIMEOUT_MS,
  BID_WATCHDOG_MS,
  decideBidMutationApply,
  isBidAckPayload,
  isBidUiBusy,
  mergeBidFields,
  nextMonotonicVersion,
  reduceBidUiPhase,
  shouldAcceptMonotonicVersion,
  shouldApplyBidDelta,
  simulateRapidBidVersionRace,
  type BidUiPhase,
} from "@workspace/api-base/auction-bid-sync";

describe("monotonic event version gate", () => {
  it("accepts equal or newer versions and rejects older ones", () => {
    expect(shouldAcceptMonotonicVersion(10, 10)).toBe(true);
    expect(shouldAcceptMonotonicVersion(10, 11)).toBe(true);
    expect(shouldAcceptMonotonicVersion(10, 9)).toBe(false);
    expect(shouldAcceptMonotonicVersion(0, undefined)).toBe(true);
    expect(nextMonotonicVersion(10, 9)).toBe(10);
    expect(nextMonotonicVersion(10, 12)).toBe(12);
  });
});

describe("shouldApplyBidDelta", () => {
  it("rejects regressing bid amounts", () => {
    expect(
      shouldApplyBidDelta(
        { currentBid: 200_000, timerEndsAt: "2026-07-10T12:00:05.000Z" },
        { currentBid: 100_000, timerEndsAt: "2026-07-10T12:00:10.000Z" },
      ),
    ).toBe(false);
  });

  it("accepts higher bids and timer extensions at same amount", () => {
    expect(
      shouldApplyBidDelta(
        { currentBid: 100_000, timerEndsAt: "2026-07-10T12:00:05.000Z" },
        { currentBid: 125_000, timerEndsAt: "2026-07-10T12:00:10.000Z" },
      ),
    ).toBe(true);
    expect(
      shouldApplyBidDelta(
        { currentBid: 100_000, timerEndsAt: "2026-07-10T12:00:05.000Z" },
        { currentBid: 100_000, timerEndsAt: "2026-07-10T12:00:08.000Z" },
      ),
    ).toBe(true);
  });
});

describe("decideBidMutationApply — root cause of stuck HIGHEST BIDDER", () => {
  it("rejects stale HTTP bid response after newer SSE version (P0 race)", () => {
    const decision = decideBidMutationApply(11, {
      eventVersion: 10,
      currentBid: 100_000,
      currentBidTeamId: 1,
      status: "active",
      currentPlayer: { id: 1 },
    });
    expect(decision).toEqual({
      action: "reject_stale",
      reason: "http_event_version_behind_sse",
    });
  });

  it("merges fast bid ACK without requiring full snapshot", () => {
    expect(isBidAckPayload({ bidAck: true, currentBid: 100_000, eventVersion: 5 })).toBe(true);
    expect(
      decideBidMutationApply(4, {
        bidAck: true,
        eventVersion: 5,
        currentBid: 125_000,
        currentBidTeamId: 2,
      }),
    ).toEqual({ action: "merge_bid_ack" });
  });

  it("replaces full auction snapshots when version is current", () => {
    expect(
      decideBidMutationApply(5, {
        eventVersion: 6,
        status: "active",
        currentPlayer: { id: 9 },
        currentBid: 150_000,
      }),
    ).toEqual({ action: "replace_full" });
  });
});

describe("mergeBidFields", () => {
  it("preserves unrelated auction state while updating bid leader", () => {
    const merged = mergeBidFields(
      {
        status: "active",
        currentPlayer: { id: 42, name: "Player" },
        currentBid: 100_000,
        currentBidTeamId: 1,
        eventVersion: 4,
      },
      {
        bidAck: true,
        currentBid: 125_000,
        currentBidTeamId: 2,
        currentBidTeamName: "Team B",
        timerEndsAt: "2026-07-10T12:00:20.000Z",
        eventVersion: 5,
      },
      5,
    );
    expect(merged.status).toBe("active");
    expect(merged.currentPlayer).toEqual({ id: 42, name: "Player" });
    expect(merged.currentBid).toBe(125_000);
    expect(merged.currentBidTeamId).toBe(2);
    expect(merged.eventVersion).toBe(5);
  });
});

describe("bid UI phase machine — never stuck", () => {
  it("returns to idle after success/error/timeout feedback clear", () => {
    let phase: BidUiPhase = "idle";
    phase = reduceBidUiPhase(phase, { type: "submit" });
    expect(isBidUiBusy(phase)).toBe(true);
    phase = reduceBidUiPhase(phase, { type: "success" });
    phase = reduceBidUiPhase(phase, { type: "clear_feedback" });
    expect(phase).toBe("idle");
    expect(isBidUiBusy(phase)).toBe(false);
  });

  it("timeout unlocks submitting even when ACK never arrives", () => {
    let phase: BidUiPhase = reduceBidUiPhase("idle", { type: "submit" });
    phase = reduceBidUiPhase(phase, { type: "timeout" });
    expect(phase).toBe("timed_out");
    expect(isBidUiBusy(phase)).toBe(false);
    phase = reduceBidUiPhase(phase, { type: "clear_feedback" });
    expect(phase).toBe("idle");
  });

  it("watchdog force-idles a wedged submitting phase", () => {
    let phase: BidUiPhase = "submitting";
    phase = reduceBidUiPhase(phase, { type: "watchdog" });
    expect(phase).toBe("idle");
    expect(BID_WATCHDOG_MS).toBeGreaterThan(BID_ACK_TIMEOUT_MS);
  });

  it("late success after timeout still settles without re-locking", () => {
    let phase: BidUiPhase = reduceBidUiPhase("idle", { type: "submit" });
    phase = reduceBidUiPhase(phase, { type: "timeout" });
    phase = reduceBidUiPhase(phase, { type: "success" });
    expect(phase).toBe("success");
    phase = reduceBidUiPhase(phase, { type: "clear_feedback" });
    expect(phase).toBe("idle");
  });
});

describe("stress: rapid interleaved SSE + HTTP bids", () => {
  it("never applies stale HTTP after newer SSE under burst bidding", () => {
    // Reproduces the production race:
    // A HTTP v10 in flight → B SSE v11 applied → late A HTTP v10 must be rejected.
    const result = simulateRapidBidVersionRace([
      { source: "http", version: 1 },
      { source: "sse", version: 2 },
      { source: "http", version: 3 },
      { source: "sse", version: 4 },
      { source: "sse", version: 5 },
      { source: "http", version: 3 }, // late stale
      { source: "http", version: 4 }, // late stale
      { source: "sse", version: 6 },
      { source: "http", version: 5 }, // late stale
      { source: "http", version: 7 },
      { source: "sse", version: 8 },
      { source: "http", version: 6 }, // late stale
    ]);

    expect(result.rejectedStaleHttp).toBeGreaterThanOrEqual(4);
    expect(result.finalVersion).toBe(8);
  });

  it("survives 200 rapid alternating events without version regression", () => {
    const steps: Array<{ source: "sse" | "http"; version: number }> = [];
    for (let i = 1; i <= 100; i++) {
      steps.push({ source: "sse", version: i });
      // Every 3rd HTTP is intentionally stale (simulates delayed ACK).
      steps.push({
        source: "http",
        version: i % 3 === 0 ? Math.max(1, i - 2) : i,
      });
    }
    const result = simulateRapidBidVersionRace(steps);
    expect(result.finalVersion).toBe(100);
    expect(result.rejectedStaleHttp).toBeGreaterThan(0);

    // Invariant: version never decreases across accepted steps.
    let v = 0;
    for (const step of steps) {
      if (!shouldAcceptMonotonicVersion(v, step.version)) continue;
      const next = nextMonotonicVersion(v, step.version);
      expect(next).toBeGreaterThanOrEqual(v);
      v = next;
    }
    expect(v).toBe(100);
  });

  it("button phase survives 50 rapid submit/timeout cycles without sticking busy", () => {
    let phase: BidUiPhase = "idle";
    for (let i = 0; i < 50; i++) {
      phase = reduceBidUiPhase(phase, { type: "submit" });
      expect(isBidUiBusy(phase)).toBe(true);
      // Alternate success vs timeout (ACK delay / failure).
      if (i % 2 === 0) {
        phase = reduceBidUiPhase(phase, { type: "success" });
      } else {
        phase = reduceBidUiPhase(phase, { type: "timeout" });
        // Late ACK after timeout
        phase = reduceBidUiPhase(phase, { type: "error" });
      }
      phase = reduceBidUiPhase(phase, { type: "clear_feedback" });
      expect(isBidUiBusy(phase)).toBe(false);
      expect(phase).toBe("idle");
    }
  });
});
