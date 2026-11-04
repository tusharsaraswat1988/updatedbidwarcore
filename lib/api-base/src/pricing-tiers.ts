/**
 * Canonical BidWar Tournament License Pricing Tiers.
 * Authoritative single source of truth for:
 * - Pricing UI (pricing-section.tsx, pricing.tsx)
 * - Server-side JSON-LD / SEO schema (page-meta.ts)
 * - Client-side JSON-LD / SEO schema (schema-markup.tsx)
 * - Checkout and payment modal (payment-modal.tsx)
 */

export interface CanonicalPricingTier {
  id: string;
  label: string;
  listPrice: number; // In INR
  sellingPrice: number; // In INR (discounted checkout price)
  teamsLimit: number;
  teamsLabel: string;
  description: string;
  highlight: boolean;
  badge: string | null;
  category: "club" | "franchise";
  cta: string;
  gstIncluded: boolean;
}

export const CANONICAL_PRICING_TIERS: readonly CanonicalPricingTier[] = [
  {
    id: "trial",
    label: "Trial",
    listPrice: 0,
    sellingPrice: 0,
    teamsLimit: 2,
    teamsLabel: "Up to 2 Teams",
    description: "Test the operator console & mobile bidding at zero cost.",
    highlight: false,
    badge: null,
    category: "club",
    cta: "Start Free Trial",
    gstIncluded: false,
  },
  {
    id: "starter",
    label: "Starter",
    listPrice: 5000,
    sellingPrice: 3750,
    teamsLimit: 4,
    teamsLabel: "Up to 4 Teams",
    description: "Small club leagues and community tournaments.",
    highlight: false,
    badge: null,
    category: "club",
    cta: "Get Starter",
    gstIncluded: true,
  },
  {
    id: "pro",
    label: "Pro",
    listPrice: 6000,
    sellingPrice: 4500,
    teamsLimit: 8,
    teamsLabel: "Up to 8 Teams",
    description: "District and city-level franchise player auctions.",
    highlight: true,
    badge: "Most Popular",
    category: "club",
    cta: "Get Pro License",
    gstIncluded: true,
  },
  {
    id: "advanced",
    label: "Advanced",
    listPrice: 8000,
    sellingPrice: 6000,
    teamsLimit: 12,
    teamsLabel: "Up to 12 Teams",
    description: "Growing franchise leagues with larger rosters.",
    highlight: false,
    badge: null,
    category: "franchise",
    cta: "Get Advanced",
    gstIncluded: true,
  },
  {
    id: "elite",
    label: "Elite",
    listPrice: 9000,
    sellingPrice: 6750,
    teamsLimit: 16,
    teamsLabel: "Up to 16 Teams",
    description: "State-level and premier franchise tournaments.",
    highlight: true,
    badge: "Recommended",
    category: "franchise",
    cta: "Get Elite",
    gstIncluded: true,
  },
  {
    id: "premium",
    label: "Premium",
    listPrice: 11000,
    sellingPrice: 8250,
    teamsLimit: 22,
    teamsLabel: "Up to 22 Teams",
    description: "Multi-city leagues and regional championships.",
    highlight: false,
    badge: null,
    category: "franchise",
    cta: "Get Premium",
    gstIncluded: true,
  },
  {
    id: "champion",
    label: "Champion",
    listPrice: 12000,
    sellingPrice: 9000,
    teamsLimit: 30,
    teamsLabel: "Up to 30 Teams",
    description: "Flagship mega-franchise auctions with maximum capacity.",
    highlight: false,
    badge: null,
    category: "franchise",
    cta: "Get Champion",
    gstIncluded: true,
  },
] as const;

/** Generate Schema.org Offer objects for SoftwareApplication structured data */
export function buildSchemaOrgOffers(): Array<{
  "@type": "Offer";
  name: string;
  price: string;
  priceCurrency: "INR";
  description: string;
  availability: "https://schema.org/InStock";
}> {
  return CANONICAL_PRICING_TIERS.map((tier) => ({
    "@type": "Offer",
    name: tier.label,
    price: String(tier.sellingPrice),
    priceCurrency: "INR",
    description:
      tier.sellingPrice === 0
        ? `Free trial plan — ${tier.teamsLabel} per tournament.`
        : `${tier.teamsLabel} per tournament. List ₹${tier.listPrice.toLocaleString("en-IN")} — special price ₹${tier.sellingPrice.toLocaleString("en-IN")}, all taxes included.`,
    availability: "https://schema.org/InStock",
  }));
}
