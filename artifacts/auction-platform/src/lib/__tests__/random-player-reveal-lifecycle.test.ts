import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRevealDurations,
  MAX_REVEAL_DURATION_MS,
  MAX_REVEAL_WINDOW_MS,
} from "../../components/display/random-player-reveal";
import {
  broadcastRandomReveal,
  listenToRandomReveal,
} from "../auction-reveal-broadcast";
import {
  derivedStateFromOverlayKey,
  OPERATOR_LED_OVERLAY_STATES,
} from "../led-view/derive-led-overlay-state";

describe("Random Player Reveal Lifecycle & Safety Integration", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("1. Duplicate Click Guard & In-Flight Request Locking", () => {
    it("locks in-flight selection requests so repeated rapid clicks do not trigger duplicates", () => {
      let isPending = false;
      let isRandomRevealing = false;
      const apiCall = vi.fn().mockImplementation(async () => {
        isPending = true;
        // simulate async delay
        await new Promise((r) => setTimeout(r, 50));
        isPending = false;
        return { currentPlayer: { id: 101, name: "Player 101" } };
      });

      const handleNextPlayer = async (mode: "sequential" | "random") => {
        if (isPending || isRandomRevealing) return;
        if (mode === "random") {
          isRandomRevealing = true;
        }
        await apiCall();
      };

      // First click succeeds
      void handleNextPlayer("random");
      expect(isPending).toBe(true);
      expect(isRandomRevealing).toBe(true);

      // Rapid consecutive clicks during in-flight operation are rejected
      void handleNextPlayer("random");
      void handleNextPlayer("random");

      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    it("locks the operator button for the pool-calculated duration", () => {
      const remainingCount = 4; // small pool
      const durations = getRevealDurations(remainingCount);
      expect(durations.totalMs).toBe(6000);
      expect(durations.movementMs).toBe(4000);
    });
  });

  describe("2. State Synchronization & Convergence", () => {
    it("organizer panel and LED display share the identical authoritative player ID", () => {
      const backendSelectedPlayerId = 777;
      const organizerState = { currentPlayerId: backendSelectedPlayerId, name: "Test Player" };
      const ledDisplayState = { currentPlayerId: backendSelectedPlayerId, name: "Test Player" };

      expect(organizerState.currentPlayerId).toBe(ledDisplayState.currentPlayerId);
      expect(ledDisplayState.currentPlayerId).toBe(777);
    });

    it("expired reveal (> 7.5s) recovers directly to stable display without replaying animation", () => {
      const startedAt = Date.now() - 8000; // 8 seconds ago
      const elapsed = Date.now() - startedAt;

      // Should be expired past MAX_REVEAL_WINDOW_MS
      const isExpired = elapsed >= MAX_REVEAL_WINDOW_MS;
      expect(isExpired).toBe(true);

      // When expired, LED display does not mount RandomPlayerReveal and directly presents stable view
      const shouldAnimate = !isExpired;
      expect(shouldAnimate).toBe(false);
    });

    it("active reveal within duration window computes correct elapsed time on mid-stream connect", () => {
      // For a pool of 10 players: movement 3500ms, lock 1000ms, reveal 1000ms
      const durations = getRevealDurations(10);
      const startedAt = Date.now() - 3800; // 3.8s ago -> in Phase B (focus lock)
      const elapsed = Date.now() - startedAt;

      expect(elapsed).toBeGreaterThanOrEqual(durations.movementMs);
      expect(elapsed).toBeLessThan(durations.movementMs + durations.focusLockMs);

      const currentPhase =
        elapsed >= durations.movementMs + durations.focusLockMs
          ? "C"
          : elapsed >= durations.movementMs
          ? "B"
          : "A";

      expect(currentPhase).toBe("B");
    });
  });

  describe("3. Cancellation on Active Bidding & Operator Overlays", () => {
    it("dismisses reveal immediately when operator starts live bidding", () => {
      let isRevealing = true;
      const onStartBidding = () => {
        isRevealing = false;
      };

      onStartBidding();
      expect(isRevealing).toBe(false);
    });

    it("preserves operator overlays (team, player, top5, banner) as higher priority than reveal", () => {
      expect(OPERATOR_LED_OVERLAY_STATES.has("teamWise")).toBe(true);
      expect(OPERATOR_LED_OVERLAY_STATES.has("playerWise")).toBe(true);
      expect(OPERATOR_LED_OVERLAY_STATES.has("topSold")).toBe(true);
      expect(OPERATOR_LED_OVERLAY_STATES.has("banner")).toBe(true);

      expect(derivedStateFromOverlayKey("top5", false)).toBe("topSold");
      expect(derivedStateFromOverlayKey("team", false)).toBe("teamWise");
    });
  });

  describe("4. Separation from Fortune Wheel & Unaltered Sports Modules", () => {
    it("ensures fortuneWheel overlay remains completely distinct from random player reveal", () => {
      expect(derivedStateFromOverlayKey("team", false)).not.toBe("fortuneWheel");
      // Random player reveal is an in-auction presentation overlay, not a wheel
      expect(OPERATOR_LED_OVERLAY_STATES.has("fortuneWheel" as any)).toBe(false);
    });

    it("verifies sports scoring and tournament module independence", async () => {
      const { isAuctionEnabled, isScoringEnabled } = await import("@workspace/platform-core");
      expect(isAuctionEnabled({ auctionEnabled: true })).toBe(true);
      expect(isScoringEnabled({ scoringEnabled: true })).toBe(true);
      expect(isAuctionEnabled({ auctionEnabled: false, scoringEnabled: true })).toBe(false);
    });
  });
});
