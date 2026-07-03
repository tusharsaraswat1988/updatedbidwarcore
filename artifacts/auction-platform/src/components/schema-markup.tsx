import { useBranding } from "@/hooks/use-branding";
import { getOrganizationLogoUrl } from "@/lib/brand-assets";
const SOFTWARE_APPLICATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "BidWar",
  "alternateName": "BidWar Sports Auction Platform",
  "description": "India's live sports auction platform. IPL-grade auction infrastructure for cricket, football, kabaddi and all franchise leagues. Real-time bidding, LED broadcast display, team owner mobile panels.",
  "url": "https://bidwar.in",
  "applicationCategory": "SportsApplication",
  "applicationSubCategory": "Sports Auction Software",
  "operatingSystem": "Web Browser",
  "browserRequirements": "Requires JavaScript. Works on all modern browsers.",
  "softwareVersion": "3.0",
  "releaseNotes": "Supports cricket, football, kabaddi, esports and business leagues.",
  "countriesSupported": "IN",
  "inLanguage": "en-IN",
  "offers": [
    {
      "@type": "Offer",
      "name": "Free Trial",
      "price": "0",
      "priceCurrency": "INR",
      "description": "Free forever plan — up to 2 teams per tournament.",
      "availability": "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      "name": "Starter",
      "price": "5000",
      "priceCurrency": "INR",
      "description": "Up to 4 teams per tournament.",
      "availability": "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      "name": "Pro",
      "price": "6000",
      "priceCurrency": "INR",
      "description": "Up to 8 teams per tournament.",
      "availability": "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      "name": "Advanced",
      "price": "8000",
      "priceCurrency": "INR",
      "description": "Up to 12 teams per tournament.",
      "availability": "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      "name": "Elite",
      "price": "10000",
      "priceCurrency": "INR",
      "description": "Up to 16 teams per tournament.",
      "availability": "https://schema.org/InStock",
    },
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "500",
    "bestRating": "5",
    "worstRating": "1",
  },
  "author": {
    "@type": "Organization",
    "name": "BidWar",
    "url": "https://bidwar.in",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-8707488250",
      "contactType": "customer support",
      "availableLanguage": ["English", "Hindi"],
      "contactOption": "TollFree",
    },
  },
  "featureList": [
    "Live real-time bidding",
    "LED broadcast display",
    "Team owner mobile bidding panels",
    "Broadcast Overlay for live streaming",
    "Player self-registration via QR code",
    "Auction analytics and reports",
    "Fortune wheel for tiebreakers",
    "Multi-screen simultaneous support",
    "IPL-style player categories",
    "Team purse management",
  ],
  "screenshot": "https://bidwar.in/bidwar-screenshot.png",
  "sameAs": [
    "https://www.instagram.com/bidwar.in",
    "https://www.facebook.com/bidwar.in",
    "https://www.youtube.com/@bidwarofficial",
  ],
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is sports auction software?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sports auction software is a digital platform that enables tournament organizers to conduct live player auctions for franchise-based leagues. It manages team rosters, bidding rounds, purse limits, player categories, and real-time bid tracking — replacing manual auction boards with a fully automated, broadcast-ready system.",
      },
    },
    {
      "@type": "Question",
      "name": "How does cricket auction software work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The auction operator controls the session from a central dashboard — selecting players, starting bid timers, and accepting bids from team owners. Team owners bid from their phones via a dedicated panel. The LED display shows live action on a projector or TV for the audience. Everything syncs in real time.",
      },
    },
    {
      "@type": "Question",
      "name": "Can BidWar run IPL-style auctions?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. BidWar is purpose-built for IPL-style franchise auctions. It supports player categories (Platinum, Gold, Silver, Emerging), team purse tracking, reserve prices, configurable bid increments, and a broadcast-quality LED display — the same format used in professional leagues.",
      },
    },
    {
      "@type": "Question",
      "name": "Does BidWar support projector and LED screens?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. BidWar includes a dedicated full-screen LED Display Mode for large projectors and smart TVs. It features animated player cards, live bid counters, a SOLD stamp animation, team purse strips, and sponsor logo rotation — all in broadcast-quality resolution.",
      },
    },
    {
      "@type": "Question",
      "name": "Is BidWar cloud-based?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. BidWar is fully cloud-based. The operator dashboard, team owner panels, and LED display all run in a browser — no downloads or installations required. All bid data syncs in real time across all connected devices from any location.",
      },
    },
    {
      "@type": "Question",
      "name": "Is BidWar suitable for local tournaments?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolutely. BidWar scales from 2-team club auctions to 16-team state-level franchise leagues. The free trial plan supports 2 teams at no cost, making it ideal for first-time organizers and small community tournaments.",
      },
    },
    {
      "@type": "Question",
      "name": "Can multiple team owners bid simultaneously?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Each team owner gets their own dedicated mobile bidding panel accessible from any smartphone. Multiple owners can see and place bids simultaneously during a live session — the system handles all bids in real time with instant updates for everyone.",
      },
    },
    {
      "@type": "Question",
      "name": "Does BidWar support YouTube or Facebook Live streaming?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. BidWar includes a browser-source Broadcast Overlay (OBS, vMix, Wirecast, and more) that shows the player photo, live bid amount, team ticker, and bid bar directly in your YouTube or Facebook Live broadcast — giving your event a professional production quality.",
      },
    },
    {
      "@type": "Question",
      "name": "How much does BidWar cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "BidWar uses one-time per-tournament pricing — no monthly fees. Plans start free (2 teams), then ₹5,000 for Starter (4 teams), ₹6,000 for Pro (8 teams), ₹8,000 for Advanced (12 teams), and ₹10,000 for Elite (16 teams). All prices are per auction event.",
      },
    },
    {
      "@type": "Question",
      "name": "Which sports does BidWar support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "BidWar supports all franchise-style sports including cricket, football, kabaddi, basketball, volleyball, esports, and business/corporate leagues. Any sport where players are auctioned to teams with a budget can be run on BidWar.",
      },
    },
  ],
};

