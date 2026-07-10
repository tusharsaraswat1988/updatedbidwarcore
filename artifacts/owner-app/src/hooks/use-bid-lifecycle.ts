import { useCallback, useEffect, useRef, useState } from "react";
import {
  BID_ACK_TIMEOUT_MS,
  BID_WATCHDOG_MS,
  isBidUiBusy,
  logBidLifecycle,
  reduceBidUiPhase,
  type BidUiPhase,
} from "@workspace/api-base/auction-bid-sync";

export type BidSubmitResult = "success" | "leading" | "error";

type UseBidLifecycleOptions = {
  tournamentId: number;
  teamId: number;
  /** Debounce window between accepted taps (ms). */
  debounceMs?: number;
  /** Feedback display duration before returning to idle. */
  feedbackMs?: number;
};

/**
 * Never-stuck bid button controller.
 *
 * Guarantees:
 * - Only one in-flight submit at a time
 * - ACK timeout unlocks the button even if the network hangs
 * - Watchdog force-idles if somehow still busy past BID_WATCHDOG_MS
 * - Request IDs ignore late responses from superseded attempts
 */
export function useBidLifecycle({
  tournamentId,
  teamId,
  debounceMs = 600,
  feedbackMs = 1600,
}: UseBidLifecycleOptions) {
  const [phase, setPhase] = useState<BidUiPhase>("idle");
  const requestIdRef = useRef(0);
  const lastTapRef = useRef(0);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitStartedAtRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
      ackTimerRef.current = null;
    }
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Hard watchdog — last resort if submitting somehow never settles.
  useEffect(() => {
    if (phase !== "submitting") return undefined;
    const watchdog = setTimeout(() => {
      logBidLifecycle({
        event: "watchdog_force_idle",
        tournamentId,
        teamId,
        requestId: requestIdRef.current,
        phase,
        elapsedMs: Date.now() - submitStartedAtRef.current,
      });
      setPhase((p) => reduceBidUiPhase(p, { type: "watchdog" }));
    }, BID_WATCHDOG_MS);
    return () => clearTimeout(watchdog);
  }, [phase, tournamentId, teamId]);

  const scheduleIdle = useCallback(
    (requestId: number) => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        if (requestIdRef.current !== requestId) return;
        setPhase((p) => reduceBidUiPhase(p, { type: "clear_feedback" }));
        logBidLifecycle({
          event: "phase_idle",
          tournamentId,
          teamId,
          requestId,
        });
      }, feedbackMs);
    },
    [feedbackMs, tournamentId, teamId],
  );

  const runBid = useCallback(
    async (
      amount: number,
      submit: (amount: number) => Promise<BidSubmitResult>,
      canSubmit: boolean,
    ): Promise<BidSubmitResult | "blocked"> => {
      const now = Date.now();
      if (!canSubmit || isBidUiBusy(phase)) {
        logBidLifecycle({
          event: "tap_blocked",
          tournamentId,
          teamId,
          amount,
          phase,
          detail: !canSubmit ? "can_submit_false" : "already_busy",
        });
        return "blocked";
      }
      if (now - lastTapRef.current < debounceMs) {
        logBidLifecycle({
          event: "tap_blocked",
          tournamentId,
          teamId,
          amount,
          phase,
          detail: "debounce",
        });
        return "blocked";
      }
      lastTapRef.current = now;

      const requestId = ++requestIdRef.current;
      submitStartedAtRef.current = now;
      clearTimers();
      setPhase((p) => reduceBidUiPhase(p, { type: "submit" }));
      logBidLifecycle({
        event: "submit_start",
        tournamentId,
        teamId,
        amount,
        requestId,
        phase: "submitting",
      });

      ackTimerRef.current = setTimeout(() => {
        if (requestIdRef.current !== requestId) return;
        logBidLifecycle({
          event: "ack_timeout",
          tournamentId,
          teamId,
          amount,
          requestId,
          elapsedMs: Date.now() - submitStartedAtRef.current,
        });
        setPhase((p) => reduceBidUiPhase(p, { type: "timeout" }));
        scheduleIdle(requestId);
      }, BID_ACK_TIMEOUT_MS);

      try {
        const result = await Promise.race([
          submit(amount),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("bid_ack_timeout")), BID_ACK_TIMEOUT_MS);
          }),
        ]);

        if (requestIdRef.current !== requestId) return result;

        if (ackTimerRef.current) {
          clearTimeout(ackTimerRef.current);
          ackTimerRef.current = null;
        }

        const elapsedMs = Date.now() - submitStartedAtRef.current;
        if (result === "success") {
          setPhase((p) => reduceBidUiPhase(p, { type: "success" }));
          logBidLifecycle({
            event: "submit_success",
            tournamentId,
            teamId,
            amount,
            requestId,
            elapsedMs,
          });
        } else if (result === "leading") {
          setPhase((p) => reduceBidUiPhase(p, { type: "leading" }));
          logBidLifecycle({
            event: "submit_leading",
            tournamentId,
            teamId,
            amount,
            requestId,
            elapsedMs,
          });
        } else {
          setPhase((p) => reduceBidUiPhase(p, { type: "error" }));
          logBidLifecycle({
            event: "submit_error",
            tournamentId,
            teamId,
            amount,
            requestId,
            elapsedMs,
          });
        }
        scheduleIdle(requestId);
        return result;
      } catch (err) {
        if (requestIdRef.current !== requestId) return "error";

        if (ackTimerRef.current) {
          clearTimeout(ackTimerRef.current);
          ackTimerRef.current = null;
        }

        const message = err instanceof Error ? err.message : "unknown";
        const timedOut = message === "bid_ack_timeout";
        setPhase((p) => reduceBidUiPhase(p, timedOut ? { type: "timeout" } : { type: "error" }));
        logBidLifecycle({
          event: timedOut ? "ack_timeout" : "submit_error",
          tournamentId,
          teamId,
          amount,
          requestId,
          elapsedMs: Date.now() - submitStartedAtRef.current,
          error: message,
        });
        scheduleIdle(requestId);
        return "error";
      }
    },
    [phase, debounceMs, clearTimers, scheduleIdle, tournamentId, teamId],
  );

  const bidding = isBidUiBusy(phase);
  const bidFeedback: "success" | "error" | "leading" | null =
    phase === "success" || phase === "error" || phase === "leading" ? phase : null;

  return {
    phase,
    bidding,
    bidFeedback,
    runBid,
    ackTimeoutMs: BID_ACK_TIMEOUT_MS,
  };
}
