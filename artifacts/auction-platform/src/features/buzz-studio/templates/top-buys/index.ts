/**
 * Buzz Studio — Top Buys Template
 *
 * Public API for the top-buys template module.
 * Import from this barrel; never import from sibling files directly.
 *
 * @example
 * import { TopBuys, TopBuysListContract, formatTopBuyPrice } from "./templates/top-buys";
 */

/* ── Component ─────────────────────────────────────────────────────────── */
export { TopBuys } from "./TopBuys";
export { TopBuyPoster } from "./TopBuyPoster";
export {
  TopBuyBackground,
  TopBuyDecorativeElements,
  TopBuyTournamentHeader,
  TopBuyTitle,
  TopBuyPlayerFrame,
  TopBuyPlayerImage,
  TopBuyPlayerName,
  TopBuyTeamName,
  TopBuyPriceCard,
  TopBuyFooter,
} from "./top-buy-chrome";

/* ── Types ─────────────────────────────────────────────────────────────── */
export type { TopBuyContract, TopBuysListContract } from "./TopBuys.types";

/* ── Utils ─────────────────────────────────────────────────────────────── */
export { formatTopBuyPrice, resolveRank, compactGridCols } from "./TopBuys.utils";

/* ── Demo data (dev only — not for production use) ─────────────────────── */
export { demoTop3, demoTop5, demoTop10, ALL_DEMO_SCENARIOS } from "./demo-data";
