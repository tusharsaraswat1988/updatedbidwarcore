/**
 * Buzz Studio — Template Metadata
 *
 * Canonical metadata definitions for every planned Buzz Studio template.
 * This file is pure data — no React, no components.
 *
 * Rules:
 *   - Enabled templates: PLAYER_SPOTLIGHT, SOLD_PLAYER, TOP_BUYS.
 *   - All others: enabled: false, comingSoon: true.
 *   - contractName must match the interface name in contracts/.
 *   - aspectRatios must list all output sizes the renderer should produce.
 */

import { BuzzTemplateType } from "./template-types";
import { BuzzTemplateCategory } from "./template-categories";
import type { BuzzTemplateDefinition } from "./registry-types";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Individual metadata objects                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

export const PLAYER_SPOTLIGHT_META: BuzzTemplateDefinition = {
  id: BuzzTemplateType.PLAYER_SPOTLIGHT,
  title: "Player Spotlight",
  description: "Highlight a player before or after auction with their photo, name, team, and sport.",
  category: BuzzTemplateCategory.PLAYER,
  enabled: true,
  aspectRatios: ["1:1"],
  contractName: "PlayerSpotlightContract",
};

export const SOLD_PLAYER_META: BuzzTemplateDefinition = {
  id: BuzzTemplateType.SOLD_PLAYER,
  title: "Sold Player",
  description: "Announce a successful player sale with the final price and buying team.",
  category: BuzzTemplateCategory.AUCTION,
  enabled: true,
  aspectRatios: ["1:1", "9:16"],
  contractName: "SoldPlayerContract",
};

export const TOP_BUYS_META: BuzzTemplateDefinition = {
  id: BuzzTemplateType.TOP_BUYS,
  title: "Top Buys",
  description: "Showcase the highest-value auction purchases in a ranked list creative.",
  category: BuzzTemplateCategory.AUCTION,
  enabled: true,
  aspectRatios: ["1:1", "4:5"],
  contractName: "TopBuysListContract",
};

export const TEAM_REVEAL_META: BuzzTemplateDefinition = {
  id: BuzzTemplateType.TEAM_REVEAL,
  title: "Team Reveal",
  description: "Reveal a team's final squad composition with captain and total spend.",
  category: BuzzTemplateCategory.TEAM,
  enabled: true,
  aspectRatios: ["1:1", "9:16"],
  contractName: "TeamRevealContract",
};

export const AUCTION_SUMMARY_META: BuzzTemplateDefinition = {
  id: BuzzTemplateType.AUCTION_SUMMARY,
  title: "Auction Summary",
  description: "A full overview of the auction — players sold, top spends, and key stats.",
  category: BuzzTemplateCategory.AUCTION,
  enabled: false,
  comingSoon: true,
  aspectRatios: ["1:1", "16:9"],
  contractName: "AuctionSummaryContract",
};

export const MVP_CARD_META: BuzzTemplateDefinition = {
  id: BuzzTemplateType.MVP_CARD,
  title: "MVP Card",
  description: "Celebrate a standout performer with their stats and achievement title.",
  category: BuzzTemplateCategory.ACHIEVEMENT,
  enabled: false,
  comingSoon: true,
  aspectRatios: ["1:1", "9:16"],
  contractName: "MvpCardContract",
};

export const TOURNAMENT_LAUNCH_META: BuzzTemplateDefinition = {
  id: BuzzTemplateType.TOURNAMENT_LAUNCH,
  title: "Tournament Launch",
  description: "Announce a new tournament with name, start date, venue, and team count.",
  category: BuzzTemplateCategory.TOURNAMENT,
  enabled: false,
  comingSoon: true,
  aspectRatios: ["1:1", "16:9", "9:16"],
  contractName: "TournamentLaunchContract",
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Aggregate ordered list                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * All template metadata in display order.
 * Enabled templates appear before coming-soon ones.
 * The registry consumes this list to build BuzzTemplateRegistryEntry[].
 */
export const ALL_TEMPLATE_METADATA: readonly BuzzTemplateDefinition[] = [
  PLAYER_SPOTLIGHT_META,
  SOLD_PLAYER_META,
  TOP_BUYS_META,
  TEAM_REVEAL_META,
  AUCTION_SUMMARY_META,
  MVP_CARD_META,
  TOURNAMENT_LAUNCH_META,
] as const;
