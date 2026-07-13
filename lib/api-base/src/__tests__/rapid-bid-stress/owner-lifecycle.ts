/**
 * Non-React driver that reuses the production bid UI state machine from
 * `useBidLifecycle` (artifacts/owner-app/src/hooks/use-bid-lifecycle.ts):
 *   reduceBidUiPhase + isBidUiBusy + BID_ACK_TIMEOUT_MS + BID_WATCHDOG_MS + requestId
 *
 * Timers are injected via the harness scheduler for determinism.
 */

import {
  BID_ACK_TIMEOUT_MS,
  BID_WATCHDOG_MS,
  isBidUiBusy,
  logBidLifecycle,
  reduceBidUiPhase,
  type BidUiPhase,
} from "../../auction-bid-sync";
import type { Timeline, UnlockReason } from "./timeline";

export type BidSubmitResult = "success" | "leading" | "error";

type ScheduleFn = (delayMs: number, fn: () => void) => { cancel: () => void };

export class OwnerBidLifecycle {
  phase: BidUiPhase = "idle";
  private requestId = 0;
  private lastTapAt = 0;
  private submitStartedAt = 0;
  private ackCancel: { cancel: () => void } | null = null;
  private watchdogCancel: { cancel: () => void } | null = null;
  private feedbackCancel: { cancel: () => void } | null = null;

  constructor(
    private readonly tournamentId: number,
    private readonly teamId: number,
    private readonly timeline: Timeline,
    private readonly clock: () => number,
    private readonly schedule: ScheduleFn,
    private readonly debounceMs = 0,
    private readonly feedbackMs = 0,
  ) {}

  get bidding(): boolean {
    return isBidUiBusy(this.phase);
  }

  private setPhase(event: Parameters<typeof reduceBidUiPhase>[1], unlockReason?: UnlockReason): void {
    const prev = this.phase;
    this.phase = reduceBidUiPhase(this.phase, event);
    if (prev !== this.phase) {
      this.timeline.record({
        t: this.clock(),
        kind: "owner_phase",
        teamId: this.teamId,
        value: this.phase,
        detail: `${prev}->${this.phase}`,
        unlockReason,
      });
    }
  }

  private clearAck(): void {
    this.ackCancel?.cancel();
    this.ackCancel = null;
  }

  private clearWatchdog(): void {
    this.watchdogCancel?.cancel();
    this.watchdogCancel = null;
  }

  private scheduleIdle(requestId: number): void {
    this.feedbackCancel?.cancel();
    this.feedbackCancel = this.schedule(this.feedbackMs, () => {
      if (this.requestId !== requestId) return;
      this.setPhase({ type: "clear_feedback" });
      logBidLifecycle({
        event: "phase_idle",
        tournamentId: this.tournamentId,
        teamId: this.teamId,
        requestId,
      });
    });
  }

