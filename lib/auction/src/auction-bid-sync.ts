/**
 * Bid lifecycle sync primitives — shared by owner-app and auction-platform.
 *
 * Root-cause class this module prevents:
 *   After rapid cross-team bids, a late HTTP bid response (older eventVersion)
 *   must never overwrite a newer SSE bid delta. Doing so regresses the live
 *   leader and leaves the owner bid button stuck on "HIGHEST BIDDER".
 */

/** Client must unlock the bid button even if the network ACK never arrives. */
export const BID_ACK_TIMEOUT_MS = 8_000;

/** Hard watchdog above ACK timeout — last-resort UI unlock. */
export const BID_WATCHDOG_MS = 10_000;

export type BidUiPhase =
  | "idle"
  | "submitting"
  | "success"
  | "error"
  | "leading"
  | "timed_out";

export type BidAmountSnapshot = {
  currentBid?: number | null;
  timerEndsAt?: string | null;
};

export type BidMutationPayload = BidAmountSnapshot & {
  eventVersion?: number;
  bidAck?: boolean;
  status?: string | null;
  currentPlayer?: unknown;
  currentBidTeamId?: number | null;
  teamPurses?: unknown;
  [key: string]: unknown;
};

export type BidMutationDecision =
  | { action: "reject_stale"; reason: "http_event_version_behind_sse" }
  | { action: "merge_bid_ack" }
  | { action: "replace_full" };

/** Monotonic version gate: never accept an older event than the cache. */
export function shouldAcceptMonotonicVersion(
  cachedVersion: number,
  incomingVersion: number | undefined | null,
): boolean {
  if (incomingVersion == null || incomingVersion <= 0) return true;
  return incomingVersion >= cachedVersion;
}

export function nextMonotonicVersion(
  cachedVersion: number,
  incomingVersion: number | undefined | null,
): number {
  if (incomingVersion == null || incomingVersion <= 0) return cachedVersion;
  return Math.max(cachedVersion, incomingVersion);
}

/**
 * Reject out-of-order bid deltas that would regress the live bid amount.
 * Equal amounts are allowed only when the timer extends forward.
 */
export function shouldApplyBidDelta(
  base: BidAmountSnapshot | undefined,
  incoming: BidAmountSnapshot,
): boolean {
  const incomingBid = incoming.currentBid;
  if (incomingBid == null) return true;

  const existingBid = base?.currentBid;
  if (existingBid == null || typeof existingBid !== "number") return true;

  if (incomingBid > existingBid) return true;

  if (incomingBid === existingBid) {
    const incomingTimer = incoming.timerEndsAt;
    const existingTimer = base?.timerEndsAt;
    if (typeof incomingTimer === "string" && typeof existingTimer === "string") {
      return new Date(incomingTimer).getTime() > new Date(existingTimer).getTime();
    }
    return typeof incomingTimer === "string" && !existingTimer;
  }

  return false;
}

/** True when the HTTP body is a fast bid ACK (not a full auction snapshot). */
export function isBidAckPayload(result: BidMutationPayload): boolean {
  if (result.bidAck === true) return true;
  // Fast-path ACK: has bid fields but no full-state markers.
  if (result.currentBid == null) return false;
  if (result.status != null) return false;
  if ("currentPlayer" in result) return false;
  return true;
}

/**
 * Decide how to apply an HTTP bid/mutation response against the SSE version cursor.
 * Stale responses are rejected so they cannot clobber a newer live leader.
 */
export function decideBidMutationApply(
  cachedVersion: number,
  result: BidMutationPayload,
): BidMutationDecision {
  const version = result.eventVersion;
  if (version != null && version > 0 && version < cachedVersion) {
    return { action: "reject_stale", reason: "http_event_version_behind_sse" };
  }
  if (isBidAckPayload(result)) {
    return { action: "merge_bid_ack" };
  }
  return { action: "replace_full" };
}

