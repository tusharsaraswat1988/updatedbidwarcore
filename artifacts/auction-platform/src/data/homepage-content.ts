/**
 * Homepage content — data-driven configuration for the marketing homepage.
 *
 * Phase 1: media fields are placeholders (`null`). Phase 2: swap URLs in this
 * file only — components and layouts stay unchanged.
 *
 * See `docs/homepage-content-guide.md` for which export drives which section.
 */

// ─── Shared media (screenshot + video ready) ────────────────────────────────

/**
 * Future-proof media asset used by Featured Tournament, Production Gallery,
 * Academy, and any screenshot placeholder. Every field is supported today even
 * when unused — Phase 2 fills values without component changes.
 */
export type HomepageMediaAsset = {
  /** Reserved height via CSS aspect-ratio — prevents CLS when assets load. */
  aspectRatio: `${number}/${number}` | "video" | "square" | "4/3" | "16/10";
  caption: string;
  alt: string;
  /** Lightweight preview / card image. */
  thumbnail: string | null;
  /** Full-resolution image (lightbox / detail later). */
  fullImage: string | null;
  /** Optional video — Featured Tournament, Academy, Gallery. */
  videoUrl: string | null;
};

export const ASPECT_RATIO_CLASS: Record<HomepageMediaAsset["aspectRatio"], string> = {
  video: "aspect-video",
  square: "aspect-square",
  "4/3": "aspect-[4/3]",
  "16/10": "aspect-[16/10]",
};

// ─── Gallery categories (filter chips later — do not rename) ────────────────

export const GALLERY_CATEGORIES = [
  "led",
  "operator",
  "audience",
  "owners",
  "obs",
  "stage",
  "trophy",
  "registration",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export const GALLERY_CATEGORY_LABEL: Record<GalleryCategory, string> = {
  led: "LED Screen",
  operator: "Operator",
  audience: "Audience",
  owners: "Team Owners",
  obs: "OBS",
  stage: "Stage",
  trophy: "Trophy",
  registration: "Registration",
};

// ─── Trust Strip ────────────────────────────────────────────────────────────

export type TrustStripItem = {
  label: string;
};

export const TRUST_STRIP_ITEMS: readonly TrustStripItem[] = [
  { label: "Broadcast-Quality LED Display" },
  { label: "Mobile Bidding for Team Owners" },
  { label: "100% Cloud-Based Platform" },
  { label: "Real-Time Bid Sync" },
  { label: "Operator-Controlled Sessions" },
] as const;

// ─── Numbers / Scoreboard stats ─────────────────────────────────────────────

export type NumberStat = {
  value: string;
  label: string;
  sub?: string;
};

export const NUMBERS_STATS: readonly NumberStat[] = [
  { value: "500+", label: "Auctions Completed", sub: "run on BidWar" },
  { value: "10,000+", label: "Players Auctioned", sub: "across every sport" },
  { value: "25+", label: "Cities Served", sub: "across India" },
  { value: "₹50 Cr+", label: "Total Bid Value", sub: "processed live" },
] as const;

// ─── Broadcast Ecosystem — hub + spokes ─────────────────────────────────────

export type EcosystemSpoke = {
  title: string;
  description: string;
  side: "left" | "right";
};

export const BROADCAST_ECOSYSTEM_SPOKES: readonly EcosystemSpoke[] = [
  { title: "Operator Console", description: "Control room laptop or tablet", side: "left" },
  { title: "Team Owner Phones", description: "Bidding from the table", side: "left" },
  { title: "LED Screen", description: "Broadcast-grade display wall", side: "left" },
  { title: "Broadcast Overlay", description: "OBS · YouTube · Facebook Live", side: "right" },
  { title: "Sponsor Branding", description: "Rotating LED bands & overlays", side: "right" },
  { title: "Analytics", description: "CSV exports & dashboards", side: "right" },
] as const;

// ─── Featured Tournament — case study carousel ──────────────────────────────

export type FeaturedTournamentStat = {
  value: string;
  label: string;
};

export type FeaturedTournamentCta = {
  label: string;
  href: string;
  /** Stable analytics id — wire later, do not rename. */
  analyticsId: string;
};

export type FeaturedTournament = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  sportTag: string;
  location: string;
  stats: readonly FeaturedTournamentStat[];
  media: HomepageMediaAsset & { duration?: string };
  cta: FeaturedTournamentCta;
};

