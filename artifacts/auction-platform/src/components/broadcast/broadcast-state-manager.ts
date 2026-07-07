import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuctionState, TeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  deriveAuctionDisplayMode,
  outcomeEventKey,
  soldRecordFromOutcome,
  unsoldRecordFromOutcome,
} from "@/lib/auction-display-status";
import type {
  BidTimelineEntry,
  BroadcastSceneId,
  BroadcastSettings,
  OutcomeSnapshot,
  SummaryStats,
} from "./types";

export type BroadcastStateManagerInput = {
  tournamentId: number;
  state: AuctionState | undefined;
  teamPurses: TeamPurse[] | undefined;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  isObsMode: boolean;
  formatAmount: (n: number) => string;
  isStaleFeed: boolean;
};

export type BroadcastStateManagerResult = {
  scene: BroadcastSceneId;
  previousScene: BroadcastSceneId | null;
  outcomeSnapshot: OutcomeSnapshot | null;
  bidTimeline: BidTimelineEntry[];
  summaryStats: SummaryStats | null;
  breakEndsAt: string | null;
  breakMessage: string | null;
  isTransitioning: boolean;
};

function computeSummaryStats(
  state: AuctionState | undefined,
  teamPurses: TeamPurse[] | undefined,
): SummaryStats | null {
  if (!state) return null;

  const sold = state.soldPlayersCount ?? 0;
  const unsold = state.unsoldPlayersCount ?? 0;
  const remaining = state.remainingPlayersCount ?? 0;

  let highestBid = 0;
  let highestBidPlayer: string | null = null;
  const outcome = state.outcome;
  if (outcome?.type === "sold" && (outcome.amount ?? 0) > highestBid) {
    highestBid = outcome.amount ?? 0;
    highestBidPlayer = outcome.playerName ?? null;
  }

  let topBuyerSpend = 0;
  let topBuyerName: string | null = null;
  let highestTeamSpend = 0;
  let highestTeamName: string | null = null;

  for (const t of teamPurses ?? []) {
    const spent = t.purseUsed ?? 0;
    if (spent > topBuyerSpend) {
      topBuyerSpend = spent;
      topBuyerName = t.teamName;
    }
    if (spent > highestTeamSpend) {
      highestTeamSpend = spent;
      highestTeamName = t.teamName;
    }
  }

  return {
    playersSold: sold,
    playersUnsold: unsold,
    remainingPlayers: remaining,
    highestBid,
    highestBidPlayer,
    topBuyerName,
    topBuyerSpend,
    highestTeamSpend,
    highestTeamName,
  };
}

/**
 * State-driven scene engine — no manual scene switching in UI.
 * Priority: ephemeral SOLD/UNSOLD → BREAK → WAITING → SUMMARY → AUCTION
 */