const ORGANIZATION_SCHEMA_BASE = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "BidWar",
  "url": "https://bidwar.in",
  "description": "India's live sports auction platform for cricket, football, kabaddi and franchise leagues.",
  "foundingLocation": {
    "@type": "Place",
    "addressLocality": "Varanasi",
    "addressRegion": "Uttar Pradesh",
    "addressCountry": "IN",
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+91-8707488250",
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
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "BidWar",
  "url": "https://bidwar.in",
  "description": "India's live sports auction platform. Run IPL-style cricket, football and kabaddi auctions with real-time bidding, LED display and mobile owner panels.",
  "inLanguage": "en-IN",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://bidwar.in/?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data, null, 0) }}
    />
  );
}

export function HomeSchemaMarkup() {
  const { iconVersion } = useBranding();
  const logoUrl = getOrganizationLogoUrl(iconVersion);
  const organizationSchema = {
    ...ORGANIZATION_SCHEMA_BASE,
    logo: logoUrl,
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      SOFTWARE_APPLICATION_SCHEMA,
      organizationSchema,
      WEBSITE_SCHEMA,
    ],
  };
  return <JsonLd data={graph} />;
}

export function SportLandingSchemaMarkup({
  name,
  url,
  description,
  faqs,
}: {
  name: string;
  url: string;
  description: string;
  faqs: Array<{ q: string; a: string }>;
}) {
  const { iconVersion } = useBranding();
  const logoUrl = getOrganizationLogoUrl(iconVersion);
  const organizationSchema = {
    ...ORGANIZATION_SCHEMA_BASE,
    logo: logoUrl,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a,
      },
    })),
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": `BidWar — ${name}`,
    "description": description,
    "url": url,
    "applicationCategory": "SportsApplication",
    "operatingSystem": "Web Browser",
    "countriesSupported": "IN",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "INR",
      "description": "Free trial available.",
    },
    "author": {
      "@type": "Organization",
      "name": "BidWar",
      "url": "https://bidwar.in",
    },
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      faqSchema,
      softwareSchema,
      organizationSchema,
    ],
  };

  return <JsonLd data={graph} />;
}
