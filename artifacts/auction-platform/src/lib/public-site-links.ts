/**
 * Shared public marketing routes and contact/social constants.
 * Single source for navbar, footer, and Lovable homepage wiring.
 */

export const SOLUTION_SPORT_LINKS = [
  { label: "Cricket Auction", href: "/cricket-auction-software" },
  { label: "Football Auction", href: "/football-player-auction" },
  { label: "Kabaddi Auction", href: "/kabaddi-auction-platform" },
  { label: "Basketball Auction", href: "/basketball-auction-software" },
  { label: "Badminton Auction", href: "/badminton-auction-platform" },
  { label: "Volleyball Auction", href: "/volleyball-player-auction" },
  { label: "Esports Auction", href: "/esports-auction-system" },
  { label: "Business League", href: "/business-league-auction" },
] as const;

export const SOLUTION_PLATFORM_LINKS = [
  { label: "Sports Auction Software", href: "/sports-auction-software" },
  { label: "Franchise Auction", href: "/franchise-auction-software" },
  { label: "Player Auction", href: "/player-auction-software" },
  { label: "League Management", href: "/sports-league-management-software" },
  { label: "Badminton Scoring", href: "/badminton-scoring-software" },
  { label: "Live Player Bidding", href: "/live-player-bidding" },
  { label: "Tournament Platform", href: "/tournament-auction-platform" },
] as const;

export const MORE_NAV_LINKS = [
  { label: "Use Cases", href: "/#solutions", sectionId: "solutions" },
  { label: "FAQs", href: "/#faq", sectionId: "faq" },
  { label: "Upcoming Auctions", href: "/upcoming-auctions" },
  { label: "Contact Us", href: "/contact" },
  { label: "Auction Tips", href: "/auction-tips" },
  { label: "Academy", href: "/academy" },
] as const;

export const LEGAL_LINKS = [
  { label: "Legal Hub", href: "/legal" },
  { label: "Terms & Conditions", href: "/legal/terms" },
  { label: "Licensing Policy", href: "/legal/licensing" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Acceptable Use", href: "/legal/acceptable-use" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
  { label: "Refund Policy", href: "/legal/refund" },
] as const;

/** Canonical public support / company contact (matches SiteFooter + legal CONTACT_BLOCK). */
export const SITE_CONTACT = {
  email: "bidwarsupport@gmail.com",
  phoneDisplay: "+91 8707488250",
  phoneWhatsApp: "918707488250",
  website: "https://bidwar.in",
  websiteLabel: "bidwar.in",
  addressLine: "Gurudham Colony, Bhelupura, Varanasi, Uttar Pradesh, India",
  billingEntity: "CWP DETAILER'S AND MOTORS",
  gstin: "09BYWPS9468R3ZG",
} as const;

export const SITE_SOCIAL = [
  { label: "IN", name: "Instagram", href: "https://www.instagram.com/bidwar.in" },
  { label: "FB", name: "Facebook", href: "https://www.facebook.com/bidwar.in" },
  { label: "YT", name: "YouTube", href: "https://www.youtube.com/@bidwarofficial" },
] as const;

/** Labels shown in Lovable footer social row that have no live URL yet. */
export const SITE_SOCIAL_PLACEHOLDERS = ["TW", "LI"] as const;

export function waMeUrl(text?: string): string {
  const base = `https://wa.me/${SITE_CONTACT.phoneWhatsApp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const HOME_SPORT_SOLUTION_HREFS: Record<string, string> = {
  Cricket: "/cricket-auction-software",
  Football: "/football-player-auction",
  Kabaddi: "/kabaddi-auction-platform",
  Badminton: "/badminton-auction-platform",
  Basketball: "/basketball-auction-software",
  Volleyball: "/volleyball-player-auction",
  Esports: "/esports-auction-system",
  "Corporate Leagues": "/business-league-auction",
};
