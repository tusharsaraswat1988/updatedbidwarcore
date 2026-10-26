/**
 * Shared price rules for hall Top 5 and the OBS lower third.
 * Sold players use soldPrice. Retained players use retainedPrice.
 * A missing, zero, or non-finite price is not a sale.
 */

type PricedPlayer = {
  status?: string | null;
  teamId?: number | null;
  soldPrice?: number | null;
  retainedPrice?: number | null;
};

function positivePrice(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Hall Top 5 eligibility: sold or retained, assigned to a team, with a real price.
 * Ranking is descending price. Equal prices keep the incoming list order, matching
 * the hall's stable sort.
 */
export function effectiveTop5Price(player: PricedPlayer): number | null {
  if (player.teamId == null) return null;
  if (player.status === "sold") return positivePrice(player.soldPrice);
  if (player.status === "retained") return positivePrice(player.retainedPrice);
  return null;
}

/** Squad chip price. Missing prices fall back to 0, which is what the overlay already rendered. */
export function squadAcquisitionPrice(player: PricedPlayer): number {
  if (player.status === "retained") return positivePrice(player.retainedPrice) ?? 0;
  if (player.status === "sold") return positivePrice(player.soldPrice) ?? 0;
  return positivePrice(player.soldPrice) ?? positivePrice(player.retainedPrice) ?? 0;
}