export function useBroadcastStateManager(input: BroadcastStateManagerInput): BroadcastStateManagerResult {
  const {
    state,
    teamPurses,
    settings,
  } = input;

  const displayMode = useMemo(
    () => deriveAuctionDisplayMode(state),
    [state?.status, state?.lastAction, state?.outcome, state?.displayCountdown],
  );

  const [scene, setScene] = useState<BroadcastSceneId>("WAITING");
  const [previousScene, setPreviousScene] = useState<BroadcastSceneId | null>(null);
  const [outcomeSnapshot, setOutcomeSnapshot] = useState<OutcomeSnapshot | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [bidTimeline, setBidTimeline] = useState<BidTimelineEntry[]>([]);

  const lastOutcomeKeyRef = useRef<string | null>(null);
  const initialOutcomeSeenRef = useRef(false);
  const outcomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPlayerIdRef = useRef<number | null>(null);
  const lastBidRef = useRef<number | null>(null);

  const summaryStats = useMemo(
    () => computeSummaryStats(state, teamPurses),
    [state, teamPurses],
  );

  const breakEndsAt = displayMode.breakEndsAt;
  const breakMessage = displayMode.breakMessage;

  const transitionTo = useCallback((next: BroadcastSceneId) => {
    setScene((prev) => {
      if (prev === next) return prev;
      setPreviousScene(prev);
      setIsTransitioning(true);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => setIsTransitioning(false), 300);
      return next;
    });
  }, []);

  // Track bid timeline for current player
  useEffect(() => {
    const playerId = state?.currentPlayer?.id ?? null;
    if (playerId !== lastPlayerIdRef.current) {
      lastPlayerIdRef.current = playerId;
      lastBidRef.current = null;
      setBidTimeline([]);
      return;
    }

    const bid = state?.currentBid ?? null;
    const teamName = state?.currentBidTeamName;
    if (
      bid != null &&
      teamName &&
      bid !== lastBidRef.current &&
      (state?.currentBidTeamId ?? null) != null
    ) {
      lastBidRef.current = bid;
      setBidTimeline((prev) => {
        const entry: BidTimelineEntry = {
          id: `${playerId}-${bid}-${Date.now()}`,
          teamName,
          teamColor: state?.currentBidTeamColor ?? null,
          amount: bid,
          at: Date.now(),
        };
        return [...prev.slice(-8), entry];
      });
    }
  }, [
    state?.currentPlayer?.id,
    state?.currentBid,
    state?.currentBidTeamName,
    state?.currentBidTeamColor,
    state?.currentBidTeamId,
  ]);

  // Outcome detection → SOLD / UNSOLD scenes
  useEffect(() => {
    const outcome = displayMode.outcome;
    if (!outcome) {
      if (state && !initialOutcomeSeenRef.current) initialOutcomeSeenRef.current = true;
      return;
    }

    const key = outcomeEventKey(outcome);
    if (!key) return;

    if (!initialOutcomeSeenRef.current) {
      initialOutcomeSeenRef.current = true;
      lastOutcomeKeyRef.current = key;
      return;
    }

    if (key === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = key;

    const sold = soldRecordFromOutcome(outcome);
    const unsold = unsoldRecordFromOutcome(outcome);

    if (sold && settings.enableSoldAnimation) {
      setOutcomeSnapshot({
        outcome: "sold",
        playerName: sold.playerName,
        photoUrl: sold.photoUrl,
        amount: sold.amount,
        teamName: sold.teamName,
        teamColor: sold.teamColor,
        teamLogoUrl: sold.teamLogoUrl,
      });
      transitionTo("SOLD");
      if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
      outcomeTimerRef.current = setTimeout(() => {
        setOutcomeSnapshot(null);
        transitionTo("AUCTION");
      }, settings.soldAnimationDurationMs);
    } else if (unsold) {
      setOutcomeSnapshot({
        outcome: "unsold",
        playerName: unsold.playerName,
        photoUrl: unsold.photoUrl,
        teamColor: "#ef4444",
        reason: outcome.isManual ? "Manual unsold" : null,
      });
      transitionTo("UNSOLD");
      if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
      outcomeTimerRef.current = setTimeout(() => {
        setOutcomeSnapshot(null);
        transitionTo("AUCTION");
      }, settings.soldAnimationDurationMs);
    }
  }, [displayMode.outcome, state, settings.enableSoldAnimation, settings.soldAnimationDurationMs, transitionTo]);

  // Clear outcome when new player loads
  useEffect(() => {
    if (state?.currentPlayer?.id) {
      setOutcomeSnapshot(null);
    }
  }, [state?.currentPlayer?.id]);

  // Base scene from auction state (when not in ephemeral outcome)
  useEffect(() => {
    if (outcomeSnapshot) return;

    const status = state?.status ?? "idle";
    const isBreak = settings.enableBreakMode && displayMode.isBreak && !!breakEndsAt;
    const isCompleted = status === "completed";

    if (isBreak) {
      transitionTo("BREAK");
      return;
    }

    if (isCompleted && settings.autoSummary) {
      transitionTo("SUMMARY");
      return;
    }

    if (status === "active") {
      transitionTo("AUCTION");
      return;
    }

    if ((status === "idle" || status === "paused") && !state?.currentPlayer) {
      transitionTo("WAITING");
      return;
    }

    transitionTo("AUCTION");
  }, [
    state?.status,
    state?.currentPlayer,
    displayMode.isBreak,
    breakEndsAt,
    settings.enableBreakMode,
    settings.autoSummary,
    outcomeSnapshot,
    transitionTo,
  ]);

  useEffect(() => {
    return () => {
      if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  return {
    scene,
    previousScene,
    outcomeSnapshot,
    bidTimeline,
    summaryStats,
    breakEndsAt,
    breakMessage,
    isTransitioning,
  };
}

export { useBroadcastStateManager as BroadcastStateManager };
