/**
 * Client auction cache that exercises the same production decision path as
 * `applyMutationAuctionState` / SSE bid apply in owner-app + auction-platform:
 *   decideBidMutationApply → mergeBidFields / reject_stale
 *   shouldApplyBidDelta → mergeBidFields (SSE)
 *
 * Mocked: QueryClient / transport. Real: monotonic gate + merge primitives.
 */

import {
  decideBidMutationApply,
  logBidLifecycle,
  mergeBidFields,
  nextMonotonicVersion,
  shouldApplyBidDelta,
  type BidMutationPayload,
} from "../../auction-bid-sync";
import type { Timeline } from "./timeline";

export type AuctionSnapshot = {
  status: "active";
  currentPlayer: { id: number; name: string };
  currentBid: number;
  currentBidTeamId: number | null;
  currentBidTeamName: string | null;
  bidIncrement: number;
  timerEndsAt: string;
  eventVersion: number;
};

export class ClientAuctionCache {
  private state: AuctionSnapshot;
  private cursor = 0;

  constructor(
    initial: AuctionSnapshot,
    private readonly tournamentId: number,
    private readonly timeline: Timeline,
    private readonly clock: () => number,
    /** When false, stale HTTP ACKs are applied (pre-fix VNBL hang mode). */
    private readonly useMonotonicGate = true,
  ) {
    this.state = { ...initial };
  }

  get snapshot(): AuctionSnapshot {
    return this.state;
  }

  get cachedVersion(): number {
    return this.cursor;
  }

  isLeading(teamId: number): boolean {
    return this.state.currentBidTeamId === teamId;
  }

  canBid(teamId: number, opts: { bidGateLocked: boolean; ownerBusy: boolean }): boolean {
    const { status, currentPlayer, timerEndsAt, currentBidTeamId } = this.state;
    const timerActive = !!timerEndsAt && Date.parse(timerEndsAt) > this.clock();
    const leading = currentBidTeamId === teamId;
    return (
      status === "active" &&
      !!currentPlayer &&
      timerActive &&
      !leading &&
      !opts.bidGateLocked &&
      !opts.ownerBusy
    );
  }

  /** Production HTTP ACK path (applyMutationAuctionState). */
  applyHttpAck(result: BidMutationPayload, teamId: number): "merged" | "replaced" | "rejected_stale" {
    // Pre-fix VNBL mode: blind overwrite (no monotonic gate, no amount gate).
    if (!this.useMonotonicGate) {
      const version = result.eventVersion;
      this.state = mergeBidFields(this.state, result, version) as AuctionSnapshot;
      if (version != null && version > 0) {
        // Intentionally allow cursor regression — the historical stuck-button bug.
        this.cursor = version;
      }
      return "merged";
    }

    const decision = decideBidMutationApply(this.cursor, result);

    if (decision.action === "reject_stale") {
      logBidLifecycle({
        event: "stale_mutation_rejected",
        tournamentId: this.tournamentId,
        teamId,
        eventVersion: result.eventVersion,
        cachedVersion: this.cursor,
        detail: decision.reason,
      });
      this.timeline.record({
        t: this.clock(),
        kind: "stale_http_rejected",
        teamId,
        eventVersion: result.eventVersion,
        detail: decision.reason,
      });
      return "rejected_stale";
    }

    if (decision.action === "merge_bid_ack") {
      if (!shouldApplyBidDelta(this.state, result)) {
        if (result.eventVersion != null && result.eventVersion > 0) {
          this.cursor = nextMonotonicVersion(this.cursor, result.eventVersion);
        }
        this.timeline.record({
          t: this.clock(),
          kind: "stale_http_rejected",
          teamId,
          eventVersion: result.eventVersion,
          detail: "bid_amount_regression",
        });
        return "rejected_stale";
      }
      const version = result.eventVersion;
      this.state = mergeBidFields(this.state, result, version) as AuctionSnapshot;
      if (version != null && version > 0) {
        this.cursor = nextMonotonicVersion(this.cursor, version);
      }
      logBidLifecycle({
        event: "bid_ack_merged",
        tournamentId: this.tournamentId,
        teamId,
        eventVersion: version,
        cachedVersion: this.cursor,
        amount: typeof result.currentBid === "number" ? result.currentBid : undefined,
      });
      return "merged";
    }

    const version = result.eventVersion;
    this.state = {
      ...this.state,
      ...result,
      eventVersion: version ?? this.state.eventVersion,
    } as AuctionSnapshot;
    if (version != null && version > 0) {
      this.cursor = nextMonotonicVersion(this.cursor, version);
    }
    return "replaced";
  }

  /** Production SSE bid delta path (applyAuctionSseMessage type=bid). */
  applySseBid(msg: {
    version: number;
    currentBid: number;
    currentBidTeamId: number;
    currentBidTeamName: string;
    timerEndsAt: string;
  }): boolean {
    if (msg.version <= this.cursor) return false;
    if (!shouldApplyBidDelta(this.state, msg)) return false;
    this.cursor = msg.version;
    this.state = mergeBidFields(this.state, msg, msg.version) as AuctionSnapshot;
    this.timeline.record({
      t: this.clock(),
      kind: "sse_bid",
      teamId: msg.currentBidTeamId,
      eventVersion: msg.version,
      value: msg.currentBid,
      detail: "sse_applied",
    });
    return true;
  }
}
