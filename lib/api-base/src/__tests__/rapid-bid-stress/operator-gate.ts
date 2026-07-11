/**
 * Operator `bidGateLocked` control flow mirrored from
 * artifacts/auction-platform/src/pages/auction-operator.tsx handleBid:
 *   set true → BID_ACK_TIMEOUT_MS timeout unlock (+ placeBid.reset)
 *   mutateAsync.finally → clear timer + set false
 *
 * Uses production BID_ACK_TIMEOUT_MS + logBidLifecycle.
 */

import { BID_ACK_TIMEOUT_MS, logBidLifecycle } from "../../auction-bid-sync";
import type { Timeline, UnlockReason } from "./timeline";

type ScheduleFn = (delayMs: number, fn: () => void) => { cancel: () => void };

export class OperatorBidGate {
  locked = false;
  private lockStartedAt: number | null = null;
  private timerCancel: { cancel: () => void } | null = null;
  /** Mirrors placeBid.isPending for timeout reset path. */
  placeBidPending = false;

  constructor(
    private readonly tournamentId: number,
    private readonly timeline: Timeline,
    private readonly clock: () => number,
    private readonly schedule: ScheduleFn,
    private readonly onLockChange: (locked: boolean) => void,
  ) {}

  /** Called at submit start — same as setBidGateLocked(true) + timeout. */
  lock(teamId: number, amount: number): void {
    this.locked = true;
    this.lockStartedAt = this.clock();
    this.placeBidPending = true;
    this.onLockChange(true);
    this.timeline.record({
      t: this.clock(),
      kind: "bidGateLocked",
      teamId,
      value: true,
      detail: "operator_lock",
    });

    this.timerCancel?.cancel();
    this.timerCancel = this.schedule(BID_ACK_TIMEOUT_MS, () => {
      this.unlock(teamId, "timeout", "operator_bid_gate_timeout");
      logBidLifecycle({
        event: "ack_timeout",
        tournamentId: this.tournamentId,
        teamId,
        amount,
        detail: "operator_bid_gate_timeout",
      });
      // Clear a hung React Query mutation so isPending cannot wedge other UI.
      if (this.placeBidPending) {
        this.placeBidPending = false;
      }
    });
  }

  /** finally() path from production handleBid. */
  unlockFromFinally(teamId: number): void {
    this.timerCancel?.cancel();
    this.timerCancel = null;
    this.placeBidPending = false;
    this.unlock(teamId, "finally", "operator_finally");
  }

  private unlock(teamId: number, reason: UnlockReason, detail: string): void {
    if (!this.locked && this.lockStartedAt == null) return;
    this.locked = false;
    this.lockStartedAt = null;
    this.onLockChange(false);
    this.timeline.record({
      t: this.clock(),
      kind: "bidGateLocked",
      teamId,
      value: false,
      unlockReason: reason,
      detail,
    });
    this.timeline.record({
      t: this.clock(),
      kind: "unlock",
      teamId,
      unlockReason: reason,
      detail,
    });
  }

  /** Continuous lock duration for permanent-lock checks. */
  lockedForMs(): number | null {
    if (!this.locked || this.lockStartedAt == null) return null;
    return this.clock() - this.lockStartedAt;
  }
}
