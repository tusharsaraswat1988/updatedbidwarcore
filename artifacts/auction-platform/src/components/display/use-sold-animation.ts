import { useEffect, useRef, useState } from "react";
import { playSoldAudio } from "./sold-audio";
import type { SoldRecord } from "./types";

type AuctionStateLite = {
  currentPlayer?: { id: number; name: string; photoUrl?: string | null } | null;
  currentBid?: number | null;
  currentBidTeamId?: number | null;
  currentBidTeamName?: string | null;
  currentBidTeamColor?: string | null;
  lastAction?: string | null;
};

export type SoldPhase = "stamp" | "card" | null;

/**
 * SOLD animation state machine.
 *
 * Render isolation: lives in DisplayShell (single owner) but only
 * surfaces `soldPhase` + `soldRecord` to a dedicated AnimatedEffectsLayer
 * that draws on top of the main content. The phase transitions are
 * derived from auction state changes — never from timer ticks — so
 * countdown updates do not retrigger the animation.
 */
export function useSoldAnimation(state: AuctionStateLite | undefined): {
  soldPhase: SoldPhase;
  soldRecord: SoldRecord | null;
} {
  const [soldPhase, setSoldPhase] = useState<SoldPhase>(null);
  const [soldRecord, setSoldRecord] = useState<SoldRecord | null>(null);
  const [lastSoldAction, setLastSoldAction] = useState<string | null>(null);
  const prevPlayerIdRef = useRef<number | null>(null);
  const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last known player + bid info so we can show sold card even after
  // the API clears currentPlayer=null in the same update as lastAction="SOLD:..."
  const lastKnownPlayerRef = useRef<{
    name: string; photoUrl?: string | null;
    bid: number; teamName: string; teamColor: string;
  } | null>(null);

  // Keep lastKnownPlayerRef up to date whenever a player is live in auction
  useEffect(() => {
    if (state?.currentPlayer && state.currentBidTeamId) {
      lastKnownPlayerRef.current = {
        name: state.currentPlayer.name,
        photoUrl: state.currentPlayer.photoUrl,
        bid: state.currentBid ?? 0,
        teamName: state.currentBidTeamName ?? "Unknown Team",
        teamColor: state.currentBidTeamColor ?? "#F59E0B",
      };
    }
  }, [state?.currentPlayer?.id, state?.currentBidTeamId, state?.currentBid, state?.currentPlayer, state?.currentBidTeamName, state?.currentBidTeamColor]);

  // Show SOLD stamp (1s) → then sold card (until next player)
  useEffect(() => {
    if (state?.lastAction && state.lastAction.startsWith("SOLD:") && state.lastAction !== lastSoldAction) {
      setLastSoldAction(state.lastAction);
      // After sell the API sets currentPlayer=null in the same payload, so use cached ref
      const src: SoldRecord | null = state.currentPlayer
        ? {
            playerName: state.currentPlayer.name,
            photoUrl: state.currentPlayer.photoUrl,
            amount: state.currentBid || 0,
            teamName: state.currentBidTeamName || "Unknown Team",
            teamColor: state.currentBidTeamColor || "#F59E0B",
          }
        : lastKnownPlayerRef.current
        ? {
            playerName: lastKnownPlayerRef.current.name,
            photoUrl: lastKnownPlayerRef.current.photoUrl,
            amount: lastKnownPlayerRef.current.bid,
            teamName: lastKnownPlayerRef.current.teamName,
            teamColor: lastKnownPlayerRef.current.teamColor,
          }
        : null;
      if (src) setSoldRecord(src);
      setSoldPhase("stamp");
      playSoldAudio();
      if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
      // After 1s, switch stamp → card
      soldTimerRef.current = setTimeout(() => {
        setSoldPhase("card");
      }, 1000);
    }
    return undefined;
  }, [state?.lastAction, lastSoldAction, state?.currentPlayer, state?.currentBid, state?.currentBidTeamName, state?.currentBidTeamColor]);

  // Clear sold card when next player appears
  useEffect(() => {
    const currentId = state?.currentPlayer?.id ?? null;
    if (currentId && currentId !== prevPlayerIdRef.current) {
      setSoldPhase(null);
      setSoldRecord(null);
      prevPlayerIdRef.current = currentId;
    } else if (!currentId) {
      prevPlayerIdRef.current = null;
    }
  }, [state?.currentPlayer?.id]);

  return { soldPhase, soldRecord };
}
