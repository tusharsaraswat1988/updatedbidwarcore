/**
 * Top Buys featured-frame typography & colors.
 * Matched to designer reference — metallic gold + white, not amber yellow.
 */

export const TOP_BUYS_FEATURED_STYLE = {
  /** Bold poster sans — close to reference player name / price */
  fontDisplay:
    '"Arial Black", "Franklin Gothic Heavy", "Helvetica Neue", Helvetica, Arial, sans-serif',
  /** Labels: CAPTAIN, TOP BUY, team name */
  fontLabel:
    '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  white: "#FFFFFF",
  labelWhite: "rgba(255,255,255,0.90)",
  /** Rich metallic gold — not Tailwind amber (#FBBF24) */
  metallicGold: "#D4AF37",
  metallicGoldDeep: "#B8962E",
  teamBlue: "#4A90D9",
  photoRadius: 8,
} as const;

/** Subtle depth on gold price text — reads metallic on dark podium bar */
export const FEATURED_AMOUNT_SHADOW =
  "0 1px 0 rgba(255, 236, 190, 0.35), 0 2px 8px rgba(0, 0, 0, 0.55)";

/** Slight depth on white player name */
export const FEATURED_NAME_SHADOW = "0 1px 3px rgba(0, 0, 0, 0.45)";

/**
 * Featured poster price — space after ₹ like reference: "₹ 1,20,000"
 */
export function formatFeaturedTopBuyPrice(priceDisplay: string): string {
  if (priceDisplay.startsWith("₹") && !priceDisplay.startsWith("₹ ")) {
    return `₹ ${priceDisplay.slice(1)}`;
  }
  return priceDisplay;
}
