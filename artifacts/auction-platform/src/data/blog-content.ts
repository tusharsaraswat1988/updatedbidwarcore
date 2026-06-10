/**
 * Full article content blocks for all blog posts.
 * Imports metadata from @workspace/blog-data and extends each post with body content.
 *
 * Text supports minimal inline markup:
 *   **bold text**, _italic text_, `code`, and [link text](url)
 */
import {
  type BlogPost,
  type Block,
  BLOG_POSTS_META,
  BLOG_AUTHORS,
  BLOG_CATEGORIES,
  BLOG_TAGS,
  getCategoryBySlug,
  getAuthorBySlug,
  getTagBySlug,
  getRelatedPosts,
} from "@workspace/blog-data";

// re-export everything from the shared package so pages only import from here
export {
  BLOG_AUTHORS,
  BLOG_CATEGORIES,
  BLOG_TAGS,
  getCategoryBySlug,
  getAuthorBySlug,
  getTagBySlug,
};
export type { BlogPost };

// ── Article content blocks ────────────────────────────────────────────────────

const CONTENT: Record<string, { tableOfContents: { id: string; title: string }[]; content: Block[] }> = {

  /* ─────────────────────────────────────────────────────────────────────────
     POST 1: How to Run an IPL-Style Cricket Auction
  ───────────────────────────────────────────────────────────────────────── */
  "how-to-run-cricket-auction": {
    tableOfContents: [
      { id: "what-makes-it-ipl-style",    title: "What Makes an Auction IPL-Style?" },
      { id: "pre-auction-setup",           title: "Pre-Auction Setup Checklist" },
      { id: "player-categories",           title: "Setting Up Player Categories" },
      { id: "running-the-live-auction",    title: "Running the Live Auction" },
      { id: "common-problems",             title: "Handling Common Problems" },
      { id: "after-the-auction",           title: "After the Auction" },
    ],
    content: [
      { type: "p", text: "Running an IPL-style cricket player auction is one of the most exciting ways to kick off a franchise league. Done right, it turns a routine tournament draw into a two-hour event that players, owners, and spectators talk about for years. This guide walks you through every step — from building your player database to broadcasting the final gavel strike on a stadium-sized screen." },

      { type: "h2", id: "what-makes-it-ipl-style", text: "What Makes an Auction IPL-Style?" },
      { type: "p", text: "The term **IPL-style** refers to a specific auction format popularised by the Indian Premier League since 2008. It has four defining characteristics that separate it from a simple draw or lottery:" },
      { type: "ul", items: [
        "**Franchise ownership** — teams are managed by owners who bid against each other with a fixed budget (the purse).",
        "**Player categories** — players are grouped by skill level and have a base price per category. Higher-tier players start at higher base prices.",
        "**Live competitive bidding** — the auctioneer calls each player's name, the base price appears on the main display, and owners raise paddles or tap buttons to bid in real time.",
        "**Broadcast display** — a large screen (projector, LED wall, or TV) shows the live bid amount, player photo, and stats throughout the auction.",
      ]},
      { type: "p", text: "BidWar is purpose-built to deliver all four elements out of the box. The platform provides the auctioneer a tablet control panel, team owners a dedicated mobile interface to bid from any device, and a separate LED Broadcast view for the main display — all synchronised in real time over your local Wi-Fi." },

      { type: "h2", id: "pre-auction-setup", text: "Pre-Auction Setup Checklist" },
      { type: "callout", heading: "How long will setup take?", text: "For a 150-player auction with 8 franchises, expect 2–3 hours of data entry spread over the week before auction day. Day-of setup (connecting devices, testing displays) takes about 30 minutes." },
      { type: "p", text: "Start your preparation at least one week before auction day. Here's a sequential checklist to work through:" },
      { type: "steps", heading: "Pre-auction preparation", items: [
        "**Create the tournament** — log in to BidWar, go to Tournaments → New Tournament. Enter the name, sport (Cricket), scheduled auction date, and the format (franchise league).",
        "**Add franchise teams** — under Teams, create each franchise. Set the team name, colour, logo, and the starting purse amount (typically ₹80–120 lakhs for local leagues).",
        "**Define player categories** — go to Categories and create tiers like Gold (₹2,00,000 base), Silver (₹1,00,000 base), Bronze (₹50,000 base), and Emerging (₹20,000 base). You can add a maximum bid cap per category if desired.",
        "**Import or add players** — upload your player list via CSV or add players manually. Each player needs a name, category, photo (optional but recommended), and base stats (batting average, bowling economy, etc.).",
        "**Set squad rules** — configure minimum and maximum squad sizes. A typical T20 league might require a minimum of 14 players and a maximum of 18 per franchise.",
        "**Test all device connections** — open the LED display on the projector, have each team owner log in on their mobile, and run a test bid sequence before the event.",
      ]},

      { type: "h2", id: "player-categories", text: "Setting Up Player Categories" },
      { type: "p", text: "Player categories are the backbone of a fair and exciting auction. Getting them right takes more thought than most organizers expect." },
      { type: "h3", id: "how-many-categories", text: "How many categories should you have?" },
      { type: "p", text: "For a league with 100–200 players, **three to five categories** is the sweet spot. Too few and the auction lacks drama in the early rounds; too many and the middle tiers get confusing for owners." },
      { type: "p", text: "A practical structure for a 120-player cricket auction across 8 teams:" },
      { type: "ul", items: [
        "**Elite (8 players)** — base ₹3,00,000. The marquee picks. Only one Elite player guaranteed per team (build excitement).",
        "**Gold (24 players)** — base ₹1,50,000. Proven performers, semi-pros, and strong club-level players.",
        "**Silver (40 players)** — base ₹75,000. Consistent local-league performers.",
        "**Emerging (48 players)** — base ₹25,000. Young talent, under-19 players, and first-season entrants.",
      ]},
      { type: "tip", heading: "Pro tip: set Retained Players first", text: "If teams are continuing from a previous season, BidWar supports a Retentions phase before the live auction. Retained players are locked to their franchise and their retention cost is deducted from the purse before bidding begins." },

      { type: "h2", id: "running-the-live-auction", text: "Running the Live Auction" },
      { type: "p", text: "Auction day is where all the preparation pays off. Assign a dedicated **auctioneer** (usually the event MC) who controls the BidWar operator tablet. All bidding, timer control, and player advancement happens through that panel." },
      { type: "h3", id: "auction-day-flow", text: "Typical auction day flow" },
      { type: "ol", items: [
        "Open BidWar on the operator tablet and connect the LED display on the big screen.",
        "Ask team owners to open their Team Panel on their phones — share the QR code or link from BidWar's Owners section.",
        "Begin with the highest category (Elite/Gold). The operator taps **Start Auction** for the first player.",
        "The player's name, photo, and base price appear on the LED display. The countdown timer starts.",
        "Owners bid by tapping the bid button in their panel. Each bid is instantly reflected on the display with the bidding franchise name and new amount.",
        "When no further bids arrive within the timer window, the operator confirms the sale. BidWar updates purses and squad rosters in real time.",
        "Unsold players are flagged automatically. You can choose to re-auction them in a later round.",
      ]},
      { type: "warning", heading: "Manage bid increment rules", text: "Without bid increment minimums, owners can stall an auction by bidding in tiny amounts. In BidWar's category settings, set a **minimum increment** (e.g., ₹10,000 below ₹1 lakh; ₹25,000 above). This keeps the pace brisk." },

      { type: "h2", id: "common-problems", text: "Handling Common Problems" },
      { type: "p", text: "Even well-prepared auctions hit snags. Here are the most common ones and how BidWar helps you recover:" },
      { type: "ul", items: [
        "**Wi-Fi drops mid-auction** — BidWar shows the last confirmed bid on all panels. Once reconnected, the session resumes exactly where it left off. Never repeat a completed sale.",
        "**An owner's phone runs out of battery** — any other device can log in with the team's owner link. BidWar supports simultaneous access from multiple devices under one team.",
        "**A bid was entered by mistake** — the operator can void the last bid within 30 seconds before confirming the sale. Confirmed sales can be manually corrected in the admin panel with an audit log entry.",
        "**Purse alert** — BidWar automatically blocks bids that would breach a team's remaining purse, preventing mathematical errors on the floor.",
        "**Unsold player accumulation** — if more than 20% of players go unsold in the first pass, lower the base prices for the unsold tier and run a flash re-auction round at a reduced rate.",
      ]},

      { type: "h2", id: "after-the-auction", text: "After the Auction" },
      { type: "p", text: "Once the gavel falls on the last player, BidWar's work isn't done. The platform generates a complete post-auction report covering:" },
      { type: "ul", items: [
        "**Full squad rosters** — every franchise's complete squad with the price paid for each player.",
        "**Purse utilisation** — how much of each team's budget was spent and what remains.",
        "**Unsold players list** — players not picked up and their base price for the reserve pool.",
        "**Auction timeline** — a timestamped log of every bid and every sale, useful for dispute resolution.",
      ]},
      { type: "p", text: "Download the full report as a PDF or CSV directly from the tournament dashboard. Share squad lists with players and owners via the built-in WhatsApp share button. Your franchise league is now ready to play." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     POST 2: Setting Up Your First BidWar Tournament
  ───────────────────────────────────────────────────────────────────────── */
  "setting-up-first-tournament": {
    tableOfContents: [
      { id: "create-tournament",     title: "Step 1: Create the Tournament" },
      { id: "add-teams",             title: "Step 2: Add Franchise Teams" },
      { id: "configure-categories",  title: "Step 3: Configure Categories" },
      { id: "add-players",           title: "Step 4: Add Players" },
      { id: "connect-devices",       title: "Step 5: Connect Display & Owners" },
    ],
    content: [
      { type: "p", text: "If you've just created a BidWar account, you're about 15 minutes away from a fully configured tournament. This walkthrough covers every click from the empty dashboard to a test auction session." },
      { type: "callout", heading: "What you'll need", text: "A BidWar organizer account, a list of team names, a player list (names + skills), and a device for each team owner (smartphone is fine). A second screen or projector for the LED display is optional for the test, required for auction day." },

      { type: "h2", id: "create-tournament", text: "Step 1: Create the Tournament" },
      { type: "p", text: "From the BidWar dashboard, click **New Tournament**. Fill in:" },
      { type: "ul", items: [
        "**Tournament name** — e.g., \"Summer Cricket League 2026\"",
        "**Sport** — choose from the dropdown (Cricket, Football, Kabaddi, Badminton, Basketball, Volleyball, or Custom).",
        "**Auction date** — pick the scheduled date. You can always change this later.",
        "**Format** — select **Franchise Auction** (not fixed-teams draw).",
      ]},
      { type: "p", text: "Click **Create Tournament**. You'll land on the tournament dashboard — your central hub for all setup steps." },

      { type: "h2", id: "add-teams", text: "Step 2: Add Franchise Teams" },
      { type: "p", text: "Navigate to **Teams → Add Team**. For each franchise, enter:" },
      { type: "ul", items: [
        "**Team name and short code** (e.g., \"Delhi Dynamos\" / \"DD\")",
        "**Team colour** — used on the LED display and owner mobile panel.",
        "**Starting purse** — the budget each owner has to spend at auction (e.g., ₹80,00,000).",
        "**Owner name and email** (optional) — BidWar emails the owner their access link.",
      ]},
      { type: "p", text: "Repeat for all franchises. BidWar supports up to 32 teams per tournament, but 6–12 is typical for local leagues." },
      { type: "tip", heading: "Uniform purse vs custom purse", text: "For most leagues, give every team the same purse. Custom purses are useful in leagues where last season's champion gets a budget penalty or promoted teams get a bonus." },

      { type: "h2", id: "configure-categories", text: "Step 3: Configure Categories" },
      { type: "p", text: "Categories group players by tier and set the starting bid prices. Go to **Categories → Add Category**:" },
      { type: "steps", heading: "Creating a category", items: [
        "Enter a category name (e.g., \"Gold\").",
        "Set the **base price** — the minimum opening bid for players in this tier.",
        "Optionally set a **maximum squad slots** limit (e.g., no team can have more than 3 Gold players).",
        "Set a **minimum bid increment** to keep bidding brisk.",
        "Save and repeat for each tier.",
      ]},
      { type: "p", text: "Order categories from highest to lowest value. BidWar auctions them in that order by default, though you can reorder individual players anytime." },

      { type: "h2", id: "add-players", text: "Step 4: Add Players" },
      { type: "p", text: "Add players one-by-one or bulk-import via CSV. The CSV import is fastest for larger pools:" },
      { type: "ul", items: [
        "Download the **CSV template** from Players → Import.",
        "Fill in: `player_name`, `category`, and any stats columns you want displayed during the auction (batting_avg, bowling_eco, etc.).",
        "Upload the file. BidWar validates each row and flags missing categories or duplicate names before importing.",
      ]},
      { type: "p", text: "Player photos are optional but **strongly recommended** — they make the LED display dramatically more engaging. You can upload photos individually from the player edit screen or zip-import a folder matching player names." },

      { type: "h2", id: "connect-devices", text: "Step 5: Connect Display & Owners" },
      { type: "p", text: "Everything is set up. Now test the live connection before auction day:" },
      { type: "steps", heading: "Device connection test", items: [
        "Open the **LED Broadcast** link on your projector or TV browser. It's available under Tournament → Display. The screen will show the BidWar standby graphic.",
        "Open the **Operator Panel** on the tablet or laptop that the auctioneer will use. This is the same browser tab you've been using for setup.",
        "Share **Owner Panel** links with each team owner. Each team has a unique URL and QR code under Teams → [Team Name] → Owner Link.",
        "In the Operator Panel, tap **Start Test Auction**. Select any player and click **Start Bidding**. The player appears on the LED display.",
        "Have one owner tap Bid in their panel — you should see the bid amount update in real time on the display and on all other owner panels.",
        "Confirm the sale. Check that the player moved to the correct team's roster and the purse deducted correctly.",
      ]},
      { type: "p", text: "If everything worked, you're ready for auction day. If Wi-Fi is spotty in your venue, consider setting up a dedicated router or mobile hotspot for BidWar devices." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     POST 3: Football Franchise Auction Guide
  ───────────────────────────────────────────────────────────────────────── */
  "football-franchise-auction-guide": {
    tableOfContents: [
      { id: "why-football-is-different",   title: "Why Football Needs Different Rules" },
      { id: "position-categories",          title: "Setting Up Position Categories" },
      { id: "squad-composition-rules",      title: "Squad Composition Rules" },
      { id: "football-auction-structure",   title: "Structuring the Auction" },
      { id: "common-mistakes",              title: "Common Football Auction Mistakes" },
    ],
    content: [
      { type: "p", text: "Cricket dominates the franchise auction scene in India, but football leagues are catching up fast — and they need a different setup approach. A cricket auction runs player by player through flat tier categories. Football requires **position-based squad construction**, and ignoring that leads to teams that can't field a starting XI. Here's how to get it right in BidWar." },

      { type: "h2", id: "why-football-is-different", text: "Why Football Needs Different Rules" },
      { type: "p", text: "The core difference is **positional dependency**. In cricket, a batting all-rounder can fill almost any slot. In football, you need specific numbers of goalkeepers, defenders, midfielders, and forwards. If you don't enforce this at the auction, team owners will stack attackers and then scramble for goalkeepers after the purse is exhausted." },
      { type: "ul", items: [
        "Each team needs **at least one goalkeeper** — if you don't mandate this, most owners will skip GKs until forced to panic-buy at inflated prices.",
        "**Defensive positions are undervalued** in open auctions — defenders go cheap early, then spike in price late when every team needs them.",
        "**Foreign player slots** (common in corporate leagues) add another constraint layer that cricket auctions don't face.",
      ]},

      { type: "h2", id: "position-categories", text: "Setting Up Position Categories in BidWar" },
      { type: "p", text: "BidWar's category system is flexible enough to handle position-based football auctions. The recommended approach uses **position groups** as categories rather than skill tiers:" },
      { type: "ul", items: [
        "**Goalkeepers (GK)** — base ₹30,000. Usually 2–3 players per team required.",
        "**Defenders (CB/FB)** — base ₹40,000. Central backs and fullbacks in one pool.",
        "**Midfielders (CM/CAM/CDM)** — base ₹60,000. The most valuable positional pool.",
        "**Forwards / Wingers (FW)** — base ₹75,000. Strikers and wide forwards.",
        "**Star Pool (Any position)** — base ₹1,50,000. 2–4 marquee picks regardless of position.",
      ]},
      { type: "p", text: "Alternatively, you can combine skill tier and position using BidWar's tag system — tag players by position and use the filter in the operator panel to run position-specific rounds." },
      { type: "tip", heading: "Run positional rounds in order", text: "Auction goalkeeper slots first. This forces every team to secure a GK before spending on attackers, preventing the common \"no goalkeeper\" crisis at the end." },

      { type: "h2", id: "squad-composition-rules", text: "Squad Composition Rules in BidWar" },
      { type: "p", text: "BidWar lets you set **per-category squad limits** — minimum and maximum players from each category that a team can hold. For a football league requiring 18-player squads:" },
      { type: "ul", items: [
        "Goalkeepers: min 1, max 2",
        "Defenders: min 4, max 6",
        "Midfielders: min 4, max 6",
        "Forwards: min 3, max 5",
        "Star Pool: min 1, max 3",
      ]},
      { type: "p", text: "Configure these in **Categories → Squad Rules**. BidWar will prevent a team from passing on a category where they haven't met the minimum — useful for the late rounds when owners try to save purse by skipping essential positions." },

      { type: "h2", id: "football-auction-structure", text: "Structuring the Auction" },
      { type: "p", text: "A well-structured football auction for an 8-team league with 18 players per squad (144 players total) typically runs like this:" },
      { type: "ol", items: [
        "**Round 1: Star Pool** (8–12 players) — marquee picks regardless of position. High drama, maximum purse spend, sets the tone.",
        "**Round 2: Goalkeepers** — ensure every team secures their GK before spending on outfield players.",
        "**Round 3: Defenders** — run through the full defender pool. Most teams need 4–6, so this is the longest positional round.",
        "**Round 4: Midfielders** — usually the most competitive round. Quality midfielders are scarce and valuable.",
        "**Round 5: Forwards/Wingers** — strikers and wide attackers. Purses are lower at this point, which keeps the round from inflating.",
        "**Round 6: Unsolds** — re-auction any player who didn't sell in their category round at a reduced base price.",
      ]},

      { type: "h2", id: "common-mistakes", text: "Common Football Auction Mistakes" },
      { type: "ul", items: [
        "**No GK mandate** — teams go GK-less. Fix: make the GK round first and enforce minimum squad rules.",
        "**Too few players in the pool** — if the pool is only 120 players for 8 teams needing 18 each, the math doesn't work (you need at least 144). Always have 110–120% of the required headcount to account for unsolds.",
        "**Star Pool too large** — if 30 players are in the Star tier, purses drain early and the later rounds become firesales. Keep Star Pool to 8–15% of total players.",
        "**No minimum bid increment** — football auctions stall when owners tick up bids by ₹1,000 on a ₹3,00,000 player. Set increments at 5% of the current bid or a flat minimum.",
        "**Forgetting the injury reserve** — professional leagues allow emergency replacements. If your league does too, BidWar supports a **Reserve Slot** category that teams can fill post-auction.",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     POST 4: LED Broadcast Display Setup
  ───────────────────────────────────────────────────────────────────────── */
  "led-broadcast-display-setup": {
    tableOfContents: [
      { id: "hardware-requirements",    title: "Hardware Requirements" },
      { id: "connecting-the-display",   title: "Connecting the Display" },
      { id: "layout-and-settings",      title: "Layout and Display Settings" },
      { id: "projector-tips",           title: "Projector & TV Tips" },
      { id: "troubleshooting",          title: "Troubleshooting" },
    ],
    content: [
      { type: "p", text: "The LED Broadcast Display is the centrepiece of any BidWar auction. It's the screen that the entire audience — players, owners, spectators — watches as bids fly in real time. A well-configured display makes your auction look professional and creates genuine excitement. Here's how to set it up right." },

      { type: "h2", id: "hardware-requirements", text: "Hardware Requirements" },
      { type: "p", text: "BidWar's display is a browser-based application — it runs on any modern device with a web browser connected to your local network. You don't need any special hardware." },
      { type: "ul", items: [
        "**Display device** — a laptop, desktop, or Android TV stick connected to your projector or TV via HDMI.",
        "**Projector or TV** — any 720p or higher output. Full HD (1080p) is recommended. 4K works too but adds no meaningful benefit.",
        "**Browser** — Chrome 90+ or Edge 90+ give the best performance. Avoid mobile Safari for the display screen.",
        "**Network** — Wi-Fi with a stable connection. If the venue's Wi-Fi is unreliable, run a dedicated mobile hotspot for BidWar devices only.",
      ]},
      { type: "callout", heading: "Can BidWar work fully offline?", text: "Yes — BidWar can run on a local network without any internet connection. All devices (operator, owner panels, LED display) just need to be on the same Wi-Fi network. Internet is only required for initial account access and report exports." },

      { type: "h2", id: "connecting-the-display", text: "Connecting the Display" },
      { type: "steps", heading: "Step-by-step connection", items: [
        "On your **display device** (the laptop or TV stick connected to the projector), open Chrome and navigate to your BidWar tournament URL.",
        "Log in as the organizer, open the tournament, and click **Display → Open LED Broadcast**.",
        "A new browser tab opens showing the BidWar standby screen. This is what the projector will show.",
        "Set that tab to **fullscreen** (F11 on Windows, Cmd+Ctrl+F on Mac) or use Chrome's **Present to** option for projector output.",
        "On your **operator device** (tablet or laptop), stay on the tournament dashboard to control the auction.",
        "The two tabs communicate in real time — everything you do on the operator panel appears instantly on the display.",
      ]},

      { type: "h2", id: "layout-and-settings", text: "Layout and Display Settings" },
      { type: "p", text: "BidWar's LED display layout automatically adapts to the player data available. Key display elements include:" },
      { type: "ul", items: [
        "**Player photo** — centre-left of the display. Recommended photo size: 600×800 px portrait, JPEG or WebP.",
        "**Player name and category badge** — top of the display, large text for readability at distance.",
        "**Current bid amount** — prominent centre-right, updates in real time with a colour flash on each new bid.",
        "**Bidding franchise name and logo** — shows the current highest bidder's team identity.",
        "**Countdown timer** — visible to operators but can be hidden from the main display in settings if you're using manual timing.",
      ]},
      { type: "tip", heading: "Dark theme is more readable on projectors", text: "BidWar's display uses a high-contrast dark theme by default. Avoid changing it to light mode — projectors in daylight lose significant contrast and the dark theme remains readable further back in the room." },

      { type: "h2", id: "projector-tips", text: "Projector & TV Tips" },
      { type: "ul", items: [
        "**Resolution** — set the projector input to 1920×1080 (Full HD) via Windows display settings before starting the display tab.",
        "**Aspect ratio** — BidWar's display is designed for 16:9. If you see black bars on the sides, check the projector's aspect ratio setting.",
        "**Brightness** — for outdoor or large-hall setups, use a projector with at least 3,000 lumens. In darker indoor venues, 2,000 lumens is sufficient.",
        "**TV (large panel)** — plug directly into the HDMI port on the TV and use Chrome on the TV's browser if it has one, or use an HDMI cable from a laptop.",
        "**HDMI audio** — the display doesn't use audio, but be aware that switching HDMI inputs may mute venue audio if it's routed through the same system.",
      ]},

      { type: "h2", id: "troubleshooting", text: "Troubleshooting" },
      { type: "ul", items: [
        "**Display not updating** — check that the display device is on the same Wi-Fi network as the operator tablet. Reload the display tab.",
        "**Bid amounts lag behind** — this usually indicates high Wi-Fi latency. Move the router closer or switch to a dedicated hotspot.",
        "**Player photo not showing** — the photo may not have finished uploading. Go to the player's profile and re-upload. Photos display within 2–3 seconds of upload.",
        "**Fullscreen exits unexpectedly** — Windows UAC prompts or notifications can exit fullscreen. Before auction day, enable Focus Assist / Do Not Disturb on the display device.",
        "**Projector shows wrong resolution** — right-click desktop → Display settings → set the projector to 1920×1080 before opening the display tab.",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     POST 5: Corporate Sports Day Franchise Auction
  ───────────────────────────────────────────────────────────────────────── */
  "corporate-sports-day-auction": {
    tableOfContents: [
      { id: "why-franchise-format",    title: "Why Use the Franchise Format?" },
      { id: "planning-the-event",      title: "Planning the Event" },
      { id: "employee-player-pool",    title: "Building the Employee Player Pool" },
      { id: "team-structure",          title: "Team Budgets and Structure" },
      { id: "running-the-auction",     title: "Running the Auction" },
      { id: "engagement-tips",         title: "Employee Engagement Tips" },
    ],
    content: [
      { type: "p", text: "Corporate sports days are already fun. Add a franchise auction format and they become genuinely memorable — the kind of event employees book leave around and discuss in the cafeteria for weeks. This guide shows you how to run one using BidWar, designed specifically for HR teams, employee engagement committees, and office sports coordinators." },

      { type: "h2", id: "why-franchise-format", text: "Why Use the Franchise Format?" },
      { type: "p", text: "The traditional corporate sports day picks teams by random draw or department allocation. The franchise format introduces something more powerful: **investment and identity**." },
      { type: "ul", items: [
        "When employees bid for their colleagues, they become **emotionally invested** in their team's performance in a way that a random draw never achieves.",
        "It creates **water-cooler conversation** in the days and weeks before the event as team owners strategise.",
        "It rewards **actual sports talent** — good players are genuinely valuable, and the auction outcome reflects that.",
        "It's **scalable** — works equally well for 50 employees or 500.",
      ]},
      { type: "tip", heading: "Use virtual currency, not real money", text: "For corporate events, BidWar tournaments work best with virtual currency (e.g., \"10,000 BidCoins\" per franchise). Using actual money between colleagues creates awkwardness. Keep the stakes in the fun zone." },

      { type: "h2", id: "planning-the-event", text: "Planning the Event" },
      { type: "p", text: "Typical corporate franchise auction events run on a two-phase schedule: an **auction session** (30–60 minutes) followed by the **sports day itself** a week or two later. This builds anticipation and gives teams time to develop their identity." },
      { type: "ul", items: [
        "**Venue** — the auction can be in a conference room with a projector or done remotely over video call. BidWar works for both.",
        "**Duration** — a 60-employee, 6-franchise auction takes about 45 minutes. Add 10 minutes per additional 15 players.",
        "**Timing** — lunchtime events work well: 12:30–1:30 PM auction, 1:30–2:00 PM squads revealed.",
        "**Announcement** — use a poster and internal email 2 weeks before. Show the player list so employees see their name on the auction board.",
      ]},

      { type: "h2", id: "employee-player-pool", text: "Building the Employee Player Pool" },
      { type: "p", text: "The player pool is every employee who wants to participate in the sports day. To build it:" },
      { type: "steps", heading: "Creating the player pool", items: [
        "Send a registration form (Google Form works fine) asking: name, department, self-assessed sport skill, and preferred sport if running multi-sport.",
        "Categorise respondents by skill: **Expert** (regular sport club members), **Experienced** (plays regularly), **Casual** (occasional player), **Rookie** (first timer).",
        "Add everyone to BidWar as players in the corresponding category with their photo from the company directory.",
        "Share the full player list with franchise owners before auction day — they'll spend hours studying it.",
      ]},
      { type: "callout", heading: "Handle senior leadership carefully", text: "If the CEO or a senior leader is in the player pool, they often become overpriced due to social dynamics. Consider placing them in a fixed draft slot or giving them a protected pick — this avoids situations where a junior employee feels awkward outbidding their manager." },

      { type: "h2", id: "team-structure", text: "Team Budgets and Structure" },
      { type: "p", text: "For a 60-person corporate sports day split into 6 teams of 10:" },
      { type: "ul", items: [
        "Set each franchise's **virtual purse** to 1,00,000 BidCoins.",
        "Use 3 categories: Expert (base 15,000), Experienced (base 8,000), Casual/Rookie (base 3,000).",
        "Require each franchise to pick **exactly 10 players**, with **at least 2 Experienced or Expert** players.",
        "Allow teams to name themselves and pick a colour — this generates surprising amounts of creative energy.",
      ]},

      { type: "h2", id: "running-the-auction", text: "Running the Auction" },
      { type: "p", text: "Assign the most enthusiastic person in the room as the auctioneer. They'll use the BidWar operator panel while team owners (typically department heads or volunteers) bid on their mobiles." },
      { type: "p", text: "Run the Expert pool first (8–10 players), then Experienced (20 players), then Casual/Rookie (remaining 30). The Expert round generates the most noise — set a timer of 20–30 seconds per player and keep the pace up." },
      { type: "warning", heading: "Avoid private side deals", text: "In corporate settings, employees sometimes arrange trades outside the auction (\"I'll let you have her if you give me him\"). These break the system and cause hurt feelings. BidWar's live display keeps everything transparent — all bids visible to all participants." },

      { type: "h2", id: "engagement-tips", text: "Employee Engagement Tips" },
      { type: "ul", items: [
        "**Reveal team rosters** on a big screen immediately after the auction — take a screenshot of each franchise squad and put it in the company Slack/Teams channel.",
        "**Fantasy points** — BidWar integrates with scoring to track which players performed best. After the sports day, rank franchises by player performance points.",
        "**Champion trophy** — even a small trophy handed out with a speech at the next all-hands meeting dramatically increases participation in future events.",
        "**Repeat the event** — leagues with retentions (carry some players from last year) become richer each year as owners develop strategies.",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     POST 6: Streaming the Auction Live
  ───────────────────────────────────────────────────────────────────────── */
  "stream-auction-youtube-facebook": {
    tableOfContents: [
      { id: "why-stream",             title: "Why Stream Your Auction?" },
      { id: "what-youll-need",        title: "What You'll Need" },
      { id: "obs-setup",              title: "Setting Up OBS Studio" },
      { id: "broadcast-overlay",      title: "Adding the BidWar Overlay" },
      { id: "going-live",             title: "Going Live on YouTube / Facebook" },
      { id: "stream-quality-tips",    title: "Stream Quality Tips" },
    ],
    content: [
      { type: "p", text: "Not everyone can be in the room on auction day — players who registered but can't attend, fans following the league online, parents watching their child get picked up by a franchise. BidWar's **Broadcast Overlay** lets you stream the entire auction live on YouTube or Facebook with zero extra cost. Here's the complete setup guide." },

      { type: "h2", id: "why-stream", text: "Why Stream Your Auction?" },
      { type: "ul", items: [
        "**Absent stakeholders** — players, owners, or sponsors who can't be physically present can follow along in real time.",
        "**Social proof and promotion** — a live stream link is shareable. When players share it with their social networks, your league gets free marketing.",
        "**Permanent record** — YouTube saves the stream as a video. New players and sponsors can watch the previous year's auction when deciding to join.",
        "**Drama and commentary** — adding a commentator over the stream makes it feel like a real broadcast, massively increasing engagement.",
      ]},

      { type: "h2", id: "what-youll-need", text: "What You'll Need" },
      { type: "ul", items: [
        "**OBS Studio** — free, open-source streaming software for Windows/Mac/Linux. Download from obsproject.com.",
        "**BidWar Broadcast Overlay URL** — available in your tournament under Display → Broadcast Overlay.",
        "**YouTube or Facebook account** with Live streaming enabled (YouTube may require 24-hour verification for new accounts).",
        "**A microphone** (USB condenser or even a wired headset mic) for commentary.",
        "**Upload speed** — at least 5 Mbps upload for 1080p streaming. Test at fast.com before auction day.",
      ]},

      { type: "h2", id: "obs-setup", text: "Setting Up OBS Studio" },
      { type: "steps", heading: "OBS initial setup", items: [
        "Download and install OBS Studio from obsproject.com. Run the Auto-configuration Wizard on first launch — select **Optimize for streaming**.",
        "In OBS, click **Settings → Stream**. Set Service to **YouTube** (or Custom for Facebook). Paste your stream key (from YouTube Studio → Go Live → Stream Key).",
        "In the main OBS window, click **+** under Sources → **Browser** source. Name it \"BidWar Display\".",
        "Paste your BidWar Broadcast Overlay URL into the URL field. Set Width to 1920 and Height to 1080. Click OK.",
        "The BidWar live auction display should now appear in the OBS preview window.",
        "Add an **Audio Input Capture** source for your microphone. Adjust levels so commentary peaks around -12 dB in the OBS mixer.",
      ]},

      { type: "h2", id: "broadcast-overlay", text: "Adding the BidWar Overlay" },
      { type: "p", text: "BidWar's **Broadcast Overlay** is a separate, streaming-optimised version of the LED display. It's designed as a browser source for OBS with a transparent background, letting you layer it over camera feeds or other visuals." },
      { type: "ul", items: [
        "Find the Overlay URL in BidWar → Tournament → Display → **Broadcast Overlay for OBS**.",
        "This URL updates live just like the main display — bids, player photos, and franchise names all update in real time.",
        "To add a **camera** (showing the auctioneer or the venue): add a **Video Capture Device** source in OBS below the BidWar browser source. Position the camera feed behind the overlay.",
        "Use OBS **Scenes** to switch between: 1) Full auction display, 2) Camera + overlay (lower-third style), 3) Intermission screen with your league logo.",
      ]},
      { type: "tip", heading: "Test the overlay before the day", text: "Run a test stream (set YouTube visibility to 'Unlisted') and simulate a 5-minute auction. Check that bids appear within 1–2 seconds on the stream, player photos load correctly, and your microphone audio is clear." },

      { type: "h2", id: "going-live", text: "Going Live on YouTube / Facebook" },
      { type: "p", text: "For **YouTube**: Go to YouTube Studio → Go Live → Schedule Stream. Create a title like \"[League Name] Player Auction 2026 – Live\". Start the stream in OBS by clicking **Start Streaming** — YouTube shows a 10–30 second delay before the stream is visible to viewers." },
      { type: "p", text: "For **Facebook**: Go to your Page or Group → Live Video → Use Stream Key. Copy the Server URL and Stream Key into OBS Settings → Stream → Service: Custom. The OBS Start Streaming button also kicks off the Facebook stream." },
      { type: "p", text: "Share the stream link in your league's WhatsApp group 30 minutes before the auction starts. Pin the link in your description field." },

      { type: "h2", id: "stream-quality-tips", text: "Stream Quality Tips" },
      { type: "ul", items: [
        "**Bitrate** — 6,000 kbps for 1080p60, 4,000 kbps for 1080p30. Check your upload speed and go one tier below your max.",
        "**Encoder** — if your PC has an NVIDIA GPU, use **NVENC** (hardware encoding) in OBS settings for smoother performance.",
        "**Close background apps** — streaming while the operator is also running BidWar on the same machine can cause frame drops. Use a separate laptop for OBS if possible.",
        "**Stable power** — don't let the streaming PC run on battery during a long auction. Plug it in.",
        "**Stream title and description** — include the league name, sport, date, and team names in the YouTube description for post-event searchability.",
      ]},
    ],
  },
};

// ── Assemble full BlogPost objects ────────────────────────────────────────────

export const BLOG_POSTS: BlogPost[] = BLOG_POSTS_META.map((meta) => {
  const extra = CONTENT[meta.slug];
  if (!extra) {
    throw new Error(`Missing content for blog post slug: "${meta.slug}"`);
  }
  return { ...meta, ...extra };
});

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getRelatedPostsFull(slug: string, limit = 3): BlogPost[] {
  const meta = BLOG_POSTS_META.find((p) => p.slug === slug);
  if (!meta) return [];
  return getRelatedPosts(meta, limit)
    .map((m) => BLOG_POSTS.find((p) => p.slug === m.slug))
    .filter((p): p is BlogPost => p !== undefined);
}

export function getPostsByCategory(categorySlug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.category === categorySlug);
}

export function getPostsByTag(tagSlug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.tags.includes(tagSlug));
}

export function getPostsByAuthor(authorSlug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.author === authorSlug);
}

export function getFeaturedPosts(): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.featured);
}
