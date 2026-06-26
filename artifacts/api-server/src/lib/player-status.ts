export const PLAYER_AUCTION_STATUSES = [
  "available",
  "sold",
  "unsold",
  "retained",
  "withdrawn",
] as const;

export type PlayerAuctionStatus = (typeof PLAYER_AUCTION_STATUSES)[number];