  /**
   * Mirrors useBidLifecycle.runBid — Promise.race vs BID_ACK_TIMEOUT_MS,
   * ack timer, watchdog, requestId ignore for late results.
   */
  async runBid(
    amount: number,
    submit: (amount: number) => Promise<BidSubmitResult>,
    canSubmit: boolean,
  ): Promise<BidSubmitResult | "blocked"> {
    const now = this.clock();
    if (!canSubmit || isBidUiBusy(this.phase)) {
      logBidLifecycle({
        event: "tap_blocked",
        tournamentId: this.tournamentId,
        teamId: this.teamId,
        amount,
        phase: this.phase,
        detail: !canSubmit ? "can_submit_false" : "already_busy",
      });
      this.timeline.record({
        t: now,
        kind: "bid_blocked",
        teamId: this.teamId,
        detail: !canSubmit ? "can_submit_false" : "already_busy",
      });
      return "blocked";
    }
    if (now - this.lastTapAt < this.debounceMs) {
      this.timeline.record({
        t: now,
        kind: "bid_blocked",
        teamId: this.teamId,
        detail: "debounce",
      });
      return "blocked";
    }
    this.lastTapAt = now;

    const requestId = ++this.requestId;
    this.submitStartedAt = now;
    this.clearAck();
    this.clearWatchdog();
    this.feedbackCancel?.cancel();
    this.setPhase({ type: "submit" });
    logBidLifecycle({
      event: "submit_start",
      tournamentId: this.tournamentId,
      teamId: this.teamId,
      amount,
      requestId,
      phase: "submitting",
    });

    this.ackCancel = this.schedule(BID_ACK_TIMEOUT_MS, () => {
      if (this.requestId !== requestId) return;
      logBidLifecycle({
        event: "ack_timeout",
        tournamentId: this.tournamentId,
        teamId: this.teamId,
        amount,
        requestId,
        elapsedMs: this.clock() - this.submitStartedAt,
      });
      this.setPhase({ type: "timeout" }, "timeout");
      this.timeline.record({
        t: this.clock(),
        kind: "unlock",
        teamId: this.teamId,
        unlockReason: "timeout",
        detail: "owner_ack_timeout",
      });
      this.scheduleIdle(requestId);
    });

    this.watchdogCancel = this.schedule(BID_WATCHDOG_MS, () => {
      if (!isBidUiBusy(this.phase) && this.phase !== "timed_out") return;
      logBidLifecycle({
        event: "watchdog_force_idle",
        tournamentId: this.tournamentId,
        teamId: this.teamId,
        requestId,
        phase: this.phase,
        elapsedMs: this.clock() - this.submitStartedAt,
      });
      this.setPhase({ type: "watchdog" }, "watchdog");
      this.timeline.record({
        t: this.clock(),
        kind: "unlock",
        teamId: this.teamId,
        unlockReason: "watchdog",
        detail: "owner_watchdog",
      });
    });

    let raceTimeoutCancel: { cancel: () => void } | null = null;
    try {
      const result = await Promise.race([
        submit(amount),
        new Promise<never>((_, reject) => {
          raceTimeoutCancel = this.schedule(BID_ACK_TIMEOUT_MS, () =>
            reject(new Error("bid_ack_timeout")),
          );
        }),
      ]);

      raceTimeoutCancel?.cancel();
      if (this.requestId !== requestId) return result;
      this.clearAck();
      this.clearWatchdog();

      const elapsedMs = this.clock() - this.submitStartedAt;
      if (result === "success") {
        this.setPhase({ type: "success" }, "success");
        logBidLifecycle({
          event: "submit_success",
          tournamentId: this.tournamentId,
          teamId: this.teamId,
          amount,
          requestId,
          elapsedMs,
        });
        this.timeline.record({
          t: this.clock(),
          kind: "unlock",
          teamId: this.teamId,
          unlockReason: "success",
          detail: "owner_success",
        });
      } else if (result === "leading") {
        this.setPhase({ type: "leading" }, "success");
        logBidLifecycle({
          event: "submit_leading",
          tournamentId: this.tournamentId,
          teamId: this.teamId,
          amount,
          requestId,
          elapsedMs,
        });
      } else {
        this.setPhase({ type: "error" }, "finally");
        logBidLifecycle({
          event: "submit_error",
          tournamentId: this.tournamentId,
          teamId: this.teamId,
          amount,
          requestId,
          elapsedMs,
        });
      }
      this.scheduleIdle(requestId);
      return result;
    } catch (err) {
      raceTimeoutCancel?.cancel();
      if (this.requestId !== requestId) return "error";
      this.clearAck();
      this.clearWatchdog();
      const message = err instanceof Error ? err.message : "unknown";
      const timedOut = message === "bid_ack_timeout";
      this.setPhase(timedOut ? { type: "timeout" } : { type: "error" }, timedOut ? "timeout" : "finally");
      logBidLifecycle({
        event: timedOut ? "ack_timeout" : "submit_error",
        tournamentId: this.tournamentId,
        teamId: this.teamId,
        amount,
        requestId,
        elapsedMs: this.clock() - this.submitStartedAt,
        error: message,
      });
      this.timeline.record({
        t: this.clock(),
        kind: "unlock",
        teamId: this.teamId,
        unlockReason: timedOut ? "timeout" : "finally",
        detail: timedOut ? "owner_ack_timeout_race" : "owner_error",
      });
      this.scheduleIdle(requestId);
      return "error";
    }
  }
}
