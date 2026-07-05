import type { BuiltAuctionState } from "./auction-sse-payload";
import { compactAuctionStateForSse } from "./auction-sse-payload";
import { publishAuctionEvent } from "./auction-events";

export type BidDeltaFields = {
  playerId: number;
  currentBid: number;
  currentBidTeamId: number;
  currentBidTeamName: string | null;
  currentBidTeamColor: string | null;
  currentBidTeamLogoUrl: string | null;
  timerEndsAt: string;
  timerType: "bid";
  lastAction: string;
  bidIncrement: number;
};

export type SoldDeltaFields = {
  playerId: number;
  teamId: number;
  amount: number;
  lastOutcome: unknown;
  lastAction: string;
  teamPurses: BuiltAuctionState["teamPurses"];
  soldPlayersCount: number;
  unsoldPlayersCount: number;
  remainingPlayersCount: number;
  currentPlayerId: number | null;
  currentBid: number | null;
  currentBidTeamId: number | null;
  timerEndsAt: string | null;
  timerType: string | null;
  lastSoldPlayer: BuiltAuctionState["lastSoldPlayer"];
};

export async function emitAuctionStateEvent(
  tournamentId: number,
  state: BuiltAuctionState,
  invalidate: string[] = [],
): Promise<BuiltAuctionState> {
  const sseInvalidate = state.teamPurses?.length
    ? invalidate.filter((key) => key !== "purses")
    : invalidate;

  await publishAuctionEvent(tournamentId, {
    type: "auction_state",
    state: compactAuctionStateForSse(state),
    invalidate: sseInvalidate,
  });

  return state;
}

export async function emitBidEvent(
  tournamentId: number,
  delta: BidDeltaFields,
): Promise<number> {
  const envelope = await publishAuctionEvent(tournamentId, {
    type: "bid",
    ...delta,
    invalidate: [],
  });
  return envelope.version;
}

export async function emitSoldEvent(
  tournamentId: number,
  delta: SoldDeltaFields,
  invalidate: string[] = ["bids", "players"],
): Promise<void> {
  const sseInvalidate = delta.teamPurses?.length
    ? invalidate.filter((key) => key !== "purses")
    : invalidate;

  await publishAuctionEvent(tournamentId, {
    type: "sold",
    ...delta,
    invalidate: sseInvalidate,
  });
}

export async function emitUnsoldEvent(
  tournamentId: number,
  delta: Omit<SoldDeltaFields, "teamId" | "amount"> & { playerId: number },
  invalidate: string[] = ["players"],
): Promise<void> {
  await publishAuctionEvent(tournamentId, {
    type: "unsold",
    ...delta,
    invalidate,
  });
}
