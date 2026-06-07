import { useEffect, useRef, useState } from "react";
import {
  outcomeEventKey,
  resolveAuctionDisplayOutcome,
  soldRecordFromOutcome,
  unsoldRecordFromOutcome,
} from "@/lib/auction-display-status";
import { playSoldAudio } from "./sold-audio";
import type { SoldRecord } from "./types";

type AuctionStateLite = {
  status?: string | null;
  lastAction?: string | null;
  outcome?: {
    type?: string | null;
    playerName?: string | null;
    photoUrl?: string | null;
    teamName?: string | null;
    teamColor?: string | null;
    teamLogoUrl?: string | null;
    amount?: number | null;
    isManual?: boolean | null;
  } | null;
  currentPlayer?: { id: number; name: string; photoUrl?: string | null } | null;
  currentBid?: number | null;
  currentBidTeamId?: number | null;
  currentBidTeamName?: string | null;
  currentBidTeamColor?: string | null;
};

export type SoldPhase = "stamp" | "card" | null;
export type UnsoldRecord = {
  playerName: string;
  photoUrl: string | null | undefined;
};

/**
 * SOLD animation state machine.
 *
 * Prefers the authoritative server `outcome` snapshot; falls back to live
 * player/bid fields and lastAction parsing for older servers.
 */
export function useSoldAnimation(state: AuctionStateLite | undefined): {
  soldPhase: SoldPhase;
  soldRecord: SoldRecord | null;
  unsoldPhase: SoldPhase;
  unsoldRecord: UnsoldRecord | null;
} {
  const [soldPhase, setSoldPhase] = useState<SoldPhase>(null);
  const [soldRecord, setSoldRecord] = useState<SoldRecord | null>(null);
  const [unsoldPhase, setUnsoldPhase] = useState<SoldPhase>(null);
  const [unsoldRecord, setUnsoldRecord] = useState<UnsoldRecord | null>(null);
  const lastSoldKeyRef = useRef<string | null>(null);
  const lastUnsoldKeyRef = useRef<string | null>(null);
  const prevPlayerIdRef = useRef<number | null>(null);
  const initialOutcomeSeenRef = useRef(false);
  const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownPlayerRef = useRef<{
    name: string; photoUrl?: string | null;
    bid: number; teamName: string; teamColor: string;
  } | null>(null);
  const lastKnownAnyPlayerRef = useRef<UnsoldRecord | null>(null);

  useEffect(() => {
    if (state?.currentPlayer) {
      lastKnownAnyPlayerRef.current = {
        playerName: state.currentPlayer.name,
        photoUrl: state.currentPlayer.photoUrl,
      };
    }
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

  useEffect(() => {
    const outcome = resolveAuctionDisplayOutcome(state);
    if (!outcome) {
      if (state && !initialOutcomeSeenRef.current) {
        initialOutcomeSeenRef.current = true;
      }
      return undefined;
    }

    const key = outcomeEventKey(outcome);
    if (!key) return undefined;

    if (!initialOutcomeSeenRef.current) {
      initialOutcomeSeenRef.current = true;
      if (outcome.type === "sold") lastSoldKeyRef.current = key;
      else lastUnsoldKeyRef.current = key;
      return undefined;
    }

    if (outcome.type === "sold" && key !== lastSoldKeyRef.current) {
      lastSoldKeyRef.current = key;
      const src: SoldRecord | null = soldRecordFromOutcome(outcome)
        ?? (state?.currentPlayer && state.currentBidTeamId
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
            : null);
      if (src) setSoldRecord(src);
      setSoldPhase("stamp");
      setUnsoldPhase(null);
      setUnsoldRecord(null);
      playSoldAudio();
      if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
      soldTimerRef.current = setTimeout(() => setSoldPhase("card"), 1000);
    }

    if (outcome.type === "unsold" && key !== lastUnsoldKeyRef.current) {
      lastUnsoldKeyRef.current = key;
      const src = unsoldRecordFromOutcome(outcome)
        ?? (state?.currentPlayer
          ? { playerName: state.currentPlayer.name, photoUrl: state.currentPlayer.photoUrl }
          : lastKnownAnyPlayerRef.current);
      if (src) setUnsoldRecord(src);
      setUnsoldPhase("stamp");
      setSoldPhase(null);
      setSoldRecord(null);
      if (unsoldTimerRef.current) clearTimeout(unsoldTimerRef.current);
      unsoldTimerRef.current = setTimeout(() => setUnsoldPhase("card"), 1000);
    }

    return undefined;
  }, [state]);

  useEffect(() => () => {
    if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
    if (unsoldTimerRef.current) clearTimeout(unsoldTimerRef.current);
  }, []);

  useEffect(() => {
    const currentId = state?.currentPlayer?.id ?? null;
    if (currentId && currentId !== prevPlayerIdRef.current) {
      setSoldPhase(null);
      setSoldRecord(null);
      setUnsoldPhase(null);
      setUnsoldRecord(null);
      prevPlayerIdRef.current = currentId;
    } else if (!currentId) {
      prevPlayerIdRef.current = null;
    }
  }, [state?.currentPlayer?.id]);

  return { soldPhase, soldRecord, unsoldPhase, unsoldRecord };
}
