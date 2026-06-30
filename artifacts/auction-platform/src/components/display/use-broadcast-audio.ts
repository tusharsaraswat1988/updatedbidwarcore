/**
 * useBroadcastAudio
 *
 * React hook that drives all broadcast audio for the LED display screen.
 * Connects auction state changes to the AuctionAudioManager:
 *  - Countdown ticks at 5, 4, 3, 2, 1 seconds remaining (deduped per second)
 *  - Sold fanfare on new soldKey after auction state hydrates (deduped per event)
 *  - Break music loops while a break countdown is active (stops on cancel, expiry, or operator mute)
 *  - Resets countdown state when a new player / timer starts
 *
 * Exposes `isUnlocked` so the shell can show a subtle "click to enable audio"
 * nudge when the browser AudioContext hasn't been unlocked yet.
 *
 * Must only be called from DisplayShell. Never mount in operator / owner panels.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { AuctionAudioManager, type AudioSettings } from "@/lib/audio-manager";

/** Display shells pass deriveAuctionDisplayMode().phase ("live"); raw API status is "active". */
function isLiveBiddingStatus(status: string | undefined): boolean {
  return status === "live" || status === "active";
}

function isBreakCountdownActive(
  type: string | undefined,
  endsAt: string | null | undefined,
): boolean {
  if (type !== "break" || !endsAt) return false;
  return new Date(endsAt).getTime() > Date.now();
}

export function useBroadcastAudio({
  status,
  timerEndsAt,
  soldKey,
  settings,
  displayCountdownType,
  displayCountdownEndsAt,
  displayCountdownMusicMuted,
  auctionStateReady,
  isAudioLeader,
}: {
  /** Display phase from deriveAuctionDisplayMode(): "live" | "paused" | "break" | "idle" | "sold" | "unsold" (or raw "active") */
  status: string | undefined;
  /** ISO timestamp when current timer expires; null/undefined when no timer */
  timerEndsAt: string | null | undefined;
  /** Unique string that changes exactly once per sold event — used for dedup */
  soldKey: string;
  /** Live audio settings from the tournament record */
  settings: AudioSettings | null;
  /** displayCountdown.type from auction state */
  displayCountdownType: string | undefined;
  /** ISO timestamp when the active display countdown ends, or null */
  displayCountdownEndsAt: string | null;
  /** Operator muted break music while countdown continues */
  displayCountdownMusicMuted: boolean;
  /** True once auction state has loaded — prevents sold replay on page refresh */
  auctionStateReady: boolean;
  /** Only the elected display tab should emit broadcast audio */
  isAudioLeader: boolean;
}) {
  const managerRef = useRef<AuctionAudioManager | null>(null);
  const prevTimerEndsAtRef = useRef<string | null | undefined>(undefined);
  const soldSoundArmedRef = useRef(false);
  const lastSoldKeyRef = useRef("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const breakActive = isBreakCountdownActive(displayCountdownType, displayCountdownEndsAt);
  const shouldPlayBreakMusic =
    isAudioLeader
    && breakActive
    && !displayCountdownMusicMuted
    && !!settings?.breakEndMusicEnabled;

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

  // ── Sold sound — fires once per new soldKey after state hydrates ───────
  useEffect(() => {
    if (!auctionStateReady) return;

    if (!soldSoundArmedRef.current) {
      soldSoundArmedRef.current = true;
      if (status === "sold" && soldKey) {
        lastSoldKeyRef.current = soldKey;
        if (isAudioLeader) {
          managerRef.current?.ackSoldKey(soldKey);
        }
      }
      return;
    }

    if (status === "sold" && soldKey && soldKey !== lastSoldKeyRef.current) {
      lastSoldKeyRef.current = soldKey;
      if (isAudioLeader) {
        managerRef.current?.playSold(soldKey);
      }
    }
  }, [auctionStateReady, isAudioLeader, status, soldKey]);

  // ── Reset countdown dedup when a new timer starts ─────────────────────
  useEffect(() => {
    if (timerEndsAt !== prevTimerEndsAtRef.current) {
      managerRef.current?.resetCountdownState();
      prevTimerEndsAtRef.current = timerEndsAt;
    }
  }, [timerEndsAt]);

  // ── Countdown tick poll (100 ms — accurate to well within 1 second) ───
  useEffect(() => {
    if (!isAudioLeader || !isLiveBiddingStatus(status) || !timerEndsAt) return;

    const id = setInterval(() => {
      const msLeft = new Date(timerEndsAt).getTime() - Date.now();
      const secsLeft = Math.ceil(msLeft / 1000);
      if (secsLeft >= 1 && secsLeft <= 5) {
        managerRef.current?.playCountdownTick(secsLeft);
      }
    }, 100);

    return () => clearInterval(id);
  }, [isAudioLeader, status, timerEndsAt]);

  // ── Break music — loops while break countdown is active ───────────────
  useEffect(() => {
    const mgr = managerRef.current;
    if (!mgr) return;

    if (shouldPlayBreakMusic) {
      mgr.startBreakMusic();
    } else {
      mgr.stopBreakMusic();
    }

    return () => {
      mgr.stopBreakMusic();
    };
  }, [shouldPlayBreakMusic, settings?.breakEndMusicUrl, settings?.breakEndMusicVolume]);

  // Stop music when break countdown expires (even if state update is delayed)
  useEffect(() => {
    if (!isAudioLeader || !breakActive || !displayCountdownEndsAt) return;
    const msUntilExpiry = new Date(displayCountdownEndsAt).getTime() - Date.now();
    if (msUntilExpiry <= 0) return;
    const id = setTimeout(() => {
      managerRef.current?.stopBreakMusic();
    }, msUntilExpiry);
    return () => clearTimeout(id);
  }, [isAudioLeader, breakActive, displayCountdownEndsAt]);

  const unlockAudio = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    void mgr.unlock().then(() => setIsUnlocked(mgr.isUnlocked));
  }, []);

  // ── Expose manager for preview (tournament settings UI) ───────────────
  const getManager = useCallback(() => managerRef.current, []);

  return { isUnlocked, unlockAudio, getManager };
}
