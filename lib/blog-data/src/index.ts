/* ───────────────────────────────────────────────────────────────────────────
   Blog Data – shared between frontend renderer and API-server SEO injector.
   Keep: types, categories, tags, authors, and post METADATA only.
   Full article content (body blocks) lives in the frontend package only.
─────────────────────────────────────────────────────────────────────────── */

export const BLOG_BASE_URL = "https://bidwar.in/blog";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BlogCategory {
  slug: string;
  name: string;
  description: string;
  color: string;        // Tailwind text-color token e.g. "text-yellow-400"
  bgColor: string;      // Tailwind bg-color token e.g. "bg-yellow-400/10"
}

export interface BlogTag {
  slug: string;
  name: string;
}

export interface BlogAuthor {
  slug: string;
  name: string;
  role: string;
  bio: string;
  avatarInitials: string;    // shown when no image available
  avatarColor: string;       // Tailwind bg token for avatar background
  twitterHandle?: string;
  linkedinUrl?: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;       // ~150 chars, used as meta description
  excerpt: string;           // ~200 chars, shown on listing cards
  category: string;          // category slug
  tags: string[];            // tag slugs
  author: string;            // author slug
  publishedAt: string;       // ISO date YYYY-MM-DD
  updatedAt?: string;        // ISO date, only if meaningfully revised
  readingTimeMinutes: number;
  featured?: boolean;
  heroImage?: string;        // relative path or absolute URL
  canonical: string;         // full canonical URL
}

// ── Content block types (used in frontend-only blog-content.ts) ──────────────

export type BlockType =
  | "h2" | "h3"
  | "p"
  | "ul" | "ol"
  | "tip" | "warning" | "callout"
  | "steps"
  | "hr";

export interface Block {
  type: BlockType;
  id?: string;         // anchor id for h2/h3 headings (used in TOC)
  text?: string;       // prose text; supports **bold** and _italic_ markdown
  items?: string[];    // for ul / ol / steps
  heading?: string;    // label for tip / warning / callout boxes
}

export interface BlogPost extends BlogPostMeta {
  tableOfContents: { id: string; title: string }[];
  content: Block[];
}

// ── Categories ────────────────────────────────────────────────────────────────

