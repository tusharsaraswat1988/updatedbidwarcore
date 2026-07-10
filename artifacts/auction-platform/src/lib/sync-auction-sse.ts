import type { QueryClient } from "@tanstack/react-query";
import {
  isAuctionActivityEventType,
  parseActivityTimestamp,
  recordAuctionActivity,
} from "@workspace/api-base/auction-connection-state";
import {
  decideBidMutationApply,
  logBidLifecycle,
  mergeBidFields,
  nextMonotonicVersion,
  shouldApplyBidDelta as shouldApplyBidDeltaShared,
} from "@workspace/api-base/auction-bid-sync";
import {
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getGetTournamentInsightsQueryKey,
  getGetTournamentSummaryQueryKey,
  getListBidsQueryKey,
  getListPlayersQueryKey,
  type Bid,
  type TeamPurse,
} from "@workspace/api-client-react";

type AuctionStateCache = Record<string, unknown> & {
  teamPurses?: TeamPurse[];
  eventVersion?: number;
  lastAuctionActivityAt?: string | null;
};

export type SseAuctionMessage = {
  type?: string;
  version?: number;
  lastAuctionActivityAt?: string | null;
  state?: AuctionStateCache;
  invalidate?: string[];
  // bid delta
  currentBid?: number;
  currentBidTeamId?: number;
  currentBidTeamName?: string | null;
  currentBidTeamColor?: string | null;
  currentBidTeamLogoUrl?: string | null;
  timerEndsAt?: string | null;
  timerType?: string | null;
  lastAction?: string;
  bidIncrement?: number;
  // sold delta
  playerId?: number;
  teamId?: number;
  amount?: number;
  lastOutcome?: unknown;
  teamPurses?: TeamPurse[];
  soldPlayersCount?: number;
  unsoldPlayersCount?: number;
  remainingPlayersCount?: number;
  currentPlayerId?: number | null;
  lastSoldPlayer?: unknown;
  // cheer / misc
  supporterLabel?: string;
  message?: string;
  teamColor?: string | null;
  timestamp?: number;
  heatLevel?: string;
  fanBattle?: Record<string, number>;
  [key: string]: unknown;
};

const versionByTournament = new Map<number, number>();

function getCachedVersion(tournamentId: number): number {
  return versionByTournament.get(tournamentId) ?? 0;
}

function setCachedVersion(tournamentId: number, version: number): void {
  // Never regress the cursor — stale HTTP responses must not unlock older SSE events.
  const current = versionByTournament.get(tournamentId) ?? 0;
  if (version > current) versionByTournament.set(tournamentId, version);
}

function isStale(tournamentId: number, version: number | undefined): boolean {
  if (version == null || version <= 0) return false;
  return version <= getCachedVersion(tournamentId);
}

function stampVersion(state: AuctionStateCache, version: number | undefined): AuctionStateCache {
  if (version == null) return state;
  return { ...state, eventVersion: version };
}

function touchAuctionActivity(
  tournamentId: number,
  msg: SseAuctionMessage,
): string | undefined {
  if (!isAuctionActivityEventType(msg.type)) return undefined;
  const atMs = parseActivityTimestamp(msg.lastAuctionActivityAt) ?? Date.now();
  recordAuctionActivity(tournamentId, atMs);
  return typeof msg.lastAuctionActivityAt === "string"
    ? msg.lastAuctionActivityAt
    : new Date(atMs).toISOString();
}

function withActivityStamp(
  state: AuctionStateCache,
  activityIso: string | undefined,
): AuctionStateCache {
  if (!activityIso) return state;
  return { ...state, lastAuctionActivityAt: activityIso };
}

function applyInvalidations(
  qc: QueryClient,
  tournamentId: number,
  invalidate: string[],
  teamPurses?: TeamPurse[],
): void {
  if (invalidate.includes("bids")) {
    qc.invalidateQueries({ queryKey: getListBidsQueryKey(tournamentId) });
  }
  if (invalidate.includes("purses") && !teamPurses?.length) {
    qc.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
  }
  if (invalidate.includes("players")) {
    void qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    void qc.refetchQueries({ queryKey: getListPlayersQueryKey(tournamentId), type: "active" });
  }
}

