/**
 * useBroadcastAudio
 *
 * React hook that drives all broadcast audio for the LED display screen.
 * Connects auction state changes to the AuctionAudioManager:
 *  - Countdown ticks at 5, 4, 3, 2, 1 seconds remaining (deduped per second)
 *  - Sold fanfare on status → "sold" transition (deduped per event)
 *  - Resets countdown state when a new player / timer starts
 *
 * Exposes `isUnlocked` so the shell can show a subtle "click to enable audio"
 * nudge when the browser AudioContext hasn't been unlocked yet.
 *
 * Must only be called from DisplayShell. Never mount in operator / owner panels.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AuctionAudioManager, type AudioSettings } from "@/lib/audio-manager";

export function useBroadcastAudio({
  status,
  timerEndsAt,
  soldKey,
  settings,
  displayCountdownType,
  displayCountdownEndsAt,
}: {
  /** Current auction status: "idle" | "active" | "paused" | "sold" | "unsold" */
  status: string | undefined;
  /** ISO timestamp when current timer expires; null/undefined when no timer */
  timerEndsAt: string | null | undefined;
  /** Unique string that changes exactly once per sold event — used for dedup */
  soldKey: string;
  /** Live audio settings from the tournament record */
  settings: AudioSettings | null;
  /** Type of the active display countdown, or null */
  displayCountdownType: "break" | "pre-auction" | null;
  /** ISO timestamp when the active display countdown ends, or null */
  displayCountdownEndsAt: string | null;
}) {
  const managerRef = useRef<AuctionAudioManager | null>(null);
  const prevStatusRef = useRef<string | undefined>(undefined);
  const prevTimerEndsAtRef = useRef<string | null | undefined>(undefined);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // ── Create manager once ────────────────────────────────────────────────
  useEffect(() => {
    const mgr = new AuctionAudioManager();
    managerRef.current = mgr;

    // Try passive unlock; won't succeed until a user gesture fires
    mgr.unlock().then(() => setIsUnlocked(mgr.isUnlocked)).catch(() => {});

    // Unlock (or confirm unlocked) on any user interaction with the display
    const tryUnlock = () => {
      mgr.unlock().then(() => setIsUnlocked(mgr.isUnlocked)).catch(() => {});
    };
    document.addEventListener("click", tryUnlock);
    document.addEventListener("keydown", tryUnlock);
    document.addEventListener("pointerdown", tryUnlock);

    return () => {
      document.removeEventListener("click", tryUnlock);
      document.removeEventListener("keydown", tryUnlock);
      document.removeEventListener("pointerdown", tryUnlock);
      mgr.dispose();
    };
  }, []);

  // ── Apply settings changes (preloads custom URL audio) ────────────────
  useEffect(() => {
    const mgr = managerRef.current;
    if (!mgr || !settings) return;
    mgr.setSettings(settings);
    // Re-attempt unlock in case context was created before settings arrived
    mgr.unlock().then(() => setIsUnlocked(mgr.isUnlocked)).catch(() => {});
  }, [settings]);

  // ── Sold sound — fires once per unique soldKey ────────────────────────
  useEffect(() => {
    if (status === "sold" && prevStatusRef.current !== "sold") {
      managerRef.current?.playSold(soldKey);
    }
    prevStatusRef.current = status;
  }, [status, soldKey]);

  // ── Reset countdown dedup when a new timer starts ─────────────────────
  useEffect(() => {
    if (timerEndsAt !== prevTimerEndsAtRef.current) {
      managerRef.current?.resetCountdownState();
      prevTimerEndsAtRef.current = timerEndsAt;
    }
  }, [timerEndsAt]);

  // ── Countdown tick poll (100 ms — accurate to well within 1 second) ───
  useEffect(() => {
    if (status !== "active" || !timerEndsAt) return;

    const id = setInterval(() => {
      const msLeft = new Date(timerEndsAt).getTime() - Date.now();
      const secsLeft = Math.ceil(msLeft / 1000);
      if (secsLeft >= 1 && secsLeft <= 5) {
        managerRef.current?.playCountdownTick(secsLeft);
      }
    }, 100);

    return () => clearInterval(id);
  }, [status, timerEndsAt]);

  // ── Break-end sound — fires once when a break countdown expires ───────
  useEffect(() => {
    if (displayCountdownType !== "break" || !displayCountdownEndsAt) return;
    const msUntilExpiry = new Date(displayCountdownEndsAt).getTime() - Date.now();
    if (msUntilExpiry <= 0) return; // already expired — don't fire retroactively
    const id = setTimeout(() => {
      managerRef.current?.playBreakEnd(displayCountdownEndsAt);
    }, msUntilExpiry);
    return () => clearTimeout(id);
  }, [displayCountdownType, displayCountdownEndsAt]);

  // ── Expose manager for preview (tournament settings UI) ───────────────
  const getManager = useCallback(() => managerRef.current, []);

  return { isUnlocked, getManager };
}