export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    slug: "auction-guides",
    name: "Auction Guides",
    description: "Step-by-step guides for running professional sports auctions with BidWar.",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
  },
  {
    slug: "tournament-management",
    name: "Tournament Management",
    description: "How to plan, schedule, and manage entire franchise leagues and tournaments.",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  {
    slug: "sport-formats",
    name: "Sport Formats",
    description: "Sport-specific auction structures for cricket, football, kabaddi, and more.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
  {
    slug: "platform-features",
    name: "Platform Features",
    description: "Deep dives into BidWar's LED display, mobile panels, overlays, and tools.",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
  },
  {
    slug: "organizer-tips",
    name: "Organizer Tips",
    description: "Practical advice for sports event organizers running franchise leagues.",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
  },
];

// ── Tags ──────────────────────────────────────────────────────────────────────

export const BLOG_TAGS: BlogTag[] = [
  { slug: "cricket",        name: "Cricket" },
  { slug: "football",       name: "Football" },
  { slug: "kabaddi",        name: "Kabaddi" },
  { slug: "badminton",      name: "Badminton" },
  { slug: "basketball",     name: "Basketball" },
  { slug: "volleyball",     name: "Volleyball" },
  { slug: "esports",        name: "Esports" },
  { slug: "corporate",      name: "Corporate" },
  { slug: "ipl-style",      name: "IPL Style" },
  { slug: "player-auction", name: "Player Auction" },
  { slug: "led-display",    name: "LED Display" },
  { slug: "live-bidding",   name: "Live Bidding" },
  { slug: "franchise-league", name: "Franchise League" },
  { slug: "tournament-setup", name: "Tournament Setup" },
  { slug: "team-management",  name: "Team Management" },
  { slug: "reports",        name: "Reports" },
  { slug: "streaming",      name: "Streaming" },
  { slug: "scoring",        name: "Scoring" },
  { slug: "setup-guide",    name: "Setup Guide" },
  { slug: "best-practices", name: "Best Practices" },
];

// ── Authors ───────────────────────────────────────────────────────────────────

export const BLOG_AUTHORS: BlogAuthor[] = [
  {
    slug: "bidwar-team",
    name: "BidWar Team",
    role: "Product & Editorial",
    bio: "The BidWar team builds and maintains India's most advanced live sports auction platform. Our editorial content distils learnings from thousands of real auctions across cricket, football, kabaddi, and corporate leagues.",
    avatarInitials: "BW",
    avatarColor: "bg-yellow-400",
  },
  {
    slug: "arjun-sharma",
    name: "Arjun Sharma",
    role: "Sports Technology Writer",
    bio: "Arjun covers the intersection of sports, technology, and community event management. With over a decade of experience organising franchise leagues across India, he writes practical guides for tournament directors and auction operators.",
    avatarInitials: "AS",
    avatarColor: "bg-blue-500",
    twitterHandle: "@arjunsports",
  },
];

// ── Post Metadata ─────────────────────────────────────────────────────────────

export const BLOG_POSTS_META: BlogPostMeta[] = [
  {
    slug: "how-to-run-cricket-auction",
    title: "How to Run an IPL-Style Cricket Auction: The Complete Organizer Guide",
    description: "A step-by-step guide to running a professional IPL-style cricket player auction using BidWar — from player list setup to the live LED broadcast.",
    excerpt: "Everything you need to know to pull off a professional IPL-style cricket franchise auction — player categories, purse rules, live display, and common pitfalls to avoid.",
    category: "auction-guides",
    tags: ["cricket", "ipl-style", "player-auction", "led-display", "franchise-league"],
    author: "arjun-sharma",
    publishedAt: "2026-05-15",
    readingTimeMinutes: 9,
    featured: true,
    canonical: `${BLOG_BASE_URL}/how-to-run-cricket-auction`,
  },
  {
    slug: "setting-up-first-tournament",
    title: "Setting Up Your First BidWar Tournament in 15 Minutes",
    description: "Create a BidWar tournament from scratch — teams, player categories, players, and display connections — in under 15 minutes with this step-by-step walkthrough.",
    excerpt: "New to BidWar? This walkthrough takes you from an empty screen to a fully configured tournament ready for auction day — in about 15 minutes.",
    category: "auction-guides",
    tags: ["tournament-setup", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-05-20",
    readingTimeMinutes: 5,
    canonical: `${BLOG_BASE_URL}/setting-up-first-tournament`,
  },
  {
    slug: "football-franchise-auction-guide",
    title: "Football Franchise Auction: Position Categories, Squad Rules & Setup",
    description: "How to structure a football franchise player auction with position-based categories, squad composition limits, and purse rules inside BidWar.",
    excerpt: "Football auctions need different category logic than cricket — position groups, squad-size caps, and minimum-player rules. Here's how to set them up in BidWar.",
    category: "sport-formats",
    tags: ["football", "player-auction", "franchise-league", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-05-27",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/football-franchise-auction-guide`,
  },
  {
    slug: "led-broadcast-display-setup",
    title: "Setting Up the LED Broadcast Display: Complete Guide for Auction Day",
    description: "How to connect, configure, and optimise BidWar's LED Broadcast Mode for a stunning big-screen auction experience on projectors and TV panels.",
    excerpt: "BidWar's LED Broadcast Mode turns any projector or large TV into a cinema-grade auction display. This guide covers connection, layout settings, and on-day tips.",
    category: "platform-features",
    tags: ["led-display", "live-bidding", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-06-01",
    readingTimeMinutes: 5,
    canonical: `${BLOG_BASE_URL}/led-broadcast-display-setup`,
  },
  {
    slug: "corporate-sports-day-auction",
    title: "Corporate Sports Day Franchise Auction: Planning and Execution Guide",
    description: "How to run a franchise-format sports day auction for your company or office — team budgets, player pools, auction format, and engagement tips.",
    excerpt: "Corporate sports days are more exciting as franchise auctions. This guide covers everything from employee player pools to team purse budgets and live bidding.",
    category: "organizer-tips",
    tags: ["corporate", "tournament-setup", "franchise-league", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-06-05",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/corporate-sports-day-auction`,
  },
  {
    slug: "stream-auction-youtube-facebook",
    title: "How to Stream Your Sports Auction Live: YouTube, Facebook & OBS Guide",
    description: "Step-by-step guide to broadcasting your BidWar sports auction live on YouTube or Facebook using OBS Studio with the Broadcast Overlay.",
    excerpt: "Stream your franchise auction to fans and absent stakeholders with BidWar's Broadcast Overlay and OBS Studio. This guide covers setup, scenes, and stream quality settings.",
    category: "platform-features",
    tags: ["streaming", "live-bidding", "setup-guide", "led-display"],
    author: "bidwar-team",
    publishedAt: "2026-06-10",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/stream-auction-youtube-facebook`,
  },

  // ── P1 Batch: Auction How-To Guides ──────────────────────────────────────

  {
    slug: "how-to-run-franchise-player-auction",
    title: "How to Run a Sports Franchise Player Auction from Scratch",
    description: "A complete step-by-step guide to organizing a franchise player auction for any sport — team setup, player categories, purse rules, live bidding, and results export.",
    excerpt: "Starting from zero? This guide walks you through every decision you need to make before, during, and after a franchise player auction — for any sport.",
    category: "auction-guides",
    tags: ["player-auction", "franchise-league", "tournament-setup", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-06-12",
    readingTimeMinutes: 10,
    featured: true,
    canonical: `${BLOG_BASE_URL}/how-to-run-franchise-player-auction`,
  },
  {
    slug: "set-player-base-prices-franchise-auction",
    title: "How to Set Player Base Prices for Any Franchise League Auction",
    description: "A practical framework for deciding player base prices in franchise sports auctions — balancing fairness, budget constraints, and market value across all tiers.",
    excerpt: "Setting the right base price is the single most important pre-auction decision. Too low and top players get stolen; too high and they go unsold. Here's how to get it right.",
    category: "auction-guides",
    tags: ["player-auction", "franchise-league", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-06-13",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/set-player-base-prices-franchise-auction`,
  },
  {
    slug: "calculate-team-purse-budgets-franchise-league",
    title: "How to Calculate Team Purse Budgets for a Franchise League",
    description: "Learn how to set fair, competitive team purse budgets for your franchise league auction — formulas, tier considerations, and common mistakes to avoid.",
    excerpt: "The purse budget drives everything — squad depth, bidding aggression, and competitive balance. Here's how to calculate one that keeps every team in contention.",
    category: "auction-guides",
    tags: ["franchise-league", "player-auction", "best-practices"],
    author: "bidwar-team",
    publishedAt: "2026-06-14",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/calculate-team-purse-budgets-franchise-league`,
  },
  {
    slug: "handle-unsold-players-franchise-auction",
    title: "How to Handle Unsold Players After a Franchise Auction",
    description: "What to do when players remain unsold after your franchise auction — re-auction rules, negotiated signings, fill-up drafts, and roster minimum enforcement.",
    excerpt: "Unsold players are inevitable in any auction. How you handle them determines whether your league starts with balanced squads or glaring gaps. Here are your options.",
    category: "auction-guides",
    tags: ["player-auction", "franchise-league", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-06-15",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/handle-unsold-players-franchise-auction`,
  },
  {
    slug: "run-retention-round-before-franchise-auction",
    title: "How to Run a Retention Round Before Your Franchise Auction",
    description: "Step-by-step guide to running a player retention round for returning franchise leagues — retention slots, costs, RTM rules, and how to configure them in BidWar.",
    excerpt: "Retention rounds let teams keep key players from last season — but they need careful rules to prevent hoarding. This guide covers slots, costs, and setup in BidWar.",
    category: "auction-guides",
    tags: ["franchise-league", "player-auction", "ipl-style"],
    author: "arjun-sharma",
    publishedAt: "2026-06-16",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/run-retention-round-before-franchise-auction`,
  },
  {
    slug: "create-player-categories-franchise-auction",
    title: "How to Create Player Categories for a Franchise League Auction",
    description: "How to design player tiers and categories for a franchise league auction — marquee, standard, uncapped, emerging, and overseas slots with bidding order logic.",
    excerpt: "Player categories structure the entire auction narrative. Get them wrong and your event feels flat. Get them right and every round is a bidding war. Here's how.",
    category: "auction-guides",
    tags: ["player-auction", "franchise-league", "best-practices"],
    author: "bidwar-team",
    publishedAt: "2026-06-17",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/create-player-categories-franchise-auction`,
  },
  {
    slug: "online-only-remote-sports-player-auction",
    title: "How to Run an Online-Only Sports Player Auction Remotely",
    description: "A complete guide to running a fully remote franchise player auction — mobile bidding, video call coordination, live display sharing, and real-time bid management.",
    excerpt: "Team owners in different cities? No problem. BidWar's mobile bidding and broadcast overlay let you run a professional auction with everyone joining remotely.",
    category: "auction-guides",
    tags: ["live-bidding", "streaming", "tournament-setup"],
    author: "bidwar-team",
    publishedAt: "2026-06-18",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/online-only-remote-sports-player-auction`,
  },
  {
    slug: "player-draft-vs-player-auction-sports-format",
    title: "Player Draft vs Player Auction: Which Format Is Better for Your League?",
    description: "A detailed comparison of snake draft and live auction formats for franchise sports leagues — engagement, fairness, time, and which works best for different contexts.",
    excerpt: "Draft or auction — both build franchise teams, but they create completely different energy. Here's an honest comparison to help you pick the right format.",
    category: "auction-guides",
    tags: ["player-auction", "franchise-league", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-06-19",
    readingTimeMinutes: 8,
    canonical: `${BLOG_BASE_URL}/player-draft-vs-player-auction-sports-format`,
  },

  // ── P1 Batch: Cricket Auction Deep-Dives ─────────────────────────────────

  {
    slug: "ipl-style-auction-format-local-cricket-leagues",
    title: "IPL-Style Auction Format Explained for Local Cricket Leagues",
    description: "Everything local cricket organizers need to know about replicating the IPL auction format — purse structure, player tiers, retention slots, and BidWar setup.",
    excerpt: "The IPL auction format is the gold standard — and any local cricket league can replicate it. Here's a plain-language breakdown of how it works and how to set it up.",
    category: "sport-formats",
    tags: ["cricket", "ipl-style", "franchise-league", "player-auction"],
    author: "arjun-sharma",
    publishedAt: "2026-06-20",
    readingTimeMinutes: 9,
    canonical: `${BLOG_BASE_URL}/ipl-style-auction-format-local-cricket-leagues`,
  },
  {
    slug: "ipl-retention-policy-local-cricket-leagues",
    title: "IPL Retention Policy Simplified for Local Cricket Leagues",
    description: "How to adapt the IPL's player retention rules for local and club cricket leagues — how many slots, at what cost deduction, and how to handle RTM cards.",
    excerpt: "IPL retention rules are designed for billion-dollar franchises, but the underlying logic works for any local league. Here's how to simplify and adapt them.",
    category: "sport-formats",
    tags: ["cricket", "ipl-style", "franchise-league"],
    author: "arjun-sharma",
    publishedAt: "2026-06-21",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/ipl-retention-policy-local-cricket-leagues`,
  },
  {
    slug: "set-cricket-player-base-prices-stats",
    title: "How to Set Cricket Player Base Prices Based on Stats",
    description: "A stats-driven framework for pricing cricket players in franchise auctions — batting average, bowling economy, all-round contribution, and positional value.",
    excerpt: "Subjective pricing leads to disputes. A stat-based system everyone can see and verify creates trust. Here's a practical framework for cricket player base prices.",
    category: "sport-formats",
    tags: ["cricket", "player-auction", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-06-22",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/set-cricket-player-base-prices-stats`,
  },
  {
    slug: "franchise-cricket-league-rules-complete-template",
    title: "Franchise Cricket League Rules: A Complete Template for Organizers",
    description: "A ready-to-use framework covering all cricket franchise league rules — squad size, purse limits, retention policy, auction process, and dispute resolution.",
    excerpt: "Good rules prevent 90% of post-auction disputes. This template covers every rule you need for a professional franchise cricket league — copy, adapt, and distribute.",
    category: "sport-formats",
    tags: ["cricket", "franchise-league", "best-practices", "tournament-setup"],
    author: "bidwar-team",
    publishedAt: "2026-06-23",
    readingTimeMinutes: 9,
    canonical: `${BLOG_BASE_URL}/franchise-cricket-league-rules-complete-template`,
  },

  // ── P1 Batch: Football, Kabaddi & Sport Formats ──────────────────────────

  {
    slug: "football-franchise-auction-vs-random-draw",
    title: "Football Franchise Auction vs Random Team Draw: Pros and Cons",
    description: "Should your football league use a live player auction or a random team draw? A detailed comparison covering engagement, fairness, time, and team quality.",
    excerpt: "Most football leagues default to random draws — but organizers who switch to franchise auctions never go back. Here's why, and when the draw still makes sense.",
    category: "sport-formats",
    tags: ["football", "player-auction", "franchise-league"],
    author: "arjun-sharma",
    publishedAt: "2026-06-24",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/football-franchise-auction-vs-random-draw`,
  },
  {
    slug: "corporate-football-sports-day-franchise-auction",
    title: "Corporate Football Sports Day Franchise Auction: Complete Guide",
    description: "How to run a franchise-format football auction for a corporate sports day — team slots, employee player pools, purse budgets, and on-day execution.",
    excerpt: "Football franchise auctions are the most engaging team-building format for corporate sports days. Here's a complete guide from planning to post-event wrap-up.",
    category: "organizer-tips",
    tags: ["football", "corporate", "franchise-league", "tournament-setup"],
    author: "arjun-sharma",
    publishedAt: "2026-06-25",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/corporate-football-sports-day-franchise-auction`,
  },
  {
    slug: "kabaddi-franchise-auction-raiders-defenders",
    title: "Kabaddi Franchise Auction: Raiders, Defenders & All-Rounders Explained",
    description: "How to structure a kabaddi franchise auction with position-based categories — raiders, left cover, right cover, all-rounders — and set squad composition rules.",
    excerpt: "Kabaddi franchise auctions need a different category structure than cricket. Raiders command premiums; a squad without corners falls apart. Here's how to structure it.",
    category: "sport-formats",
    tags: ["franchise-league", "player-auction", "best-practices"],
    author: "arjun-sharma",
    publishedAt: "2026-06-26",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/kabaddi-franchise-auction-raiders-defenders`,
  },
  {
    slug: "pro-kabaddi-style-auction-format-local-leagues",
    title: "Pro Kabaddi-Style Auction Format for Local Leagues in India",
    description: "How to replicate the PKL auction format at local and club level — team purse structure, player categories, squad limits, and auction order for kabaddi leagues.",
    excerpt: "PKL's auction format creates incredible drama — and local kabaddi leagues can run exactly the same format. Here's a plain-language guide to setting it up.",
    category: "sport-formats",
    tags: ["franchise-league", "ipl-style", "player-auction"],
    author: "arjun-sharma",
    publishedAt: "2026-06-27",
    readingTimeMinutes: 8,
    canonical: `${BLOG_BASE_URL}/pro-kabaddi-style-auction-format-local-leagues`,
  },

  // ── P1 Batch: Badminton & Live Scoring ───────────────────────────────────

  {
    slug: "badminton-franchise-auction-playing-discipline",
    title: "How to Run a Badminton Franchise Auction by Playing Discipline",
    description: "A guide to structuring a badminton franchise auction with discipline-based categories — men's singles, women's singles, doubles, and mixed doubles slots.",
    excerpt: "Badminton franchise auctions need discipline-based categories so teams can't stack one event type. Here's how to structure categories, budgets, and bidding order.",
    category: "sport-formats",
    tags: ["franchise-league", "player-auction", "tournament-setup"],
    author: "bidwar-team",
    publishedAt: "2026-06-28",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/badminton-franchise-auction-playing-discipline`,
  },
  {
    slug: "badminton-scoring-software-live-rally-guide",
    title: "Badminton Scoring Software: Live Rally-by-Rally Scoring Guide",
    description: "How to use badminton scoring software to track every rally, service fault, let, and game result in real time — with live display output for spectators.",
    excerpt: "Paper scorecards are error-prone and invisible to spectators. Digital rally-by-rally scoring solves both — here's a complete guide to using BidWar's scoring tools.",
    category: "platform-features",
    tags: ["scoring", "led-display", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-06-29",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/badminton-scoring-software-live-rally-guide`,
  },
  {
    slug: "score-badminton-doubles-match-digitally",
    title: "How to Score a Badminton Doubles Match Digitally in Real Time",
    description: "Step-by-step guide to digital scoring for badminton doubles — service rotation, fault tracking, deuce handling, and syncing scores to a live display.",
    excerpt: "Doubles scoring has more complexity than singles — service rotation, partner faults, and court positioning. Here's how to handle all of it digitally.",
    category: "platform-features",
    tags: ["scoring", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-06-30",
    readingTimeMinutes: 5,
    canonical: `${BLOG_BASE_URL}/score-badminton-doubles-match-digitally`,
  },
  {
    slug: "live-badminton-scoreboard-tournament-setup",
    title: "Live Badminton Scoreboard for Tournaments: Setup and Display Guide",
    description: "How to set up a live digital scoreboard for a badminton tournament — screen connections, scorer assignments, real-time updates, and spectator display modes.",
    excerpt: "A live scoreboard transforms a club tournament into a professional event. Here's everything you need to get one running on any TV or projector.",
    category: "platform-features",
    tags: ["scoring", "led-display", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-07-01",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/live-badminton-scoreboard-tournament-setup`,
  },
  {
    slug: "led-scoreboard-badminton-tournament-setup",
    title: "How to Set Up an LED Scoreboard for a Badminton Tournament",
    description: "A complete hardware and software guide for running an LED scoreboard at a badminton tournament — TV vs projector, connection types, BidWar display mode, and troubleshooting.",
    excerpt: "LED scoreboards add professional polish to any badminton tournament. Here's a practical guide to choosing your screen, connecting it, and keeping it running smoothly.",
    category: "platform-features",
    tags: ["scoring", "led-display", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-07-02",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/led-scoreboard-badminton-tournament-setup`,
  },
  {
    slug: "badminton-tournament-management-software-guide",
    title: "Badminton Tournament Management Software: What to Look For",
    description: "A buyer's guide to badminton tournament management software — draw generation, live scoring, scoreboard display, results publishing, and mobile access for Scorers.",
    excerpt: "Not all tournament software handles badminton's specific needs. Here's what features to demand before committing to any platform for your club or district tournament.",
    category: "platform-features",
    tags: ["scoring", "tournament-setup"],
    author: "arjun-sharma",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/badminton-tournament-management-software-guide`,
  },
  {
    slug: "run-badminton-league-live-scoring-standings",
    title: "How to Run a Badminton League with Live Scoring and Standings",
    description: "How to manage a multi-week badminton league end-to-end — round scheduling, live scoring each match, running standings, and publishing results to all players.",
    excerpt: "Running a badminton league takes more than a single tournament — you need consistent scoring, running standings, and clear communication. Here's how to do all three.",
    category: "organizer-tips",
    tags: ["scoring", "tournament-setup", "team-management"],
    author: "bidwar-team",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/run-badminton-league-live-scoring-standings`,
  },
  {
    slug: "badminton-scoring-app-scorers-features",
    title: "Badminton Scoring App for Scorers: Features to Look For",
    description: "What makes a good badminton scoring app for Scorers — one-tap rally entry, service fault buttons, game auto-detection, offline mode, and display sync.",
    excerpt: "Scorers need an app that keeps up with fast rally exchanges and doesn't crash mid-match. Here's a feature checklist every badminton Scorer should review.",
    category: "platform-features",
    tags: ["scoring", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 5,
    canonical: `${BLOG_BASE_URL}/badminton-scoring-app-scorers-features`,
  },

  // ── P1 Batch: Technology & Platform Features ─────────────────────────────

  {
    slug: "what-is-live-auction-software-sports",
    title: "What Is Live Auction Software and How Does It Work for Sports?",
    description: "An explainer on how live sports auction software works — real-time bidding, LED display output, mobile team owner access, purse management, and reporting.",
    excerpt: "If you've never run a franchise auction before, the software can seem intimidating. This plain-language explainer walks through exactly how it all works together.",
    category: "platform-features",
    tags: ["live-bidding", "led-display", "player-auction"],
    author: "bidwar-team",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/what-is-live-auction-software-sports`,
  },
  {
    slug: "how-real-time-bidding-software-works-franchise",
    title: "How Real-Time Bidding Software Works for Franchise Player Auctions",
    description: "A technical and practical explainer on how real-time bidding works in franchise sports auctions — bid synchronization, countdown timers, purse deduction, and sold confirmation.",
    excerpt: "Real-time bidding software does a lot under the hood. Understanding how it works helps you run smoother auctions and troubleshoot faster on the day.",
    category: "platform-features",
    tags: ["live-bidding", "player-auction"],
    author: "bidwar-team",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/how-real-time-bidding-software-works-franchise`,
  },
  {
    slug: "mobile-bidding-apps-sports-events-team-owners",
    title: "Mobile Bidding Apps for Sports Events: How Team Owners Bid on Phones",
    description: "How mobile bidding works for franchise player auctions — QR code access, real-time bid submission, purse tracking on phone, and managing bid conflicts.",
    excerpt: "Team owners bidding from their phones is the modern standard. Here's how mobile bidding apps work, what owners see, and how you set it up as an organizer.",
    category: "platform-features",
    tags: ["live-bidding", "player-auction", "setup-guide"],
    author: "bidwar-team",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 6,
    canonical: `${BLOG_BASE_URL}/mobile-bidding-apps-sports-events-team-owners`,
  },
  {
    slug: "cloud-vs-local-auction-software-sports-events",
    title: "Cloud vs Local Auction Software: Which Is Better for Sports Events?",
    description: "A detailed comparison of cloud-based and locally-installed sports auction software — reliability, setup time, offline capability, multi-device sync, and cost.",
    excerpt: "Your venue may have unreliable Wi-Fi — or you might want team owners bidding remotely from home. Which type of auction software fits your situation? Here's the breakdown.",
    category: "platform-features",
    tags: ["live-bidding", "setup-guide"],
    author: "arjun-sharma",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/cloud-vs-local-auction-software-sports-events`,
  },
  {
    slug: "sports-league-management-software-buyers-guide",
    title: "Sports League Management Software: Buyer's Guide for Organizers",
    description: "What to look for in sports league management software — team management, scheduling, live scoring, auction integration, reports, and mobile access for players.",
    excerpt: "Choosing league management software is a long-term decision. This guide covers every feature category you should evaluate before committing to a platform.",
    category: "platform-features",
    tags: ["team-management", "tournament-setup", "reports"],
    author: "arjun-sharma",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 8,
    canonical: `${BLOG_BASE_URL}/sports-league-management-software-buyers-guide`,
  },
  {
    slug: "franchise-league-software-features-matter-most",
    title: "Franchise League Software: What Features Matter Most?",
    description: "The essential features every franchise league software platform must have — player auction, team management, scoring, standings, reports, and broadcast display.",
    excerpt: "Not every 'franchise league platform' is actually built for franchise leagues. Here's the feature checklist that separates purpose-built tools from generic alternatives.",
    category: "platform-features",
    tags: ["franchise-league", "team-management", "live-bidding"],
    author: "bidwar-team",
    publishedAt: "2026-07-03",
    readingTimeMinutes: 7,
    canonical: `${BLOG_BASE_URL}/franchise-league-software-features-matter-most`,
  },
];

// ── Helper functions ──────────────────────────────────────────────────────────

export function getCategoryBySlug(slug: string): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((c) => c.slug === slug);
}

export function getAuthorBySlug(slug: string): BlogAuthor | undefined {
  return BLOG_AUTHORS.find((a) => a.slug === slug);
}

export function getTagBySlug(slug: string): BlogTag | undefined {
  return BLOG_TAGS.find((t) => t.slug === slug);
}

export function getPostMetaBySlug(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS_META.find((p) => p.slug === slug);
}

export function getPostsByCategory(categorySlug: string): BlogPostMeta[] {
  return BLOG_POSTS_META.filter((p) => p.category === categorySlug);
}

export function getPostsByTag(tagSlug: string): BlogPostMeta[] {
  return BLOG_POSTS_META.filter((p) => p.tags.includes(tagSlug));
}

export function getPostsByAuthor(authorSlug: string): BlogPostMeta[] {
  return BLOG_POSTS_META.filter((p) => p.author === authorSlug);
}

export function getFeaturedPosts(): BlogPostMeta[] {
  return BLOG_POSTS_META.filter((p) => p.featured);
}

export function getRelatedPosts(post: BlogPostMeta, limit = 3): BlogPostMeta[] {
  return BLOG_POSTS_META
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({
      post: p,
      score:
        (p.category === post.category ? 3 : 0) +
        p.tags.filter((t) => post.tags.includes(t)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ post: p }) => p);
}

/** All blog URLs for sitemap generation. */
export function getAllBlogUrls(): string[] {
  const urls: string[] = [`${BLOG_BASE_URL}`];
  for (const post of BLOG_POSTS_META) {
    urls.push(post.canonical);
  }
  for (const cat of BLOG_CATEGORIES) {
    urls.push(`${BLOG_BASE_URL}/category/${cat.slug}`);
  }
  for (const author of BLOG_AUTHORS) {
    urls.push(`${BLOG_BASE_URL}/author/${author.slug}`);
  }
  return urls;
}

export {
  todayIsoDate,
  isFutureIsoDate,
  clampIsoDateToToday,
  getPostDatePublished,
  getPostDateModified,
  getPostSitemapLastmod,
  toIsoDateTime,
  auditPostDates,
  type BlogDateAuditRow,
} from "./dates.js";
