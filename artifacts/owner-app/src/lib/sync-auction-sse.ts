import type { QueryClient } from "@tanstack/react-query";
import {
  isAuctionActivityEventType,
  parseActivityTimestamp,
  recordAuctionActivity,
} from "@workspace/api-base/auction-connection-state";
import {
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getListBidsQueryKey,
  getListPlayersQueryKey,
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
  currentBid?: number;
  currentBidTeamId?: number;
  currentBidTeamName?: string | null;
  currentBidTeamColor?: string | null;
  currentBidTeamLogoUrl?: string | null;
  timerEndsAt?: string | null;
  timerType?: string | null;
  lastAction?: string;
  bidIncrement?: number;
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
  [key: string]: unknown;
};

const versionByTournament = new Map<number, number>();

function getCachedVersion(tournamentId: number): number {
  return versionByTournament.get(tournamentId) ?? 0;
}

function setCachedVersion(tournamentId: number, version: number): void {
  versionByTournament.set(tournamentId, version);
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
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
  }
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

function mergeBidDelta(
  prev: AuctionStateCache | undefined,
  msg: SseAuctionMessage,
): AuctionStateCache {
  const base = prev ?? {};
  return stampVersion(
    {
      ...base,
      currentBid: msg.currentBid ?? base.currentBid,
      currentBidTeamId: msg.currentBidTeamId ?? base.currentBidTeamId,
      currentBidTeamName: msg.currentBidTeamName ?? base.currentBidTeamName,
      currentBidTeamColor: msg.currentBidTeamColor ?? base.currentBidTeamColor,
      currentBidTeamLogoUrl: msg.currentBidTeamLogoUrl ?? base.currentBidTeamLogoUrl,
      timerEndsAt: msg.timerEndsAt ?? base.timerEndsAt,
      timerType: msg.timerType ?? base.timerType,
      lastAction: msg.lastAction ?? base.lastAction,
      bidIncrement: msg.bidIncrement ?? base.bidIncrement,
    },
    msg.version,
  );
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
    applyInvalidations(qc, tournamentId, msg.invalidate ?? [], teamPurses);
    return;
  }

  if (msg.type === "bid") {
    const prev = qc.getQueryData<AuctionStateCache>(key);
    qc.setQueryData(key, withActivityStamp(mergeBidDelta(prev, msg), activityIso));
    return;
  }

  if (msg.type === "sold") {
    const prev = qc.getQueryData<AuctionStateCache>(key);
    const merged = withActivityStamp(mergeSoldDelta(prev, msg), activityIso);
    qc.setQueryData(key, merged);
    syncTeamPurses(qc, tournamentId, msg.teamPurses);
    applyInvalidations(qc, tournamentId, msg.invalidate ?? [], msg.teamPurses);
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
  }
}

export function resetAuctionEventVersion(tournamentId: number): void {
  versionByTournament.delete(tournamentId);
}
