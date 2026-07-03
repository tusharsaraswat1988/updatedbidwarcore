/** Canonical Auction License copy — keep wording identical across all surfaces. */

export const AUCTION_LICENSE_INTRO =
  "An Auction License grants access to the BidWar Auction Module for a single tournament.";

export const AUCTION_LICENSE_INCLUDES = [
  "One (1) Tournament",
  "One (1) Auction Purse/Budget",
  "Up to the maximum number of Teams permitted under the purchased license plan",
  "Unlimited Player Categories",
  "Unlimited Player Registrations",
  "Complete Auction Management for the licensed tournament",
] as const;

export const AUCTION_LICENSE_USAGE_RESTRICTION =
  "The only usage restriction is the maximum number of teams allowed under the selected plan. Player categories and player registrations are unlimited.";

export const AUCTION_LICENSE_CONSUMPTION =
  "An Auction License is consumed once a tournament is created and cannot be transferred to another tournament after the auction has commenced, except where permitted by BidWar Support.";

export const AUCTION_LICENSE_EXCLUSIONS = [
  "Sports Scoring",
  "Match Management",
  "Fixtures & Scheduling",
  "Live Scoring",
  "Points Tables",
  "Statistics & Analytics",
  "Live Streaming Features",
  "Any sport-specific scoring modules",
] as const;

export const AUCTION_LICENSE_EXCLUSIONS_FOOTNOTE =
  "These features are licensed separately under the BidWar Sports Scoring License.";

export const AUCTION_LICENSE_CLARIFICATION = [
  {
    title: "Auction License",
    description: "Used exclusively for conducting player auctions.",
  },
  {
    title: "Sports Scoring License",
    description: "Used exclusively for managing and scoring sports tournaments.",
  },
] as const;

export const AUCTION_LICENSE_CLARIFICATION_FOOTNOTE =
  "Purchasing an Auction License does not automatically grant access to Sports Scoring features, and purchasing a Sports Scoring License does not automatically grant access to the Auction Module unless explicitly included in the purchased plan.";

export const AUCTION_LICENSE_CLARIFICATION_INTRO =
  "BidWar offers independent licenses for different products.";

/** Plain-text block for legal pages (Terms, Licensing Policy). */
export function auctionLicenseDefinitionBody(): string {
  const includes = AUCTION_LICENSE_INCLUDES.map((item) => `• ${item}`).join("\n");
  const exclusions = AUCTION_LICENSE_EXCLUSIONS.map((item) => `• ${item}`).join("\n");
  const clarification = AUCTION_LICENSE_CLARIFICATION.map(
    (item, index) => `${index + 1}. ${item.title}\n   - ${item.description}`,
  ).join("\n\n");

  return [
    AUCTION_LICENSE_INTRO,
    "",
    "Each Auction License includes:",
    "",
    includes,
    "",
    AUCTION_LICENSE_USAGE_RESTRICTION,
    "",
    AUCTION_LICENSE_CONSUMPTION,
    "",
    "The Auction License does NOT include:",
    "",
    exclusions,
    "",
    AUCTION_LICENSE_EXCLUSIONS_FOOTNOTE,
    "",
    AUCTION_LICENSE_CLARIFICATION_INTRO,
    "",
    clarification,
    "",
    AUCTION_LICENSE_CLARIFICATION_FOOTNOTE,
  ].join("\n");
}

export const AUCTION_LICENSE_FAQ = {
  q: "What is included in a BidWar Auction License?",
  a: "An Auction License covers the BidWar Auction Module for one tournament — including one auction purse, unlimited player categories and registrations, and complete auction management up to your plan's team limit. It does not include Sports Scoring, match management, fixtures, live scoring, points tables, statistics, or live streaming. Those require a separate Sports Scoring License.",
} as const;

export const AUCTION_LICENSE_PRICING_NOTE =
  "All paid plans are Auction Licenses for the BidWar Auction Module only. Sports Scoring is licensed separately.";

export const AUCTION_LICENSE_CHECKOUT_NOTE =
  "This purchase activates an Auction License for one tournament. Sports Scoring features are not included unless purchased separately.";
