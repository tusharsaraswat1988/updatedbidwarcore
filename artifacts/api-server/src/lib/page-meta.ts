/**
 * Server-side page metadata registry.
 *
 * Every public marketing page has a canonical entry here. The Express
 * html-meta-injector reads this table and injects the correct <title>,
 * <meta>, canonical, OG/Twitter tags, and JSON-LD schemas into index.html
 * before sending it — so social crawlers and bots that don't execute JS
 * see the right metadata immediately.
 *
 * App pages (/tournament/*, /admin/*, /organizer/*) are intentionally absent;
 * they are served with the generic index.html shell.
 *
 * Registration pages (/register/:code) are resolved dynamically via
 * registration-page-meta.ts (one tournament lookup, server-injected OG tags).
 *
 * Blog pages (/blog/*) are handled dynamically via getPageMeta() below.
 */
import { resolvePlatformPrimaryLogoUrl } from "@workspace/api-base/branding-assets";
import {
  BLOG_POSTS_META,
  BLOG_CATEGORIES,
  BLOG_AUTHORS,
  getPostMetaBySlug,
  getCategoryBySlug,
  getAuthorBySlug,
  getAllBlogUrls,
} from "@workspace/blog-data";
import { getPlatformOpenGraphImageUrl } from "./branding-service.js";

export const BASE_URL = "https://bidwar.in";
export const DEFAULT_OG_IMAGE_URL = resolvePlatformPrimaryLogoUrl(BASE_URL);
const PHONE = "+91-8707488250";

// ─── Shared schema fragments ──────────────────────────────────────────────────

const ORGANIZATION_SCHEMA = {
  "@type": "Organization",
  "name": "BidWar",
  "url": BASE_URL,
  "logo": resolvePlatformPrimaryLogoUrl(BASE_URL),
  "description": "India's live sports auction platform for cricket, football, kabaddi and franchise leagues.",
  "foundingLocation": {
    "@type": "Place",
    "addressLocality": "Varanasi",
    "addressRegion": "Uttar Pradesh",
    "addressCountry": "IN",
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": PHONE,
    "contactType": "customer support",
    "availableLanguage": ["English", "Hindi"],
  },
  "sameAs": [
    "https://www.instagram.com/bidwar.in",
    "https://www.facebook.com/bidwar.in",
    "https://www.youtube.com/@bidwarofficial",
  ],
};