export const FEATURED_TOURNAMENTS: readonly FeaturedTournament[] = [
  {
    id: "vnbl3",
    title: "VNBL 3.0",
    subtitle: "Broadcast · Season 3",
    description:
      "Vasai Nalasopara Box League Season 3 — one of Maharashtra's most-watched tape-ball leagues. Ran on BidWar with a live LED wall, multi-camera stream and category-based bidding across 84 players.",
    sportTag: "Cricket · T10",
    location: "Mumbai",
    stats: [
      { value: "8", label: "Teams" },
      { value: "84", label: "Players" },
      { value: "₹40L", label: "Purse" },
      { value: "112", label: "Bids / Min" },
    ],
    media: {
      aspectRatio: "video",
      caption: "Season 3 · Highlight Reel",
      alt: "VNBL 3.0 auction highlight reel placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
      duration: "02:47",
    },
    cta: { label: "Host Your Own Season", href: "/organizer?tab=signup", analyticsId: "case_study_vnbl3_cta" },
  },
  {
    id: "ricl",
    title: "RICL",
    subtitle: "Season 2 · Upcoming",
    description:
      "Regional Inter-City League — 10 franchise teams across Karnataka, with retention and RTM enabled. Season 2's auction runs on the BidWar operator console with an OBS-driven livestream.",
    sportTag: "Cricket · T20",
    location: "Bengaluru",
    stats: [
      { value: "10", label: "Teams" },
      { value: "120", label: "Players" },
      { value: "₹55L", label: "Purse" },
      { value: "3", label: "Categories" },
    ],
    media: {
      aspectRatio: "video",
      caption: "Season 1 · Recap",
      alt: "RICL Season 1 recap video placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
      duration: "03:12",
    },
    cta: { label: "Host Your Own Season", href: "/organizer?tab=signup", analyticsId: "case_study_ricl_cta" },
  },
  {
    id: "corp",
    title: "Corporate Cricket League",
    subtitle: "Season 4 · Repeat Client",
    description:
      "A departmental office IPL now in its fourth year on BidWar. 12 teams, custom sponsor overlays and analytics dashboards exported straight to HR after every auction night.",
    sportTag: "Cricket · T20",
    location: "Delhi NCR",
    stats: [
      { value: "12", label: "Teams" },
      { value: "96", label: "Players" },
      { value: "₹28L", label: "Purse" },
      { value: "4", label: "Seasons" },
    ],
    media: {
      aspectRatio: "video",
      caption: "Boardroom Cut",
      alt: "Corporate Cricket League auction highlight placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
      duration: "01:58",
    },
    cta: { label: "Host Your Own Season", href: "/organizer?tab=signup", analyticsId: "case_study_corp_cta" },
  },
] as const;

// ─── Production Gallery — masonry grid ──────────────────────────────────────

export type ProductionGalleryItem = {
  id: string;
  title: string;
  /** Stable category for future filter chips — see GALLERY_CATEGORIES. */
  category: GalleryCategory;
  description: string;
  /** Controls the grid span on desktop. */
  size: "hero" | "medium" | "small";
  media: HomepageMediaAsset;
};

