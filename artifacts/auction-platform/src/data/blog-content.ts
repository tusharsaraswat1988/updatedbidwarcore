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

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 1: How to Run a Sports Franchise Player Auction from Scratch
  ───────────────────────────────────────────────────────────────────────── */
  "how-to-run-franchise-player-auction": {
    tableOfContents: [
      { id: "what-is-franchise-auction", title: "What Is a Franchise Player Auction?" },
      { id: "pre-auction-setup", title: "Pre-Auction Setup" },
      { id: "team-and-purse-structure", title: "Team & Purse Structure" },
      { id: "player-categories", title: "Player Categories and Order" },
      { id: "running-live-auction", title: "Running the Live Auction" },
      { id: "post-auction-steps", title: "Post-Auction Steps" },
      { id: "bidwar-setup", title: "Setting It All Up in BidWar" },
    ],
    content: [
      { type: "p", text: "A franchise player auction is the most exciting format for any sports league — team owners compete in real time to build their squads, making every bid a moment of strategy and tension. Whether you're organizing a 6-team cricket league or a 12-team football event, this guide covers every decision from pre-event planning through post-auction wrap-up." },
      { type: "h2", id: "what-is-franchise-auction", text: "What Is a Franchise Player Auction?" },
      { type: "p", text: "In a franchise player auction, team owners are each assigned a fixed budget (called a **purse** or **wallet**). Players are presented one at a time and owners bid against each other. The highest bidder wins the player, and that amount is deducted from their purse. Owners must manage their budget across an entire session — spending big on marquee players means less money for squad depth." },
      { type: "p", text: "Unlike a random draw, an auction rewards strategic thinking. Owners who study player value, time their bids well, and manage their purse wisely end up with stronger squads. This creates genuine investment in the league and much higher engagement on match days." },
      { type: "h2", id: "pre-auction-setup", text: "Pre-Auction Setup" },
      { type: "p", text: "A smooth auction day depends entirely on preparation done days or weeks before. Start by finalising your player list — every player who will be available in the auction. Collect photos, positions, any relevant stats, and jersey numbers if applicable." },
      { type: "ul", items: [
        "Finalise the complete player list at least one week before auction day",
        "Decide how many teams will participate (6–12 is ideal for most events)",
        "Confirm team owner names and contact numbers",
        "Set the total number of players each squad must have by auction end",
        "Decide whether unsold players can be re-nominated or are dropped",
      ]},
      { type: "tip", heading: "Send owners a pre-auction playbook", text: "Email all team owners a document explaining the purse amount, category structure, squad size requirements, and auction day schedule at least 3 days before the event. This reduces confusion on the day and lets everyone arrive prepared." },
      { type: "h2", id: "team-and-purse-structure", text: "Team & Purse Structure" },
      { type: "p", text: "The purse budget is the engine of your auction. Set it too low and bidding wars can't develop; set it too high and players get way over-bid, which can upset organizers if prize pools are involved." },
      { type: "p", text: "A common formula: **Total purse = base price of all players × 1.3 ÷ number of teams**. This gives each team enough to bid competitively for the players they want while keeping the total auction value in a realistic range." },
      { type: "p", text: "For most local leagues, a purse between ₹50,000 and ₹5,00,000 (virtual money) works well. The actual amount matters less than the ratio — all teams should have a purse large enough to buy at least their minimum required squad." },
      { type: "h2", id: "player-categories", text: "Player Categories and Order" },
      { type: "p", text: "Dividing players into tiers creates the auction's narrative arc. Marquee players go first — they generate the biggest bidding wars and set the energy for the rest of the session. Standard and emerging players follow." },
      { type: "steps", items: [
        "**Marquee/Elite**: Top 15–20% of players; highest base prices; goes first",
        "**Standard**: Core of the player pool; mid-range base prices",
        "**Emerging/Uncapped**: Young or unknown players; low base prices; often bargains",
        "**Specialist** (optional): Wicketkeepers, foreign players, etc., depending on sport",
      ]},
      { type: "h2", id: "running-live-auction", text: "Running the Live Auction" },
      { type: "p", text: "The auctioneer presents each player on the LED display or projector screen. A countdown timer (typically 10–30 seconds) starts. Owners raise their paddles, click on the mobile app, or call out bids. Each new bid resets the timer. When the timer reaches zero with no higher bid, the player is SOLD." },
      { type: "p", text: "**Pace management is critical.** Move too fast and owners miss bids; too slow and attention drifts. Aim for an average of 3–5 minutes per player including presentation time. A 150-player pool should take 6–8 hours with breaks." },
      { type: "warning", heading: "Never skip breaks", text: "For auctions running more than 3 hours, schedule 15-minute breaks every 90 minutes. Decision fatigue sets in fast — owners making tired bids leads to regret, complaints, and reduced interest in future editions." },
      { type: "h2", id: "post-auction-steps", text: "Post-Auction Steps" },
      { type: "p", text: "Once the final player is sold, export the full auction results immediately. Share team rosters with all owners the same day. BidWar generates a complete PDF report showing each team's squad, total spend, remaining purse, and individual player sale prices." },
      { type: "h2", id: "bidwar-setup", text: "Setting It All Up in BidWar" },
      { type: "p", text: "BidWar handles the entire auction end-to-end. Create your tournament, add teams with their purse amounts, upload your player list with photos and base prices, configure categories and auction order, then start your auction. Team owners join via QR code on their phones and bid in real time." },
      { type: "callout", heading: "Ready to start?", text: "Create a free BidWar account at [bidwar.in](/organizer) and use the quick-setup wizard to have your first tournament configured in under 15 minutes." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 2: How to Set Player Base Prices
  ───────────────────────────────────────────────────────────────────────── */
  "set-player-base-prices-franchise-auction": {
    tableOfContents: [
      { id: "why-base-prices-matter", title: "Why Base Prices Matter" },
      { id: "tiers", title: "Tier-Based Pricing Framework" },
      { id: "stat-based", title: "Stat-Based Approach" },
      { id: "purse-ratio", title: "Anchoring to the Team Purse" },
      { id: "common-mistakes", title: "Common Pricing Mistakes" },
    ],
    content: [
      { type: "p", text: "Base prices are the invisible architecture of your auction. They determine which players generate bidding wars, which ones slip through cheaply, and whether the auction ends with teams having balanced squads or massive leftover purses." },
      { type: "h2", id: "why-base-prices-matter", text: "Why Base Prices Matter" },
      { type: "p", text: "A base price is the minimum bid accepted for a player. If it's too low, a great player gets bought for a fraction of their value — owners who missed the bid resent the organizer. Too high, and the player goes unsold, which creates awkward silences and disrupts auction flow." },
      { type: "p", text: "The goal is to set prices that reflect perceived value closely enough that: (1) top players attract competitive bidding, (2) mid-tier players have realistic base prices that lead to interesting battles, and (3) lower-tier players are priced low enough that no team runs out of options." },
      { type: "h2", id: "tiers", text: "Tier-Based Pricing Framework" },
      { type: "p", text: "The simplest and most reliable approach is dividing your player pool into 3–4 value tiers and setting a base price range for each tier." },
      { type: "ul", items: [
        "**Tier 1 (Elite):** 10–15% of players. Base price: 15–20% of average team purse.",
        "**Tier 2 (Standard):** 40–50% of players. Base price: 5–10% of average team purse.",
        "**Tier 3 (Emerging):** 30–40% of players. Base price: 1–3% of average team purse.",
        "**Tier 4 (Specialist/Wildcard):** Sport-specific roles at negotiated prices.",
      ]},
      { type: "h2", id: "stat-based", text: "Stat-Based Approach" },
      { type: "p", text: "For more experienced leagues, base prices derived from actual performance stats earn more credibility with team owners. Create a simple scoring formula relevant to your sport:" },
      { type: "p", text: "**Example for cricket:** Score = (Batting average × 0.4) + (Strike rate ÷ 10 × 0.3) + (Wickets × 3 × 0.3). Normalize all scores to a 0–100 range, then map score ranges to price tiers." },
      { type: "tip", heading: "Publish your formula", text: "Sharing the scoring formula with owners before the auction prevents post-auction disputes about why certain players had certain base prices. Transparency builds trust." },
      { type: "h2", id: "purse-ratio", text: "Anchoring to the Team Purse" },
      { type: "p", text: "Whatever method you use, always anchor your prices to the team purse. Add up all player base prices across the entire pool and divide by the number of teams. The result should be no more than 60–70% of each team's purse. If it's higher, you're pricing too aggressively and some teams will run out of money before filling their squad." },
      { type: "h2", id: "common-mistakes", text: "Common Pricing Mistakes" },
      { type: "ul", items: [
        "**Setting identical prices for all players in a tier** — kills the excitement of differentiated bidding",
        "**Pricing based on reputation alone** — long-retired stars shouldn't command marquee prices if they haven't played recently",
        "**Not testing the math** — always simulate a full auction on paper before the event to check if teams can fill squads",
        "**Changing prices on auction day** — this destroys trust; once distributed, prices are final",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 3: How to Calculate Team Purse Budgets
  ───────────────────────────────────────────────────────────────────────── */
  "calculate-team-purse-budgets-franchise-league": {
    tableOfContents: [
      { id: "what-is-purse", title: "What Is a Team Purse?" },
      { id: "purse-formula", title: "The Purse Calculation Formula" },
      { id: "adjustments", title: "Adjusting for League Size" },
      { id: "purse-in-bidwar", title: "Setting Purse Amounts in BidWar" },
    ],
    content: [
      { type: "p", text: "The team purse — sometimes called wallet or budget — is the virtual currency each franchise owner uses to buy players. Get the amount right and your auction will produce competitive squads with minimal leftover funds. Get it wrong and you'll end up with lopsided teams or teams that can't afford mandatory minimum squad sizes." },
      { type: "h2", id: "what-is-purse", text: "What Is a Team Purse?" },
      { type: "p", text: "A purse is a fixed amount of virtual money (₹ or points) assigned to each team owner before the auction begins. Every time they win a player, the sale price is deducted. Owners must manage their remaining purse strategically — spending too much early leaves gaps in the squad later." },
      { type: "p", text: "The purse has no real monetary value unless your league uses it to determine prize distribution or has a salary-cap style penalty system. For most local leagues, it is entirely virtual and used purely to create bidding constraints." },
      { type: "h2", id: "purse-formula", text: "The Purse Calculation Formula" },
      { type: "p", text: "Use this formula as your starting point:" },
      { type: "callout", heading: "Purse Formula", text: "**Purse per team = (Sum of all base prices × 1.4) ÷ Number of teams**\n\nThe 1.4 multiplier allows for competitive bidding — if every player sold at exactly base price, teams would have 40% of their purse left over, which creates room for bidding wars on premium players." },
      { type: "p", text: "Example: 100 players with an average base price of ₹10,000 each. Total base price pool = ₹10,00,000. Multiplied by 1.4 = ₹14,00,000. Divided by 8 teams = **₹1,75,000 per team purse**." },
      { type: "h2", id: "adjustments", text: "Adjusting for League Size" },
      { type: "ul", items: [
        "**Fewer teams (4–6):** Use a 1.5x multiplier — fewer teams means each owner needs more budget to build a full squad",
        "**More teams (10–12):** Use a 1.3x multiplier — more competition naturally drives prices up",
        "**Marquee-heavy auctions:** Add 10–15% to account for bidding wars inflating top prices",
        "**First-time leagues:** Add a 20% buffer — rookie organizers often underestimate how aggressively owners bid",
      ]},
      { type: "tip", heading: "Test with a simulation", text: "Before finalizing, run a mental simulation: Can each team buy their minimum squad requirement at base prices? If not, increase purse amounts before the event." },
      { type: "h2", id: "purse-in-bidwar", text: "Setting Purse Amounts in BidWar" },
      { type: "p", text: "In BidWar, you set purse amounts per team in the Teams section. You can also configure a **minimum purse reserve** — an amount each team must hold back to ensure they can always afford late-auction mandatory picks. BidWar automatically blocks bids that would exceed a team's available purse." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 4: How to Handle Unsold Players
  ───────────────────────────────────────────────────────────────────────── */
  "handle-unsold-players-franchise-auction": {
    tableOfContents: [
      { id: "why-players-go-unsold", title: "Why Players Go Unsold" },
      { id: "re-auction-pool", title: "The Re-Auction Pool" },
      { id: "negotiated-signings", title: "Negotiated Signings" },
      { id: "mandatory-picks", title: "Mandatory Pick Draft" },
      { id: "preventing-unsold", title: "Preventing Too Many Unsold Players" },
    ],
    content: [
      { type: "p", text: "Unsold players are an inevitable reality of any franchise auction. Whether it's a player with an overpriced base price, a position that's already filled on every team, or someone simply not known well enough to attract bids — organizers need a clear plan for what happens next." },
      { type: "h2", id: "why-players-go-unsold", text: "Why Players Go Unsold" },
      { type: "ul", items: [
        "**Base price too high** — no team is willing to pay the minimum for a player of that caliber",
        "**Position saturation** — every team already has enough players in that role",
        "**Late in the auction** — teams have spent most of their purse on earlier players",
        "**Unknown player** — owners don't know the player and won't risk budget on an unknown",
        "**Collusion** — in rare cases, owners agree not to bid against each other on certain players",
      ]},
      { type: "h2", id: "re-auction-pool", text: "The Re-Auction Pool" },
      { type: "p", text: "The most common approach: after the main auction ends, all unsold players are pooled together and re-auctioned at a 50% reduced base price. Teams with the most remaining purse have the most flexibility, but teams with roster gaps can also get required players at bargain prices." },
      { type: "p", text: "Run the re-auction immediately after the main auction, while owners are still present. Keep it fast — 1–2 minutes per player maximum." },
      { type: "h2", id: "negotiated-signings", text: "Negotiated Signings" },
      { type: "p", text: "If players remain unsold even after a re-auction, allow teams to sign them via direct negotiation at the base price or below. In BidWar, you can manually record these signings by marking the player as sold to a specific team at the agreed price." },
      { type: "h2", id: "mandatory-picks", text: "Mandatory Pick Draft" },
      { type: "p", text: "For leagues with minimum squad sizes: if a team hasn't filled their minimum slots by the end of re-auction, use a **reverse standing draft** — the team that spent the least gets first pick of remaining unsold players, and so on. Players are assigned at their reduced base price." },
      { type: "tip", heading: "Communicate the policy in advance", text: "Include your unsold player policy in the pre-auction rulebook sent to owners. Knowing what happens to unsold players removes ambiguity and reduces complaints on auction day." },
      { type: "h2", id: "preventing-unsold", text: "Preventing Too Many Unsold Players" },
      { type: "ul", items: [
        "Set realistic base prices — review and adjust any player whose price seems too high",
        "Limit the player pool size — 15–20 players per team slot is a good ratio",
        "Balance categories so that all required positions have enough players available",
        "Consider using **nomination-based auction** where teams nominate players to the pool, ensuring demand for every nominated player",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 5: How to Run a Retention Round
  ───────────────────────────────────────────────────────────────────────── */
  "run-retention-round-before-franchise-auction": {
    tableOfContents: [
      { id: "what-is-retention", title: "What Is a Retention Round?" },
      { id: "retention-slots", title: "How Many Players Can Be Retained?" },
      { id: "retention-cost", title: "Retention Cost Deductions" },
      { id: "rtm-cards", title: "Right to Match (RTM) Cards" },
      { id: "setup-in-bidwar", title: "Setting Up Retention in BidWar" },
    ],
    content: [
      { type: "p", text: "A retention round allows franchise teams to keep selected players from the previous season before the main auction begins. This creates continuity, rewards teams that invested in developing young players, and gives the auction a clear narrative around who is available." },
      { type: "h2", id: "what-is-retention", text: "What Is a Retention Round?" },
      { type: "p", text: "Before the auction, each team may retain a limited number of players at predetermined costs (deducted from their auction purse). The retained players are removed from the auction pool. This mirrors how the IPL, PKL, and ISL handle squad continuity between seasons." },
      { type: "h2", id: "retention-slots", text: "How Many Players Can Be Retained?" },
      { type: "p", text: "The standard local league allocation is **2–3 retentions per team**. More than 3 retentions starts to remove too many top players from the auction pool, reducing bidding excitement. Fewer than 2 means teams lose players they invested in developing, reducing long-term owner commitment." },
      { type: "ul", items: [
        "**2-team league formats:** 3 retentions per team",
        "**6–8 team leagues:** 2–3 retentions per team",
        "**10+ team leagues:** 1–2 retentions per team (to maintain a large available pool)",
      ]},
      { type: "h2", id: "retention-cost", text: "Retention Cost Deductions" },
      { type: "p", text: "Teams must pay a cost for each retained player — deducted from their auction purse. This prevents teams from hoarding all the best players for free. A common structure:" },
      { type: "steps", items: [
        "**First retention:** 25% of team purse deducted",
        "**Second retention:** 15% of team purse deducted",
        "**Third retention:** 10% of team purse deducted",
      ]},
      { type: "p", text: "This means a team retaining 3 players enters the auction with only 50% of their purse — a meaningful trade-off that keeps the auction competitive." },
      { type: "h2", id: "rtm-cards", text: "Right to Match (RTM) Cards" },
      { type: "p", text: "RTM cards allow a team to **match the highest bid** for a player they didn't retain at the start of the auction. If they choose to exercise the RTM, they buy the player at the final bid price from their purse. RTM cards add drama — owners never know until the final bid whether their marquee player is truly available." },
      { type: "warning", heading: "Keep RTM rules simple", text: "RTM rules are complex and can lead to disputes if not clearly communicated. For first-time retention leagues, skip RTM entirely and only introduce it once owners are comfortable with the basic retention format." },
      { type: "h2", id: "setup-in-bidwar", text: "Setting Up Retention in BidWar" },
      { type: "p", text: "In BidWar, mark retained players as sold to their respective teams before starting the main auction. Deduct the retention cost from each team's purse in the team settings. The retained players will appear in team rosters but won't come up in the auction queue." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 6: How to Create Player Categories
  ───────────────────────────────────────────────────────────────────────── */
  "create-player-categories-franchise-auction": {
    tableOfContents: [
      { id: "why-categories", title: "Why Categories Are Essential" },
      { id: "standard-structure", title: "The Standard 4-Tier Structure" },
      { id: "sport-specific", title: "Sport-Specific Category Variations" },
      { id: "auction-order", title: "Auction Order Strategy" },
      { id: "squad-requirements", title: "Linking Categories to Squad Requirements" },
    ],
    content: [
      { type: "p", text: "Player categories define the bidding narrative of your auction. They determine which players go up when, at what minimum price, and what the maximum squad composition looks like for each team. A well-structured category system makes the auction feel professionally run; a poorly structured one creates confusion and disputes." },
      { type: "h2", id: "why-categories", text: "Why Categories Are Essential" },
      { type: "p", text: "Without categories, an auction would present 200 players in random order — owners wouldn't know when to save budget and when to spend. Categories create strategic windows: 'I need to save enough for the Emerging round to get those cheap gems' or 'If I miss this Marquee player, there won't be another one in my position.' This strategic depth is what makes franchise auctions so engaging." },
      { type: "h2", id: "standard-structure", text: "The Standard 4-Tier Structure" },
      { type: "steps", items: [
        "**Marquee / Elite:** Top 10–15% of players by reputation and ability. Highest base prices. Presented first. Maximum 1–2 per team.",
        "**Standard / Core:** The majority of the pool (40–50%). Mid-range prices. Presented second. Form the backbone of most squads.",
        "**Emerging / Uncapped:** Younger or less-known players with high potential. Lowest prices. Often the source of auction bargains.",
        "**Specialist (optional):** Position-specific categories like wicketkeepers, foreign players, or all-rounders. Can be interleaved or saved for last.",
      ]},
      { type: "h2", id: "sport-specific", text: "Sport-Specific Category Variations" },
      { type: "p", text: "Different sports call for different category structures. Football auctions often use **position groups** (Strikers, Midfielders, Defenders, Goalkeepers) instead of tier levels — teams bid for a quota of each position. Kabaddi uses **role categories** (Raiders, All-Rounders, Defenders). Badminton uses **discipline categories** (Men's Singles, Women's Singles, Doubles, Mixed)." },
      { type: "tip", heading: "Limit cross-category flexibility", text: "If using position-based categories, set minimum and maximum quotas per position per team. A football team that buys 8 strikers and 1 defender makes for an unbalanced league. BidWar lets you configure squad composition requirements per category." },
      { type: "h2", id: "auction-order", text: "Auction Order Strategy" },
      { type: "p", text: "The order players are presented within each category matters too. Within the Marquee category, presenting the most contested players first (rather than last) creates immediate excitement and sets the auction's energy for the entire session. Within Standard, interleave positions to ensure every team has opportunities to bid for players they need." },
      { type: "h2", id: "squad-requirements", text: "Linking Categories to Squad Requirements" },
      { type: "p", text: "For each category, define a **minimum requirement** — how many players from that category each team must have in their final squad. This prevents teams from spending entirely on marquee players and fielding an incomplete squad. BidWar enforces these minimums and alerts the auctioneer if a team is at risk of not meeting them before the auction ends." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 7: Online-Only Remote Player Auction
  ───────────────────────────────────────────────────────────────────────── */
  "online-only-remote-sports-player-auction": {
    tableOfContents: [
      { id: "online-format-overview", title: "How an Online Auction Works" },
      { id: "platform-requirements", title: "Platform Requirements" },
      { id: "video-call-setup", title: "Video Call Setup" },
      { id: "mobile-bidding", title: "Mobile Bidding for Remote Owners" },
      { id: "troubleshooting-remote", title: "Troubleshooting Common Issues" },
    ],
    content: [
      { type: "p", text: "Not everyone can be in the same room for auction day. Remote team owners, organizers in different cities, and post-pandemic habits have made online-only franchise auctions completely mainstream. BidWar supports fully remote auctions with mobile bidding, broadcast overlay sharing, and real-time sync across devices." },
      { type: "h2", id: "online-format-overview", text: "How an Online Auction Works" },
      { type: "p", text: "In a remote auction, the organizer acts as the auctioneer, managing the auction from BidWar's admin panel. Team owners join via a QR code link on their phones or laptops. The main display — which would normally be a projector — is shared via video call screen share. Every bid happens through the mobile/web bidding interface." },
      { type: "h2", id: "platform-requirements", text: "Platform Requirements" },
      { type: "ul", items: [
        "**BidWar account** with your tournament, teams, and players configured in advance",
        "**Stable internet** for the organizer — minimum 10 Mbps upload for smooth broadcast sharing",
        "**Video conferencing** — Google Meet, Zoom, or Teams for screen-sharing the BidWar display",
        "**Mobile browser access** for team owners — no app install needed",
      ]},
      { type: "h2", id: "video-call-setup", text: "Video Call Setup" },
      { type: "p", text: "Screen-share BidWar's Broadcast Overlay mode from the organizer's laptop on the video call. This gives all participants the same full-screen player display that would normally appear on an LED screen. Owners see the current player, timer, and live bid amounts in real time." },
      { type: "tip", heading: "Record the auction", text: "Enable recording on your video call platform. This creates a permanent record of every bid, which is invaluable if any bid disputes arise after the event." },
      { type: "h2", id: "mobile-bidding", text: "Mobile Bidding for Remote Owners" },
      { type: "p", text: "Each team owner receives a unique QR code link before auction day. They open it on their phone or laptop browser — no app install required. The BidWar bidding interface shows their current purse, the active player, the current highest bid, and a **Bid** button. One tap submits the next increment bid." },
      { type: "h2", id: "troubleshooting-remote", text: "Troubleshooting Common Issues" },
      { type: "ul", items: [
        "**Owner can't connect:** Have their QR code link ready as a direct URL backup",
        "**Bid not registering:** Ask them to refresh their browser — mobile browsers sometimes drop the connection",
        "**Lag in video call:** Reduce screen share resolution; BidWar's bidding interface works independently of the call",
        "**Owner drops out mid-auction:** Pause the auction, wait 2 minutes, then continue — BidWar retains all state",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 8: Draft vs Auction Format
  ───────────────────────────────────────────────────────────────────────── */
  "player-draft-vs-player-auction-sports-format": {
    tableOfContents: [
      { id: "how-draft-works", title: "How a Snake Draft Works" },
      { id: "how-auction-works", title: "How a Player Auction Works" },
      { id: "engagement", title: "Engagement & Entertainment" },
      { id: "fairness", title: "Fairness & Competitive Balance" },
      { id: "time-and-logistics", title: "Time & Logistics" },
      { id: "which-to-choose", title: "Which Format Should You Choose?" },
    ],
    content: [
      { type: "p", text: "Two formats dominate franchise team-building — the snake draft and the live auction. Both produce franchise squads, but they create completely different experiences for team owners and spectators. Understanding the trade-offs helps you pick the right format for your league's context." },
      { type: "h2", id: "how-draft-works", text: "How a Snake Draft Works" },
      { type: "p", text: "In a snake draft, teams take turns picking players in a set order. Round 1: Team 1 picks, Team 2 picks, …, Team 8 picks. Round 2 reverses: Team 8 picks, …, Team 1 picks. This 'snake' pattern continues until all roster slots are filled. No money is involved — every team has equal picking opportunities." },
      { type: "h2", id: "how-auction-works", text: "How a Player Auction Works" },
      { type: "p", text: "In a live auction, each player is presented and teams bid against each other. The highest bidder wins, and the sale price is deducted from their fixed budget (purse). Teams must strategically manage their remaining budget across the entire session — creating real pressure and strategy on every single bid." },
      { type: "h2", id: "engagement", text: "Engagement & Entertainment" },
      { type: "p", text: "**Auction wins, decisively.** Every bid is a decision. Will you go one increment higher? Can you afford to? Will another owner outbid you? This real-time tension makes auctions spectacular to watch, even for spectators who aren't owners. Drafts, by contrast, feel like a spreadsheet exercise — each pick happens in sequence with no counter-play." },
      { type: "h2", id: "fairness", text: "Fairness & Competitive Balance" },
      { type: "p", text: "**Draft is more mechanically fair** — every team has the same number of picks. But auctions produce better **competitive balance** because good strategists can build better squads with the same budget through smart timing and value identification. Draft order (which is often random or reward-based) creates structural advantages; auction purse amounts are equal." },
      { type: "h2", id: "time-and-logistics", text: "Time & Logistics" },
      { type: "p", text: "**Drafts are faster** — a 10-round draft for 10 teams takes about 90 minutes. Auctions run longer: plan for 4–8 hours for a full player pool. Auctions also require more setup: purse management, bid timers, and LED display hardware. But this investment pays back in the experience quality." },
      { type: "h2", id: "which-to-choose", text: "Which Format Should You Choose?" },
      { type: "ul", items: [
        "**Choose a draft** if: this is your first franchise event, time is very limited, owners aren't familiar with auction formats, or you have fewer than 6 teams",
        "**Choose an auction** if: you want maximum engagement, owners are competitive, you have 3+ hours, you want the event to feel professional and spectacular",
        "**Consider a hybrid:** Some leagues use a 2-round draft for marquee players (equal access to stars) then auction the remaining pool — combining the best of both formats",
      ]},
      { type: "callout", heading: "BidWar supports both", text: "BidWar's auction engine handles live bidding beautifully. For draft-based events, you can use the manual assignment feature to record picks in order. Most leagues that try the auction format don't go back to drafts." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 9: IPL-Style Auction Format
  ───────────────────────────────────────────────────────────────────────── */
  "ipl-style-auction-format-local-cricket-leagues": {
    tableOfContents: [
      { id: "ipl-format-explained", title: "The IPL Auction Format Explained" },
      { id: "purse-structure", title: "Purse Structure" },
      { id: "player-sets", title: "Player Sets and Bidding Order" },
      { id: "retention-overview", title: "Retention Before the Auction" },
      { id: "local-adaptations", title: "Adapting for Local Leagues" },
    ],
    content: [
      { type: "p", text: "The Indian Premier League auction is the most watched franchise player auction in the world — and its format is well-designed enough that local cricket leagues of any size can replicate the core structure with minimal adaptation. Here's a plain-language breakdown of exactly how it works." },
      { type: "h2", id: "ipl-format-explained", text: "The IPL Auction Format Explained" },
      { type: "p", text: "Each IPL franchise enters the auction with a fixed salary cap (purse) — currently ₹100 crore. Players are divided into sets by nationality, role, and tier. An auctioneer presents each player with their base price shown on a large screen. Franchises bid by raising a paddle; the highest bidder wins. Unsold players go into a pool for potential re-auction at 50% base price." },
      { type: "h2", id: "purse-structure", text: "Purse Structure" },
      { type: "p", text: "Every franchise gets an identical purse — this is the defining fairness mechanism of the IPL format. There are no differences in starting budget based on past performance. A team that finished last gets the same auction power as the defending champion." },
      { type: "p", text: "For local leagues, set purses between ₹50,000 and ₹10,00,000 (virtual) — the actual number matters less than consistency across all teams." },
      { type: "h2", id: "player-sets", text: "Player Sets and Bidding Order" },
      { type: "p", text: "Players are grouped into sets: **capped Indians** (experienced), **uncapped Indians** (up-and-coming), **overseas players** (if allowed), and sometimes a **marquee set** of the most sought-after players presented first. Presenting marquees first creates immediate bidding excitement and sets expectations for the session." },
      { type: "h2", id: "retention-overview", text: "Retention Before the Auction" },
      { type: "p", text: "Before the main auction, each franchise can retain up to a set number of players at predetermined costs deducted from their purse. Retained players don't appear in the auction pool. This gives continuity to successful teams while still maintaining a large available player pool." },
      { type: "h2", id: "local-adaptations", text: "Adapting for Local Leagues" },
      { type: "ul", items: [
        "**Purse:** Scale down to ₹1–5 lakh virtual money per team",
        "**Sets:** Use 3 sets — Elite, Standard, Emerging — based on local player ability",
        "**Overseas:** Replace with 'Guest player' slots if your league allows outside city/organization players",
        "**Retention:** Allow 1–2 retentions for returning leagues; skip for inaugural seasons",
        "**Auctioneer:** Designate a dedicated auctioneer (not a team owner) for credibility",
      ]},
      { type: "tip", heading: "Use BidWar's IPL-style setup", text: "BidWar was built specifically for this format. The LED display mode, countdown timer, and mobile bidding interface mirror the IPL auction experience perfectly at any scale." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 10: IPL Retention Policy
  ───────────────────────────────────────────────────────────────────────── */
  "ipl-retention-policy-local-cricket-leagues": {
    tableOfContents: [
      { id: "ipl-retention-rules", title: "IPL Retention Rules in Brief" },
      { id: "simplifying-for-local", title: "Simplifying for Local Leagues" },
      { id: "cost-structure", title: "Cost Structure for Retentions" },
      { id: "announcing-retentions", title: "Announcing Retentions Publicly" },
    ],
    content: [
      { type: "p", text: "IPL franchises can retain a limited number of players before each auction. Retained players cost a set deduction from the team's purse — a mechanism designed to allow continuity while keeping the auction competitive. Local leagues can implement a simplified version of this policy with minimal complexity." },
      { type: "h2", id: "ipl-retention-rules", text: "IPL Retention Rules in Brief" },
      { type: "p", text: "In the IPL, each franchise may retain up to 5 players (combination of Indian and overseas) at specific salary deductions from their ₹100 crore cap. Retained players cannot be nominated for auction by other franchises. If retained, they are guaranteed their retention price as salary — even if their auction value would have been lower." },
      { type: "h2", id: "simplifying-for-local", text: "Simplifying for Local Leagues" },
      { type: "p", text: "Local leagues don't need the complexity of Indian vs overseas slots or complex salary tiers. A simple structure works well:" },
      { type: "steps", items: [
        "Each team may retain **1–3 players** from the previous season",
        "Retention decisions are submitted to the organizer **7 days before** auction day",
        "Retained players are removed from the auction pool",
        "Each team's purse is reduced by the retention cost before auction day",
      ]},
      { type: "h2", id: "cost-structure", text: "Cost Structure for Retentions" },
      { type: "p", text: "Use graduated costs to prevent teams from retaining all their best players for a small price:" },
      { type: "ul", items: [
        "**Retention 1:** Deduct ₹30,000 (or 25% of purse for proportional systems)",
        "**Retention 2:** Deduct ₹20,000 (15% of purse)",
        "**Retention 3:** Deduct ₹10,000 (8% of purse)",
      ]},
      { type: "h2", id: "announcing-retentions", text: "Announcing Retentions Publicly" },
      { type: "p", text: "Announce all team retentions to all owners simultaneously — via group WhatsApp, email, or during a pre-auction video call. Transparency here prevents suspicion of favoritism. Each team should see exactly who every other team has retained before the auction begins." },
      { type: "tip", heading: "Don't skip the announcement", text: "Owners who arrive at the auction not knowing which players are retained will be disoriented from the start. A public retention announcement creates buzz and starts the auction conversation early." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 11: Set Cricket Player Base Prices Based on Stats
  ───────────────────────────────────────────────────────────────────────── */
  "set-cricket-player-base-prices-stats": {
    tableOfContents: [
      { id: "why-stat-based", title: "Why Stat-Based Pricing?" },
      { id: "batsman-formula", title: "Batsman Price Formula" },
      { id: "bowler-formula", title: "Bowler Price Formula" },
      { id: "all-rounder-formula", title: "All-Rounder Formula" },
      { id: "normalising-prices", title: "Normalizing to Your Purse Scale" },
    ],
    content: [
      { type: "p", text: "Stat-based pricing removes the most common source of pre-auction controversy: 'Why is Player X priced so much higher than Player Y?' When prices come from objective metrics, owners may disagree with the formula but they can't claim bias. This is especially important in leagues where team owners know each other personally." },
      { type: "h2", id: "why-stat-based", text: "Why Stat-Based Pricing?" },
      { type: "p", text: "**Three benefits of stats-based pricing:** First, it is defensible — owners can see exactly why a price was set. Second, it scales — you can process 200 players without making 200 individual judgment calls. Third, it creates interesting auction dynamics — undervalued players (by reputation) who have good stats can become surprise premium picks." },
      { type: "h2", id: "batsman-formula", text: "Batsman Price Formula" },
      { type: "p", text: "A simple batting score: **(Batting Average × 0.5) + (Strike Rate ÷ 10 × 0.3) + (Half-centuries × 2 × 0.2)**. Weight these components based on your format — T20 leagues should weight Strike Rate more heavily; 50-over formats should weight Average more." },
      { type: "h2", id: "bowler-formula", text: "Bowler Price Formula" },
      { type: "p", text: "Bowling score: **(Wickets per match × 10 × 0.5) + ((8 - Economy rate) × 5 × 0.3) + (5-wicket hauls × 5 × 0.2)**. Economy rate below 6 scores positively; above 8 scores negatively. Adjust weights for your format." },
      { type: "h2", id: "all-rounder-formula", text: "All-Rounder Formula" },
      { type: "p", text: "For all-rounders, take **60% of the batting score + 60% of the bowling score**. This allows all-rounders to score higher than pure specialists while not double-counting their contributions." },
      { type: "h2", id: "normalising-prices", text: "Normalizing to Your Purse Scale" },
      { type: "p", text: "Once you have raw scores for all players, map them to actual price tiers. Find your highest-scored player — their price becomes your **Marquee base price** (e.g., ₹50,000). Scale all other prices linearly: a player with 80% of the top score gets 80% of the marquee price. Set a floor — the minimum any player can be priced at regardless of score — to ensure every player is biddable." },
      { type: "tip", heading: "Share the spreadsheet", text: "Export your scoring spreadsheet and share it with all team owners before auction day. Players and owners who can verify their scores are far more likely to accept pricing decisions as fair." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 12: Franchise Cricket League Rules Template
  ───────────────────────────────────────────────────────────────────────── */
  "franchise-cricket-league-rules-complete-template": {
    tableOfContents: [
      { id: "squad-rules", title: "Squad Composition Rules" },
      { id: "auction-rules", title: "Auction Rules" },
      { id: "retention-rules", title: "Retention Rules" },
      { id: "match-rules", title: "Match Rules" },
      { id: "dispute-resolution", title: "Dispute Resolution" },
    ],
    content: [
      { type: "p", text: "Good rules are the foundation of every successful franchise league. They prevent disputes, create predictability, and let everyone focus on the fun parts. Use this template as a starting point — copy it, adapt names and numbers to your context, and distribute it to all owners at least one week before auction day." },
      { type: "h2", id: "squad-rules", text: "Squad Composition Rules" },
      { type: "ul", items: [
        "Each team must have a minimum of **15 players** and a maximum of **20 players** in their final squad",
        "A squad must include at least **2 wicketkeepers**, **4 specialist bowlers**, and **2 all-rounders**",
        "A maximum of **[N] guest players** (from outside the organisation) allowed per squad",
        "The playing XI on any match day must include at least **[N] players** from the team's primary organisation or department",
      ]},
      { type: "h2", id: "auction-rules", text: "Auction Rules" },
      { type: "ul", items: [
        "Each team's auction purse is **₹[X]** — identical for all teams",
        "Bids are made in increments of **₹[Y]** — no lower increments accepted",
        "A team may not bid on a player they cannot afford (bid would leave them with less than minimum squad-filling budget)",
        "Once the auctioneer calls **'SOLD'**, the bid is final and cannot be reversed",
        "If a team owner is absent, they may designate a representative in writing before the auction",
      ]},
      { type: "h2", id: "retention-rules", text: "Retention Rules (for returning leagues)" },
      { type: "ul", items: [
        "Each team may retain up to **[N] players** from the previous season",
        "Retention submissions must be received by **[date/time]**",
        "Retention costs: 1st retention = ₹[A], 2nd retention = ₹[B], 3rd retention = ₹[C]",
        "A retained player who does not participate in the league forfeits their team's retention slot",
      ]},
      { type: "h2", id: "match-rules", text: "Match Rules" },
      { type: "ul", items: [
        "The franchise team owner (or designated captain) selects the playing XI at least **[N] minutes** before match start",
        "A minimum of **[N] players** from a team's squad must be present for the match to proceed",
        "Loan/emergency replacements for injured players must be approved by the organizer at least **24 hours** before the match",
      ]},
      { type: "h2", id: "dispute-resolution", text: "Dispute Resolution" },
      { type: "p", text: "All disputes are to be raised in writing to the tournament organizer within **24 hours** of the incident. The organizer's decision is final. Disputes raised verbally during the auction will not be considered." },
      { type: "tip", heading: "Laminate and post at the venue", text: "Print a one-page summary of the most important rules (squad minimums, bid increments, and dispute process) and post it at the auction venue. This prevents mid-auction arguments about rules that were documented but not remembered." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 13: Football Auction vs Random Draw
  ───────────────────────────────────────────────────────────────────────── */
  "football-franchise-auction-vs-random-draw": {
    tableOfContents: [
      { id: "random-draw-explained", title: "How a Random Draw Works" },
      { id: "auction-advantage", title: "Why Auctions Win on Engagement" },
      { id: "fairness-comparison", title: "Which Is Actually Fairer?" },
      { id: "time-cost", title: "Time & Setup Cost" },
      { id: "recommendation", title: "Which Should You Choose?" },
    ],
    content: [
      { type: "p", text: "Every football league organizer faces this choice: should teams be built through a live franchise auction or a random draw? The answer depends on your league's goals, your owners' experience level, and how much you care about engagement vs simplicity." },
      { type: "h2", id: "random-draw-explained", text: "How a Random Draw Works" },
      { type: "p", text: "In a random draw, all players are pooled, and each team takes turns drawing a player at random — usually until all squads are filled. Sometimes a points-based selection is used: players are graded and teams alternately pick from grade buckets. It's fast, requires no software, and takes maybe 30 minutes for 100 players." },
      { type: "h2", id: "auction-advantage", text: "Why Auctions Win on Engagement" },
      { type: "p", text: "The franchise auction transforms team assembly from an administrative task into the **main event of the season**. Owners spend weeks scouting players, preparing bidding strategies, and calculating purse allocation — all before a ball is kicked. On auction day, every bid is live drama. After auction day, teams have emotional investment in their squad that a random draw simply cannot create." },
      { type: "p", text: "Owners who built their team through an auction show up to every game — they want to see the players they fought for in a live bidding war. This translates directly to higher attendance and better league atmosphere." },
      { type: "h2", id: "fairness-comparison", text: "Which Is Actually Fairer?" },
      { type: "p", text: "**Random draw is mechanically equal** — every team has the same probability of getting any player. But 'equal probability' does not mean 'equal outcome.' A team can get lucky and draw most of the best players; another team can be stuck with the bottom of the pool. In an auction, budget discipline and strategic thinking determine squad quality — far more within an owner's control." },
      { type: "h2", id: "time-cost", text: "Time & Setup Cost" },
      { type: "p", text: "**Draw:** 30–60 minutes, no tech required, no pre-event prep beyond listing players. **Auction:** 3–8 hours on auction day, requires software (BidWar), a display screen, and owner preparation. The auction demands more from everyone — but most leagues that make the switch report that this preparation time becomes one of the most enjoyed parts of the season." },
      { type: "h2", id: "recommendation", text: "Which Should You Choose?" },
      { type: "ul", items: [
        "**First-season leagues with new owners:** Start with a draw — lower barrier to entry",
        "**Any league with 6+ competitive teams:** Switch to auction — the engagement benefit is enormous",
        "**Corporate / office leagues:** Auction almost always wins — people enjoy it as a full-day social event",
        "**Returning leagues:** Once you've run one auction, owners will never accept going back to a draw",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 14: Corporate Football Sports Day Franchise Auction
  ───────────────────────────────────────────────────────────────────────── */
  "corporate-football-sports-day-franchise-auction": {
    tableOfContents: [
      { id: "why-football-auction-corporate", title: "Why Football Auctions Work for Corporate Days" },
      { id: "planning-timeline", title: "Planning Timeline" },
      { id: "team-slots", title: "Team Slots & Ownership" },
      { id: "player-pool", title: "Building the Player Pool" },
      { id: "auction-day-execution", title: "Auction Day Execution" },
    ],
    content: [
      { type: "p", text: "Corporate sports days are more memorable and more competitive when teams are built through a franchise auction rather than random assignment. The auction itself becomes a team-building exercise — colleagues compete, negotiate, and strategize before a ball is kicked. Here's a complete guide for HR and event planning teams." },
      { type: "h2", id: "why-football-auction-corporate", text: "Why Football Auctions Work for Corporate Days" },
      { type: "p", text: "When employees build their own team through an auction, they become **emotionally invested in the outcome**. Teammates feel chosen, not assigned. The auction day itself creates cross-departmental interaction that typical team-building exercises rarely achieve." },
      { type: "h2", id: "planning-timeline", text: "Planning Timeline" },
      { type: "steps", items: [
        "**4 weeks before:** Confirm team count (4–8 teams), assign or select team owners",
        "**3 weeks before:** Collect player registrations — name, department, self-reported playing ability",
        "**2 weeks before:** Grade players into tiers, set base prices and team purse amounts",
        "**1 week before:** Send team owners the player list and auction rules document",
        "**Auction day:** 2–3 hour auction, then sports day activities",
      ]},
      { type: "h2", id: "team-slots", text: "Team Slots & Ownership" },
      { type: "p", text: "Assign team ownership to department heads, senior employees, or selected volunteers. Each owner receives a purse amount — typically ₹50,000–2,00,000 virtual money. Consider giving owners a small real prize (team dinner, trophy) to increase their competitive investment." },
      { type: "h2", id: "player-pool", text: "Building the Player Pool" },
      { type: "p", text: "Self-registration forms work well: employees rate their own ability on a 1–5 scale. Cross-validate with anyone known in the company for playing football seriously. Create three simple tiers: **Experienced, Regular, Recreational**. This is enough structure for a corporate event — keep the grading system simple and transparent." },
      { type: "tip", heading: "Include everyone, not just good players", text: "Some employees will want to participate but aren't confident about their football skills. Create an 'Enthusiast' category with very low base prices — teams can pick them up cheaply and they get to participate. Inclusive formats lead to much higher participation rates across the organisation." },
      { type: "h2", id: "auction-day-execution", text: "Auction Day Execution" },
      { type: "p", text: "Run the auction in a common space — cafeteria, conference room, or outdoor area with a projector. Use BidWar's LED Broadcast Mode so everyone can see the current player on a large screen. Aim for 2 minutes per player maximum — corporate auctions work best with fast pace and high energy. Have background music playing between players to maintain atmosphere." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 15: Kabaddi Franchise Auction Guide
  ───────────────────────────────────────────────────────────────────────── */
  "kabaddi-franchise-auction-raiders-defenders": {
    tableOfContents: [
      { id: "kabaddi-roles", title: "Kabaddi Roles Explained" },
      { id: "category-structure", title: "Category Structure for Auction" },
      { id: "squad-composition", title: "Squad Composition Rules" },
      { id: "base-price-logic", title: "Base Price Logic by Role" },
      { id: "bidding-strategy", title: "Bidding Strategy for Team Owners" },
    ],
    content: [
      { type: "p", text: "Kabaddi franchise auctions require a very different category structure than cricket or football. Roles are highly specialized — a team without a strong raider has almost no attacking threat; a team without corner defenders can be torn apart by any competent raider. Understanding these roles is the foundation of a well-designed kabaddi auction." },
      { type: "h2", id: "kabaddi-roles", text: "Kabaddi Roles Explained" },
      { type: "ul", items: [
        "**Raiders:** Primary attackers who score touch points. The most valuable players in any auction.",
        "**Left & Right Cover Defenders:** Second-line defense; tackle raiders who breach the front line.",
        "**Left & Right Corner Defenders:** Most critical defensive position; directly engage the raider.",
        "**All-Rounders:** Competent in both raiding and defending; valuable for flexibility.",
        "**Super Tacklers:** Specialist defenders known for chained tackles.",
      ]},
      { type: "h2", id: "category-structure", text: "Category Structure for Auction" },
      { type: "p", text: "Structure your auction around three categories:" },
      { type: "steps", items: [
        "**Elite Raiders** (5–8 players): Highest base prices; presented first",
        "**Corner Specialists** (8–12 players): Second highest prices; critical for squad quality",
        "**All-Rounders & Covers** (remaining pool): Standard and emerging players",
      ]},
      { type: "h2", id: "squad-composition", text: "Squad Composition Rules" },
      { type: "p", text: "Set minimum squad requirements to prevent teams from over-investing in one position:" },
      { type: "ul", items: [
        "Minimum 3 raiders per squad",
        "Minimum 2 corner defenders per squad",
        "Minimum 1 all-rounder per squad",
        "Maximum squad size: 12–15 players",
      ]},
      { type: "h2", id: "base-price-logic", text: "Base Price Logic by Role" },
      { type: "p", text: "Raiders with high raid success rates (>60%) and multiple Super Raid records should command the highest base prices. Corner defenders with high tackle success rates are the second most valuable category. Covers and all-rounders are priced based on versatility and fitness." },
      { type: "h2", id: "bidding-strategy", text: "Bidding Strategy for Team Owners" },
      { type: "tip", heading: "Secure your corners early", text: "Teams that secure strong corner defenders often outlast teams with better raiders in close matches. If your league uses a time-limited format, corners who can chain tackles are worth their weight in gold — bid for them aggressively in the Corner Specialist category." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 16: Pro Kabaddi-Style Auction Format
  ───────────────────────────────────────────────────────────────────────── */
  "pro-kabaddi-style-auction-format-local-leagues": {
    tableOfContents: [
      { id: "pkl-format-overview", title: "PKL Auction Format Overview" },
      { id: "purse-and-categories", title: "Purse Structure & Player Categories" },
      { id: "local-adaptation", title: "Adapting for Local Leagues" },
      { id: "auction-execution", title: "Running the Auction" },
    ],
    content: [
      { type: "p", text: "The Pro Kabaddi League runs one of the best-organized franchise auctions in Indian sports. Their format — separated player categories, graduated base prices, and a strict purse cap — can be directly adapted for local and university kabaddi leagues. Here's a step-by-step breakdown." },
      { type: "h2", id: "pkl-format-overview", text: "PKL Auction Format Overview" },
      { type: "p", text: "PKL auctions feature three player categories: **Category A** (highest base price — established stars), **Category B** (mid-tier, experienced players), and **New Young Players (NYP)** (under-23 talent). Each franchise has a salary cap; retentions are allowed up to a set number with price deductions. The auction is run live with team officials bidding on tablets." },
      { type: "h2", id: "purse-and-categories", text: "Purse Structure & Player Categories" },
      { type: "p", text: "For local leagues, simplify to 3 equivalent tiers:" },
      { type: "steps", items: [
        "**Category A (Elite Raiders & Corners):** Base price = 20–25% of team purse. Typically 2–4 players per team",
        "**Category B (Experienced Players):** Base price = 8–12% of team purse. Backbone of most squads",
        "**Young Players:** Base price = 2–4% of team purse. Academy or college-age players",
      ]},
      { type: "h2", id: "local-adaptation", text: "Adapting for Local Leagues" },
      { type: "ul", items: [
        "Set team purse at ₹2–5 lakh (virtual) for leagues with 6–8 teams",
        "Squad minimum: 8–10 players; maximum: 12–14",
        "Allow 1–2 retentions for returning leagues with purse deductions",
        "No overseas/foreign player slots required for most local tournaments",
      ]},
      { type: "h2", id: "auction-execution", text: "Running the Auction" },
      { type: "p", text: "PKL auctions are fast-paced — aim for 2–3 minutes per player including presentation. Display each player's category, last-season stats (if available), and photo on the main screen. Use BidWar's countdown timer to keep pace. Allow team representatives to bid from any device via the mobile bidding interface." },
      { type: "callout", heading: "Growing kabaddi leagues in India", text: "Kabaddi franchise leagues are growing rapidly at university, corporate, and district level. A professionally run auction with BidWar signals to players and sponsors that your league is serious — and attracts better participation in subsequent seasons." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 17: Badminton Franchise Auction by Playing Discipline
  ───────────────────────────────────────────────────────────────────────── */
  "badminton-franchise-auction-playing-discipline": {
    tableOfContents: [
      { id: "discipline-categories", title: "The Discipline Category System" },
      { id: "squad-structure", title: "Squad Structure for Badminton" },
      { id: "base-price-by-discipline", title: "Base Prices by Discipline" },
      { id: "auction-order", title: "Auction Order" },
      { id: "setup-in-bidwar", title: "Setting It Up in BidWar" },
    ],
    content: [
      { type: "p", text: "Badminton franchise auctions are uniquely structured because players can compete in multiple disciplines — singles, doubles, and mixed. A team that loads up on men's singles players but has no doubles or mixed pairs will be uncompetitive in team tournaments. The discipline category system is the key design tool to prevent this." },
      { type: "h2", id: "discipline-categories", text: "The Discipline Category System" },
      { type: "p", text: "Instead of the standard tier system, badminton franchise auctions work best with **role-based discipline categories:**" },
      { type: "steps", items: [
        "**Men's Singles Specialists:** Top singles players; usually the first and most competitive category",
        "**Women's Singles Specialists:** Presented separately to ensure every team builds this position",
        "**Doubles Specialists (Men's & Mixed):** Players specifically valued for doubles play",
        "**All-Discipline Players:** Versatile players who can compete in any discipline — premium for flexibility",
      ]},
      { type: "h2", id: "squad-structure", text: "Squad Structure for Badminton" },
      { type: "p", text: "For team badminton, set minimum discipline requirements per squad:" },
      { type: "ul", items: [
        "Minimum 2 men's singles players",
        "Minimum 1 women's singles player",
        "Minimum 1 men's doubles pair (2 players)",
        "Minimum 1 mixed doubles pair (1M + 1F capable player)",
        "Recommended squad size: 8–12 players",
      ]},
      { type: "h2", id: "base-price-by-discipline", text: "Base Prices by Discipline" },
      { type: "p", text: "All-discipline players should command the highest base prices since they give teams the most flexibility. Men's singles specialists are typically priced next. Women's singles specialists and doubles specialists follow — their value is high in absolute terms but the pool is smaller." },
      { type: "h2", id: "auction-order", text: "Auction Order" },
      { type: "p", text: "Present All-Discipline and Men's Singles categories first to build early excitement. Then Women's Singles (ensure every team bids seriously before their budget is exhausted). Doubles specialists last — by this point, teams know exactly what they need to complete their squad." },
      { type: "h2", id: "setup-in-bidwar", text: "Setting It Up in BidWar" },
      { type: "p", text: "In BidWar, tag each player with their primary discipline in the player profile. Use categories to group them for auction presentation. Set squad composition requirements per category to enforce minimum discipline slots per team." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 18: Badminton Scoring Software Live Rally Guide
  ───────────────────────────────────────────────────────────────────────── */
  "badminton-scoring-software-live-rally-guide": {
    tableOfContents: [
      { id: "why-digital-scoring", title: "Why Digital Rally-by-Rally Scoring?" },
      { id: "scoring-flow", title: "The Scoring Flow" },
      { id: "service-rules", title: "Service and Fault Tracking" },
      { id: "deuce-and-game", title: "Deuce and Game Detection" },
      { id: "display-output", title: "Live Display Output" },
    ],
    content: [
      { type: "p", text: "Paper scorecards have two critical problems: they're invisible to spectators sitting 5 meters away, and they require a dedicated scorer whose attention is split between writing and watching the match. Digital rally-by-rally scoring solves both — with a live display that everyone can see and an umpire interface fast enough to keep up with every exchange." },
      { type: "h2", id: "why-digital-scoring", text: "Why Digital Rally-by-Rally Scoring?" },
      { type: "ul", items: [
        "Spectators can follow the score on a screen without asking anyone",
        "Automatic game detection removes human error in score tracking",
        "Instant service fault logging prevents disputes about who was serving when",
        "Complete match history is automatically saved — no post-match transcription",
        "Live broadcast capability — scores can be displayed on YouTube/Facebook streams",
      ]},
      { type: "h2", id: "scoring-flow", text: "The Scoring Flow" },
      { type: "p", text: "The umpire uses BidWar's scoring interface on a phone or tablet. For each rally, they tap the winning side's button (Player A or Player B / Team A or Team B). The score updates instantly, the service indicator flips if appropriate, and the display updates on all connected screens." },
      { type: "steps", items: [
        "Tap the match to open it in scoring mode",
        "Confirm server and receiver for the first rally",
        "For each rally: tap winning side → score updates automatically",
        "Service changes are tracked based on score and BWF rules",
        "Game ends automatically when a side reaches 21 (or wins at 30–29)",
      ]},
      { type: "h2", id: "service-rules", text: "Service and Fault Tracking" },
      { type: "p", text: "BWF rules have specific service change conditions. The scoring software tracks these automatically — you don't need to manually manage service rotation. If a service fault occurs, tap the fault button and the software handles the score and service assignment correctly." },
      { type: "h2", id: "deuce-and-game", text: "Deuce and Game Detection" },
      { type: "p", text: "When the score reaches 20–20, the game enters deuce mode — a player must win by 2 consecutive points up to a maximum of 30–29. BidWar handles this automatically, changing the display to show the deuce indicator and tracking the subsequent rallies correctly." },
      { type: "h2", id: "display-output", text: "Live Display Output" },
      { type: "p", text: "Connect any TV or monitor to display the live scoreboard. The display shows current score, game number, match title, and server indicator in a large readable format. For streaming, use BidWar's broadcast overlay to embed scores in an OBS scene." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 19: Score Badminton Doubles Digitally
  ───────────────────────────────────────────────────────────────────────── */
  "score-badminton-doubles-match-digitally": {
    tableOfContents: [
      { id: "doubles-vs-singles", title: "Doubles Scoring vs Singles" },
      { id: "service-rotation", title: "Service Rotation in Doubles" },
      { id: "fault-types", title: "Tracking Fault Types" },
      { id: "setting-up-doubles", title: "Setting Up a Doubles Match" },
    ],
    content: [
      { type: "p", text: "Doubles badminton scoring has significantly more complexity than singles — service rotation is conditional on whether the serving side wins or loses the rally, court sides switch at the start of each game, and partner positioning affects service order. Digital scoring handles all of this automatically if configured correctly." },
      { type: "h2", id: "doubles-vs-singles", text: "Doubles Scoring vs Singles" },
      { type: "p", text: "The fundamental scoring (21 points, best of 3, deuce at 20–20, cap at 30) is identical to singles. The key difference is **service mechanics:** in doubles, the server rotates between partners on the serving side based on whether they win or lose the rally, and the starting server in each game is determined by the previous game's score." },
      { type: "h2", id: "service-rotation", text: "Service Rotation in Doubles" },
      { type: "p", text: "BWF rules for doubles service rotation:" },
      { type: "ul", items: [
        "At the start of each game, only the serving side's designated player serves first",
        "If the serving side wins a rally, the same player serves again from the alternate court",
        "If the receiving side wins a rally, service passes to them — whichever partner is in the correct court serves",
        "No second service exists — fault means service changes immediately",
      ]},
      { type: "p", text: "BidWar's doubles scoring mode tracks the current server automatically based on these rules, updating the service indicator after each rally." },
      { type: "h2", id: "fault-types", text: "Tracking Fault Types" },
      { type: "p", text: "For detailed record-keeping, log the fault type when applicable:" },
      { type: "ul", items: [
        "Service fault (foot position, shuttle height, racket position)",
        "Let (interference, not ready, shuttle on top of net)",
        "Net touch",
        "Out / long service",
      ]},
      { type: "h2", id: "setting-up-doubles", text: "Setting Up a Doubles Match" },
      { type: "steps", items: [
        "Create the match in BidWar and select 'Doubles' as the format",
        "Enter both partners' names for each side",
        "Designate the first server for each team",
        "Start the match — service rotation is automatic from here",
        "At the end of each game, confirm court-switch and new server assignment",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 20: Live Badminton Scoreboard Tournament Setup
  ───────────────────────────────────────────────────────────────────────── */
  "live-badminton-scoreboard-tournament-setup": {
    tableOfContents: [
      { id: "hardware-choices", title: "Hardware Choices" },
      { id: "scorer-assignment", title: "Scorer Assignment" },
      { id: "display-configuration", title: "Display Configuration" },
      { id: "multi-court-setup", title: "Multi-Court Setup" },
      { id: "common-issues", title: "Common Issues and Fixes" },
    ],
    content: [
      { type: "p", text: "A live scoreboard transforms any badminton tournament from a casual club event into a professional experience. Spectators can follow the action, umpires have a clear reference, and results are automatically recorded. Here's everything you need to set one up." },
      { type: "h2", id: "hardware-choices", text: "Hardware Choices" },
      { type: "p", text: "**Best option:** A 40–55 inch TV mounted or placed at the end of the court, connected via HDMI to a laptop running BidWar's display mode. **Budget option:** A projector pointed at a wall — works well in darker halls. **Outdoor option:** High-brightness projector (>3000 lumens) or multiple smaller screens at strategic viewing positions." },
      { type: "h2", id: "scorer-assignment", text: "Scorer Assignment" },
      { type: "p", text: "Assign one scorer per court. The scorer sits at the umpire chair or a designated position with a tablet or phone running BidWar's scoring interface. They update the score after each rally — typically 2–3 taps per rally point. For high-level matches, the umpire can score directly." },
      { type: "h2", id: "display-configuration", text: "Display Configuration" },
      { type: "p", text: "In BidWar's display mode, you can choose between full-screen scoreboard (ideal for a TV at the end of the court), landscape overlay (for streaming), and compact strip (for multi-court hall displays). Configure player/team names, match title, and round number before each match." },
      { type: "tip", heading: "Use landscape mode for streams", text: "If you're streaming the tournament, use BidWar's broadcast overlay mode in OBS — it adds a transparent score strip to any camera feed. This creates the professional presentation viewers expect from sports broadcasts." },
      { type: "h2", id: "multi-court-setup", text: "Multi-Court Setup" },
      { type: "p", text: "For tournaments with multiple simultaneous courts, each court has its own scorer running a separate match in BidWar. A tournament dashboard shows all ongoing matches, scores, and status on a single screen — useful for the organizer to track progress across courts and know when to schedule the next round." },
      { type: "h2", id: "common-issues", text: "Common Issues and Fixes" },
      { type: "ul", items: [
        "**Score not updating on display:** Refresh the display browser; the scorer device may have lost the connection briefly",
        "**Wrong server shown:** Use the 'swap server' button to correct without resetting the score",
        "**Score entered wrong:** Use the 'undo last point' button — one tap rolls back the most recent entry",
        "**Display too dark to read:** Increase TV brightness; for projectors, dim room lights or upgrade to higher-lumen unit",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 21: LED Scoreboard for Badminton Tournament
  ───────────────────────────────────────────────────────────────────────── */
  "led-scoreboard-badminton-tournament-setup": {
    tableOfContents: [
      { id: "tv-vs-projector", title: "TV vs Projector: Which Is Right?" },
      { id: "connection-types", title: "Connection Types" },
      { id: "bidwar-display-mode", title: "BidWar Display Mode Setup" },
      { id: "positioning", title: "Screen Positioning" },
      { id: "troubleshooting", title: "On-Day Troubleshooting" },
    ],
    content: [
      { type: "p", text: "An LED scoreboard instantly elevates the professionalism of any badminton tournament. Players perform better, spectators engage more, and your event looks like a broadcast production — not a club session. Here's the complete hardware and software guide." },
      { type: "h2", id: "tv-vs-projector", text: "TV vs Projector: Which Is Right?" },
      { type: "p", text: "**TV (40–65 inch):** Best for indoor halls. Bright, reliable, visible from 10–15 meters. Requires a mount or stable surface. No brightness issues in lit rooms. **Projector:** Better for larger halls and covering multiple courts from a central position. Requires 2500+ lumens for lit halls; 1500 lumens for darkened halls. Image can be affected by ambient light." },
      { type: "h2", id: "connection-types", text: "Connection Types" },
      { type: "ul", items: [
        "**HDMI cable:** Most reliable — connect laptop to TV/projector directly",
        "**Wireless HDMI / Chromecast:** Convenient but can lag 0.5–1 second — fine for scoring display, not recommended for streaming",
        "**Wireless screen mirroring:** Works well for BidWar's scoring display — lower bandwidth requirements than full video",
      ]},
      { type: "h2", id: "bidwar-display-mode", text: "BidWar Display Mode Setup" },
      { type: "steps", items: [
        "Open BidWar on your laptop/desktop",
        "Navigate to the active match and click 'Display Mode'",
        "Choose 'Scoreboard — Full Screen'",
        "Extend display (Windows: Win+P → Extend) and drag the BidWar window to the secondary display",
        "Press F11 to fullscreen on the secondary display",
        "The display updates in real time as the scorer enters each point",
      ]},
      { type: "h2", id: "positioning", text: "Screen Positioning" },
      { type: "p", text: "Mount or position the TV at the non-service end of the court, approximately 2–3 meters high. This ensures both players and spectators on the sides can see it clearly. For projectors, project onto the end wall or a pull-down screen at the same end." },
      { type: "h2", id: "troubleshooting", text: "On-Day Troubleshooting" },
      { type: "ul", items: [
        "**Display showing duplicate/mirrored screen:** Press Win+P, select 'Extend' instead of 'Mirror'",
        "**Resolution mismatch:** Right-click desktop → Display Settings → set second display to 1920×1080",
        "**Browser not fullscreen:** Press F11 on the BidWar display window",
        "**HDMI not detected:** Swap to a different HDMI port; restart the display with cable connected",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 22: Badminton Tournament Management Software Guide
  ───────────────────────────────────────────────────────────────────────── */
  "badminton-tournament-management-software-guide": {
    tableOfContents: [
      { id: "must-have-features", title: "Must-Have Features" },
      { id: "draw-generation", title: "Draw & Schedule Generation" },
      { id: "live-scoring-features", title: "Live Scoring Features" },
      { id: "results-and-reporting", title: "Results & Reporting" },
      { id: "mobile-access", title: "Mobile Access" },
      { id: "bidwar-for-badminton", title: "BidWar for Badminton" },
    ],
    content: [
      { type: "p", text: "The right tournament management software can turn a chaotic multi-court event into a smoothly run professional tournament. The wrong software — or a generic sports platform not built for badminton — creates more work than it saves. This guide covers exactly what to look for." },
      { type: "h2", id: "must-have-features", text: "Must-Have Features" },
      { type: "ul", items: [
        "**Live match scoring** — umpires or scorers update scores in real time on any device",
        "**Automatic standings/rankings** update as matches complete",
        "**Display output** — ability to show scores on a TV or projector without additional software",
        "**Player registration management** — adding, editing, and grouping players or pairs",
        "**Match scheduling** — assign courts, times, and umpires to each match",
      ]},
      { type: "h2", id: "draw-generation", text: "Draw & Schedule Generation" },
      { type: "p", text: "For knockout tournaments, automatic draw generation is essential — seedings should be honored, and bracket generation should be instant. For round-robin pools, the software should generate a complete schedule that minimizes court time conflicts and ensures no player/pair plays twice in quick succession." },
      { type: "h2", id: "live-scoring-features", text: "Live Scoring Features" },
      { type: "p", text: "The umpire interface needs to be fast — single-tap scoring per rally with no confirmation dialogs. Service tracking should be automatic based on BWF rules. An **undo button** is essential; errors happen in fast rallies. Game-end should be detected automatically." },
      { type: "h2", id: "results-and-reporting", text: "Results & Reporting" },
      { type: "p", text: "After each match, results should appear in the standings immediately. A **tournament report** at the end should include all match scores, final standings, and player statistics. Printable or PDF export is important for physical award distribution." },
      { type: "h2", id: "mobile-access", text: "Mobile Access" },
      { type: "p", text: "Umpires need mobile scoring access. Players and participants should be able to check their schedule, draw position, and results on their own phones — reducing the number of times they interrupt organizers for schedule information." },
      { type: "h2", id: "bidwar-for-badminton", text: "BidWar for Badminton" },
      { type: "p", text: "BidWar handles badminton tournament management alongside franchise auctions — making it the only platform you need whether you're running a player auction before the season or managing live scoring during the tournament. The LED display mode works for both auction and scoring use cases." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 23: Run Badminton League with Live Scoring
  ───────────────────────────────────────────────────────────────────────── */
  "run-badminton-league-live-scoring-standings": {
    tableOfContents: [
      { id: "league-structure", title: "League Structure Options" },
      { id: "scheduling", title: "Round Scheduling" },
      { id: "live-scoring-workflow", title: "Live Scoring Workflow" },
      { id: "standings-management", title: "Running Standings Management" },
      { id: "communication", title: "Communicating Results to Players" },
    ],
    content: [
      { type: "p", text: "Running a multi-week badminton league requires consistent systems for scheduling, scoring, and communicating results. Without these, players lose track of standings, disputes arise over results, and the league loses momentum between rounds. Here's a complete system." },
      { type: "h2", id: "league-structure", text: "League Structure Options" },
      { type: "ul", items: [
        "**Single round-robin:** Every player/pair plays every other player/pair once. Best for small leagues (8–16 entries). Takes 4–8 weeks depending on frequency.",
        "**Double round-robin:** Every entry plays every other twice (home and away). More data, longer format. 10–16 weeks.",
        "**Group stage + knockout:** Split into groups of 4–6 for round-robin, top 2 from each group advance to knockout. Best for larger leagues (16+ entries).",
      ]},
      { type: "h2", id: "scheduling", text: "Round Scheduling" },
      { type: "p", text: "Generate the full league schedule before the first match day. Post it publicly — ideally in a shared WhatsApp group and on a results page. Each round should list match dates, times, courts, and opponent pairings. For multi-court halls, BidWar automatically assigns courts based on availability." },
      { type: "h2", id: "live-scoring-workflow", text: "Live Scoring Workflow" },
      { type: "steps", items: [
        "Open BidWar on match day and navigate to the active round's matches",
        "Assign umpires/scorers to each court via the scorer assignment screen",
        "Scorers open their assigned match on their phone and start scoring",
        "Standings update automatically as each game and match completes",
        "Players can view scores live on any device using the public results link",
      ]},
      { type: "h2", id: "standings-management", text: "Running Standings Management" },
      { type: "p", text: "BidWar calculates standings using your configured points system (typical: 2 points for a win, 1 for a walkover, 0 for a loss). Tie-breaking criteria can be configured: games won, games lost, points difference, or head-to-head record. Standings update instantly after each match result is entered." },
      { type: "h2", id: "communication", text: "Communicating Results to Players" },
      { type: "p", text: "Share the public results link in your league WhatsApp group after each match day. Players can check their own record, their next opponent, and the current standings from any device. This reduces organizer burden and keeps participants engaged between rounds." },
      { type: "tip", heading: "Post weekly highlights", text: "A short WhatsApp message after each round — 'This week: 3 upsets, Player X now leads Group B' — keeps non-playing members engaged and builds anticipation for the next round." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 24: Badminton Scoring App for Umpires
  ───────────────────────────────────────────────────────────────────────── */
  "badminton-scoring-app-umpires-features": {
    tableOfContents: [
      { id: "core-requirements", title: "Core Requirements for Umpire Apps" },
      { id: "speed-and-accuracy", title: "Speed & Accuracy Features" },
      { id: "fault-handling", title: "Fault Handling" },
      { id: "offline-mode", title: "Offline Mode" },
      { id: "display-sync", title: "Display Sync" },
      { id: "bidwar-umpire-interface", title: "BidWar's Umpire Interface" },
    ],
    content: [
      { type: "p", text: "An umpire's scoring app needs to keep pace with a sport where rallies can last 2 seconds and service faults can happen multiple times per game. The wrong app — slow, cluttered, or crash-prone — makes an umpire's job harder rather than easier. Here's the feature checklist every badminton umpire should require." },
      { type: "h2", id: "core-requirements", text: "Core Requirements for Umpire Apps" },
      { type: "ul", items: [
        "**One-tap rally scoring** — no confirmation dialogs, no secondary taps",
        "**Visible current score** — large numbers readable in bright hall lighting",
        "**Service indicator** — always shows who is serving and from which court",
        "**Game auto-detection** — automatically ends game at 21 (or deuce resolution)",
        "**Match history** — full record of every point for dispute resolution",
      ]},
      { type: "h2", id: "speed-and-accuracy", text: "Speed & Accuracy Features" },
      { type: "p", text: "The most important quality of any umpire scoring interface is **speed without error**. A well-designed app separates the two team buttons by enough space that a tap never hits the wrong side accidentally. Large touch targets, clear contrast, and minimal UI clutter are non-negotiable." },
      { type: "p", text: "An **undo button** is equally critical — umpires will mis-tap, especially during fast exchanges. The undo button should be single-tap and should restore the complete previous state including service position." },
      { type: "h2", id: "fault-handling", text: "Fault Handling" },
      { type: "p", text: "Service faults, let calls, and unsporting conduct all need quick recording. The app should have dedicated buttons for common fault types. These don't need to be on the main scoring screen — a secondary panel accessible from the main screen is fine — but they must be accessible in under 2 taps." },
      { type: "h2", id: "offline-mode", text: "Offline Mode" },
      { type: "p", text: "Tournament halls often have poor Wi-Fi. An umpire scoring app must work offline — storing rally data locally and syncing to the central tournament when connectivity is restored. An app that requires constant internet connection is a liability at any real tournament." },
      { type: "h2", id: "display-sync", text: "Display Sync" },
      { type: "p", text: "The best apps sync the umpire's inputs to a separate display screen in real time — so the scoreboard on the TV updates as the umpire taps. This requires a backend that handles WebSocket connections or a similar real-time sync mechanism." },
      { type: "h2", id: "bidwar-umpire-interface", text: "BidWar's Umpire Interface" },
      { type: "p", text: "BidWar's scoring interface is designed for exactly these requirements: single-tap rally entry, large touch targets, automatic service tracking, one-tap undo, offline mode, and real-time sync to any connected display. Umpires access it via browser on any smartphone — no app install required." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 25: What Is Live Auction Software for Sports?
  ───────────────────────────────────────────────────────────────────────── */
  "what-is-live-auction-software-sports": {
    tableOfContents: [
      { id: "definition", title: "What Is Live Auction Software?" },
      { id: "core-components", title: "Core Components" },
      { id: "how-bidding-works", title: "How Real-Time Bidding Works" },
      { id: "led-display", title: "The LED Display Component" },
      { id: "post-auction", title: "After the Auction" },
    ],
    content: [
      { type: "p", text: "If you've never organized a franchise player auction before, the idea of 'live auction software' can feel technical and intimidating. It isn't. At its core, it's a system that lets team owners bid for players in real time, manages their budgets automatically, and displays everything on a big screen. Here's exactly how it all works." },
      { type: "h2", id: "definition", text: "What Is Live Auction Software?" },
      { type: "p", text: "Live auction software is a platform that manages franchise sports player auctions from start to finish. It handles the player database, team budgets, real-time bidding, display output, and post-auction reports — all in one place. It replaces the manual system of spreadsheets, whiteboards, and handwritten bid sheets that most organizers struggle with at their first auction." },
      { type: "h2", id: "core-components", text: "Core Components" },
      { type: "ul", items: [
        "**Player database:** All players with photos, base prices, and categories",
        "**Team management:** Each team's name, owner, and purse balance",
        "**Bidding engine:** Accepts bids from owners, validates budget, records winner",
        "**Countdown timer:** Adds time pressure to each bid; resets when a new bid is placed",
        "**LED display output:** Full-screen view for projectors and TVs at the venue",
        "**Mobile bidding:** Owners bid from their phones without a dedicated terminal",
        "**Reports:** Post-auction team rosters, spend summaries, and transaction history",
      ]},
      { type: "h2", id: "how-bidding-works", text: "How Real-Time Bidding Works" },
      { type: "p", text: "The auctioneer clicks 'Start Bidding' for the current player. A countdown timer begins. Team owners see the current player and bid on their phones or via assigned terminals. Each new bid increments the price by a set amount and resets the timer. When the timer reaches zero with no new bids, the player is automatically marked as SOLD to the highest bidder, and the amount is deducted from their purse." },
      { type: "h2", id: "led-display", text: "The LED Display Component" },
      { type: "p", text: "The display screen is what transforms an auction from a WhatsApp conversation into a live spectacle. It shows the current player's photo, name, stats, base price, current bid, and countdown timer in full screen. When a player is sold, an animated SOLD stamp appears. This visual element is what makes franchise auctions so exciting to attend." },
      { type: "h2", id: "post-auction", text: "After the Auction" },
      { type: "p", text: "Once the last player is sold, the software generates complete reports: full team rosters with every player's sale price, each team's remaining purse, and a total transaction summary. BidWar exports these as PDF and provides a shareable link so all owners can view their squad immediately." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 26: How Real-Time Bidding Software Works
  ───────────────────────────────────────────────────────────────────────── */
  "how-real-time-bidding-software-works-franchise": {
    tableOfContents: [
      { id: "bid-synchronization", title: "Bid Synchronization" },
      { id: "countdown-mechanics", title: "Countdown Timer Mechanics" },
      { id: "purse-deduction", title: "Automatic Purse Deduction" },
      { id: "sold-confirmation", title: "SOLD Confirmation Flow" },
      { id: "conflict-resolution", title: "Simultaneous Bid Handling" },
    ],
    content: [
      { type: "p", text: "Real-time bidding software does a lot under the hood to ensure that every team owner sees the same current bid, that budget limits are enforced correctly, and that sold confirmations are consistent across all devices. Understanding how it works helps you run smoother auctions and troubleshoot faster on the day." },
      { type: "h2", id: "bid-synchronization", text: "Bid Synchronization" },
      { type: "p", text: "BidWar uses a server-authoritative model — every bid goes to the central server first, where it's validated (is the team's purse sufficient? is the bid higher than the current maximum?) and then broadcast to all connected devices simultaneously. This means all screens — the LED display, every owner's phone, the auctioneer's laptop — always show the same current bid price in real time." },
      { type: "h2", id: "countdown-mechanics", text: "Countdown Timer Mechanics" },
      { type: "p", text: "The countdown timer starts when bidding opens for a player. Every valid new bid resets the timer to its full duration (configurable: typically 10–30 seconds). The timer pauses if the auctioneer manually holds it (for confusion or connection issues). When the timer reaches zero, no more bids are accepted and the player is sold." },
      { type: "p", text: "The timer is server-side — all clients display the server's timer state. This prevents a race condition where someone's phone shows 5 seconds remaining while another shows 0." },
      { type: "h2", id: "purse-deduction", text: "Automatic Purse Deduction" },
      { type: "p", text: "When a player sells, the sale price is instantly deducted from the winning team's purse on the server. The updated purse balance is pushed to that team's bidding interface immediately. Any subsequent bid attempt that would exceed the team's remaining purse is rejected before it reaches the server — the bidding interface disables the bid button when a team can't afford the next increment." },
      { type: "h2", id: "sold-confirmation", text: "SOLD Confirmation Flow" },
      { type: "p", text: "When the timer expires: (1) the server records the winning bid, team, and price; (2) the LED display shows the SOLD animation; (3) the player is removed from the auction queue; (4) the winning team's purse updates; (5) the player appears in that team's roster. All of this happens within 1–2 seconds of timer expiry." },
      { type: "h2", id: "conflict-resolution", text: "Simultaneous Bid Handling" },
      { type: "p", text: "When two owners tap bid at the same millisecond, the server receives two bid requests. The server processes them in receipt order — the first to arrive is registered; the second is evaluated against the now-higher current bid. This is a standard first-in-time-wins mechanism. The losing owner sees their bid button already showing the higher price and can choose to bid again." },
      { type: "tip", heading: "Better Wi-Fi = fewer conflicts", text: "Using a dedicated mobile hotspot for the auction rather than shared venue Wi-Fi significantly reduces bid latency and simultaneous bid conflicts. Always test connectivity before the event." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 27: Mobile Bidding Apps for Sports Events
  ───────────────────────────────────────────────────────────────────────── */
  "mobile-bidding-apps-sports-events-team-owners": {
    tableOfContents: [
      { id: "how-mobile-bidding-works", title: "How Mobile Bidding Works" },
      { id: "qr-code-access", title: "QR Code Access" },
      { id: "owner-interface", title: "What Owners See on Their Phone" },
      { id: "purse-tracking", title: "Real-Time Purse Tracking" },
      { id: "organizer-setup", title: "Organizer Setup Steps" },
    ],
    content: [
      { type: "p", text: "The era of bidding by raising a paddle or shouting bids across a hall is being replaced by mobile bidding — team owners competing from their phones, even from different cities. Here's how it works, what the bidding interface looks like, and how you set it up as an organizer." },
      { type: "h2", id: "how-mobile-bidding-works", text: "How Mobile Bidding Works" },
      { type: "p", text: "Each team owner gets a unique access link (usually delivered via QR code). They open this on their smartphone browser — no app installation required. The interface shows the current player being auctioned, the current highest bid, the countdown timer, and a bid button. Tapping the bid button places a bid at the next increment above the current price." },
      { type: "h2", id: "qr-code-access", text: "QR Code Access" },
      { type: "p", text: "BidWar generates a unique QR code for each team. The organizer shares these before the event — via WhatsApp, email, or printed cards at the venue. Each QR code links to that team's specific bidding session, so the system always knows which team is placing a bid. Scanning the QR code opens a mobile-optimized bidding page that works on any smartphone browser." },
      { type: "h2", id: "owner-interface", text: "What Owners See on Their Phone" },
      { type: "ul", items: [
        "**Current player:** Photo, name, category, and base price",
        "**Current bid:** The highest bid amount updated in real time",
        "**Timer:** Countdown showing seconds remaining",
        "**Bid button:** Disabled when the team can't afford the next increment or when not their turn",
        "**Team purse:** Running balance showing how much budget remains",
        "**Squad:** Current roster showing all players already won",
      ]},
      { type: "h2", id: "purse-tracking", text: "Real-Time Purse Tracking" },
      { type: "p", text: "As soon as a player is sold to a team, the purse deduction appears in their mobile interface instantly. Owners can make smarter decisions in the heat of bidding when they always know exactly how much budget remains — rather than trying to mentally track multiple purchases from memory." },
      { type: "h2", id: "organizer-setup", text: "Organizer Setup Steps" },
      { type: "steps", items: [
        "Create your tournament in BidWar and configure teams with purse amounts",
        "Navigate to Teams → Generate QR Codes",
        "Share each team's QR code with their owner (WhatsApp is the most reliable delivery method)",
        "Test: have all owners scan their codes and confirm the bidding interface loads before the event",
        "Start the auction — the mobile interfaces update automatically from this point",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 28: Cloud vs Local Auction Software
  ───────────────────────────────────────────────────────────────────────── */
  "cloud-vs-local-auction-software-sports-events": {
    tableOfContents: [
      { id: "cloud-explained", title: "Cloud-Based Auction Software" },
      { id: "local-explained", title: "Locally-Installed Software" },
      { id: "reliability", title: "Reliability & Uptime" },
      { id: "multi-device", title: "Multi-Device Access" },
      { id: "which-to-use", title: "Which Fits Your Situation?" },
    ],
    content: [
      { type: "p", text: "Your venue may have unreliable Wi-Fi. Team owners may be joining remotely from other cities. You might want mobile bidding for 12 owners simultaneously. All of these factors affect whether cloud-based or locally-installed software is the right choice for your auction." },
      { type: "h2", id: "cloud-explained", text: "Cloud-Based Auction Software" },
      { type: "p", text: "Cloud-based platforms (like BidWar) run on servers accessible via any internet browser. There's nothing to install — organizers log in from any laptop, and team owners join via browser link or QR code. All data is stored remotely; if the organizer's laptop crashes, they can resume from any other device instantly." },
      { type: "p", text: "**Requires:** Reliable internet at the venue. **Best for:** Remote team owners, multi-device access, organizers without IT skills." },
      { type: "h2", id: "local-explained", text: "Locally-Installed Software" },
      { type: "p", text: "Locally-installed software runs entirely on the organizer's machine — no internet required during the auction. Bidding is done by the auctioneer operating the software manually (calling bids, entering them). Owners can't bid from their own phones without network connectivity." },
      { type: "p", text: "**Requires:** One capable laptop. **Best for:** Venues with no Wi-Fi or severely restricted network access." },
      { type: "h2", id: "reliability", text: "Reliability & Uptime" },
      { type: "p", text: "**Local wins in venues with poor connectivity.** There's no dependency on external servers. **Cloud wins everywhere else** — server reliability from providers like Vercel or AWS typically exceeds 99.9% uptime, far better than any local network setup. BidWar runs on cloud infrastructure with redundant connectivity." },
      { type: "h2", id: "multi-device", text: "Multi-Device Access" },
      { type: "p", text: "Cloud platforms support unlimited devices simultaneously — 12 owners bidding from phones, the auctioneer on a laptop, and the LED display on a separate screen, all perfectly synchronized. Local software typically allows one active session at a time, requiring manual bid entry by the auctioneer." },
      { type: "h2", id: "which-to-use", text: "Which Fits Your Situation?" },
      { type: "ul", items: [
        "**All owners in same room, good Wi-Fi:** Cloud with mobile bidding — best experience",
        "**Remote owners, anyone joining online:** Cloud only — local software can't serve remote users",
        "**Venue with no internet, small event:** Local software or manual spreadsheet auction",
        "**Corporate event with IT restrictions:** Test cloud access on the event network beforehand; bring a mobile hotspot as backup",
      ]},
      { type: "tip", heading: "Always have a hotspot backup", text: "Even when using venue Wi-Fi, bring a mobile data hotspot (Jio/Airtel with 4G). If venue Wi-Fi fails mid-auction, you can switch the organizer laptop and display to the hotspot in under 2 minutes. This single backup has saved dozens of BidWar auctions." },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 29: Sports League Management Software Buyer's Guide
  ───────────────────────────────────────────────────────────────────────── */
  "sports-league-management-software-buyers-guide": {
    tableOfContents: [
      { id: "what-to-manage", title: "What League Software Needs to Manage" },
      { id: "team-management", title: "Team & Roster Management" },
      { id: "scheduling-features", title: "Scheduling Features" },
      { id: "live-scoring", title: "Live Scoring & Standings" },
      { id: "player-auction", title: "Player Auction Integration" },
      { id: "reports-and-comms", title: "Reports & Communication" },
      { id: "evaluation-checklist", title: "Evaluation Checklist" },
    ],
    content: [
      { type: "p", text: "Choosing sports league management software is a decision that affects every round, every match, and every player for the entire season. Getting it right the first time saves months of frustration with workarounds, manual data entry, and complaints from participants. This guide covers every feature category you should evaluate before committing." },
      { type: "h2", id: "what-to-manage", text: "What League Software Needs to Manage" },
      { type: "p", text: "A franchise sports league has multiple simultaneous management needs: player registrations, team rosters, match scheduling, live scoring, standings, and communications. Many platforms handle one or two of these well but fall short on others. Look for a single platform that covers all of them — switching between tools mid-season creates errors and extra work." },
      { type: "h2", id: "team-management", text: "Team & Roster Management" },
      { type: "ul", items: [
        "Add, edit, and remove players from rosters without affecting historical match data",
        "Track player availability and injury status",
        "Set squad size limits and minimum/maximum composition requirements",
        "Player photo management for display and identification",
      ]},
      { type: "h2", id: "scheduling-features", text: "Scheduling Features" },
      { type: "p", text: "The scheduler should generate a complete round-robin or knockout bracket instantly. Key features: venue/court assignment, time-slot management, umpire/referee assignment, and the ability to reschedule specific matches without regenerating the entire schedule." },
      { type: "h2", id: "live-scoring", text: "Live Scoring & Standings" },
      { type: "p", text: "Live match scoring must update standings in real time. Standings should support configurable point systems (e.g., 2W/1D/0L for football; games won/lost for badminton). Tie-breaking criteria should be configurable. Export options for standings are essential for publishing or display." },
      { type: "h2", id: "player-auction", text: "Player Auction Integration" },
      { type: "p", text: "If your league uses a franchise auction to build teams, the league management platform should integrate directly with the auction data — so team rosters at auction close are immediately available for league management without manual data re-entry. BidWar connects auction results directly to league rosters." },
      { type: "h2", id: "reports-and-comms", text: "Reports & Communication" },
      { type: "p", text: "End-of-season reports should include player statistics, team records, top performers, and standings history. Communication features — or easy integration with WhatsApp/email — keep participants informed of schedules and results without manual work by the organizer." },
      { type: "h2", id: "evaluation-checklist", text: "Evaluation Checklist" },
      { type: "ul", items: [
        "Can I run a player auction and manage the league in the same platform?",
        "Does live scoring update standings automatically?",
        "Can umpires score on mobile without installing an app?",
        "Is there a public results page for participants?",
        "Can I export a full tournament report as PDF?",
        "Does it work offline if the venue has poor internet?",
        "What is the pricing model — per tournament, per season, or subscription?",
      ]},
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     P1 BATCH 30: Franchise League Software Features
  ───────────────────────────────────────────────────────────────────────── */
  "franchise-league-software-features-matter-most": {
    tableOfContents: [
      { id: "player-auction-engine", title: "Player Auction Engine" },
      { id: "team-management-features", title: "Team Management Features" },
      { id: "live-scoring-features", title: "Live Scoring" },
      { id: "standings-features", title: "Standings & Points Tables" },
      { id: "broadcast-display", title: "Broadcast Display" },
      { id: "reports-features", title: "Reports & Data Export" },
      { id: "nice-to-have", title: "Nice-to-Have Features" },
    ],
    content: [
      { type: "p", text: "Not every platform that claims to support 'franchise leagues' was actually designed for them. Many are generic tournament platforms that can loosely accommodate an auction or a league — but lack the specific features that make franchise leagues work well. Here's the definitive feature checklist." },
      { type: "h2", id: "player-auction-engine", text: "Player Auction Engine" },
      { type: "p", text: "This is the most critical differentiator. The platform must have a purpose-built live auction engine — not just a 'manual assignment' tool. Requirements:" },
      { type: "ul", items: [
        "Real-time bidding with countdown timer",
        "Automatic purse management and bid validation",
        "LED/projector display mode for the auction hall",
        "Mobile bidding for team owners via QR code",
        "Player categorization and auction order configuration",
        "Post-auction PDF reports",
      ]},
      { type: "h2", id: "team-management-features", text: "Team Management Features" },
      { type: "ul", items: [
        "Configurable squad composition requirements (min/max per position or category)",
        "Player transfer and loan functionality between seasons",
        "Team owner access management",
        "Retention/release management for multi-season leagues",
      ]},
      { type: "h2", id: "live-scoring-features", text: "Live Scoring" },
      { type: "ul", items: [
        "Mobile scorer interface — no app install, browser-based",
        "Automatic service/turn tracking for relevant sports",
        "Undo functionality for scoring errors",
        "Match history for dispute resolution",
        "Offline capability for poor-connectivity venues",
      ]},
      { type: "h2", id: "standings-features", text: "Standings & Points Tables" },
      { type: "p", text: "Points tables should update automatically as match results are entered. Tie-breaking logic should be configurable. Export as shareable links, PDF, and images for WhatsApp distribution is important for real-world usage." },
      { type: "h2", id: "broadcast-display", text: "Broadcast Display" },
      { type: "p", text: "For both auction days and match days, the platform needs a broadcast display mode: a full-screen output designed for projectors and TVs. For auctions, this shows the current player, timer, and bid amount. For matches, this shows live scores, match title, and player names." },
      { type: "h2", id: "reports-features", text: "Reports & Data Export" },
      { type: "ul", items: [
        "Complete auction report: all players, sale prices, team rosters, remaining purses",
        "Season statistics: top scorers, win rates, attendance",
        "PDF export of all reports",
        "Public shareable results page",
      ]},
      { type: "h2", id: "nice-to-have", text: "Nice-to-Have Features" },
      { type: "ul", items: [
        "WhatsApp integration for result notifications",
        "Player self-registration forms",
        "Sponsor logo display in broadcast mode",
        "Multi-language support (Hindi + regional languages for India)",
        "Year-over-year retention of league data",
      ]},
      { type: "callout", heading: "BidWar checks every box", text: "BidWar is built specifically for franchise sports leagues in India — live auction engine, mobile bidding, LED display, scoring, standings, and reports all in one platform. [Start free today](/organizer)." },
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