function bumpInsightsQueries(qc: QueryClient, tournamentId: number): void {
  qc.invalidateQueries({ queryKey: getGetTournamentInsightsQueryKey(tournamentId) });
  qc.invalidateQueries({ queryKey: getGetTournamentSummaryQueryKey(tournamentId) });
}

function syncTeamPurses(
  qc: QueryClient,
  tournamentId: number,
  teamPurses: TeamPurse[] | undefined,
): void {
  if (teamPurses?.length) {
    qc.setQueryData(getGetTeamPursesQueryKey(tournamentId), teamPurses);
  }
}

/** Reject out-of-order SSE bid deltas that would regress the live bid amount. */
function shouldApplyBidDelta(
  base: AuctionStateCache | undefined,
  msg: SseAuctionMessage,
): boolean {
  return shouldApplyBidDeltaShared(
    {
      currentBid: typeof base?.currentBid === "number" ? base.currentBid : null,
      timerEndsAt: typeof base?.timerEndsAt === "string" ? base.timerEndsAt : null,
    },
    {
      currentBid: msg.currentBid,
      timerEndsAt: msg.timerEndsAt,
    },
  );
}

function resolveBidPlayerId(
  msg: SseAuctionMessage,
  auctionState: AuctionStateCache | undefined,
): number | null {
  if (typeof msg.playerId === "number") return msg.playerId;
  const currentPlayer = auctionState?.currentPlayer as { id?: number } | null | undefined;
  if (typeof currentPlayer?.id === "number") return currentPlayer.id;
  const currentPlayerId = auctionState?.currentPlayerId;
  return typeof currentPlayerId === "number" ? currentPlayerId : null;
}

/** Append live bid to cache — bid-events DB write is async so refetch alone drops history. */
function appendBidToCache(
  qc: QueryClient,
  tournamentId: number,
  msg: SseAuctionMessage,
  auctionState: AuctionStateCache | undefined,
): void {
  const playerId = resolveBidPlayerId(msg, auctionState);
  const teamId = msg.currentBidTeamId;
  const amount = msg.currentBid;
  if (playerId == null || teamId == null || amount == null) return;

  const bidsKey = getListBidsQueryKey(tournamentId);
  const prev = qc.getQueryData<Bid[]>(bidsKey) ?? [];
  const nowMs = Date.now();
  const alreadyRecorded = prev.some(
    (b) =>
      b.playerId === playerId &&
      b.teamId === teamId &&
      b.amount === amount &&
      Math.abs(new Date(b.timestamp).getTime() - nowMs) < 10_000,
  );
  if (alreadyRecorded) return;

  const currentPlayer = auctionState?.currentPlayer as { name?: string } | null | undefined;
  const entry: Bid = {
    id: -nowMs,
    tournamentId,
    playerId,
    teamId,
    amount,
    timestamp: new Date(nowMs).toISOString(),
    playerName: currentPlayer?.name ?? null,
    teamName: msg.currentBidTeamName ?? null,
    teamColor: msg.currentBidTeamColor ?? null,
  };

  qc.setQueryData(bidsKey, [entry, ...prev]);
}

function mergeBidDelta(
  prev: AuctionStateCache | undefined,
  msg: SseAuctionMessage,
): AuctionStateCache {
  return mergeBidFields(prev, msg, msg.version);
}

