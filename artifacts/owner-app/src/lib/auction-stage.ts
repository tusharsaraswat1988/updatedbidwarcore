/** True when a player is actively on the auction stage (live bidding in progress). */
export function isPlayerOnAuctionStage(
  state: { status?: string; currentPlayer?: unknown } | null | undefined,
): boolean {
  return state?.status === "active" && !!state?.currentPlayer;
}

export const AUCTION_STAGE_NAV_MESSAGE =
  "Player is currently on the auction stage. Please wait until bidding for this player is completed.";