const WEBSITE_SCHEMA = {
  "@type": "WebSite",
  "name": "BidWar",
  "url": BASE_URL,
  "description": "India's live sports auction platform. Run IPL-style cricket, football and kabaddi auctions with real-time bidding, LED display and mobile owner panels.",
  "inLanguage": "en-IN",
  "potentialAction": {
    "@type": "SearchAction",
    "target": { "@type": "EntryPoint", "urlTemplate": `${BASE_URL}/?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

const SOFTWARE_APPLICATION_SCHEMA = {
  "@type": "SoftwareApplication",
  "name": "BidWar",
  "alternateName": "BidWar Sports Auction Platform",
  "description": "India's live sports auction platform. IPL-grade auction infrastructure for cricket, football, kabaddi and all franchise leagues. Real-time bidding, LED broadcast display, team owner mobile panels.",
  "url": BASE_URL,
  "applicationCategory": "SportsApplication",
  "applicationSubCategory": "Sports Auction Software",
  "operatingSystem": "Web Browser",
  "browserRequirements": "Requires JavaScript. Works on all modern browsers.",
  "softwareVersion": "3.0",
  "countriesSupported": "IN",
  "inLanguage": "en-IN",
  "offers": [
    { "@type": "Offer", "name": "Free Trial", "price": "0", "priceCurrency": "INR", "description": "Free forever plan — up to 2 teams per tournament.", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "Starter", "price": "5000", "priceCurrency": "INR", "description": "Up to 4 teams per tournament.", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "Pro", "price": "6000", "priceCurrency": "INR", "description": "Up to 8 teams per tournament.", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "Advanced", "price": "8000", "priceCurrency": "INR", "description": "Up to 12 teams per tournament.", "availability": "https://schema.org/InStock" },
    { "@type": "Offer", "name": "Elite", "price": "10000", "priceCurrency": "INR", "description": "Up to 16 teams per tournament.", "availability": "https://schema.org/InStock" },
  ],
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "500", "bestRating": "5", "worstRating": "1" },
  "author": ORGANIZATION_SCHEMA,
  "featureList": [
    "Live real-time bidding",
    "LED broadcast display",
    "Team owner mobile bidding panels",
    "Broadcast Overlay for live streaming",
    "Player self-registration via QR code",
    "Auction analytics and reports",
    "Fortune wheel for tiebreakers",
    "IPL-style player categories",
    "Team purse management",
  ],
  "screenshot": `${BASE_URL}/bidwar-screenshot.png`,
  "sameAs": [
    "https://www.instagram.com/bidwar.in",
    "https://www.facebook.com/bidwar.in",
    "https://www.youtube.com/@bidwarofficial",
  ],
};

const HOME_FAQ_SCHEMA = {
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What is sports auction software?", "acceptedAnswer": { "@type": "Answer", "text": "Sports auction software is a digital platform that enables tournament organizers to conduct live player auctions for franchise-based leagues. It manages team rosters, bidding rounds, purse limits, player categories, and real-time bid tracking — replacing manual auction boards with a fully automated, broadcast-ready system." } },
    { "@type": "Question", "name": "How does cricket auction software work?", "acceptedAnswer": { "@type": "Answer", "text": "The auction operator controls the session from a central dashboard — selecting players, starting bid timers, and accepting bids from team owners. Team owners bid from their phones via a dedicated panel. The LED display shows live action on a projector or TV for the audience. Everything syncs in real time." } },
    { "@type": "Question", "name": "Can BidWar run IPL-style auctions?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. BidWar is purpose-built for IPL-style franchise auctions. It supports player categories (Platinum, Gold, Silver, Emerging), team purse tracking, reserve prices, configurable bid increments, and a broadcast-quality LED display — the same format used in professional leagues." } },
    { "@type": "Question", "name": "Does BidWar support projector and LED screens?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. BidWar includes a dedicated full-screen LED Display Mode for large projectors and smart TVs. It features animated player cards, live bid counters, a SOLD stamp animation, team purse strips, and sponsor logo rotation — all in broadcast-quality resolution." } },
    { "@type": "Question", "name": "Is BidWar cloud-based?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. BidWar is fully cloud-based. The operator dashboard, team owner panels, and LED display all run in a browser — no downloads or installations required. All bid data syncs in real time across all connected devices from any location." } },
    { "@type": "Question", "name": "Is BidWar suitable for local tournaments?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. BidWar scales from 2-team club auctions to 16-team state-level franchise leagues. The free trial plan supports 2 teams at no cost, making it ideal for first-time organizers and small community tournaments." } },
    { "@type": "Question", "name": "How much does BidWar cost?", "acceptedAnswer": { "@type": "Answer", "text": "BidWar uses one-time per-tournament pricing — no monthly fees. Plans start free (2 teams), then ₹5,000 for Starter (4 teams), ₹6,000 for Pro (8 teams), ₹8,000 for Advanced (12 teams), and ₹10,000 for Elite (16 teams). All prices are per auction event and activate an Auction License for the BidWar Auction Module only." } },
    { "@type": "Question", "name": "What is included in a BidWar Auction License?", "acceptedAnswer": { "@type": "Answer", "text": "An Auction License covers the BidWar Auction Module for one tournament — including one auction purse, unlimited player categories and registrations, and complete auction management up to your plan's team limit. It does not include Sports Scoring, match management, fixtures, live scoring, points tables, statistics, or live streaming. Those require a separate Sports Scoring License." } },
    { "@type": "Question", "name": "Which sports does BidWar support?", "acceptedAnswer": { "@type": "Answer", "text": "BidWar supports all franchise-style sports including cricket, football, kabaddi, basketball, volleyball, badminton, esports, and business/corporate leagues. Any sport where players are auctioned to teams with a budget can be run on BidWar." } },
  ],
};

function breadcrumb(name: string, url: string) {
  return {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
      { "@type": "ListItem", "position": 2, "name": name, "item": url },
    ],
  };
}

function sportSoftwareSchema(name: string, description: string, url: string) {
  return {
    "@type": "SoftwareApplication",
    "name": `BidWar — ${name}`,
    "description": description,
    "url": url,
    "applicationCategory": "SportsApplication",
    "operatingSystem": "Web Browser",
    "countriesSupported": "IN",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR", "description": "Free trial available — up to 2 teams." },
    "author": { "@type": "Organization", "name": "BidWar", "url": BASE_URL },
  };
}

function sportFaq(faqs: Array<{ q: string; a: string }>) {
  return {
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };
}

function graph(...items: object[]) {
  return { "@context": "https://schema.org", "@graph": items };
}

// ─── PageMeta type ────────────────────────────────────────────────────────────

/** Extensible registration-specific fields for future OG additions (deadline, city, etc.). */
export interface RegistrationMetaFields {
  tournamentName: string;
  sport?: string | null;
  venue?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  organizerName?: string | null;
  registrationCode?: string | null;
  registrationDeadline?: string | null;
}

export interface PageMeta {
  title: string;
  description: string;
  /** When omitted and omitCanonical is not set, canonical is still emitted from this value. */
  canonical?: string;
  /** When true, no <link rel="canonical"> is emitted (404 and private app pages). */
  omitCanonical?: boolean;
  robots?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  schemas?: object[];
  /** Present only for /register/:code pages — not emitted into HTML directly. */
  registration?: RegistrationMetaFields;
}

// ─── Static marketing pages ───────────────────────────────────────────────────

const STATIC_PAGES: Record<string, PageMeta> = {
  "/": {
    title: "BidWar | IPL-Style Live Sports Auction Software",
    description: "Host a grand tournament auction with BidWar. India's premium live auction software featuring real-time bidding and big-screen LED display for Cricket, Football, Kabaddi, Badminton, Basketball, and corporate leagues.",
    canonical: `${BASE_URL}/`,
    keywords: "sports auction software, cricket auction software, IPL style auction, live player auction platform, franchise auction system, tournament management software India, digital sports auction, real-time bidding software, cricket league auction",
    ogTitle: "BidWar — Live Sports Auction Software | Run IPL-Style Player Auctions",
    ogDescription: "Run professional IPL-style player auctions live. Real-time bidding, LED broadcast display, team owner mobile panel, Broadcast Overlay. Built for cricket, football, kabaddi and franchise leagues across India.",
    schemas: [graph(SOFTWARE_APPLICATION_SCHEMA, ORGANIZATION_SCHEMA, WEBSITE_SCHEMA, HOME_FAQ_SCHEMA)],
  },

  "/upcoming-auctions": {
    title: "Upcoming Live Sports Auctions in India | BidWar",
    description: "Browse upcoming IPL-style sports auctions powered by BidWar across India. Cricket, football, kabaddi franchise auctions — register as a player or follow your team's auction live.",
    canonical: `${BASE_URL}/upcoming-auctions`,
    keywords: "upcoming cricket auctions, upcoming sports auctions India, live auction events, franchise player auction schedule, cricket league auction dates",
    ogTitle: "Upcoming Live Sports Auctions | BidWar Platform",
    ogDescription: "Discover live franchise player auctions happening across India. Cricket, football, kabaddi, and more — powered by BidWar.",
    schemas: [graph(ORGANIZATION_SCHEMA, {
      "@type": "WebPage",
      "name": "Upcoming Live Sports Auctions",
      "url": `${BASE_URL}/upcoming-auctions`,
      "description": "Browse upcoming IPL-style sports auctions powered by BidWar across India.",
      "isPartOf": { "@type": "WebSite", "url": BASE_URL },
      "breadcrumb": breadcrumb("Upcoming Auctions", `${BASE_URL}/upcoming-auctions`),
    })],
  },

  "/contact": {
    title: "Contact BidWar | Sports Auction Software Support & Demo",
    description: "Get in touch with BidWar for auction software demos, setup help, pricing, or technical support. Reach us on WhatsApp, email, or phone — we respond same day.",
    canonical: `${BASE_URL}/contact`,
    keywords: "contact BidWar, auction software support, BidWar demo, BidWar pricing, auction software India contact",
    ogTitle: "Contact BidWar | Same-Day Auction Software Support",
    ogDescription: "Reach the BidWar team for demos, pricing, or event setup assistance. WhatsApp, email, and phone support available.",
    schemas: [graph(ORGANIZATION_SCHEMA, {
      "@type": "ContactPage",
      "name": "Contact BidWar",
      "url": `${BASE_URL}/contact`,
      "description": "Contact the BidWar team for sports auction software support, demos, and pricing.",
      "isPartOf": { "@type": "WebSite", "url": BASE_URL },
    })],
  },

  "/auction-tips": {
    title: "Sports Auction Tips & Best Practices | BidWar",
    description: "Expert tips for running successful IPL-style sports player auctions — purse planning, category setup, LED display, owner panels, and auction-day checklist.",
    canonical: `${BASE_URL}/auction-tips`,
    keywords: "sports auction tips, cricket auction guide, player auction best practices, franchise auction checklist, auction day tips India",
    ogTitle: "Sports Auction Tips & Best Practices | BidWar",
    ogDescription: "Practical auction tips for organizers running franchise player auctions with BidWar.",
    schemas: [graph(ORGANIZATION_SCHEMA, {
      "@type": "WebPage",
      "name": "Sports Auction Tips",
      "url": `${BASE_URL}/auction-tips`,
      "description": "Tips and best practices for running live sports player auctions.",
      "isPartOf": { "@type": "WebSite", "url": BASE_URL },
      "breadcrumb": breadcrumb("Auction Tips", `${BASE_URL}/auction-tips`),
    })],
  },

  "/legal": {
    title: "Legal Policies | BidWar Sports Auction Platform",
    description: "Read BidWar legal documents including Terms & Conditions, Privacy Policy, Acceptable Use, Disclaimer, and Refund Policy.",
    canonical: `${BASE_URL}/legal`,
    robots: "index, follow",
    schemas: [graph({
      "@type": "CollectionPage",
      "name": "BidWar Legal Policies",
      "url": `${BASE_URL}/legal`,
      "description": "Central legal hub for BidWar policies and platform compliance documents.",
      "isPartOf": { "@type": "WebSite", "url": BASE_URL },
      "breadcrumb": breadcrumb("Legal Policies", `${BASE_URL}/legal`),
    })],
  },

  "/legal/terms": {
    title: "Terms of Service | BidWar Sports Auction Platform",
    description: "BidWar Terms of Service — the legal agreement governing your use of BidWar auction software and platform services, including Auction License scope and exclusions.",
    canonical: `${BASE_URL}/legal/terms`,
    robots: "index, follow",
    schemas: [],
  },

  "/legal/licensing": {
    title: "Licensing Policy | BidWar Auction & Sports Scoring Licenses",
    description: "BidWar Licensing Policy — what an Auction License includes and excludes, team limits, and how Auction Licenses differ from Sports Scoring Licenses.",
    canonical: `${BASE_URL}/legal/licensing`,
    robots: "index, follow",
    schemas: [],
  },

  "/legal/privacy": {
    title: "Privacy Policy | BidWar Sports Auction Platform",
    description: "BidWar Privacy Policy — how we collect, use, and protect your personal data when you use BidWar auction software.",
    canonical: `${BASE_URL}/legal/privacy`,
    robots: "index, follow",
    schemas: [],
  },

  "/legal/acceptable-use": {
    title: "Acceptable Use Policy | BidWar Sports Auction Platform",
    description: "BidWar Acceptable Use Policy — guidelines for appropriate use of BidWar's auction platform and related services.",
    canonical: `${BASE_URL}/legal/acceptable-use`,
    robots: "index, follow",
    schemas: [],
  },

  "/legal/disclaimer": {
    title: "Disclaimer | BidWar Sports Auction Platform",
    description: "BidWar Disclaimer covering platform limitations, third-party dependencies, and liability boundaries.",
    canonical: `${BASE_URL}/legal/disclaimer`,
    robots: "index, follow",
    schemas: [],
  },

  "/legal/refund": {
    title: "Refund Policy | BidWar Sports Auction Platform",
    description: "BidWar Refund & Cancellation Policy for subscriptions, onboarding fees, and payment transactions.",
    canonical: `${BASE_URL}/legal/refund`,
    robots: "index, follow",
    schemas: [],
  },
};

// ─── SEO landing pages ────────────────────────────────────────────────────────

const SEO_LANDING_PAGES: Record<string, PageMeta> = {
  "/cricket-auction-software": {
    title: "Cricket Auction Software | IPL-Style Player Auction Platform — BidWar",
    description: "Run professional cricket player auctions with BidWar — IPL-style categories, team purse limits, LED broadcast display, and mobile owner panels. Free trial for 2 teams. No credit card.",
    canonical: `${BASE_URL}/cricket-auction-software`,
    keywords: "cricket auction software, IPL style auction software, cricket player auction platform, T20 league auction, local cricket auction India, franchise cricket auction",
    ogTitle: "Cricket Auction Software — IPL-Style Player Bidding | BidWar",
    ogDescription: "Run IPL-format cricket player auctions with Platinum-to-Emerging categories, team purse tracking, LED display, and one-tap mobile bidding. Free trial included.",
    schemas: [graph(
      sportSoftwareSchema("Cricket Auction Software", "IPL-style cricket player auction platform with real-time bidding, LED broadcast display, and team owner mobile panels.", `${BASE_URL}/cricket-auction-software`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Cricket Auction Software", `${BASE_URL}/cricket-auction-software`),
      sportFaq([
        { q: "What is cricket auction software?", a: "Cricket auction software is a digital platform that lets tournament organisers run live IPL-style player auctions. It handles player categories (Platinum, Gold, Silver, Emerging), team purse limits, real-time bidding from team owners on their phones, an LED broadcast display for the audience, and a complete auction report. BidWar runs everything from a browser — no installation needed." },
        { q: "Can I run IPL-style player categories?", a: "Yes. BidWar supports up to 8 custom player categories — Platinum, Gold, Silver, Emerging, or any names you choose. Each category has its own minimum bid price and bid increment. The system also enforces squad composition rules during live bidding." },
        { q: "How many teams can BidWar handle?", a: "BidWar scales from 2 teams (free trial) to 30 teams on the Champion plan. Starter (4 teams) costs ₹5,000, Pro (8 teams) costs ₹6,000, Advanced (12 teams) costs ₹8,000, Elite (16 teams) costs ₹10,000. All are one-time per-tournament fees — no monthly subscription." },
        { q: "Can team owners bid from their mobile phones?", a: "Yes. Each team owner gets a private Owner Panel link. Opening it on any Android or iPhone browser shows them the current player, live bid, remaining budget, and a large BID button. No app download needed. Multiple owners can bid simultaneously in real time." },
      ]),
    )],
  },

  "/football-player-auction": {
    title: "Football Player Auction Software | Live Franchise Bidding — BidWar",
    description: "Run live football player auctions with BidWar — position-based categories, team budgets, mobile owner panels, and broadcast LED display. Free trial available. No credit card.",
    canonical: `${BASE_URL}/football-player-auction`,
    keywords: "football player auction software, football franchise auction India, ISL style auction, football league bidding, local football auction platform",
    ogTitle: "Football Player Auction Software — Franchise Bidding | BidWar",
    ogDescription: "Live football franchise auctions with position-based categories, team budgets, and broadcast-quality LED display. Mobile bidding for all team owners. Free trial.",
    schemas: [graph(
      sportSoftwareSchema("Football Player Auction", "Live football franchise player auction platform with position-based categories, mobile bidding, and broadcast LED display.", `${BASE_URL}/football-player-auction`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Football Player Auction", `${BASE_URL}/football-player-auction`),
      sportFaq([
        { q: "How does football player auction software work?", a: "Football auction software lets organisers run live franchise player bidding sessions. Players are categorised by position (goalkeeper, defender, midfielder, forward), and team owners bid from their smartphones. A broadcast display shows live action to the venue audience." },
        { q: "Can I set squad composition rules for football?", a: "Yes. BidWar lets you set squad quotas — for example, 'minimum 1 goalkeeper, maximum 3 forwards per team'. The system enforces these limits live during bidding, preventing overstacked squads automatically." },
        { q: "Is BidWar suitable for 5-a-side and futsal leagues?", a: "Yes. BidWar scales from small 4-team futsal events to 16-team ISL-style championships. Custom position categories work for any football format including 5-a-side, 7-a-side, or full 11-a-side." },
      ]),
    )],
  },

  "/kabaddi-auction-platform": {
    title: "Kabaddi Auction Platform | PKL-Style Player Bidding — BidWar",
    description: "Professional kabaddi auction platform for PKL-style franchise leagues. Raider, defender, and all-rounder categories, live bidding, LED broadcast display, and team owner mobile panels. Free trial.",
    canonical: `${BASE_URL}/kabaddi-auction-platform`,
    keywords: "kabaddi auction platform, PKL style auction software, kabaddi player auction India, kabaddi franchise league, Pro Kabaddi League auction software",
    ogTitle: "Kabaddi Auction Platform — PKL-Style Franchise Bidding | BidWar",
    ogDescription: "Run PKL-format kabaddi player auctions with raider, defender, all-rounder categories, squad quotas, LED display, and mobile owner bidding. Free trial.",
    schemas: [graph(
      sportSoftwareSchema("Kabaddi Auction Platform", "PKL-style kabaddi franchise player auction platform with raider/defender categories, squad enforcement, and broadcast display.", `${BASE_URL}/kabaddi-auction-platform`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Kabaddi Auction Platform", `${BASE_URL}/kabaddi-auction-platform`),
      sportFaq([
        { q: "Can BidWar replicate the PKL auction format?", a: "Yes. BidWar mirrors the PKL format with raider, defender, and all-rounder categories, each with custom base prices and bid increments. Squad composition rules (e.g., minimum 3 raiders per team) are enforced live during bidding." },
        { q: "Does BidWar work for local kabaddi tournaments in smaller towns?", a: "Absolutely. BidWar requires only a browser and internet — no software installation. The free trial supports 2-team auctions at zero cost, making it accessible for district-level and community kabaddi events anywhere in India." },
      ]),
    )],
  },

  "/esports-auction-system": {
    title: "Esports Auction System | Live Player Bidding for Gaming Leagues — BidWar",
    description: "Run live esports player auctions for gaming franchise leagues with BidWar. Role-based categories (IGL, fragger, support, AWPer), team budgets, mobile bidding, and broadcast overlay. Free trial.",
    canonical: `${BASE_URL}/esports-auction-system`,
    keywords: "esports auction system, esports player auction software, gaming league auction, BGMI auction, Valorant franchise auction, esports tournament India",
    ogTitle: "Esports Auction System — Live Gaming Franchise Bidding | BidWar",
    ogDescription: "Esports franchise player auctions with role-based categories (IGL, fragger, support), mobile bidding, YouTube Live overlay, and real-time broadcast display.",
    schemas: [graph(
      sportSoftwareSchema("Esports Auction System", "Live esports franchise player auction system with role-based categories, mobile bidding, and broadcast overlay for gaming leagues.", `${BASE_URL}/esports-auction-system`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Esports Auction System", `${BASE_URL}/esports-auction-system`),
    )],
  },

  "/business-league-auction": {
    title: "Business League Auction Software | Corporate Sports Franchise Bidding — BidWar",
    description: "Professional corporate sports league auction software. Run IPL-style franchise player bidding for corporate cricket, football, and kabaddi events with BidWar. Sponsor branding, live streaming overlay, mobile bidding.",
    canonical: `${BASE_URL}/business-league-auction`,
    keywords: "corporate sports auction, business league auction software, corporate cricket auction, office sports league bidding, corporate franchise auction India",
    ogTitle: "Business League Auction Software — Corporate Sports Franchise Bidding | BidWar",
    ogDescription: "Corporate sports franchise auctions with sponsor branding, YouTube Live overlay, executive mobile bidding panels, and broadcast-quality LED display.",
    schemas: [graph(
      sportSoftwareSchema("Business League Auction", "Corporate and business league franchise player auction platform with sponsor branding, live streaming support, and mobile bidding.", `${BASE_URL}/business-league-auction`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Business League Auction", `${BASE_URL}/business-league-auction`),
    )],
  },

  "/live-player-bidding": {
    title: "Live Player Bidding Software | Real-Time Sports Auction Platform — BidWar",
    description: "How real-time live player bidding works in BidWar. Sub-second bid sync across all devices, mobile owner panels, LED broadcast display, and undo protection. The technical story behind India's fastest auction platform.",
    canonical: `${BASE_URL}/live-player-bidding`,
    keywords: "live player bidding software, real-time auction platform, sports bidding technology India, live auction sync, sub-second bid updates",
    ogTitle: "Live Player Bidding — How Real-Time Auction Sync Works | BidWar",
    ogDescription: "Sub-second bid sync across operator dashboard, team owner phones, and LED display screens. The technology powering India's live sports auction platform.",
    schemas: [graph(
      sportSoftwareSchema("Live Player Bidding", "Real-time sports player bidding platform with sub-second sync, mobile owner panels, and broadcast LED display for franchise leagues.", `${BASE_URL}/live-player-bidding`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Live Player Bidding", `${BASE_URL}/live-player-bidding`),
    )],
  },

  "/tournament-auction-platform": {
    title: "Tournament Auction Platform | Sports Franchise Bidding Software — BidWar",
    description: "BidWar is India's complete tournament auction platform for all sports — cricket, football, kabaddi, basketball, badminton, volleyball, and corporate leagues. Real-time bidding, LED display, mobile owner panels. Free trial.",
    canonical: `${BASE_URL}/tournament-auction-platform`,
    keywords: "tournament auction platform, sports franchise auction software India, tournament player bidding, franchise auction management, multi-sport auction platform",
    ogTitle: "Tournament Auction Platform — All Sports Franchise Bidding | BidWar",
    ogDescription: "India's complete tournament auction platform for cricket, football, kabaddi, basketball, and more. Real-time bidding, LED display, and mobile owner panels.",
    schemas: [graph(
      SOFTWARE_APPLICATION_SCHEMA,
      ORGANIZATION_SCHEMA,
      breadcrumb("Tournament Auction Platform", `${BASE_URL}/tournament-auction-platform`),
    )],
  },

  "/basketball-auction-software": {
    title: "Basketball Auction Software | Franchise Player Bidding — BidWar",
    description: "Run professional basketball franchise player auctions with BidWar. Position-based categories (guards, forwards, center), team budgets, mobile owner bidding, and broadcast LED display. Free trial for 2 teams.",
    canonical: `${BASE_URL}/basketball-auction-software`,
    keywords: "basketball auction software, basketball franchise auction India, NBA style auction platform, basketball player bidding, corporate basketball league auction",
    ogTitle: "Basketball Auction Software — Franchise Player Bidding | BidWar",
    ogDescription: "Live basketball franchise auctions with position categories (guard, forward, center), team budgets, mobile owner bidding, and broadcast-quality LED display.",
    schemas: [graph(
      sportSoftwareSchema("Basketball Auction Software", "Live basketball franchise player auction platform with position-based categories, mobile bidding panels, and broadcast LED display.", `${BASE_URL}/basketball-auction-software`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Basketball Auction Software", `${BASE_URL}/basketball-auction-software`),
      sportFaq([
        { q: "How does basketball auction software work?", a: "Basketball auction software lets organisers run live franchise player bidding sessions. Players are categorised by position (point guard, shooting guard, small forward, power forward, center), and team owners bid from their smartphones while a broadcast display shows the live action to the audience." },
        { q: "Can I set basketball-specific position categories?", a: "Yes. BidWar lets you create categories for any positions — guards, forwards, centers, or the full 5-position split. You can set minimum and maximum squad counts per position, and the system enforces these limits live during bidding." },
        { q: "Is BidWar suitable for corporate basketball events?", a: "Yes. BidWar is widely used for corporate sports events. It includes sponsor branding support, a YouTube Live broadcast overlay, and a professional LED display — perfect for office basketball tournaments and company sports days." },
      ]),
    )],
  },

  "/badminton-auction-platform": {
    title: "Badminton Auction Platform | Franchise Player Bidding & Scoring — BidWar",
    description: "Run live badminton franchise player auctions with BidWar. Category bidding, team budgets, mobile owner panels, LED display, and built-in badminton scoring system. Free trial for 2 teams.",
    canonical: `${BASE_URL}/badminton-auction-platform`,
    keywords: "badminton auction platform, badminton player auction software, badminton league auction India, badminton franchise bidding, badminton tournament management",
    ogTitle: "Badminton Auction Platform — Franchise Bidding & Live Scoring | BidWar",
    ogDescription: "Live badminton franchise auctions with category bidding, mobile owner panels, LED display, and a built-in badminton scoring system for your league matches.",
    schemas: [graph(
      sportSoftwareSchema("Badminton Auction Platform", "Live badminton franchise player auction platform with category bidding, mobile owner panels, and integrated badminton scoring for league matches.", `${BASE_URL}/badminton-auction-platform`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Badminton Auction Platform", `${BASE_URL}/badminton-auction-platform`),
      sportFaq([
        { q: "Can BidWar run a badminton franchise auction?", a: "Yes. BidWar supports franchise-style badminton player auctions with categories (Men's Singles, Women's Singles, Doubles, Mixed Doubles), team budgets, mobile owner bidding panels, and a broadcast LED display. Setup takes under 15 minutes." },
        { q: "Does BidWar have a built-in badminton scoring system?", a: "Yes. BidWar offers a Sports Scoring module for badminton, licensed separately from the Auction License. With a Sports Scoring License, you can score live matches point-by-point with automatic deuce and game-winning detection on the same platform used for your auction data." },
        { q: "What is included in a BidWar Auction License?", a: "An Auction License covers the BidWar Auction Module for one tournament — including one auction purse, unlimited player categories and registrations, and complete auction management up to your plan's team limit. Sports Scoring requires a separate Sports Scoring License." },
        { q: "Is BidWar suitable for college and club badminton leagues?", a: "Absolutely. BidWar's free trial supports 2-team auctions at no cost. College and club badminton tournaments typically fit the Starter or Pro plan. Setup is simple — no technical knowledge required." },
      ]),
    )],
  },

  "/sports-auction-software": {
    title: "Sports Auction Software | Live Franchise Player Auctions — BidWar",
    description: "Run professional franchise auctions for cricket, football, kabaddi, badminton, basketball and more with BidWar. Real-time bidding, LED display, mobile owner panels. Free trial available.",
    canonical: `${BASE_URL}/sports-auction-software`,
    keywords: "sports auction software, franchise auction software India, live sports player auction, multi-sport auction platform, franchise bidding software",
    ogTitle: "Sports Auction Software — Professional Franchise Auctions | BidWar",
    ogDescription: "One platform for all franchise sports auctions. Cricket, football, kabaddi, badminton, basketball — real-time bidding, LED display, mobile owner panels. Free trial.",
    schemas: [graph(
      sportSoftwareSchema("Sports Auction Software", "India's most complete sports auction platform for franchise leagues — cricket, football, kabaddi, badminton, basketball, and more.", `${BASE_URL}/sports-auction-software`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Sports Auction Software", `${BASE_URL}/sports-auction-software`),
    )],
  },

  "/badminton-scoring-software": {
    title: "Badminton Scoring Software | Live Rally-by-Rally Scoring — BidWar",
    description: "Digital badminton scoring software with live rally-by-rally scoring, LED scoreboards, standings, and tournament management. Works on any device. Free for club events.",
    canonical: `${BASE_URL}/badminton-scoring-software`,
    keywords: "badminton scoring software, live badminton score, badminton tournament scoring, digital badminton scorer, badminton scoreboard India",
    ogTitle: "Badminton Scoring Software — Live Digital Scoring | BidWar",
    ogDescription: "Rally-by-rally live badminton scoring on any device. LED scoreboards, automatic deuce/game detection, standings, and tournament reports.",
    schemas: [graph(
      sportSoftwareSchema("Badminton Scoring Software", "Live rally-by-rally badminton scoring platform with LED scoreboards, standings, and tournament management for clubs and leagues.", `${BASE_URL}/badminton-scoring-software`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Badminton Scoring Software", `${BASE_URL}/badminton-scoring-software`),
      sportFaq([
        { q: "How does BidWar's badminton scoring software work?", a: "The umpire scores each rally on any smartphone browser — no app download needed. Points are instantly displayed on any TV or projector connected to BidWar's LED scoreboard mode. Deuce, game, and match detection is automatic based on BWF rules." },
        { q: "Can I use BidWar for club badminton tournaments?", a: "Yes. BidWar's badminton scoring module is free for small club events. It handles singles, doubles, and mixed doubles — with separate scorecards for each court. Standings update automatically as matches complete." },
        { q: "Does BidWar integrate auction and scoring for badminton leagues?", a: "Yes. BidWar handles the entire lifecycle: franchise player auction, team formation, match scheduling, and live rally-by-rally scoring — all in one platform. Teams created during the auction feed directly into the scoring system." },
      ]),
    )],
  },

  "/franchise-auction-software": {
    title: "Franchise Auction Software | Automated Franchise Player Bidding — BidWar",
    description: "Conduct professional franchise-based player auctions with automated bidding workflows, real-time updates, and broadcast-quality LED display. Free trial for 2 teams.",
    canonical: `${BASE_URL}/franchise-auction-software`,
    keywords: "franchise auction software, franchise player bidding, franchise league auction India, IPL franchise auction platform, automated franchise bidding",
    ogTitle: "Franchise Auction Software — Automated Player Bidding | BidWar",
    ogDescription: "Professional franchise player auctions with automated bidding workflows, purse tracking, category-based bidding, and broadcast LED display. Free trial available.",
    schemas: [graph(
      sportSoftwareSchema("Franchise Auction Software", "Professional franchise-based sports player auction platform with automated bidding, purse tracking, and broadcast LED display for all sports.", `${BASE_URL}/franchise-auction-software`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Franchise Auction Software", `${BASE_URL}/franchise-auction-software`),
    )],
  },

  "/player-auction-software": {
    title: "Player Auction Software | Digital Sports Player Bidding Platform — BidWar",
    description: "Digitize player auctions for sports leagues with automated bidding, team budgets, live auction controls, and mobile owner panels. Works for all sports. Free trial available.",
    canonical: `${BASE_URL}/player-auction-software`,
    keywords: "player auction software, sports player auction platform India, digital player bidding, player auction management, live player auction software",
    ogTitle: "Player Auction Software — Digital Player Bidding for Sports Leagues | BidWar",
    ogDescription: "Run live player auctions with automated bidding, team budget management, mobile owner panels, and broadcast display. Free trial for 2 teams.",
    schemas: [graph(
      sportSoftwareSchema("Player Auction Software", "Digital sports player auction platform with automated bidding workflows, team budget management, and live broadcast display for franchise leagues.", `${BASE_URL}/player-auction-software`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Player Auction Software", `${BASE_URL}/player-auction-software`),
    )],
  },

  "/sports-league-management-software": {
    title: "Sports League Management Software | Registrations, Auctions, Scoring — BidWar",
    description: "Manage registrations, player auctions, live scoring, standings, and tournament operations from one platform. BidWar's league management software supports all sports.",
    canonical: `${BASE_URL}/sports-league-management-software`,
    keywords: "sports league management software, league management platform India, sports tournament management, online league software, cricket league management system",
    ogTitle: "Sports League Management Software — Full Season Operations | BidWar",
    ogDescription: "One platform for the full league season: registrations, auctions, scheduling, live scoring, standings, and end-of-season reports. All sports supported.",
    schemas: [graph(
      sportSoftwareSchema("Sports League Management Software", "End-to-end sports league management platform for registrations, franchise auctions, match scheduling, live scoring, and standings.", `${BASE_URL}/sports-league-management-software`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Sports League Management Software", `${BASE_URL}/sports-league-management-software`),
      sportFaq([
        { q: "What does BidWar's sports league management software include?", a: "BidWar covers the full league lifecycle: player registrations via QR code, franchise player auctions with live bidding, match scheduling, live scoring (including badminton rally-by-rally), standings calculation, and end-of-season reports with export options." },
        { q: "Which sports does the league management platform support?", a: "BidWar supports cricket, football, kabaddi, badminton, basketball, volleyball, throwball, futsal, and corporate multi-sport events. Each sport uses sport-specific player categories, scoring rules, and display configurations." },
        { q: "Can I run both the auction and the league season on BidWar?", a: "Yes. BidWar integrates the auction and league management into one platform. The teams built during the franchise auction become the squads used in the league season — no duplicate data entry. The same organizer dashboard manages both phases." },
      ]),
    )],
  },

  "/volleyball-player-auction": {
    title: "Volleyball Player Auction Software | Franchise Bidding Platform — BidWar",
    description: "Run professional volleyball franchise player auctions with BidWar. Position categories (setter, libero, hitter, blocker), team budgets, mobile owner panels, and broadcast LED display. Free trial.",
    canonical: `${BASE_URL}/volleyball-player-auction`,
    keywords: "volleyball player auction software, volleyball franchise auction India, volleyball league bidding, corporate volleyball auction, volleyball tournament auction platform",
    ogTitle: "Volleyball Player Auction Software — Franchise Bidding | BidWar",
    ogDescription: "Live volleyball franchise auctions with position categories (setter, libero, outside hitter, middle blocker), team budgets, mobile owner bidding, and broadcast LED display.",
    schemas: [graph(
      sportSoftwareSchema("Volleyball Player Auction", "Live volleyball franchise player auction platform with position-based categories, mobile bidding, and broadcast LED display.", `${BASE_URL}/volleyball-player-auction`),
      ORGANIZATION_SCHEMA,
      breadcrumb("Volleyball Player Auction", `${BASE_URL}/volleyball-player-auction`),
      sportFaq([
        { q: "How does volleyball player auction software work?", a: "Volleyball auction software lets organisers run live franchise player bidding sessions categorised by position (setter, libero, outside hitter, opposite hitter, middle blocker). Team owners bid from their smartphones while a broadcast display shows the live action to the audience. BidWar handles player categories, budgets, bid logging, and post-auction reports from one browser-based platform." },
        { q: "Can I set volleyball position-based squad rules?", a: "Yes. BidWar supports position-based player categories with squad quotas. You can require 'at least 1 setter and 1 libero per team' and the system enforces these limits automatically during the live auction. This prevents unbalanced squads and keeps the auction format structured." },
        { q: "Is BidWar suitable for college volleyball tournaments?", a: "Yes. BidWar's free trial is available at zero cost, and most college volleyball franchise events fit the Starter or Pro plan. The platform runs in any browser with no software installation, making it accessible for university sports committees." },
      ]),
    )],
  },
};

// ─── Public lookup function ───────────────────────────────────────────────────

function withPlatformOgImage(meta: PageMeta): PageMeta {
  if (meta.ogImage) return meta;
  const platformOg = getPlatformOpenGraphImageUrl();
  return platformOg ? { ...meta, ogImage: platformOg } : meta;
}

/**
 * Returns page-specific metadata for a given URL pathname, or null if the
 * page is an app page (tournament, admin, organizer) that should receive the
 * generic index.html shell without meta injection.
 */
export function getPageMeta(pathname: string): PageMeta | null {
  // Exact match for static pages
  const staticMatch = STATIC_PAGES[pathname];
  if (staticMatch) return withPlatformOgImage(staticMatch);

  // Exact match for SEO landing pages
  const seoMatch = SEO_LANDING_PAGES[pathname];
  if (seoMatch) return withPlatformOgImage(seoMatch);

  // Pattern match for /legal/:slug — unknown slugs return null (404)
  const legalMatch = pathname.match(/^\/legal\/([a-z-]+)$/);
  if (legalMatch) {
    const slug = legalMatch[1]!;
    const knownLegal = STATIC_PAGES[`/legal/${slug}`];
    if (knownLegal) return withPlatformOgImage(knownLegal);
    return null;
  }

  // ── Blog pages ──────────────────────────────────────────────────────────────

  // /blog — listing page
  if (pathname === "/blog") {
    return withPlatformOgImage({
      title: "BidWar Blog — Sports Auction Guides, Tips & Platform Walkthroughs",
      description: "Practical guides for franchise league organisers: how to run auctions, configure BidWar, stream live, and manage sports events. Covers cricket, football, kabaddi, and more.",
      canonical: `${BASE_URL}/blog`,
      ogTitle: "BidWar Blog — Sports Auction Guides & Tips",
      ogDescription: "Practical guides for franchise league organisers running sports auctions with BidWar.",
      schemas: [
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Blog",
              "name": "BidWar Blog",
              "url": `${BASE_URL}/blog`,
              "description": "Sports auction guides, platform walkthroughs, and organiser tips from BidWar.",
              "publisher": { "@type": "Organization", "name": "BidWar", "url": BASE_URL },
            },
            {
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
              ],
            },
          ],
        },
      ],
    });
  }

  // /blog/:slug — individual article
  const articleMatch = pathname.match(/^\/blog\/([a-z0-9-]+)$/);
  if (articleMatch) {
    const slug = articleMatch[1];
    const post = getPostMetaBySlug(slug);
    if (post) {
      const category = getCategoryBySlug(post.category);
      return withPlatformOgImage({
        title: `${post.title} — BidWar Blog`,
        description: post.description,
        canonical: post.canonical,
        ogTitle: post.title,
        ogDescription: post.description,
        ...(post.heroImage ? { ogImage: post.heroImage } : {}),
        schemas: [
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BlogPosting",
                headline: post.title,
                description: post.description,
                url: post.canonical,
                datePublished: post.publishedAt,
                dateModified: post.updatedAt ?? post.publishedAt,
                inLanguage: "en-IN",
                publisher: { "@type": "Organization", name: "BidWar", url: BASE_URL },
                isPartOf: { "@type": "Blog", name: "BidWar Blog", url: `${BASE_URL}/blog` },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
                  { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
                  ...(category ? [{ "@type": "ListItem", position: 3, name: category.name, item: `${BASE_URL}/blog/category/${category.slug}` }] : []),
                  { "@type": "ListItem", position: category ? 4 : 3, name: post.title, item: post.canonical },
                ],
              },
            ],
          },
        ],
      });
    }
  }

  // /blog/category/:slug
  const categoryMatch = pathname.match(/^\/blog\/category\/([a-z0-9-]+)$/);
  if (categoryMatch) {
    const slug = categoryMatch[1];
    const category = getCategoryBySlug(slug);
    if (category) {
      return withPlatformOgImage({
        title: `${category.name} — BidWar Blog`,
        description: category.description,
        canonical: `${BASE_URL}/blog/category/${slug}`,
        ogTitle: `${category.name} — BidWar Blog`,
        ogDescription: category.description,
        schemas: [],
      });
    }
  }

  // /blog/author/:slug
  const authorMatch = pathname.match(/^\/blog\/author\/([a-z0-9-]+)$/);
  if (authorMatch) {
    const slug = authorMatch[1];
    const author = getAuthorBySlug(slug);
    if (author) {
      return withPlatformOgImage({
        title: `${author.name} — BidWar Blog`,
        description: author.bio,
        canonical: `${BASE_URL}/blog/author/${slug}`,
        ogTitle: `Articles by ${author.name} — BidWar Blog`,
        ogDescription: author.bio,
        schemas: [],
      });
    }
  }

  // /blog/tag/:slug — generic
  const tagMatch = pathname.match(/^\/blog\/tag\/([a-z0-9-]+)$/);
  if (tagMatch) {
    const slug = tagMatch[1];
    return withPlatformOgImage({
      title: `#${slug} Articles — BidWar Blog`,
      description: `Sports auction articles tagged with "${slug}" on the BidWar Blog.`,
      canonical: `${BASE_URL}/blog/tag/${slug}`,
      schemas: [],
    });
  }

  return null;
}

/**
 * All public marketing page paths (for sitemap generation and route registration).
 */
export const ALL_PUBLIC_PATHS = [
  ...Object.keys(STATIC_PAGES),
  ...Object.keys(SEO_LANDING_PAGES),
];

/** All blog URLs for sitemap — re-exported from shared blog-data package. */
export { getAllBlogUrls };