function mergeSoldDelta(
  prev: AuctionStateCache | undefined,
  msg: SseAuctionMessage,
): AuctionStateCache {
  const base = prev ?? {};
  return stampVersion(
    {
      ...base,
      outcome: msg.lastOutcome ?? base.outcome,
      lastAction: msg.lastAction ?? base.lastAction,
      teamPurses: msg.teamPurses ?? base.teamPurses,
      soldPlayersCount: msg.soldPlayersCount ?? base.soldPlayersCount,
      unsoldPlayersCount: msg.unsoldPlayersCount ?? base.unsoldPlayersCount,
      remainingPlayersCount: msg.remainingPlayersCount ?? base.remainingPlayersCount,
      currentPlayer: msg.currentPlayerId == null ? null : base.currentPlayer,
      currentPlayerId: msg.currentPlayerId ?? base.currentPlayerId,
      currentBid: msg.currentBid ?? base.currentBid,
      currentBidTeamId: msg.currentBidTeamId ?? base.currentBidTeamId,
      timerEndsAt: msg.timerEndsAt ?? base.timerEndsAt,
      timerType: msg.timerType ?? base.timerType,
      lastSoldPlayer: msg.lastSoldPlayer ?? base.lastSoldPlayer,
    },
    msg.version,
  );
}

/** Apply any auction SSE envelope to React Query caches (full state, deltas, versioning). */
export function applyAuctionSseMessage(
  qc: QueryClient,
  tournamentId: number,
  msg: SseAuctionMessage,
): void {
  if (isStale(tournamentId, msg.version)) return;

  if (msg.version != null && msg.version > 0) {
    setCachedVersion(tournamentId, msg.version);
  }

  const key = getGetAuctionStateQueryKey(tournamentId);
  const activityIso = touchAuctionActivity(tournamentId, msg);

  if (msg.type === "auction_state" && msg.state) {
    const teamPurses = msg.state.teamPurses;
    const activityAt =
      activityIso ??
      (typeof msg.state.lastAuctionActivityAt === "string" ? msg.state.lastAuctionActivityAt : null) ??
      (typeof msg.lastAuctionActivityAt === "string" ? msg.lastAuctionActivityAt : null);
    qc.setQueryData(
      key,
      stampVersion({ ...msg.state, lastAuctionActivityAt: activityAt ?? null }, msg.version),
    );
    syncTeamPurses(qc, tournamentId, teamPurses);
    if ((msg.invalidate ?? []).includes("bids")) {
      qc.setQueryData(getListBidsQueryKey(tournamentId), []);
    }
    applyInvalidations(qc, tournamentId, msg.invalidate ?? [], teamPurses);
    bumpInsightsQueries(qc, tournamentId);
    return;
  }

  if (msg.type === "bid") {
    const prev = qc.getQueryData<AuctionStateCache>(key);
    if (!shouldApplyBidDelta(prev, msg)) return;
    qc.setQueryData(key, withActivityStamp(mergeBidDelta(prev, msg), activityIso));
    appendBidToCache(qc, tournamentId, msg, prev);
    return;
  }

  if (msg.type === "sold") {
    const prev = qc.getQueryData<AuctionStateCache>(key);
    const merged = withActivityStamp(mergeSoldDelta(prev, msg), activityIso);
    qc.setQueryData(key, merged);
    syncTeamPurses(qc, tournamentId, msg.teamPurses);
    applyInvalidations(qc, tournamentId, msg.invalidate ?? [], msg.teamPurses);
    bumpInsightsQueries(qc, tournamentId);
    return;
  }

  if (msg.type === "unsold") {
    const prev = qc.getQueryData<AuctionStateCache>(key);
    qc.setQueryData(
      key,
      withActivityStamp(
        stampVersion(
          {
            ...(prev ?? {}),
            outcome: msg.lastOutcome ?? prev?.outcome,
            lastAction: msg.lastAction ?? prev?.lastAction,
            soldPlayersCount: msg.soldPlayersCount ?? prev?.soldPlayersCount,
            unsoldPlayersCount: msg.unsoldPlayersCount ?? prev?.unsoldPlayersCount,
            remainingPlayersCount: msg.remainingPlayersCount ?? prev?.remainingPlayersCount,
            currentPlayer: msg.currentPlayerId == null ? null : prev?.currentPlayer,
            currentBid: msg.currentBid ?? prev?.currentBid,
            currentBidTeamId: msg.currentBidTeamId ?? prev?.currentBidTeamId,
            timerEndsAt: msg.timerEndsAt ?? prev?.timerEndsAt,
            timerType: msg.timerType ?? prev?.timerType,
          },
          msg.version,
        ),
        activityIso,
      ),
    );
    applyInvalidations(qc, tournamentId, msg.invalidate ?? []);
    bumpInsightsQueries(qc, tournamentId);
    return;
  }
}