export const PRODUCTION_GALLERY_ITEMS: readonly ProductionGalleryItem[] = [
  {
    id: "auction-stage",
    title: "Auction Stage",
    category: "stage",
    description: "VNBL 3.0 · Mumbai",
    size: "hero",
    media: {
      aspectRatio: "16/10",
      caption: "Auction Stage",
      alt: "VNBL 3.0 auction stage placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "led-reveal",
    title: "LED Reveal",
    category: "led",
    description: "SOLD stamp on the big screen",
    size: "medium",
    media: {
      aspectRatio: "4/3",
      caption: "LED Reveal",
      alt: "LED SOLD stamp reveal placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "team-owners",
    title: "Team Owners",
    category: "owners",
    description: "Owners bidding live from the floor",
    size: "medium",
    media: {
      aspectRatio: "4/3",
      caption: "Team Owners",
      alt: "Team owners bidding from the floor placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "trophy-handover",
    title: "Trophy Handover",
    category: "trophy",
    description: "Season finale",
    size: "small",
    media: {
      aspectRatio: "square",
      caption: "Trophy Handover",
      alt: "Trophy ceremony placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "broadcast-overlay",
    title: "Broadcast Overlay",
    category: "obs",
    description: "Live on YouTube",
    size: "small",
    media: {
      aspectRatio: "square",
      caption: "Broadcast Overlay",
      alt: "OBS broadcast overlay placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "control-room",
    title: "Control Room",
    category: "operator",
    description: "Operator's point of view",
    size: "small",
    media: {
      aspectRatio: "square",
      caption: "Control Room",
      alt: "Operator control room placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
] as const;

// ─── Tournament Timeline ────────────────────────────────────────────────────

export type TimelineStep = {
  title: string;
  description: string;
};

export const TIMELINE_STEPS: readonly TimelineStep[] = [
  { title: "Registration", description: "QR + web signup" },
  { title: "Verification", description: "Docs + categories" },
  { title: "Auction Night", description: "Live bidding room" },
  { title: "LED Broadcast", description: "Lower-thirds · SOLD" },
  { title: "Final Squads", description: "CSV + player cards" },
  { title: "Fixtures", description: "Draw + schedule" },
  { title: "Champion", description: "Trophy handover" },
] as const;

// ─── Academy — video tutorial cards ─────────────────────────────────────────

export type AcademyVideo = {
  id: string;
  title: string;
  duration: string;
  tag: string;
  media: HomepageMediaAsset;
};

export const ACADEMY_VIDEOS: readonly AcademyVideo[] = [
  {
    id: "first-auction",
    title: "Set up your first auction",
    duration: "12:04",
    tag: "Beginner",
    media: {
      aspectRatio: "video",
      caption: "Set up your first auction",
      alt: "Academy tutorial — set up your first auction",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "operator-masterclass",
    title: "Operator masterclass",
    duration: "24:31",
    tag: "Advanced",
    media: {
      aspectRatio: "video",
      caption: "Operator masterclass",
      alt: "Academy tutorial — operator masterclass",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "owner-briefing",
    title: "Team-owner briefing",
    duration: "06:18",
    tag: "Owners",
    media: {
      aspectRatio: "video",
      caption: "Team-owner briefing",
      alt: "Academy tutorial — team-owner briefing",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "led-obs-wiring",
    title: "LED & OBS wiring",
    duration: "18:47",
    tag: "Broadcast",
    media: {
      aspectRatio: "video",
      caption: "LED & OBS wiring",
      alt: "Academy tutorial — LED and OBS wiring",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
] as const;

// ─── Events gallery fallback (until showcase API has items) ─────────────────

export type EventsGalleryFallbackItem = {
  img: string;
  caption: string;
  tag: string;
  alt: string;
};

export const DEFAULT_GALLERY_ITEMS: readonly EventsGalleryFallbackItem[] = [
  {
    img: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&h=380&fit=crop&q=80",
    caption: "T20 League Franchise Auction",
    tag: "Cricket",
    alt: "Cricket stadium aerial view for T20 franchise auction",
  },
  {
    img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&h=380&fit=crop&q=80",
    caption: "Live Team Bidding Session",
    tag: "Football",
    alt: "Sports team huddle at franchise bidding event",
  },
  {
    img: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=380&fit=crop&q=80",
    caption: "Business League Draft Night",
    tag: "Business League",
    alt: "Indoor sports event live auction session",
  },
  {
    img: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&h=380&fit=crop&q=80",
    caption: "Franchise Auction Night",
    tag: "Football",
    alt: "Football league franchise auction event",
  },
  {
    img: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&h=380&fit=crop&q=80",
    caption: "Multi-Team Player Draft",
    tag: "Kabaddi",
    alt: "Sports field during player draft event",
  },
  {
    img: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&h=380&fit=crop&q=80",
    caption: "Operator Command Center",
    tag: "Live Auction",
    alt: "Auction operator dashboard running live player auction",
  },
] as const;

// ─── Product Showcase surfaces (mock UI until media URLs are set) ───────────

/**
 * Phase 2: set thumbnail / fullImage on a surface to replace the mock UI with
 * a real screenshot — ProductShowcase reads this; no component edits needed.
 */
export type ProductShowcaseSurface = {
  id: "operator" | "display" | "owner" | "reports";
  label: string;
  desc: string;
  /** Address-bar path shown in the browser chrome mock. */
  urlPath: string;
  media: HomepageMediaAsset;
};

export const PRODUCT_SHOWCASE_SURFACES: readonly ProductShowcaseSurface[] = [
  {
    id: "operator",
    label: "Operator Panel",
    desc: "Control the live auction",
    urlPath: "bidwar.in/tournament/12/auction",
    media: {
      aspectRatio: "16/10",
      caption: "Operator Panel",
      alt: "BidWar operator auction control panel screenshot placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "display",
    label: "LED Display",
    desc: "Broadcast screen",
    urlPath: "bidwar.in/tournament/12/display",
    media: {
      aspectRatio: "16/10",
      caption: "LED Display",
      alt: "BidWar LED auction display screenshot placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "owner",
    label: "Owner App",
    desc: "Team bidding panel",
    urlPath: "bidwar.in/tournament/12/owner/3",
    media: {
      aspectRatio: "16/10",
      caption: "Owner App",
      alt: "BidWar team owner bidding panel screenshot placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
  {
    id: "reports",
    label: "Reports",
    desc: "Post-auction analytics",
    urlPath: "bidwar.in/tournament/12/reports",
    media: {
      aspectRatio: "16/10",
      caption: "Analytics Dashboard",
      alt: "BidWar post-auction analytics dashboard screenshot placeholder",
      thumbnail: null,
      fullImage: null,
      videoUrl: null,
    },
  },
] as const;
