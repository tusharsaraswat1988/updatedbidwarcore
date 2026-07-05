/** Player fields needed to resolve how much purse a retained player costs. */
export type RetainedSpendPlayer = {
  status: string;
  retainedPrice?: number | null;
  basePrice?: number | null;
};

/**
 * Purse amount to deduct for a retained player.
 * Uses explicit retainedPrice when set; otherwise falls back to basePrice
 * (which mirrors player-selected bid value at registration).
 */
export function resolveRetainedSpend(player: RetainedSpendPlayer): number {
  if (player.status !== "retained") return 0;
  if (player.retainedPrice != null && player.retainedPrice > 0) {
    return player.retainedPrice;
  }
  return player.basePrice ?? 0;
}

/**
 * Resolve retainedPrice to persist when marking a player as retained.
 * Prefers an explicit price; otherwise uses the player's base bid value.
 */
export function resolveRetainedPriceForSave(
  explicitPrice: number | null | undefined,
  basePrice: number,
): number | null {
  if (explicitPrice != null && explicitPrice > 0) return explicitPrice;
  if (basePrice > 0) return basePrice;
  return null;
}
