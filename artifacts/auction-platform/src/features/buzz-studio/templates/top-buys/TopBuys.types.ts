/**
 * Buzz Studio — Top Buys Template Types
 *
 * This template uses TopBuysListContract directly as its data shape.
 * No duplicate interface — the contracts ARE the input.
 *
 * TopBuysListContract fields used by this template:
 *   entries       TopBuyContract[]  — ordered list (price desc), 1–10 items
 *   title         string?           — card headline, defaults to "TOP BUYS"
 *   sport         SportType         — drives SportBadge (from first entry if absent)
 *   branding      BuzzBranding?     — future branding overrides
 *   metadata      ContractMetadata? — future audit / cache metadata
 *
 * TopBuyContract fields used per entry:
 *   playerName    string    — required, monogram fallback source
 *   playerImageUrl string?  — optional, PlayerSlot monogram if absent
 *   teamName      string?   — optional, TeamSlot monogram if absent
 *   teamLogoUrl   string?   — optional
 *   sport         SportType — per-entry sport (for mixed-sport lists)
 *   price         number    — required, formatted by TopBuys.utils
 *   priceDisplay  string?   — overrides price formatting when present
 *   currency      string?   — default "INR"
 *   rank          number?   — drives RankingBadge (inferred from index if absent)
 *   designation   string?   — optional role label shown on featured card
 */

export type { TopBuyContract, TopBuysListContract } from "../../contracts/TopBuy.contract";