/**
 * Apply the authoritative auction snapshot returned by reset-trial (or any full
 * state write). Clears bid history, syncs purses, and eagerly refetches players
 * so LED/operator views cannot show pre-reset sold rosters from stale caches.
 */
export function applyAuctionResetState(
  qc: QueryClient,
  tournamentId: number,
  state: AuctionStateCache,
): void {
  qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), state);
  syncTeamPurses(qc, tournamentId, state.teamPurses);
  qc.setQueryData(getListBidsQueryKey(tournamentId), []);
  void qc.invalidateQueries({ queryKey: getListBidsQueryKey(tournamentId) });
  void qc.refetchQueries({ queryKey: getListPlayersQueryKey(tournamentId), type: "active" });
  if (!state.teamPurses?.length) {
    void qc.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
  }
  bumpInsightsQueries(qc, tournamentId);
}

/**
 * Apply an HTTP mutation response with a monotonic version gate.
 * Stale bid ACKs (older than the latest SSE event) are rejected so they cannot
 * regress the live leader and stick bid controls on the wrong team.
 */
export function applyMutationAuctionState(
  qc: QueryClient,
  tournamentId: number,
  result: AuctionStateCache,
): void {
  const key = getGetAuctionStateQueryKey(tournamentId);
  const cachedVersion = getCachedVersion(tournamentId);
  const decision = decideBidMutationApply(cachedVersion, result);

  if (decision.action === "reject_stale") {
    logBidLifecycle({
      event: "stale_mutation_rejected",
      tournamentId,
      eventVersion: result.eventVersion,
      cachedVersion,
      detail: decision.reason,
    });
    return;
  }

  if (decision.action === "merge_bid_ack") {
    const prev = qc.getQueryData<AuctionStateCache>(key);
    if (!shouldApplyBidDelta(prev, result)) {
      logBidLifecycle({
        event: "stale_mutation_rejected",
        tournamentId,
        eventVersion: result.eventVersion,
        cachedVersion,
        detail: "bid_amount_regression",
      });
      if (result.eventVersion != null && result.eventVersion > 0) {
        setCachedVersion(tournamentId, nextMonotonicVersion(cachedVersion, result.eventVersion));
      }
      return;
    }
    const version = result.eventVersion;
    qc.setQueryData(key, mergeBidFields(prev, result, version));
    if (version != null && version > 0) {
      setCachedVersion(tournamentId, nextMonotonicVersion(cachedVersion, version));
    }
    logBidLifecycle({
      event: "bid_ack_merged",
      tournamentId,
      eventVersion: version,
      cachedVersion: getCachedVersion(tournamentId),
      amount: typeof result.currentBid === "number" ? result.currentBid : undefined,
    });
    syncTeamPurses(qc, tournamentId, result.teamPurses);
    return;
  }

  const version = result.eventVersion;
  const stamped = version != null ? stampVersion(result, version) : result;
  qc.setQueryData(key, stamped);
  if (version != null && version > 0) {
    setCachedVersion(tournamentId, nextMonotonicVersion(cachedVersion, version));
  }
  logBidLifecycle({
    event: "full_state_replaced",
    tournamentId,
    eventVersion: version,
    cachedVersion: getCachedVersion(tournamentId),
  });
  syncTeamPurses(qc, tournamentId, result.teamPurses);
}

/** Reset tracked version on reconnect recovery (full snapshot follows). */
export function resetAuctionEventVersion(tournamentId: number): void {
  versionByTournament.delete(tournamentId);
}

export function getAuctionEventVersion(tournamentId: number): number {
  return getCachedVersion(tournamentId);
}