/** Merge bid ACK / delta fields into existing auction state without wiping the rest. */
export function mergeBidFields<T extends Record<string, unknown>>(
  prev: T | undefined,
  incoming: BidMutationPayload,
  version?: number,
): T {
  const base = (prev ?? {}) as T;
  const next: Record<string, unknown> = {
    ...base,
    currentBid: incoming.currentBid ?? base.currentBid,
    currentBidTeamId: incoming.currentBidTeamId ?? base.currentBidTeamId,
    currentBidTeamName: incoming.currentBidTeamName ?? base.currentBidTeamName,
    currentBidTeamColor: incoming.currentBidTeamColor ?? base.currentBidTeamColor,
    currentBidTeamLogoUrl: incoming.currentBidTeamLogoUrl ?? base.currentBidTeamLogoUrl,
    timerEndsAt: incoming.timerEndsAt ?? base.timerEndsAt,
    timerType: incoming.timerType ?? base.timerType,
    lastAction: incoming.lastAction ?? base.lastAction,
    bidIncrement: incoming.bidIncrement ?? base.bidIncrement,
  };
  if (version != null) next.eventVersion = version;
  return next as T;
}

export type BidLifecycleEvent =
  | "tap_blocked"
  | "submit_start"
  | "submit_success"
  | "submit_error"
  | "submit_leading"
  | "ack_timeout"
  | "watchdog_force_idle"
  | "phase_idle"
  | "stale_mutation_rejected"
  | "bid_ack_merged"
  | "full_state_replaced";

export type BidLifecycleLog = {
  event: BidLifecycleEvent;
  requestId?: number;
  tournamentId?: number;
  teamId?: number;
  amount?: number;
  phase?: BidUiPhase;
  eventVersion?: number;
  cachedVersion?: number;
  elapsedMs?: number;
  error?: string;
  detail?: string;
};

/** Structured bid-lifecycle logger (safe for browser + node). */
export function logBidLifecycle(entry: BidLifecycleLog): void {
  const payload = {
    scope: "bid-lifecycle",
    ts: new Date().toISOString(),
    ...entry,
  };
  if (entry.event === "ack_timeout" || entry.event === "watchdog_force_idle" || entry.event === "stale_mutation_rejected") {
    console.warn("[bid-lifecycle]", payload);
    return;
  }
  if (typeof console.debug === "function") {
    console.debug("[bid-lifecycle]", payload);
  } else {
    console.log("[bid-lifecycle]", payload);
  }
}

/**
 * Pure reducer for the never-stuck bid button state machine.
 * Used by the React hook and by stress tests.
 */
export function reduceBidUiPhase(
  phase: BidUiPhase,
  event:
    | { type: "submit" }
    | { type: "success" }
    | { type: "error" }
    | { type: "leading" }
    | { type: "timeout" }
    | { type: "watchdog" }
    | { type: "clear_feedback" },
): BidUiPhase {
  switch (event.type) {
    case "submit":
      return phase === "submitting" ? phase : "submitting";
    case "success":
      return phase === "submitting" ? "success" : phase === "timed_out" ? "success" : phase;
    case "error":
      return phase === "submitting" || phase === "timed_out" ? "error" : phase;
    case "leading":
      return phase === "submitting" || phase === "timed_out" ? "leading" : phase;
    case "timeout":
      return phase === "submitting" ? "timed_out" : phase;
    case "watchdog":
      return phase === "submitting" || phase === "timed_out" ? "idle" : phase;
    case "clear_feedback":
      return phase === "success" || phase === "error" || phase === "leading" || phase === "timed_out"
        ? "idle"
        : phase;
    default:
      return phase;
  }
}

/** Busy = button must show spinner / be disabled. */
export function isBidUiBusy(phase: BidUiPhase): boolean {
  return phase === "submitting";
}

/**
 * Simulate interleaved SSE + HTTP under rapid bidding.
 * Returns false if a stale HTTP response would have been applied (the stuck-button bug).
 */
export function simulateRapidBidVersionRace(steps: Array<{ source: "sse" | "http"; version: number }>): {
  finalVersion: number;
  rejectedStaleHttp: number;
  applied: number;
} {
  let version = 0;
  let rejectedStaleHttp = 0;
  let applied = 0;
  for (const step of steps) {
    if (!shouldAcceptMonotonicVersion(version, step.version)) {
      if (step.source === "http") rejectedStaleHttp += 1;
      continue;
    }
    version = nextMonotonicVersion(version, step.version);
    applied += 1;
  }
  return { finalVersion: version, rejectedStaleHttp, applied };
}
