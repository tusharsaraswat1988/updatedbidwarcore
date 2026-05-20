import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel, Monitor, Smartphone, Users, Radio, Zap, Check,
  ArrowRight, ChevronDown, Plus, Star, Cloud, Wifi,
  ShieldCheck, Clock, ChevronRight, Trophy, BarChart3, Tv,
  X, MessageCircle, Phone,
} from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { SportLandingSchemaMarkup } from "@/components/schema-markup";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SportPageConfig = {
  title: string;
  description: string;
  canonical: string;
  eyebrow: string;
  h1: React.ReactNode;
  subheading: string;
  breadcrumbLabel: string;
  heroStats: { label: string; value: string }[];

  bodyParagraphs: string[];

  howItWorks: { n: number; title: string; desc: string }[];

  features: { icon: React.ElementType; title: string; short: string; long: string }[];

  comparison: { point: string; manual: string; bidwar: string }[];

  targetAudience: { title: string; desc: string }[];

  quotes: { text: string; name: string; role: string; city: string }[];

  faqs: { q: string; a: string }[];

  relatedPages: { label: string; href: string; desc: string }[];

  whatsappText: string;
};

// ─── Page Configs ─────────────────────────────────────────────────────────────

export const SPORT_CONFIGS: Record<string, SportPageConfig> = {

  "cricket-auction-software": {
    title: "Cricket Auction Software | IPL-Style Player Auction Platform — BidWar",
    description: "Run professional cricket player auctions with BidWar — IPL-style categories, team purse limits, LED broadcast display, and mobile owner panels. Free trial for 2 teams. No credit card.",
    canonical: "https://www.bidwar.in/cricket-auction-software",
    eyebrow: "Cricket Auction Software",
    h1: <>IPL-Style <span className="text-primary">Cricket Auction</span> Software for Local Leagues</>,
    subheading: "Run franchise cricket player auctions the way the IPL does — player categories, team purse limits, real-time mobile bidding, and a broadcast-quality LED display that has the whole room on its feet.",
    breadcrumbLabel: "Cricket Auction Software",
    heroStats: [
      { label: "Platforms", value: "All Devices" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial", value: "2 Teams" },
      { label: "Sync Latency", value: "< 1 second" },
    ],

    bodyParagraphs: [
      "Local cricket leagues in India have changed. What once meant a whiteboard, paper slips, and an auctioneer shouting over a crowd is now a serious production — franchise names, team jerseys, sponsor banners, and players who have trained hard hoping to be picked. The IPL didn't just create stars; it created a format that every organizer from Lucknow to Coimbatore now wants to replicate at the local level.",
      "The challenge is that running a real franchise auction used to require a team of coordinators, a printed player database, someone managing a bid board by hand, and enough patience to survive inevitable arguments about who bid first. Manual auctions with WhatsApp and spreadsheets are exhausting, prone to errors, and — frankly — they feel amateur compared to what your players and team owners expect in 2025.",
      "BidWar solves all of this. One organizer, one tablet, and a projector or smart TV is all you need to run a professional IPL-style cricket auction for 4, 8, 12, or up to 30 teams. Player categories, purse limits, bid increments, quick-bid buttons, SOLD animations — it all runs live from your browser without installing a single piece of software. Whether you're organising a mohalla T20 league, a corporate cricket tournament, or a district-level franchise championship, BidWar brings the broadcast production quality that makes your event genuinely memorable.",
    ],

    howItWorks: [
      { n: 1, title: "Create your tournament and teams", desc: "Sign up, create a tournament, and add your franchise teams with names, colours, and starting purse amounts. Takes about 5 minutes. You can also customize your auction rules — bid increment per round, unsold player rules, and squad size limits per team." },
      { n: 2, title: "Add your player database", desc: "Upload players manually or share a QR code link for self-registration. Each player gets a category (Platinum, Gold, Silver, Emerging — or your custom names), a base price, a playing role, and optional stats. The system auto-populates your auction queue." },
      { n: 3, title: "Set up your screens", desc: "Open the LED Display in fullscreen on any projector or TV — just visit the display URL in a browser. Share each team's Owner Panel link with team owners; they open it on their smartphones. No app download needed for anyone." },
      { n: 4, title: "Run the live auction", desc: "Press Start Auction. Nominate players from your queue. Accept bids from team owners via quick-bid buttons or let them tap from their phones. Mark each player SOLD (with animated stamp) or UNSOLD. Undo any mistake instantly." },
      { n: 5, title: "Export reports and share", desc: "After the auction ends, your full report generates automatically — sold players per team, team compositions, top picks, spend breakdown, and complete bid history. Share it on WhatsApp, export it, or print it." },
    ],

    features: [
      { icon: Gavel, title: "IPL-Style Player Categories", short: "Platinum, Gold, Silver, Emerging tiers with custom reserve prices.", long: "Create up to 8 player categories with individual minimum bid prices and bid increment settings. Platinum players start at ₹10 lakh, Silver at ₹2 lakh — or set whatever values your tournament requires. Category icons, colours, and names are fully customizable. This is exactly how professional franchise leagues structure their auctions, and it's available for your local tournament from day one." },
      { icon: Monitor, title: "Broadcast LED Display", short: "Full-screen display for projectors, TVs, and LED walls.", long: "The LED Display mode is purpose-built for venue projection. It shows an animated player card with photo, name, role, and stats — alongside the live bid counter in giant glowing numbers, the leading team name in their franchise colour, a SOLD stamp animation when a player is confirmed, and a team purse strip along the bottom showing all teams' remaining budgets at a glance. Plug any laptop into a projector and open the display URL. That's it." },
      { icon: Smartphone, title: "Team Owner Mobile Panels", short: "One-tap bidding from any smartphone — no app needed.", long: "Every franchise owner gets a private panel link that opens on any Android or iPhone browser. They see the current player up for bid, the live bid amount, their remaining purse, their current squad composition, and a large BID button that places the next increment. The panel updates in real time — when another team outbids them, it shows immediately. No app installation, no login complexity, no technical issues on auction day." },
      { icon: Radio, title: "OBS Streaming Overlay", short: "Broadcast your auction live on YouTube or Facebook.", long: "BidWar includes a transparent OBS overlay designed for livestreaming. Add it as a browser source in OBS Studio and it overlays the player card, live bid amount, team ticker, and bid bar directly over your camera feed or presentation. Your cricket auction can be broadcast live to YouTube or Facebook Live with production quality that rivals professional sports coverage — ideal for remote team owners and online audiences." },
      { icon: Zap, title: "Player QR Self-Registration", short: "Players register themselves via a QR code — zero manual entry.", long: "Share your player registration QR code on WhatsApp or your tournament's social pages. Players fill in their name, photo, playing role (batsman, bowler, all-rounder, wicket-keeper), stats like batting average and wickets, and their city. This information flows directly into your auction player list. Organizers running 60-80 player databases used to spend hours entering data manually — now players do it themselves before the event." },
      { icon: BarChart3, title: "Post-Auction Reports", short: "Full analytics after every session — exportable and shareable.", long: "Once your auction ends, BidWar generates a complete post-auction report: every player sold, which team bought them, at what price, in which round, and the full bid history for contested players. Team composition tables, purse utilization charts, top sold players by amount, and unsold player lists are all included. Share the report link on WhatsApp for team owners, or export it for your records and social media content." },
    ],

    comparison: [
      { point: "Bid tracking", manual: "Someone writes on a whiteboard — errors happen, arguments start", bidwar: "Every bid logged automatically, real-time, dispute-free" },
      { point: "Audience experience", manual: "People at the back can't see or hear what's happening", bidwar: "Giant animated display on any projector or TV at any size" },
      { point: "Team owner participation", manual: "Raise a hand and hope the auctioneer notices you", bidwar: "Tap once on your phone — bid placed instantly" },
      { point: "Purse tracking", manual: "Mental math, someone keeping spreadsheet, constant rechecking", bidwar: "Live purse displayed on every screen, automatically updated" },
      { point: "Post-auction records", manual: "Reconstruct from memory or photos of the whiteboard", bidwar: "Complete bid history and reports generated automatically" },
      { point: "Setup effort", manual: "Hours of preparation, printed materials, coordinators", bidwar: "15 minutes from signup to live auction" },
    ],

    targetAudience: [
      { title: "T20 & T10 Club Organisers", desc: "Running a local franchise T20 or T10 league? BidWar handles everything from 4 to 30 teams, with Platinum-to-Emerging categories and live bidding for 40–80 players." },
      { title: "Corporate Cricket Event Teams", desc: "Office cricket tournaments are one of the most popular business events in India. BidWar adds franchise-auction energy with sponsor branding and streaming support." },
      { title: "District & State League Admins", desc: "District cricket associations running annual franchise championships use BidWar to manage complex auctions with multiple rounds, categories, and dozens of teams." },
      { title: "School & College Sports Heads", desc: "Inter-school and inter-college cricket franchise auctions are increasingly popular. BidWar's free 2-team trial and simple setup make it accessible for first-time organisers." },
    ],

    quotes: [
      { text: "We ran 72 players across 8 teams in 85 minutes. The LED screen had the whole venue silent every time the SOLD stamp appeared. Nothing we tried before came close to this.", name: "Suresh Kumar", role: "T20 League Organiser", city: "Lucknow, UP" },
      { text: "Our corporate cricket auction was the highlight of the company sports day. Team owners were bidding from their seats. The projector screen had live bid counters. Everyone was hooked.", name: "Priya Singh", role: "HR Events Head", city: "Pune, Maharashtra" },
    ],

    faqs: [
      { q: "What is cricket auction software?", a: "Cricket auction software is a digital platform that lets tournament organisers run live IPL-style player auctions for franchise leagues. It handles player categories (Platinum, Gold, Silver, Emerging), team purse limits, real-time bidding from team owners on their phones, an LED broadcast display for the audience, and a complete auction report. BidWar replaces manual auction boards, spreadsheets, and WhatsApp coordination with a single automated system that runs from any browser." },
      { q: "How does BidWar's cricket auction work step by step?", a: "First, the organiser creates a tournament, adds franchise teams with their purse amounts, and uploads the player database (or lets players self-register via QR). On auction day, the operator opens the LED display on a projector, shares owner panel links with each team, and presses Start. Players are nominated one by one, bid timers run, and owners tap their phone screens to bid. Each player is confirmed as SOLD (with an animated stamp) or UNSOLD. The whole auction is tracked and a report generated at the end." },
      { q: "Can I run IPL-style player categories in BidWar?", a: "Yes. BidWar supports up to 8 custom player categories — Platinum, Gold, Silver, Emerging, or any names you choose. Each category has its own minimum bid price and bid increment. You can also set squad composition rules — for example, 'each team must buy at least 2 bowlers' — and the system enforces these limits during the auction. This mirrors the exact format used in the IPL, CPL, and other professional franchise leagues." },
      { q: "How many teams can participate in a BidWar cricket auction?", a: "BidWar scales from 2 teams (free trial) up to 30 teams on the Champion plan. The free trial supports 2 teams at zero cost. Starter supports 4 teams (₹5,000), Pro supports 8 teams (₹6,000), Advanced supports 12 teams (₹8,000), Elite supports 16 teams (₹10,000), and Champion supports 30 teams (₹15,000). All plans are one-time per-tournament fees — no monthly subscription." },
      { q: "Can I stream my cricket auction live on YouTube?", a: "Yes. BidWar includes an OBS-compatible transparent overlay that adds professional broadcast graphics to your stream. Add the overlay URL as a browser source in OBS, and it automatically shows the current player's photo, live bid amount, team ticker, and bid progress bar over your stream. You can broadcast your cricket auction live to YouTube, Facebook, or any OBS-supported platform with a TV production look." },
      { q: "Does BidWar work for small local cricket leagues?", a: "Absolutely. BidWar's free trial supports 2-team auctions at zero cost, and the paid Starter plan at ₹5,000 covers 4-team tournaments. It works for all sizes — from a 4-team mohalla T20 league to a 30-team state franchise championship. Setup takes under 15 minutes, and there's no technical knowledge required. If you can use WhatsApp, you can run BidWar." },
      { q: "Can team owners bid from their mobile phones?", a: "Yes. Every team owner gets a private Owner Panel link that opens on any smartphone browser — Android or iPhone, no app download needed. The panel shows the current player up for bid, live bid amount, remaining purse, squad roster, and a large BID button. Tapping it places the next bid increment instantly. Multiple owners can bid simultaneously; the system handles all bids in real time." },
      { q: "What happens if I make a mistake during the auction?", a: "BidWar has an Undo button that reverses the last operator action — whether that was accepting a wrong bid, marking a player as sold incorrectly, or assigning a player to the wrong team. You can undo and redo without disrupting the live session. Experienced organisers use this regularly during busy bidding moments. The full bid log is always visible so you can review what happened at any point." },
    ],

    relatedPages: [
      { label: "Football Player Auction", href: "/football-player-auction", desc: "Franchise bidding platform for football leagues" },
      { label: "Kabaddi Auction Platform", href: "/kabaddi-auction-platform", desc: "PKL-style auction software for kabaddi" },
      { label: "Business League Auction", href: "/business-league-auction", desc: "Corporate sports event auction platform" },
      { label: "Live Player Bidding", href: "/live-player-bidding", desc: "How real-time bid sync works across devices" },
      { label: "Tournament Auction Platform", href: "/tournament-auction-platform", desc: "Full platform overview for all sports" },
    ],

    whatsappText: "Hi%2C%20I%20want%20to%20run%20a%20cricket%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20it%20up%3F",
  },

  // ─────────────────────────────────────────────────────────────────────────────

  "football-player-auction": {
    title: "Football Player Auction Software | Live Franchise Bidding — BidWar",
    description: "Run live football player auctions with BidWar — position-based categories, team budgets, mobile owner panels, and broadcast LED display. Free trial available. No credit card.",
    canonical: "https://www.bidwar.in/football-player-auction",
    eyebrow: "Football Player Auction",
    h1: <>Football Player <span className="text-primary">Auction Software</span> for Franchise Leagues</>,
    subheading: "Conduct live football franchise player auctions with real-time bidding, position-based categories, team budget management, and a broadcast display — from local 5-a-side leagues to full ISL-style championships.",
    breadcrumbLabel: "Football Player Auction",
    heroStats: [
      { label: "Player Roles", value: "GK · DEF · MID · FWD" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial", value: "2 Teams" },
      { label: "Sync", value: "Real-Time" },
    ],

    bodyParagraphs: [
      "Football has quietly become one of India's fastest-growing sports at the grassroots level. From box football leagues in Kolkata to 11-a-side corporate tournaments in Bangalore, franchise-format football events are now running in cities and towns that barely had organised leagues a decade ago. The Indian Super League changed what people expect from football — and now local organisers are expected to deliver a similar level of excitement and structure.",
      "The challenge is that a football franchise auction has unique requirements that generic auction tools don't handle. You need position-based player categories — goalkeepers, defenders, midfielders, forwards — each with different base prices and squad quotas. You need team owners to bid competitively within budgets. You need the crowd to see what's happening. And you need the whole thing to run without arguments, errors, or a coordinator furiously typing into a spreadsheet.",
      "BidWar was built for exactly this. Position-based player categories, one-tap mobile bidding for team owners, a full-screen broadcast display for your venue, and a real-time audit trail of every bid — all running from a browser on any device. Whether you're running a 4-team 5-a-side futsal event or a 12-team ISL-inspired city league, BidWar gives your football auction the professional infrastructure it deserves.",
    ],

    howItWorks: [
      { n: 1, title: "Set up teams with budgets", desc: "Create your football tournament and add franchise teams with their colours, logos, and starting budgets. Set squad rules — for example, 'minimum 2 defenders and 1 goalkeeper per team' — and BidWar will enforce these during the auction." },
      { n: 2, title: "Build your player database by position", desc: "Add players manually or let them self-register via a QR link. Assign each player a position category (Goalkeeper, Defender, Midfielder, Forward), a base price, and relevant stats like goals scored or appearances. Players are automatically sorted into your auction categories." },
      { n: 3, title: "Connect all screens", desc: "Open the LED Display on a projector or venue TV. Share the Owner Panel link with each franchise owner — they open it on any smartphone. Both screens update live as bidding happens." },
      { n: 4, title: "Conduct the auction live", desc: "Nominate players from your queue, start bid timers, accept bids via quick-bid buttons or from owner phones. Mark each player SOLD to their highest bidder. The display shows animated SOLD stamps and updates all purses instantly." },
      { n: 5, title: "Share results and reports", desc: "When the auction ends, every team's squad, spend, and player details are available in a shareable report. Post it to your league WhatsApp group or social pages." },
    ],

    features: [
      { icon: Users, title: "Position-Based Player Categories", short: "Goalkeeper, Defender, Midfielder, Forward tiers.", long: "Create separate auction categories for each playing position with different minimum bid prices and bid increments. Set squad quotas — for example, each team must have at least 1 goalkeeper and at most 3 forwards. BidWar enforces these limits live during bidding, preventing overstacked squads and ensuring balanced team compositions. Custom position names are supported for 5-a-side, futsal, or any variant of football." },
      { icon: Monitor, title: "Broadcast LED Display for Venues", short: "Full-screen animated display for projectors and TVs.", long: "The LED Display shows the current player's name, photo, position, and stats in large, readable format — with the live bid counter in bright gold numbers, the leading team's name and colour, and a team purse strip showing all franchises' remaining budgets. When a player is sold, an animated SOLD stamp confirms the deal to the entire venue. Plug any laptop into a projector and navigate to the display URL — setup takes 30 seconds." },
      { icon: Smartphone, title: "Mobile Bidding for Team Owners", short: "One-tap phone bidding, no app download.", long: "Each team owner receives a private panel link via WhatsApp or SMS. Opening it on any smartphone shows them the player up for bid, the live bid, their remaining budget, their current squad, and a BID button. Tapping places the next bid increment immediately. If someone outbids them, their panel updates within a second. Multiple owners can bid simultaneously — the system logs every action in real time with no race conditions." },
      { icon: Gavel, title: "Operator Control Dashboard", short: "Run the full auction from a tablet or laptop.", long: "The operator dashboard gives you complete control: choose which player to nominate next, start or pause bid timers, accept bids from the quick-bid panel (one button per team), mark a player as SOLD or UNSOLD, and undo any action. The dashboard also shows you each team's remaining purse and squad count so you can manage pacing — speeding through low-value players and giving more time to the marquee ones." },
      { icon: Zap, title: "QR Player Registration", short: "Players fill in their own profiles — no manual entry.", long: "Before your auction, share a player registration QR code with your participants. Players upload their photo, enter their preferred position, and add relevant stats. This data flows directly into your player database and auction queue. For leagues with 50+ players, this alone saves organisers 3-4 hours of data entry. The self-registration form works on any smartphone browser in under 3 minutes per player." },
      { icon: BarChart3, title: "Post-Match Analytics", short: "Full team compositions and spend reports after the auction.", long: "After your football auction ends, BidWar generates a comprehensive report: which team bought which player, at what price, in what order. Team composition tables show each franchise's squad by position. Purse utilisation charts show how each team spent their budget. The highest-price sales are ranked. Everything is shareable via a link — post it to your tournament's WhatsApp group or social media within minutes of the auction ending." },
      { icon: Cloud, title: "Fully Cloud-Based", short: "No software to install on any device.", long: "BidWar runs entirely in a browser. There is no software to download on the operator's laptop, no app to install on team owners' phones, and no configuration needed on the display screen device. Everything syncs through the internet — which means you can run your football auction from any venue, hotel conference room, school ground, or stadium without IT support. If the venue has a WiFi router or mobile data, you're ready to go." },
    ],

    comparison: [
      { point: "Player position tracking", manual: "Separate lists per position, confusion during bidding", bidwar: "Category-based queue with position enforcement built in" },
      { point: "Squad quota management", manual: "Organiser mentally tracks 'they already have 3 defenders'", bidwar: "System blocks overstacked squads automatically" },
      { point: "Bid disputes", manual: "Two owners claim they bid simultaneously — no proof", bidwar: "Every bid is timestamped and logged — disputes impossible" },
      { point: "Budget tracking", manual: "Manual subtraction, someone always has the wrong number", bidwar: "Live purse updates on every screen after each sale" },
      { point: "Audience engagement", manual: "People at the back have no idea what's happening", bidwar: "Animated display keeps every person in the room engaged" },
      { point: "Remote team owners", manual: "Must be physically present", bidwar: "Can bid from anywhere via their phone" },
    ],

    targetAudience: [
      { title: "5-a-Side & Futsal League Organisers", desc: "Running indoor football or futsal franchise leagues? BidWar's compact auction format handles 4–8 team auctions with position categories and phone bidding in under an hour." },
      { title: "11-a-Side Club & District Tournaments", desc: "Full-format franchise football auctions with goalkeeper quotas, defender limits, and complete squad management across 8–16 teams and 60–100 players." },
      { title: "Corporate Football Event Planners", desc: "Business football league auctions with sponsor branding, YouTube Live streaming overlay, and executive bidding panels that work on any device." },
      { title: "College & University Sports Committees", desc: "Inter-college football franchise auctions that feel professional. Free trial available; most college events comfortably fit the Starter or Pro plan." },
    ],

    quotes: [
      { text: "Our 8-team corporate football auction ran for 2 hours with 64 players. Not a single dispute, not a single technical issue. Team owners were competitive to the point of trash talk — in the best way.", name: "Arjun Mehta", role: "Corporate Events Manager", city: "Bengaluru, Karnataka" },
      { text: "I used to spend 4 hours making Excel sheets before every football auction. With BidWar I sent a QR code to the players and they registered themselves. Setup took 20 minutes.", name: "Farouk Ahmed", role: "Football League Commissioner", city: "Hyderabad, Telangana" },
    ],

    faqs: [
      { q: "How does football player auction software work?", a: "Football auction software lets tournament organisers run live franchise player bidding sessions. The operator nominates players one by one, starts bid timers, and accepts bids from team owners who tap their smartphones to bid. A large LED display shows the live action to the venue audience. BidWar manages the entire process — player categories, team budgets, bid logging, and post-auction reports — in one browser-based platform with no installation required." },
      { q: "Can I categorise football players by playing position?", a: "Yes. BidWar allows you to create player categories by position — goalkeeper, defender, midfielder, forward — each with its own minimum bid price and bid increment. You can also set squad composition limits (e.g., minimum 1 goalkeeper, maximum 3 forwards per team). The system enforces these limits during the auction, preventing teams from overstacking one position. Custom position names for 5-a-side, futsal, or other variants are also supported." },
      { q: "Is BidWar suitable for small local football leagues?", a: "Yes. BidWar's free trial supports 2-team auctions at zero cost, and paid plans start from ₹5,000 for 4-team tournaments. It has been used for 5-a-side futsal leagues, box football events, school inter-house tournaments, and full 11-a-side district championships. Setup takes under 15 minutes and requires no technical knowledge — if you can use WhatsApp, you can run BidWar." },
      { q: "Can team owners bid from their phones during a live football auction?", a: "Yes. Each team owner receives a private Owner Panel link. Opening it on any Android or iPhone browser shows them the current player, live bid, remaining budget, and a large BID button. Tapping places the next bid increment instantly. No app download is needed. Owners can bid from anywhere — in the room, in the venue cafeteria, or even remotely if needed." },
      { q: "How do I handle squad composition rules in a football auction?", a: "In BidWar, you set squad rules when creating your tournament — minimum and maximum players per category, total squad size limits, and per-position quotas. During the auction, the system will prevent a team from buying a fifth forward if you've set a maximum of 4. If a team has used their full budget or reached their squad limit, their bid button is automatically disabled on the Owner Panel." },
      { q: "Can I stream my football auction live online?", a: "Yes. BidWar includes an OBS-compatible transparent overlay for YouTube and Facebook Live. Add the overlay URL as a browser source in OBS Studio and it displays the player photo, live bid amount, team ticker, and bid bar over your stream. This is particularly useful for league events where some team owners or supporters are watching remotely. It gives your football auction a professional broadcast look without any additional production equipment." },
      { q: "Does BidWar support multi-day football auctions?", a: "Yes. If your football franchise auction runs across multiple days — for example, Platinum players on Day 1 and Silver players on Day 2 — BidWar supports this natively. You can pause the auction at any point, save the state, and resume the next day. All bids, purse balances, and squad compositions carry over automatically. The operator simply resumes from where they left off." },
      { q: "How is BidWar priced for football tournaments?", a: "BidWar uses one-time per-tournament pricing. The free trial is available for 2-team events. Starter (4 teams) costs ₹5,000 + GST, Pro (8 teams) costs ₹6,000 + GST, Advanced (12 teams) costs ₹8,000 + GST, Elite (16 teams) costs ₹10,000 + GST, and Champion (30 teams) costs ₹15,000 + GST. There are no monthly subscriptions or recurring charges. You pay once per auction event and get full platform access including LED display, owner panels, and reports." },
    ],

    relatedPages: [
      { label: "Cricket Auction Software", href: "/cricket-auction-software", desc: "IPL-style auction for franchise cricket leagues" },
      { label: "Kabaddi Auction Platform", href: "/kabaddi-auction-platform", desc: "PKL-style player bidding for kabaddi tournaments" },
      { label: "Business League Auction", href: "/business-league-auction", desc: "Corporate sports franchise auction software" },
      { label: "Live Player Bidding", href: "/live-player-bidding", desc: "Real-time bidding technology explained" },
      { label: "Tournament Auction Platform", href: "/tournament-auction-platform", desc: "All-sport auction platform overview" },
    ],

    whatsappText: "Hi%2C%20I%20want%20to%20run%20a%20football%20player%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20it%20up%3F",
  },

  // ─────────────────────────────────────────────────────────────────────────────

  "kabaddi-auction-platform": {
    title: "Kabaddi Auction Platform | PKL-Style Player Bidding — BidWar",
    description: "Professional kabaddi auction platform for PKL-style franchise leagues. Raider, defender, and all-rounder categories, live bidding, LED broadcast display, and team owner mobile panels. Free trial.",
    canonical: "https://www.bidwar.in/kabaddi-auction-platform",
    eyebrow: "Kabaddi Auction Platform",
    h1: <>Kabaddi Auction Platform for <span className="text-primary">PKL-Style</span> Franchise Leagues</>,
    subheading: "Run professional kabaddi franchise auctions inspired by the Pro Kabaddi League — raider, defender, and all-rounder categories, team purse management, and a live broadcast display that electrifies your audience.",
    breadcrumbLabel: "Kabaddi Auction Platform",
    heroStats: [
      { label: "Player Roles", value: "Raider · Defender · All-Rounder" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial", value: "2 Teams" },
      { label: "Sync", value: "Real-Time" },
    ],

    bodyParagraphs: [
      "The Pro Kabaddi League did something remarkable for Indian sport: it turned what was seen as a village game into a primetime television spectacle. Franchise teams, marquee player auctions, massive broadcast viewership — PKL changed everything. And now, district kabaddi tournaments, college championships, and state-level leagues across Maharashtra, Haryana, Uttar Pradesh, and Tamil Nadu want to bring that same franchise excitement to their events.",
      "Running a kabaddi franchise auction manually is harder than it looks. Kabaddi has a specific squad structure — you need a defined number of raiders, defenders, and all-rounders per team. Categories need different base prices. Team owners need to track their purse carefully because squad composition mistakes can't be undone. When you're managing 8 teams bidding on 60 players in front of an audience, manual coordination breaks down fast.",
      "BidWar was designed with this complexity in mind. You can replicate the full PKL auction format — raider, defender, and all-rounder categories with individual base prices and bid increments, squad composition enforcement, team purse tracking, and a full-screen broadcast display that makes every SOLD moment feel like a professional production. Whether you're running a 2-team exhibition event or a 12-team state championship, the platform scales to match.",
    ],

    howItWorks: [
      { n: 1, title: "Configure your kabaddi auction format", desc: "Create the tournament and set up player categories matching your format — Raiders (base ₹5L), Defenders (base ₹3L), All-Rounders (base ₹4L), or any structure you prefer. Set squad rules: minimum raiders required, total squad size, and budget per team." },
      { n: 2, title: "Build the player database", desc: "Add players with QR self-registration or manual entry. Each player gets assigned to a role category, a base price, and relevant stats. Players are automatically organised into your auction queue by category." },
      { n: 3, title: "Set up the display and owner panels", desc: "Open the LED Display on a venue projector or large TV. Share Owner Panel links with franchise owners — they open it on their phones. Everything syncs live from the moment you press Start." },
      { n: 4, title: "Run the live kabaddi auction", desc: "Nominate players category by category, run bid timers, and accept bids via quick-bid buttons or from owner phones. Mark each player SOLD with the animated stamp or UNSOLD and they re-enter the pool. Undo any error instantly." },
      { n: 5, title: "Generate and share team rosters", desc: "After the auction, each team's full squad — by position, price, and composition — is available in a report. Share it with players, media, or your association." },
    ],

    features: [
      { icon: Trophy, title: "PKL-Inspired Player Categories", short: "Raider, Defender, All-Rounder tiers with custom pricing.", long: "Create player categories that precisely mirror the PKL format or customise them to your league's rules. Set different minimum bid prices, bid increments, and squad quotas for each category. BidWar can enforce 'minimum 3 raiders per team' or 'maximum 2 all-rounders' rules automatically during the live auction — removing the need for the organiser to track squad composition manually while managing bidding simultaneously." },
      { icon: Monitor, title: "Full-Screen Broadcast Display", short: "LED display for venues, projectors, and smart TVs.", long: "The kabaddi auction display shows each player's category badge (Raider/Defender/All-Rounder), their name, home state, key stats, and the live bid counter in large bright numerals. The leading team is shown in their franchise colour, and the team purse strip at the bottom keeps the whole room informed of everyone's remaining budget. The SOLD animation has genuine broadcast quality — every confirmed purchase gets its moment in the spotlight." },
      { icon: Smartphone, title: "Franchise Owner Bidding Panels", short: "Mobile bidding for every owner — one tap, zero setup.", long: "Each kabaddi franchise owner receives a unique panel link. Opening it on their phone gives them the current player's full profile, the live bid amount, their current squad composition, and a large BID button. The panel shows their remaining purse in real time. If they've already filled their raider slots, the system can optionally warn them when they're about to bid on another raider — keeping squad balance top of mind." },
      { icon: Gavel, title: "Auction Operator Dashboard", short: "Full session control from any laptop or tablet.", long: "The operator dashboard gives the auction host complete authority over the session. Choose players from the queue by category, start timers, accept bids using the quick-bid panel (one large button per team), and mark outcomes. The dashboard shows each team's purse, squad count, and category breakdown at a glance. You can also temporarily pause the auction — for a tea break, a sponsor announcement, or a technical issue — without losing any data." },
      { icon: BarChart3, title: "Squad Analytics and Reports", short: "Complete post-auction team compositions and spend data.", long: "When the auction ends, BidWar shows you everything: which team bought which player, at what price, in which round, and the total spend breakdown by category. You can see which teams overpaid for raiders, which have balanced squads, and which players attracted the most competitive bidding. The report is shareable via link — forward it to your kabaddi association, post it on social media, or use it for pre-season coverage of your league." },
      { icon: Zap, title: "Player Self-Registration QR", short: "Players register their own profiles — no manual data entry.", long: "Before your kabaddi auction, share a registration QR code with players. They upload a photo, enter their preferred role, home state, and career statistics. This data flows directly into the auction queue. For state-level kabaddi tournaments with 80–120 players, self-registration alone saves organisers 5+ hours of manual data preparation. The form takes under 3 minutes per player and works on any smartphone." },
      { icon: Cloud, title: "Browser-Based, No Installation", short: "Runs on any device, any venue, any internet connection.", long: "There is no software to install on the operator's laptop, no app to download on franchise owners' phones, and no technical configuration needed on the display screen device. BidWar runs entirely in a browser. If the venue has WiFi or you can create a mobile hotspot, you're ready to run a professional kabaddi auction. This makes it practical for district-level events in smaller towns where IT infrastructure is limited." },
    ],

    comparison: [
      { point: "Squad composition enforcement", manual: "Organiser tries to remember 'that team already has 3 raiders'", bidwar: "System enforces squad limits automatically, no manual tracking" },
      { point: "Bid acceptance speed", manual: "Auctioneer must identify who bid first in a room of raised hands", bidwar: "All bids from phone taps, system logs them with timestamps" },
      { point: "Player information display", manual: "Organiser reads from a sheet, audience can't see details", bidwar: "Full player profile on the broadcast screen in real time" },
      { point: "Multi-category auction management", manual: "Separate sheets, category switching causes confusion", bidwar: "Automatic category queue, seamless round transitions" },
      { point: "Post-auction team reports", manual: "Hours to compile manually from notes and photos", bidwar: "Generated automatically in seconds, shareable via link" },
      { point: "Remote bidding capability", manual: "All team owners must be physically present", bidwar: "Owners can join from anywhere on their phones" },
    ],

    targetAudience: [
      { title: "District Kabaddi Associations", desc: "Running annual district franchise kabaddi championships? BidWar handles the full PKL-format auction with raider/defender categories, squad quotas, and live LED display for venues." },
      { title: "State-Level League Organisers", desc: "Scale to 12–16 team state kabaddi franchise auctions with complex squad composition rules, high bidding volumes, and broadcast-quality display screens." },
      { title: "College & School Sports Committees", desc: "Inter-college kabaddi franchise auctions with a free trial, simple setup, and mobile bidding that works on any student's smartphone." },
      { title: "Corporate & Community Event Teams", desc: "Corporate kabaddi events and community league auctions that need professional presentation, sponsor branding support, and reliable live bidding." },
    ],

    quotes: [
      { text: "We ran a 10-team PKL-format auction for 90 players in 3 hours. The category system handled raiders, defenders, and all-rounders perfectly. The audience was completely engaged throughout.", name: "Rakesh Verma", role: "Kabaddi League Director", city: "Jaipur, Rajasthan" },
      { text: "The LED display screen is what makes it special. Every time a big raider went for a high price and the SOLD stamp appeared, the room exploded. It felt like the real PKL.", name: "Santosh Yadav", role: "District Kabaddi Organiser", city: "Patna, Bihar" },
    ],

    faqs: [
      { q: "What is a kabaddi auction platform?", a: "A kabaddi auction platform is software that enables tournament organisers to run live PKL-style franchise player auctions. It manages player categories (raiders, defenders, all-rounders), team purse limits, real-time bidding from team owners on their phones, and a broadcast display screen for the venue audience. BidWar automates all of this from one browser-based platform — no manual bid boards, spreadsheets, or coordinators needed." },
      { q: "Can BidWar replicate the Pro Kabaddi League auction format?", a: "Yes. BidWar is designed to mirror the PKL format exactly. You create three player categories — Raiders, Defenders, All-Rounders — each with their own minimum bid prices, bid increments, and squad quotas (e.g., 'each team must have at least 3 raiders'). The system enforces these rules live during bidding. Category names, base prices, and squad limits are all customisable to match your specific league's format." },
      { q: "How many teams can participate in a BidWar kabaddi auction?", a: "BidWar supports 2 to 30 teams. The free trial supports 2 teams at zero cost. Paid plans scale from Starter (4 teams, ₹5,000) through Champion (30 teams, ₹15,000). All plans are one-time per-tournament fees with no monthly subscriptions. District-level kabaddi events typically use the Pro or Advanced plan (8–12 teams), while state championships may use Elite or Champion." },
      { q: "Does BidWar work for local kabaddi tournaments in smaller towns?", a: "Absolutely. BidWar requires only a browser and internet connection — no software installation, no IT support, no special hardware. If you have a laptop, a projector or TV, and mobile data or WiFi, you can run a professional kabaddi auction anywhere. The free trial lets you run a 2-team test auction at zero cost before committing to a paid plan." },
      { q: "Can I display the kabaddi auction on a projector screen?", a: "Yes. BidWar's LED Display Mode opens in fullscreen on any laptop or device connected to a projector or large TV. It shows the current player's category, name, photo, state, and stats — plus the live bid counter in large numerals, the leading team in franchise colour, and a SOLD stamp animation. The display updates automatically as bids come in; no one needs to manually control it once the auction starts." },
      { q: "How do squad composition rules work in BidWar for kabaddi?", a: "When you set up your kabaddi tournament, you define squad composition rules — minimum raiders per team, maximum all-rounders, total squad size, etc. During the live auction, BidWar tracks each team's current composition and enforces these limits. If a team has already filled their raider quota, they can still see the live auction but may be restricted from bidding on additional raiders depending on your settings. This removes a major source of errors and disputes in manual kabaddi auctions." },
      { q: "Can team owners bid on their phones during a kabaddi auction?", a: "Yes. Every franchise owner receives a unique Owner Panel link via WhatsApp or SMS. Opening it on any Android or iPhone browser shows them the current player's full profile, live bid, their remaining purse, and their squad composition by role. A large BID button places the next increment. No app download is needed, and multiple owners can bid simultaneously — the system logs everything in real time." },
      { q: "What happens to unsold players in a BidWar kabaddi auction?", a: "When a player is marked UNSOLD, they are moved to an unsold pool. You can choose to re-auction unsold players at the end of each category round, or hold a separate unsold round at the end of the full auction. BidWar supports both workflows. Teams with remaining budget can re-bid on previously unsold players at their base price or with a reduced reserve — whichever your format dictates." },
    ],

    relatedPages: [
      { label: "Cricket Auction Software", href: "/cricket-auction-software", desc: "IPL-style franchise cricket auction platform" },
      { label: "Football Player Auction", href: "/football-player-auction", desc: "Position-based football franchise bidding" },
      { label: "Business League Auction", href: "/business-league-auction", desc: "Corporate sports event auction software" },
      { label: "Live Player Bidding", href: "/live-player-bidding", desc: "How real-time bid sync works across all screens" },
      { label: "Tournament Auction Platform", href: "/tournament-auction-platform", desc: "Full platform overview for any sport" },
    ],

    whatsappText: "Hi%2C%20I%20want%20to%20run%20a%20kabaddi%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20it%20up%3F",
  },

  // ─────────────────────────────────────────────────────────────────────────────

  "esports-auction-system": {
    title: "Esports Auction System | Live Gaming Team Draft Platform — BidWar",
    description: "Professional esports player auction and team draft system. Role-based categories, real-time bidding, team manager panels, and live display for BGMI, Valorant, CS2 and college esports leagues.",
    canonical: "https://www.bidwar.in/esports-auction-system",
    eyebrow: "Esports Auction System",
    h1: <>Esports Auction System for <span className="text-primary">Franchise Drafts</span> and Player Bidding</>,
    subheading: "Run professional esports franchise player auctions with role-based categories — IGL, entry fragger, support, AWPer — real-time bidding from team managers, and a live display screen for your LAN or online event.",
    breadcrumbLabel: "Esports Auction System",
    heroStats: [
      { label: "Player Roles", value: "IGL · Fragger · Support" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial", value: "2 Teams" },
      { label: "Platform", value: "100% Browser" },
    ],

    bodyParagraphs: [
      "Esports in India has grown from LAN cafe weekends to a structured competitive industry. BGMI franchise leagues, Valorant college championships, and CS2 corporate teams are now a real part of the competitive gaming landscape. With that growth has come a new problem: how do you build competitive esports teams in a way that's fair, exciting, and transparent — especially when team compositions require specific role coverage?",
      "The traditional draft system — where teams pick in rotation — doesn't create the same excitement as a live auction. In a draft, the first pick goes to the team with the worst record. In an auction, every franchise starts equal, and it's strategy and budget management that determine who builds the best squad. BGMI tournaments in India that have tried auction-based team building consistently report higher engagement from players, team owners, and audiences compared to simple rotation drafts.",
      "BidWar brings this auction format to any esports event. Role-based player categories (IGL, entry fragger, support, AWPer, or any custom roles your game requires), real-time bidding from team managers on their devices, a live display screen for LAN venues or online audiences, and an OBS overlay for Twitch and YouTube streams. It runs entirely in a browser — no LAN configuration, no firewall exceptions, no software installation on gaming rigs.",
    ],

    howItWorks: [
      { n: 1, title: "Define roles and team budgets", desc: "Create player categories matching your game's roles — IGL, entry fragger, support, AWPer for CS2/Valorant; or assaulter, support, sniper for BGMI. Set team budgets and squad size rules (e.g., each team needs exactly 1 IGL and 2 fraggers)." },
      { n: 2, title: "Build your player roster", desc: "Add players with their in-game name, role, rank, and key stats. For esports, stats might include K/D ratio, win rate, tournaments played, or peak rank. Players can self-register via QR code or be added manually by the organiser." },
      { n: 3, title: "Set up LAN display and manager panels", desc: "Open the display screen on a venue monitor or projector. Share team manager bidding panels via link — managers open them on any device. For online events, everything works over the internet without any LAN setup." },
      { n: 4, title: "Run the draft auction", desc: "Nominate players by role category, run bid timers (typically 30 seconds for esports auctions), accept bids from managers, and confirm each player to their team. Stream the display via OBS for Twitch or YouTube audiences." },
      { n: 5, title: "Publish team rosters", desc: "At the end of the auction, each team's full roster — player names, roles, prices, and total spend — is available as a shareable link. Announce team compositions on your tournament Discord or social channels." },
    ],

    features: [
      { icon: Users, title: "Role-Based Player Categories", short: "IGL, fragger, support, AWPer — fully customisable.", long: "Define player categories based on the in-game roles relevant to your esports title. For Valorant: Controller, Duelist, Sentinel, Initiator. For BGMI: Assaulter, Support, Sniper, Scout. For CS2: IGL, Entry Fragger, AWPer, Support, Lurker. Each category has its own base price and bid increment. Squad quotas ensure balanced team compositions — 'each team must have exactly 1 IGL' is enforced automatically during bidding." },
      { icon: Monitor, title: "Live Auction Display Screen", short: "Large-screen display for LAN venues and online streams.", long: "The auction display shows the current player's IGN, role, rank, photo or avatar, and stats in large, clean format. The live bid counter updates in real time. Leading team name and colour display prominently. A team budget strip along the bottom shows all franchises' remaining wallets. For LAN events, project this on a venue screen. For online events, share it with viewers via OBS stream overlay or as a visible browser tab on stream." },
      { icon: Smartphone, title: "Team Manager Bidding Panels", short: "Bid from any device — no special software needed.", long: "Each team manager receives a unique panel link. Opening it on any laptop, tablet, or smartphone gives them the current player profile, live bid amount, their remaining budget, current roster by role, and a BID button. For esports, where participants are comfortable with technology, this is a natural interface — one tap to bid, immediate feedback. The panel works on any browser including those on gaming laptops and mobile phones." },
      { icon: Radio, title: "Twitch & YouTube OBS Overlay", short: "Broadcast your draft live with professional graphics.", long: "BidWar's OBS overlay is transparent and designed to sit over your stream layout. Add the overlay URL as a browser source in OBS Studio. It shows the current player profile, live bid bar, and team ticker — updating in real time as bidding happens. Broadcast your esports franchise auction live on Twitch, YouTube, or Loco. Viewers can follow the draft in real time without any delay. This turns your player auction into a content event in its own right." },
      { icon: Gavel, title: "Auction Host Control Panel", short: "Full session control for the tournament director.", long: "The host dashboard lets you nominate players from the queue by category, set custom timer lengths per player (marquee players get 60 seconds, lower-tier players get 30), accept bids via the quick-bid panel, and mark outcomes. You can pause the auction at any time — for breaks, announcements, or technical delays — without losing data. An Undo button reverses the last action for immediate error correction." },
      { icon: Cloud, title: "Browser-Based, No LAN Config", short: "No installation, no firewall exceptions needed.", long: "BidWar runs entirely in a browser. There is nothing to install, no ports to open, and no dependencies on the LAN configuration at your venue. Each participant — the auction host, team managers, and the display screen — just opens a URL. For online esports events, participants join from their homes; for LAN events, anyone on the venue network or mobile data can connect. This eliminates the most common source of technical delays at gaming events." },
      { icon: BarChart3, title: "Post-Draft Roster Reports", short: "Complete team compositions and spend analysis.", long: "After the auction, BidWar generates a full roster report: every player acquired, by which team, at what price, in what order. Role composition tables show whether teams are balanced. Budget utilisation shows how each team spent their wallet. The top-priced players are ranked. Share the report on Discord, post it to your tournament website, or use it to generate pre-season content and team previews for your community." },
    ],

    comparison: [
      { point: "Team building format", manual: "Rotation draft — boring, unequal starting positions", bidwar: "Auction draft — every team starts equal, strategy wins" },
      { point: "Role enforcement", manual: "Organiser manually checks 'do they have an IGL yet?'", bidwar: "System enforces role quotas automatically" },
      { point: "Audience engagement", manual: "No display, audience has no idea what's happening", bidwar: "Live display with bid counter keeps everyone watching" },
      { point: "Remote team managers", manual: "Must be physically at the venue", bidwar: "Can join from anywhere via browser link" },
      { point: "Stream integration", manual: "No stream graphics for draft picks", bidwar: "Live OBS overlay for Twitch/YouTube broadcasts" },
      { point: "Dispute resolution", manual: "Arguments about bid order have no proof", bidwar: "Every bid logged with timestamp — disputes resolved instantly" },
    ],

    targetAudience: [
      { title: "BGMI & PUBG Mobile Tournament Organisers", desc: "Run franchise squad auctions for mobile battle royale leagues with assaulter, support, sniper, and scout role categories and team budget bidding." },
      { title: "Valorant & CS2 LAN Event Directors", desc: "Franchise player auctions for PC esports events with full role category enforcement, LAN display screens, and OBS overlay for stream audiences." },
      { title: "College Esports Committee Heads", desc: "Inter-college esports franchise auctions that feel professional, run on any device, and fit within the free trial or Starter plan budget." },
      { title: "Corporate Gaming Event Organisers", desc: "Business gaming league franchise drafts with real-time bidding, sponsor branding support, and stream capabilities for internal company audiences." },
    ],

    quotes: [
      { text: "We ran a BGMI franchise auction for 8 teams and 40 players. The whole thing streamed live on YouTube with the BidWar overlay. Viewers were commenting on bids in real time. It felt like a real esports broadcast.", name: "Karan Nair", role: "Esports Tournament Director", city: "Mumbai, Maharashtra" },
      { text: "The role enforcement feature is what sold it for us. In past Valorant auctions we'd end up with teams stacking Duelists because no one was tracking composition. BidWar just stops it from happening.", name: "Ananya Bose", role: "College Esports Head", city: "Kolkata, West Bengal" },
    ],

    faqs: [
      { q: "What is an esports auction system?", a: "An esports auction system is a platform that lets tournament organisers run live franchise player auctions for competitive gaming teams. Instead of rotation drafts where teams pick in order, an auction gives all teams equal budgets and lets them bid competitively for each player. BidWar manages the entire process — role categories, real-time bidding from team managers, a display screen for the venue or stream, and full roster reports — from one browser-based platform." },
      { q: "Which esports games does BidWar support for player auctions?", a: "BidWar supports any esports title where players can be categorised by role. This includes BGMI, PUBG Mobile, Valorant, CS2, Free Fire, Mobile Legends, Call of Duty Mobile, and any other competitive game. You define the player categories (IGL, entry fragger, support, assaulter, sniper, etc.) based on your game's role system. The auction mechanics work identically regardless of the game." },
      { q: "How is an esports auction different from a regular draft?", a: "In a standard rotation draft, teams pick players in a predetermined order — typically the weakest team picks first. In an auction, every team starts with the same budget, and all players are put up for competitive bidding. This means every team has an equal opportunity regardless of their past performance. Auctions create strategic tension — teams must decide when to spend big on a star player and when to save budget for depth. This format consistently produces more player and audience engagement than rotation drafts." },
      { q: "Can I use BidWar for online esports auctions where teams are in different locations?", a: "Yes. BidWar is fully cloud-based. The auction host, team managers, and display screen all connect via browser links — no physical location required. Online esports auctions work perfectly: the host runs the session from their setup, team managers bid from their homes, and the display can be shared via OBS stream for the audience to follow live. This is how many BGMI and Valorant community leagues now run their franchise drafts." },
      { q: "Can I stream my esports franchise auction on Twitch or YouTube?", a: "Yes. BidWar includes an OBS-compatible transparent overlay. Add the overlay URL as a browser source in OBS Studio at any size and position. It displays the current player's profile, live bid amount, team ticker, and bid bar — updating live as bidding happens. You can broadcast your entire franchise auction on Twitch, YouTube, or Loco. Many esports community organisers find that auction streams get significantly higher viewership than regular tournament streams." },
      { q: "How do role composition limits work in esports auctions?", a: "When setting up your esports tournament, you define squad composition rules — for example, 'each team must have exactly 1 IGL, minimum 2 fraggers, and maximum 1 AWPer' for a CS2 league. BidWar enforces these limits during the live auction. If a team has already bought their maximum number of AWPers, they can still watch the auction but their bid button for that player category is disabled. This prevents role stacking and ensures balanced competitive teams." },
      { q: "Can BidWar handle a very small esports event with just 4 teams?", a: "Yes. BidWar's free trial supports 2-team events, and the Starter plan (₹5,000 per tournament) supports up to 4 teams. Small esports events with 4–6 teams are among the most common use cases — college esports committees, gaming club internal leagues, and community tournament organisers all regularly use BidWar for 4-team franchise auctions. The platform scales identically from 2 teams to 30." },
      { q: "What player statistics can I track in an esports auction?", a: "BidWar lets you add custom stat fields for each player. For BGMI or PUBG Mobile you might track K/D ratio, average damage, win rate, and tournaments played. For Valorant you might add agent pool, ACS (Average Combat Score), and rank. For CS2 you might track HLTV rating, headshot percentage, and peak ranking. These stats appear on the player card during the auction — both on the display screen and on manager panels — helping teams make informed bidding decisions." },
    ],

    relatedPages: [
      { label: "Cricket Auction Software", href: "/cricket-auction-software", desc: "IPL-style franchise cricket auction platform" },
      { label: "Football Player Auction", href: "/football-player-auction", desc: "Franchise football bidding with position categories" },
      { label: "Business League Auction", href: "/business-league-auction", desc: "Corporate sports event franchise auctions" },
      { label: "Live Player Bidding", href: "/live-player-bidding", desc: "How real-time bid technology works" },
      { label: "Tournament Auction Platform", href: "/tournament-auction-platform", desc: "Multi-sport auction platform overview" },
    ],

    whatsappText: "Hi%2C%20I%20want%20to%20run%20an%20esports%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20it%20up%3F",
  },

  // ─────────────────────────────────────────────────────────────────────────────

  "business-league-auction": {
    title: "Business Sports League Auction Software | Corporate Cricket & Football — BidWar",
    description: "Run professional corporate sports franchise auctions with BidWar — sponsor branding, OBS streaming overlay, mobile bidding, and LED display. For cricket, football, and kabaddi business leagues.",
    canonical: "https://www.bidwar.in/business-league-auction",
    eyebrow: "Business Sports League Auction",
    h1: <>Business Sports League <span className="text-primary">Auction Software</span> for Corporate Events</>,
    subheading: "Transform your corporate sports day into a professional franchise auction event — sponsor branding on the display screen, mobile bidding for executives, YouTube Live streaming overlay, and real-time analytics.",
    breadcrumbLabel: "Business League Auction",
    heroStats: [
      { label: "Sports", value: "Cricket · Football · Kabaddi" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial", value: "2 Teams" },
      { label: "Streaming", value: "YouTube · Facebook" },
    ],

    bodyParagraphs: [
      "Corporate sports events in India have evolved significantly. What used to be a casual company cricket match has become, at many organisations, a full franchise auction experience — departments forming teams, bidding for colleagues, competing with real budgets, and creating the kind of team identity that lasts well beyond the event itself. HR departments, alumni associations, and industry bodies are now running franchise sports auctions as signature events that drive genuine engagement.",
      "The challenge is that corporate events have higher expectations than community tournaments. Sponsors expect their logos to appear prominently on the display screen. Executives expect a smooth, professional-looking operation — not an organiser frantically managing paper bids. And the company's social media team expects shareable content: dramatic SOLD moments, bid rivalries between departments, and post-event team composition announcements.",
      "BidWar was built for exactly this kind of high-stakes, audience-facing event. Sponsor logo support on the LED broadcast display, OBS overlay for YouTube and Facebook Live, polished owner bidding panels that work on any smartphone, and post-event analytics that double as social media content. Whether you're running a 4-department office league or a 16-company industry association championship, BidWar makes your corporate sports auction look and feel like a professional production.",
    ],

    howItWorks: [
      { n: 1, title: "Create your corporate tournament", desc: "Set up the event with your company or association name, add department or company teams with franchise names and logos, and configure their starting budgets. For corporate events, budgets are often symbolic (play money) rather than real rupees — both modes work." },
      { n: 2, title: "Add players and sponsor branding", desc: "Upload player data or use QR self-registration. Add sponsor logos that will appear on the broadcast display screen during the event. Configure the LED display colour theme to match your company or event branding." },
      { n: 3, title: "Set up the event production", desc: "Connect the LED display to your venue projector or AV system. Distribute owner panel links to department heads or team representatives. If streaming, set up OBS with the BidWar stream overlay source." },
      { n: 4, title: "Run the live franchise auction", desc: "Host the auction with the same energy as a professional sports event. Players nominated one by one, bid timers running, executives bidding from their phones, animated SOLD stamps on the display — corporate memories are made here." },
      { n: 5, title: "Share results and content", desc: "Generate the post-auction report and share it on company WhatsApp, LinkedIn, or the event's social pages. Top-sold player rankings, team compositions, and highest bid moments make great post-event content." },
    ],

    features: [
      { icon: Trophy, title: "Sponsor Branding on Display", short: "Your sponsors' logos on the auction broadcast screen.", long: "Corporate and business league events often have sponsors — whether internal business units, product brands, or external partners. BidWar's LED Display Mode supports sponsor logo display and rotation during the auction. Your event sponsors get prominent visibility on the main screen for the entire duration of the auction, making it a sponsorship opportunity in its own right alongside the sporting activity." },
      { icon: Radio, title: "Live Streaming Overlay for YouTube", short: "Broadcast your corporate auction to a wider audience.", long: "If your corporate event is being recorded or streamed — for remote employees, alumni watching from other cities, or a general company audience — BidWar's OBS overlay puts professional broadcast graphics over your stream. The overlay shows the current player, live bid amount, and team ticker in real time. Stream to YouTube Live, Facebook, or any OBS-supported platform. Some companies use this for company-wide engagement events where remote offices follow along from their locations." },
      { icon: Monitor, title: "Venue Projector LED Display", short: "Animated broadcast screen for any corporate venue.", long: "Connect any laptop to your venue's projector or AV system, open the display URL in fullscreen, and you have a professional-grade auction broadcast display. The animated player cards, live bid counters, SOLD stamps, and team purse strips create the visual excitement that makes corporate franchise auctions memorable. The display is specifically designed to look impressive in a darkened conference hall or auditorium environment." },
      { icon: Smartphone, title: "Executive Bidding Panels", short: "Bid from any smartphone or laptop — no installation.", long: "Corporate participants don't want to download apps or create accounts. BidWar Owner Panels open in any browser — on smartphones, tablets, or laptops. Each team representative gets a private link via WhatsApp or email. Tapping the BID button places the next increment instantly. Panels show the current budget in real time, preventing overspending. For executives who are comfortable with mobile banking and apps, the BidWar panel feels completely natural." },
      { icon: Gavel, title: "Professional Auction Control", short: "Complete host control for a smooth event.", long: "The auction host runs the entire event from a tablet or laptop. Control pacing — give marquee players more time, run through lower-value players quickly. Use quick-bid buttons to accept bids on behalf of teams bidding by voice, or let owners bid independently from their panels. Pause for sponsor announcements, team introductions, or awards segments without losing data. Undo any error instantly. The host dashboard is designed for non-technical event managers, not IT professionals." },
      { icon: BarChart3, title: "Post-Event Reports and Analytics", short: "Data and shareable content for your event debrief.", long: "After your corporate sports auction ends, BidWar generates a comprehensive event report: team compositions, per-team spend, top-priced players, bid history, and purse utilisation by department. This report is immediately shareable via link — forward it to your company's social media team for post-event LinkedIn posts, share it with the winning team for their moment of recognition, or include it in your event debrief presentation." },
      { icon: ShieldCheck, title: "Secure, Reliable Session Management", short: "Role-based access — only the right people get the right screens.", long: "The operator dashboard is accessible only to the auction host. Each team owner gets access only to their own panel, not other teams' panels or the operator controls. Audience members watching the display screen see the broadcast view only. This role-based access structure ensures that corporate participants can't see each other's bidding strategies or interfere with the auction session." },
    ],

    comparison: [
      { point: "Event professionalism", manual: "Manual boards feel amateurish at corporate events", bidwar: "Broadcast-quality display with animations and sponsor logos" },
      { point: "Participant experience", manual: "Confusion, paper slips, arguments — stressful to manage", bidwar: "Phone bidding, live screen — participants focus on fun" },
      { point: "Streaming capability", manual: "No integration with recording or streaming", bidwar: "Built-in OBS overlay for YouTube/Facebook Live" },
      { point: "Sponsor visibility", manual: "Manual banners, no dynamic display integration", bidwar: "Sponsor logo on LED display throughout the event" },
      { point: "Post-event content", manual: "Organisers have to rebuild data from notes", bidwar: "Shareable report ready within minutes of auction end" },
      { point: "Organiser stress", manual: "Managing bids, purses, records simultaneously", bidwar: "Platform handles all tracking — host just runs the show" },
    ],

    targetAudience: [
      { title: "HR & Corporate Events Teams", desc: "Running an annual company sports day or inter-department tournament? BidWar adds franchise auction energy that drives team identity and genuine employee engagement." },
      { title: "Industry & Trade Associations", desc: "Multi-company sports championships for industry bodies, chambers of commerce, or alumni associations with 8–16 participating companies and their franchise teams." },
      { title: "Event Management Companies", desc: "Running corporate sports events as a service? BidWar is your plug-and-play auction infrastructure — handles all the technical complexity while you focus on the experience." },
      { title: "College Alumni Networks", desc: "Alumni cricket, football, or kabaddi franchise auctions with batch teams, reunion events, and the kind of competitive bidding that creates lasting memories." },
    ],

    quotes: [
      { text: "Our Diwali cricket franchise auction became the most-talked-about company event of the year. 8 teams, 56 players, bidding wars between departments. The CEO's team came last in the auction and won the tournament — still the best narrative of the quarter.", name: "Deepa Nair", role: "HR Business Partner", city: "Chennai, Tamil Nadu" },
      { text: "As an event management agency, BidWar lets us offer franchise auctions as a premium service to corporate clients. Setup is under 30 minutes, the display looks incredible, and clients are always blown away.", name: "Rohit Kapoor", role: "Events Director", city: "Delhi, NCR" },
    ],

    faqs: [
      { q: "What is a business sports league auction?", a: "A business sports league auction is a franchise player bidding event run as part of a corporate sports tournament — where participating teams (departments, companies, or groups) bid for players with a set budget. BidWar provides the full platform: an operator control dashboard, mobile bidding panels for team representatives, a broadcast LED display screen, and post-event reports. It transforms a standard sports day into a structured, exciting franchise auction event." },
      { q: "Can BidWar display sponsor logos during the corporate auction?", a: "Yes. BidWar's LED Display Mode supports sponsor logo display and rotation. Your event sponsors get visible branding on the main audience-facing screen throughout the auction. This makes sponsorship of your corporate sports event more attractive — sponsors get dynamic display exposure rather than a static banner. Logo display is configurable by the event organiser in the tournament settings." },
      { q: "Is BidWar suitable for small 4–8 team corporate tournaments?", a: "Yes. The Starter plan (4 teams, ₹5,000 + GST) and Pro plan (8 teams, ₹6,000 + GST) are ideally sized for most corporate events. Setup takes under 15 minutes. Team owners bid from their existing smartphones — no app download, no IT involvement, no technical preparation needed. The free trial lets you run a 2-team test before your event." },
      { q: "Can I stream my corporate sports auction live to remote employees?", a: "Yes. BidWar includes an OBS-compatible streaming overlay for YouTube Live, Facebook Live, and any OBS-supported platform. Remote employees or alumni watching from other locations can follow the franchise auction in real time — seeing the player, the live bid, and the winning team just as the in-room audience does. This is increasingly common for organisations with distributed teams or multi-city workforces." },
      { q: "Does BidWar work for multi-sport corporate events?", a: "Yes. BidWar supports cricket, football, kabaddi, volleyball, basketball, and esports in the same platform. You can create separate tournament setups for each sport within your account. Many corporate sports days run cricket and football auctions on separate days — BidWar handles both with no additional cost per sport, just per event based on team count." },
      { q: "What sports work best for corporate franchise auctions?", a: "Cricket is by far the most popular corporate franchise auction sport in India, followed by football and kabaddi. Cricket works so well because the IPL format is universally understood — everyone knows what player categories and purse limits mean. Football is popular for companies in metros. Kabaddi is particularly popular in North India and Maharashtra. Esports is emerging strongly for tech companies and younger workforces." },
      { q: "How do I manage bidding for executives who aren't tech-savvy?", a: "BidWar's Owner Panel is designed to be as simple as possible: open the link, see the player, tap BID. There are no account logins, no app downloads, and no technical steps. If an executive can use WhatsApp, they can use the Owner Panel. For very non-technical participants, the auction operator can accept bids on their behalf using the quick-bid buttons on the operator dashboard — so even verbal bids ('Delhi bids!') can be entered by the host." },
      { q: "How is BidWar priced for corporate events?", a: "BidWar uses one-time per-tournament pricing with no monthly fees. For corporate events: Starter (4 teams) is ₹5,000 + GST, Pro (8 teams) is ₹6,000 + GST, Advanced (12 teams) is ₹8,000 + GST, Elite (16 teams) is ₹10,000 + GST. The free trial covers 2-team test runs. GST invoices are provided on request. Payment is via bank transfer and license is activated on WhatsApp typically within the same business day." },
    ],

    relatedPages: [
      { label: "Cricket Auction Software", href: "/cricket-auction-software", desc: "IPL-style franchise cricket auction" },
      { label: "Football Player Auction", href: "/football-player-auction", desc: "Position-based football franchise bidding" },
      { label: "Kabaddi Auction Platform", href: "/kabaddi-auction-platform", desc: "PKL-style kabaddi franchise auction" },
      { label: "Live Player Bidding", href: "/live-player-bidding", desc: "How real-time bidding sync works" },
      { label: "Tournament Auction Platform", href: "/tournament-auction-platform", desc: "Complete platform overview" },
    ],

    whatsappText: "Hi%2C%20I%20want%20to%20run%20a%20corporate%20sports%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20it%20up%3F",
  },

  // ─────────────────────────────────────────────────────────────────────────────

  "live-player-bidding": {
    title: "Live Player Bidding Platform | Real-Time Sports Auction Software — BidWar",
    description: "Real-time live player bidding for sports tournaments. Team owner mobile panels, LED broadcast display, operator control — all synced live in under 1 second across every connected screen.",
    canonical: "https://www.bidwar.in/live-player-bidding",
    eyebrow: "Live Player Bidding Platform",
    h1: <>Live Player <span className="text-primary">Bidding Platform</span> for Sports Auctions</>,
    subheading: "A purpose-built real-time bidding engine — team owners bid from their phones, the operator controls the session, and a broadcast display shows the live action. All screens sync in under one second, every time.",
    breadcrumbLabel: "Live Player Bidding",
    heroStats: [
      { label: "Bid Sync Latency", value: "< 1 second" },
      { label: "Concurrent Bidders", value: "Unlimited" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Platform", value: "100% Browser" },
    ],

    bodyParagraphs: [
      "The most stressful moment in any manual sports auction is when two team owners claim they bid at the same time. The room goes quiet. The organiser is in the middle. Nobody has proof. Someone feels cheated. If you've organised even one manual auction, you know exactly how this feels — and how much it damages the event atmosphere.",
      "Live bidding technology changes this entirely. When every bid is placed via a smartphone tap, logged with a timestamp, and confirmed on a display screen that every person in the room can see, disputes become impossible. More than that: the speed and transparency of live digital bidding creates a completely different energy. Owners are glued to their phones. The audience watches the display screen react in real time. Every SOLD announcement is a moment.",
      "BidWar's live player bidding engine was built from the ground up for sports franchise auctions. Sub-second sync across all connected devices — whether the operator is in the same room or across the country. Unlimited concurrent bidders with no performance degradation. Automatic bid collision handling so no two bids are ever lost. And a display system that reflects every single event — bid placed, timer updated, player sold — in real time, without any page refreshes.",
    ],

    howItWorks: [
      { n: 1, title: "The operator controls the session", desc: "The auction operator — typically the tournament director or event MC — runs the session from a dashboard. They select the next player from the queue, start the bid timer, and monitor incoming bids. The operator is the single source of truth for the session." },
      { n: 2, title: "Team owners bid from their phones", desc: "Each team owner has a private panel open on their smartphone. When a player is nominated and the timer starts, they see the current bid amount and tap BID to raise it by the configured increment. Their panel updates in real time as other owners bid." },
      { n: 3, title: "The display screen shows everything live", desc: "The LED Display — projected on a venue screen — shows the current player, the live bid amount as it rises with each tap, the leading team in their colour, and all teams' remaining purses. Every person in the room follows the auction on this screen." },
      { n: 4, title: "SOLD or UNSOLD confirmation", desc: "When the timer expires, the operator confirms the player as SOLD to the highest bidder (with an animated stamp on the display screen) or UNSOLD (returning them to the pool for a later round). Purse balances update instantly across all screens." },
      { n: 5, title: "Full audit trail throughout", desc: "Every bid placed, every timer started, every SOLD or UNSOLD confirmation is logged with a timestamp. The bid history is visible to the operator in real time and available in the post-auction report for all participants." },
    ],

    features: [
      { icon: Wifi, title: "Sub-Second Bid Synchronisation", short: "Every bid appears on every screen within one second.", long: "BidWar's bidding engine uses server-sent real-time updates to push bid events to all connected devices simultaneously. When an owner taps BID on their phone, the new bid amount appears on the operator dashboard, on all other owner panels, and on the LED display screen — all within under one second. This speed is critical in live auctions where the excitement depends on instant feedback. There are no page refreshes, no polling delays, and no need to manually update any screen." },
      { icon: Smartphone, title: "Mobile Bidding Panels for Owners", short: "One-tap phone bidding for every team owner.", long: "Each team owner receives a unique panel link that opens on any smartphone browser — no app download, no login, no technical setup. The panel shows: the current player being auctioned with their full profile, the live bid amount updating in real time, their remaining purse balance, their current squad composition, and a large BID button. Tapping BID places the next increment immediately. If an owner is outbid, their panel updates before they've even put their phone down." },
      { icon: Monitor, title: "Real-Time Audience Display Screen", short: "Live bid counter and player card on any projector or TV.", long: "The display screen is the audience's window into the auction. It shows the current player's photo, name, role, and stats — with the live bid amount in large, glowing numerals that update with each new bid. The leading team's name and colour display prominently. A team purse strip at the bottom shows all franchises' remaining budgets at a glance, so sophisticated auction-watchers can predict which teams will compete for each upcoming player." },
      { icon: Gavel, title: "Operator Bid Controls", short: "Accept bids, run timers, undo mistakes — complete control.", long: "The auction operator sees every incoming bid in real time on the operator dashboard. Quick-bid buttons — one large button per team, labelled with the team name — let the operator accept bids with one click when working with teams bidding verbally. The timer countdown is visible, and the operator can extend it in emergencies. An Undo button reverses the last action for immediate error correction. The operator dashboard is the single most powerful tool in a BidWar auction — designed for one person to manage the entire session without assistance." },
      { icon: ShieldCheck, title: "Bid Collision Handling", short: "Simultaneous bids are handled cleanly — no disputes.", long: "When two team owners tap BID at exactly the same moment, BidWar's server-side logic processes bids sequentially and acknowledges them in order of receipt. The first valid bid is accepted; the second owner's panel immediately shows the updated (now-higher) amount. This eliminates the most contentious moment in any manual auction — the simultaneous bid. The bid log records both events with their exact timestamps, providing an irrefutable record if any question arises." },
      { icon: Cloud, title: "Browser-Based with No Installation", short: "Works on any device over any internet connection.", long: "BidWar's live bidding works on any device that has a modern browser and internet access. The operator can use a 5-year-old laptop. Team owners use their existing smartphones. The display screen can be any laptop or smart TV connected to a projector. Mobile data works fine — the bidding protocol is optimised for low-bandwidth conditions, so a 4G connection on any standard smartphone is sufficient for reliable real-time performance during a live auction." },
      { icon: BarChart3, title: "Complete Bid Audit Trail", short: "Every bid logged, timestamped, and available in reports.", long: "Every event in a BidWar auction is logged: which player was nominated at what time, which bids were placed by which team and at what timestamp, when the timer started and expired, and what the outcome was. This audit trail is visible to the operator during the session and available to all participants in the post-auction report. It provides complete transparency — and makes any dispute resolution straightforward, since the data is simply a matter of record." },
    ],

    comparison: [
      { point: "Bid disputes", manual: "Two owners claim simultaneous bids — no proof, argument ensues", bidwar: "All bids timestamped; disputes are resolved in seconds with data" },
      { point: "Display update speed", manual: "Someone manually writes or changes a number on a board", bidwar: "Bid amount updates on display within 1 second of phone tap" },
      { point: "Owner participation", manual: "Must raise a hand and hope the auctioneer sees", bidwar: "Tap a phone from anywhere — instant confirmation" },
      { point: "Multi-team management", manual: "Organiser tracks 8 teams' purses in their head or spreadsheet", bidwar: "All purses updated automatically on every screen" },
      { point: "Concurrent bidding capacity", manual: "One auctioneer can only watch one part of the room", bidwar: "Unlimited simultaneous bidders, all handled in order" },
      { point: "Audit and accountability", manual: "No record of who bid when", bidwar: "Full timestamped bid log for every auction session" },
    ],

    targetAudience: [
      { title: "First-Time Auction Organisers", desc: "Never run a live franchise auction before? BidWar's guided setup and simple operator dashboard make your first event professional from the start." },
      { title: "Experienced Organisers Upgrading", desc: "Moving from manual auction boards or spreadsheets to a digital platform? BidWar's live bidding eliminates every problem that plagues manual auctions." },
      { title: "Multi-Sport Tournament Directors", desc: "Running cricket, football, and kabaddi auctions across a season? BidWar's consistent bidding infrastructure works identically across all sports." },
      { title: "Remote & Hybrid Event Organisers", desc: "Running auctions where some team owners join remotely? BidWar's browser-based bidding works from anywhere — same experience, same real-time sync." },
    ],

    quotes: [
      { text: "We had 12 teams bidding simultaneously on a Platinum player. The bid went from ₹8 lakh to ₹24 lakh in 40 seconds. Every single bid appeared on the display screen instantly. The room was completely electric.", name: "Mohd. Imran", role: "League Founder", city: "Kanpur, UP" },
      { text: "I've run 6 auctions manually before trying BidWar. The difference in organiser stress alone is worth the entire cost. No disputes, no tracking, no chaos. Just the auction.", name: "Manoj Rathi", role: "Club Organiser", city: "Nagpur, Maharashtra" },
    ],

    faqs: [
      { q: "How does live player bidding work in a sports auction?", a: "In a live player bidding session, the auction operator nominates a player and starts a bid timer. Team owners who want to acquire that player tap a BID button on their private panel (open on their smartphones). Each tap raises the current bid by the configured increment. The highest bid when the timer expires wins the player. All of this — bids, timer, and outcomes — is visible in real time on the LED display screen for the audience and on every owner's panel." },
      { q: "How fast does BidWar sync bids across all devices?", a: "BidWar's bidding engine syncs bid events to all connected devices — operator dashboard, owner panels, and display screen — in under one second. The technology uses server-sent real-time updates rather than polling, which means there are no periodic delays. When a team owner taps BID on their phone in Mumbai, the new bid amount appears on the display screen in the venue and on all other owners' panels before a full second has passed." },
      { q: "What happens when two team owners bid at exactly the same time?", a: "BidWar's server-side bid processing handles simultaneous bids sequentially in the order they are received. The first bid received is accepted and confirmed. The second owner's panel immediately shows the updated (now-higher) bid amount, and they can choose to bid again. Both events are recorded in the bid log with their exact timestamps. This is a fundamental improvement over manual auctions, where simultaneous bids are impossible to resolve fairly." },
      { q: "Can team owners bid from outside the venue?", a: "Yes. Because BidWar runs entirely in a browser over the internet, team owners can bid from anywhere with an internet connection — inside the venue, in the car park, or even from another city in special circumstances. Owner panels work over mobile data (4G or 5G) with no special configuration required. This also enables hybrid events where some team owners are physically present and others join remotely." },
      { q: "How many teams can bid simultaneously in BidWar?", a: "BidWar supports unlimited concurrent bidders. Whether you have 4 teams, 16 teams, or 30 teams all potentially bidding on the same player, the system handles all bids in real time without performance degradation. The server-side processing ensures that all bids are logged in the correct order regardless of how many arrive simultaneously." },
      { q: "Does BidWar work on slow or unreliable internet connections?", a: "BidWar is optimised for real-world conditions including mobile data and venue WiFi, which are often inconsistent. The bidding protocol is designed to be resilient — bid submissions are confirmed server-side and retried automatically if the first attempt doesn't receive a response. Owner panels reconnect automatically if the connection drops briefly. For critical events, we recommend the operator uses a wired connection or a dedicated mobile hotspot for the main session while owners use their regular mobile data." },
      { q: "What is the difference between the operator panel and the owner panel?", a: "The operator panel is the auction control centre used by the tournament director or event host. It shows all teams, all bids, player queue management, bid controls (accept, timer, undo), and session management. The owner panel is a simplified bidding interface for each franchise team owner — it shows only what that owner needs to bid: the current player, current bid, remaining purse, and a BID button. The operator has full control; owners can only bid within the active session rules." },
      { q: "Can I use BidWar for online auctions where participants join from home?", a: "Yes. BidWar is fully cloud-based and all panels work over any internet connection. Online sports franchise auctions — where the operator runs the session from one location, team owners join from their homes, and the display is shared via OBS stream or video call — are increasingly common. BidWar supports this fully. Distributed sports leagues, inter-city franchise auctions, and alumni events with participants across India all use this setup successfully." },
    ],

    relatedPages: [
      { label: "Cricket Auction Software", href: "/cricket-auction-software", desc: "IPL-style franchise cricket auction" },
      { label: "Football Player Auction", href: "/football-player-auction", desc: "Football franchise player bidding" },
      { label: "Kabaddi Auction Platform", href: "/kabaddi-auction-platform", desc: "PKL-style kabaddi franchise auction" },
      { label: "Esports Auction System", href: "/esports-auction-system", desc: "Gaming team draft and player auction" },
      { label: "Tournament Auction Platform", href: "/tournament-auction-platform", desc: "Full platform overview for all sports" },
    ],

    whatsappText: "Hi%2C%20I%20want%20to%20set%20up%20a%20live%20player%20bidding%20auction%20on%20BidWar.%20Can%20you%20help%3F",
  },

  // ─────────────────────────────────────────────────────────────────────────────

  "tournament-auction-platform": {
    title: "Tournament Auction Platform | Multi-Sport Franchise Bidding — BidWar",
    description: "BidWar is India's tournament auction platform — cricket, football, kabaddi, esports, and all franchise sports. Real-time bidding, LED display, mobile owner panels, and post-event analytics.",
    canonical: "https://www.bidwar.in/tournament-auction-platform",
    eyebrow: "Tournament Auction Platform",
    h1: <>India's <span className="text-primary">Tournament Auction Platform</span> for Franchise Sports</>,
    subheading: "From cricket to kabaddi, football to esports — BidWar is the complete tournament auction infrastructure. Player categories, purse management, live bidding, broadcast display, and analytics for every sport, every size.",
    breadcrumbLabel: "Tournament Auction Platform",
    heroStats: [
      { label: "Sports Supported", value: "Cricket · Football · Kabaddi+" },
      { label: "Tournament Sizes", value: "2 to 30 Teams" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial", value: "2 Teams, Free" },
    ],

    bodyParagraphs: [
      "India runs more franchise sports auctions than any other country in the world. From T20 cricket leagues in UP to PKL-format kabaddi in Maharashtra, from futsal franchise events in Bengaluru to BGMI team drafts in Mumbai — the IPL's influence has created a template that organisers across every sport and city level are trying to replicate. The common thread in all of these events is the same problem: there is no platform designed for this. Until BidWar.",
      "A generic event management tool doesn't know what a player category is, doesn't understand purse limits, and has never heard of a SOLD stamp. A spreadsheet can track bids but can't display them in real time to an audience. A WhatsApp group can coordinate, but it can't run a live bidding session with multiple simultaneous owners. Organisers across India have been stitching these tools together for years — and the results are manual, error-prone, and exhausting.",
      "BidWar is built specifically for one thing: franchise sports auctions. Every feature on the platform — from the player category system to the bid increment logic, from the LED display animations to the squad composition enforcement, from the OBS streaming overlay to the post-event analytics — exists because a real organiser running a real franchise auction needed it. The platform has been tested across cricket, football, kabaddi, esports, volleyball, basketball, and multi-sport corporate events, and it works identically for all of them.",
    ],

    howItWorks: [
      { n: 1, title: "Choose your sport and set up teams", desc: "Create your tournament, select or customise your sport's format, and add franchise teams with names, colours, and purse amounts. BidWar works for any franchise-format sport — the underlying auction engine is identical, the player categories are customised per sport." },
      { n: 2, title: "Configure your auction format", desc: "Set player categories (Platinum/Gold/Silver or position-based), individual base prices, bid increments, squad composition rules, and total round structure. These settings mirror professional league formats like IPL, PKL, or ISL — or your own custom rules." },
      { n: 3, title: "Build your player database", desc: "Upload players manually or share a QR registration link with players. Each player is assigned to a category with relevant stats and a photo. BidWar organises them into your auction queue automatically." },
      { n: 4, title: "Go live on auction day", desc: "Open the LED display on your projector or TV. Share owner panels with franchise representatives. Press Start. From here, the platform runs the auction — you just control the pace and confirm each outcome." },
      { n: 5, title: "Generate reports and plan next season", desc: "Complete post-auction reports are available immediately. Share team compositions, top sold players, and analytics with your league community — and use the data to plan your next season's auction format." },
    ],

    features: [
      { icon: Trophy, title: "Multi-Sport Player Categories", short: "Custom categories for any sport — cricket, football, kabaddi, esports.", long: "BidWar's category system is sport-agnostic. Create up to 8 player categories per tournament with any names, base prices, and bid increments. For cricket: Platinum, Gold, Silver, Emerging. For football: Goalkeeper, Defender, Midfielder, Forward. For kabaddi: Raider, Defender, All-Rounder. For esports: IGL, Entry Fragger, Support, AWPer. Category icons, colours, and auction order are all configurable. The same flexible system supports every franchise-format sport." },
      { icon: Monitor, title: "Broadcast LED Display", short: "Professional venue display for any projector, TV, or LED wall.", long: "The LED Display is BidWar's most visible feature — and the one that immediately makes any franchise auction feel professional. Open the display URL on any laptop connected to a projector or smart TV. It shows the current player's full profile, the live bid counter in large animated numerals, the leading team in their franchise colour, a SOLD stamp animation for confirmed sales, and a team purse strip at the bottom. No configuration, no technical setup — just open the URL in fullscreen." },
      { icon: Smartphone, title: "Team Owner Mobile Bidding", short: "Universal mobile bidding for every sport format.", long: "Whether owners are bidding for cricket all-rounders, football midfielders, kabaddi raiders, or esports IGLs, the Owner Panel works identically. They receive a private link, open it on their smartphone, and see the current player's details, the live bid, their remaining purse, and a BID button. The panel updates in real time across all sports and auction formats. No app, no account, no technical barrier." },
      { icon: Gavel, title: "Operator Control Dashboard", short: "One dashboard to run your entire auction from.", long: "The operator dashboard is the command centre for your franchise auction. Select players from the category queue, run bid timers, accept bids via quick-bid buttons, mark outcomes, and monitor all teams' purse levels — all from one screen. The dashboard works on a tablet, laptop, or desktop and is designed for non-technical event managers. Undo handles any mistake, pause handles any interruption, and the full bid log is always visible for reference." },
      { icon: Radio, title: "OBS Streaming Overlay", short: "Broadcast your franchise auction on YouTube, Facebook, or Twitch.", long: "Any franchise auction can be broadcast as a live event using BidWar's OBS overlay. Add the overlay URL as a browser source in OBS Studio and it places professional bid graphics — player profile, live bid counter, team ticker — directly over your video stream. This works for all sports and all auction formats on BidWar. Cricket leagues stream to Facebook Live. Esports auctions stream to YouTube or Twitch. Corporate events stream to internal company channels." },
      { icon: Zap, title: "Player Self-Registration QR", short: "Players register themselves — works for any sport.", long: "The QR player registration system is sport-agnostic. Players scan a QR code and fill in their name, photo, playing role or position, and relevant stats. The fields are configurable per tournament — batting average for cricket, K/D ratio for esports, or goals scored for football. The registration form works on any smartphone, takes under 3 minutes per player, and eliminates hours of manual data entry for organisers running large player pools." },
      { icon: BarChart3, title: "Post-Auction Analytics", short: "Instant reports covering every aspect of your auction.", long: "After any BidWar auction — regardless of sport — the post-event report is available immediately. It shows team compositions, player-by-player spend, top sold players by price, bid history for each player, purse utilisation percentages, and unsold player lists. The report is accessible via a shareable link. League administrators use it for official records. Social media managers use it for post-event content. Team owners use it to understand their competition's squad strategy." },
    ],

    comparison: [
      { point: "Sport flexibility", manual: "Different tools for different sports — inconsistent experience", bidwar: "One platform, all sports — same professional experience" },
      { point: "Setup per event", manual: "Rebuild spreadsheets and processes from scratch each time", bidwar: "Template-based setup, new tournament in 5 minutes" },
      { point: "Data continuity", manual: "Previous event data lost or in an old spreadsheet", bidwar: "All tournament history stored in your account" },
      { point: "Scalability", manual: "4-team event is as hard to manage as 16-team event", bidwar: "Platform scales identically from 2 teams to 30" },
      { point: "Organiser replicability", manual: "Dependent on the same coordinator every year", bidwar: "Any new organiser can run the event using the same setup" },
      { point: "Event prestige", manual: "Manual auction feels like an afterthought", bidwar: "Broadcast display and live bidding create a flagship event" },
    ],

    targetAudience: [
      { title: "League Commissioners & Sports Directors", desc: "Running an annual franchise league across multiple sports? BidWar is your permanent auction infrastructure — consistent, professional, and improving every season." },
      { title: "Tournament Organisers Running Multiple Sports", desc: "Managing cricket, football, and kabaddi auctions in the same season? One BidWar account handles all of them with consistent tools and centralised reporting." },
      { title: "Associations & Sports Bodies", desc: "District, state, and national-level sports bodies running official franchise auctions need reliable, dispute-free infrastructure. BidWar is designed for exactly this." },
      { title: "First-Time Franchise Organisers", desc: "Want to run your first franchise auction but don't know where to start? BidWar's guided setup and free trial let you run a professional-quality test auction before your event." },
    ],

    quotes: [
      { text: "We run cricket, football, and kabaddi franchise auctions in the same district league. Three different sports, one platform, same professional quality every time. The consistency alone is worth it.", name: "Aditya Sharma", role: "District Sports Commissioner", city: "Varanasi, UP" },
      { text: "We've used BidWar for 6 consecutive seasons. The platform gets better each year and the support team on WhatsApp is outstanding. It's become the standard for how our league runs auctions.", name: "Kumari Sinha", role: "League Founder", city: "Patna, Bihar" },
    ],

    faqs: [
      { q: "What is a tournament auction platform?", a: "A tournament auction platform is software designed specifically to run franchise player auctions for sports tournaments. It manages the full auction workflow: player categories and base prices, team purse limits, real-time bidding from team owners, a broadcast display screen for the audience, operator controls for managing the session, and post-event reports. BidWar is purpose-built for this — unlike generic event tools, every feature is designed for the specific needs of franchise sports auctions." },
      { q: "Which sports does BidWar support for franchise auctions?", a: "BidWar supports all franchise-format sports where players are auctioned to teams with a budget. This includes cricket, football, kabaddi, basketball, volleyball, badminton, esports (BGMI, Valorant, CS2, Free Fire), and any other sport where the franchise auction format applies. Player categories, base prices, squad rules, and bid increments are all configurable to match any sport's specific structure." },
      { q: "How many tournaments can I run on one BidWar account?", a: "A BidWar account can hold multiple tournaments — you can run your cricket auction in March, your football auction in June, and your kabaddi auction in September all under the same account. Each tournament is priced separately based on the number of teams. All tournament histories, player databases, and reports are stored in your account and accessible at any time." },
      { q: "How long does it take to set up a tournament auction on BidWar?", a: "Setting up a new tournament on BidWar takes 10–20 minutes depending on the number of teams and players. Creating the tournament and teams takes about 5 minutes. Configuring player categories and auction rules takes 5 minutes. Adding players (or initiating self-registration) takes another 5–10 minutes. On auction day, opening the display and sharing owner panel links takes about 2 minutes. Most first-time organisers run a test auction within 30 minutes of signing up." },
      { q: "Can I use BidWar for tournaments with different rules each season?", a: "Yes. BidWar's tournament settings are fully configurable for each event. Season 1 might have 8 teams and Platinum/Gold/Silver categories. Season 2 might add a fourth category or change base prices. You can adjust purse amounts, bid increments, squad rules, and player categories every season to match your league's evolving format. Previous seasons remain stored in your account for reference and comparison." },
      { q: "Does BidWar work for both small and large tournaments?", a: "Yes. BidWar scales from the smallest possible auction (2 teams, free trial) to the largest practical franchise format (30 teams, Champion plan). The platform works identically at both extremes — same features, same display quality, same real-time performance. A 4-team club auction and a 16-team state championship both run on the same infrastructure, with pricing scaled to team count rather than features." },
      { q: "What technical equipment do I need to run a BidWar auction?", a: "You need: one laptop or tablet for the operator dashboard, one device (laptop, Chromecast, or smart TV) connected to a projector or large screen for the LED display, and smartphones for team owners (which they already have). An internet connection — venue WiFi or mobile hotspot — is required. No special hardware, no dedicated servers, no AV technician. Most organisers run successful auctions with just their personal laptop, a projector, and a mobile hotspot." },
      { q: "How do I get support if something goes wrong on auction day?", a: "BidWar provides WhatsApp support at +91 8707488250. During business hours, responses are typically within 1 hour. For planned events, we strongly recommend doing a full test run (available for free with the 2-team trial) the day before your actual auction. This lets you verify that the display works on your projector, that owner panels open correctly on the phones being used, and that your internet connection is reliable at the venue." },
    ],

    relatedPages: [
      { label: "Cricket Auction Software", href: "/cricket-auction-software", desc: "IPL-style franchise cricket auction" },
      { label: "Football Player Auction", href: "/football-player-auction", desc: "Football franchise player bidding" },
      { label: "Kabaddi Auction Platform", href: "/kabaddi-auction-platform", desc: "PKL-style kabaddi franchise auction" },
      { label: "Esports Auction System", href: "/esports-auction-system", desc: "Gaming team draft and player auction" },
      { label: "Business League Auction", href: "/business-league-auction", desc: "Corporate sports franchise auctions" },
    ],

    whatsappText: "Hi%2C%20I%20want%20to%20run%20a%20sports%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20it%20up%3F",
  },
};

// ─── Helper Components ─────────────────────────────────────────────────────────

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
      className="border border-border rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-card/50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-semibold text-sm text-white leading-snug">{q}</span>
        <span className="flex-shrink-0">
          {open
            ? <ChevronDown className="w-4 h-4 text-primary rotate-180 transition-transform duration-200" />
            : <Plus className="w-4 h-4 text-primary" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="ans"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/50 pt-4">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function SeoSportLanding({ slug }: { slug: string }) {
  const [, navigate] = useLocation();
  const config = SPORT_CONFIGS[slug];

  if (!config) {
    navigate("/");
    return null;
  }

  return (
    <>
      <SeoHead
        title={config.title}
        description={config.description}
        canonical={config.canonical}
        ogImage="https://www.bidwar.in/opengraph.jpg"
      />
      <SportLandingSchemaMarkup
        name={config.breadcrumbLabel}
        url={config.canonical}
        description={config.description}
        faqs={config.faqs}
      />

      <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">

        {/* ── Nav ─────────────────────────────────────────── */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <img src="/bidwar-logo-transparent.png" alt="BidWar" className="h-8 w-auto" />
              <span className="font-black text-lg tracking-tight text-white">BIDWAR</span>
            </a>
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/#features" className="hover:text-white transition-colors">Features</a>
              <a href="/#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="/#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/organizer")} className="text-sm text-muted-foreground hover:text-white transition-colors hidden sm:block">Sign In</button>
              <button onClick={() => navigate("/organizer")} className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors">
                Get Started Free
              </button>
            </div>
          </div>
        </nav>

        {/* ── Breadcrumb ───────────────────────────────────── */}
        <div className="pt-20 pb-0 px-6">
          <div className="max-w-6xl mx-auto">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground py-4">
              <a href="/" className="hover:text-white transition-colors">Home</a>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white">{config.breadcrumbLabel}</span>
            </nav>
          </div>
        </div>

        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative pt-6 pb-16 px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/8 rounded-full blur-[100px]" />
          </div>
          <div className="relative max-w-4xl mx-auto text-center space-y-7">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest mb-5">
                <Star className="w-3 h-3" />
                {config.eyebrow}
              </div>
              <h1 className="text-4xl md:text-6xl font-black leading-none tracking-tight mb-5">
                {config.h1}
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {config.subheading}
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate("/organizer")}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-primary text-black font-black text-base hover:bg-primary/90 transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.35)] flex items-center justify-center gap-2"
              >
                Start Free <ArrowRight className="w-4 h-4" />
              </button>
              <a href={`https://wa.me/918707488250?text=${config.whatsappText}`} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-border text-foreground font-semibold text-base hover:bg-card/50 transition-all flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-400" /> WhatsApp Us
              </a>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> Free trial — 2 teams</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> No credit card needed</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> Works on any device</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> Setup in under 15 minutes</span>
            </motion.div>
          </div>

          {/* Hero stats */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-3xl mx-auto mt-12 grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {config.heroStats.map((s, i) => (
              <div key={i} className="bg-card/30 border border-border rounded-xl p-4 text-center">
                <p className="text-primary font-black text-lg">{s.value}</p>
                <p className="text-muted-foreground text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ── Editorial Body ────────────────────────────────── */}
        <section className="py-16 px-6 border-t border-border/30 bg-white/[0.012]">
          <div className="max-w-3xl mx-auto space-y-5">
            {config.bodyParagraphs.map((para, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-base text-muted-foreground leading-[1.85] tracking-wide"
              >
                {para}
              </motion.p>
            ))}
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Step by Step</div>
              <h2 className="text-3xl md:text-4xl font-black">How it works — start to finish</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                From tournament setup to sharing your post-auction report — here's exactly how a BidWar auction runs.
              </p>
            </div>
            <div className="space-y-4">
              {config.howItWorks.map((step, i) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-5 p-5 rounded-2xl border border-border bg-card/20 hover:border-primary/20 hover:bg-card/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="font-black text-primary text-sm">{step.n}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features (Deep) ───────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Platform Features</div>
              <h2 className="text-3xl md:text-4xl font-black">Every tool your auction day needs</h2>
              <p className="text-muted-foreground text-base max-w-xl mx-auto">
                BidWar handles every part of your auction — player registration, live bidding, broadcast display, and post-event reports.
              </p>
            </div>
            <div className="space-y-5">
              {config.features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className={`grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-5 p-6 rounded-2xl border border-border bg-card/20 hover:border-primary/20 hover:bg-card/30 transition-all ${i % 2 !== 0 ? "md:grid-cols-[2fr_1fr]" : ""}`}
                >
                  {i % 2 !== 0 ? (
                    <>
                      <div>
                        <h3 className="font-bold text-white text-base mb-2 leading-snug">{f.long}</h3>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <f.icon className="w-5 h-5 text-primary" />
                          </div>
                          <h3 className="font-bold text-white text-base">{f.title}</h3>
                        </div>
                        <p className="text-primary text-sm font-medium">{f.short}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <f.icon className="w-5 h-5 text-primary" />
                          </div>
                          <h3 className="font-bold text-white text-base">{f.title}</h3>
                        </div>
                        <p className="text-primary text-sm font-medium">{f.short}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm leading-relaxed">{f.long}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social Proof Quotes ───────────────────────────── */}
        <section className="py-16 px-6 border-t border-border/30 bg-white/[0.012]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10 space-y-2">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">What Organisers Say</div>
              <h2 className="text-2xl md:text-3xl font-black">From people who've run it live</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {config.quotes.map((q, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl border border-border bg-card/20 space-y-4"
                >
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => <Star key={n} className="w-3.5 h-3.5 text-primary fill-primary" />)}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">"{q.text}"</p>
                  <div className="pt-3 border-t border-border/40">
                    <p className="text-sm font-bold text-white">{q.name}</p>
                    <p className="text-xs text-muted-foreground">{q.role}</p>
                    <p className="text-xs text-muted-foreground/70">{q.city}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BidWar vs Manual ─────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Comparison</div>
              <h2 className="text-3xl md:text-4xl font-black">BidWar vs manual auction methods</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                Every organiser who has switched to BidWar from a manual system reports the same thing: they wish they'd done it sooner.
              </p>
            </div>
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="grid grid-cols-[1.5fr_1fr_1fr] bg-card/40 border-b border-border">
                <div className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">What's being compared</div>
                <div className="p-3 text-xs font-bold text-muted-foreground uppercase tracking-wider border-l border-border text-center flex items-center justify-center gap-1.5">
                  <X className="w-3.5 h-3.5 text-red-400" /> Manual / Whiteboard
                </div>
                <div className="p-3 text-xs font-bold text-primary uppercase tracking-wider border-l border-border text-center flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-400" /> BidWar
                </div>
              </div>
              {config.comparison.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[1.5fr_1fr_1fr] border-b border-border/50 last:border-0 ${i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"}`}
                >
                  <div className="p-4 text-sm font-semibold text-white">{row.point}</div>
                  <div className="p-4 text-sm text-muted-foreground border-l border-border/50">{row.manual}</div>
                  <div className="p-4 text-sm text-green-400/90 border-l border-border/50 font-medium">{row.bidwar}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who It's For ─────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30 bg-white/[0.012]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Who Uses This</div>
              <h2 className="text-3xl md:text-4xl font-black">Built for tournament organisers at every level</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.targetAudience.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="p-5 rounded-2xl border border-border bg-card/20 hover:border-primary/20 hover:bg-card/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    <div>
                      <h3 className="font-bold text-white text-sm mb-1.5">{item.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing Mini ─────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Pricing</div>
              <h2 className="text-3xl md:text-4xl font-black">One-time per-tournament fee</h2>
              <p className="text-muted-foreground text-sm">No monthly subscription. No recurring charges. Pay once, run your auction.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Trial", price: "Free", teams: "2 Teams", highlight: false },
                { label: "Starter", price: "₹5,000", teams: "4 Teams", highlight: false },
                { label: "Pro", price: "₹6,000", teams: "8 Teams", highlight: true },
                { label: "Advanced", price: "₹8,000", teams: "12 Teams", highlight: false },
                { label: "Elite", price: "₹10,000", teams: "16 Teams", highlight: false },
                { label: "Champion", price: "₹15,000", teams: "30 Teams", highlight: false },
              ].map((p) => (
                <div
                  key={p.label}
                  className={`relative p-4 rounded-xl border text-center transition-all ${p.highlight ? "border-primary bg-primary/5" : "border-border bg-card/20"}`}
                >
                  {p.highlight && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-black text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{p.label}</p>
                  <p className="font-black text-xl text-white">{p.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">{p.teams}</p>
                  {p.price !== "Free" && <p className="text-[10px] text-muted-foreground/60 mt-0.5">+ GST per auction</p>}
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate("/organizer")}
                className="px-6 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-all inline-flex items-center gap-2"
              >
                Start Free <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-muted-foreground mt-3">
                Payment via bank transfer · License activated on WhatsApp ·{" "}
                <a href="https://wa.me/918707488250" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">+91 8707488250</a>
              </p>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30 bg-white/[0.012]">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">FAQ</div>
              <h2 className="text-3xl md:text-4xl font-black">Common questions answered</h2>
              <p className="text-muted-foreground text-sm">Everything you need to know before running your first auction with BidWar.</p>
            </div>
            <div className="space-y-3">
              {config.faqs.map((f, i) => (
                <FaqItem key={i} q={f.q} a={f.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Related Pages (Internal Links) ───────────────── */}
        <section className="py-16 px-6 border-t border-border/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 space-y-2">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Also Explore</div>
              <h2 className="text-2xl font-black">BidWar for other sports</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {config.relatedPages.map((page) => (
                <a
                  key={page.href}
                  href={page.href}
                  className="group p-4 rounded-xl border border-border hover:border-primary/30 bg-card/20 hover:bg-card/30 transition-all"
                >
                  <p className="font-bold text-sm text-white group-hover:text-primary transition-colors">{page.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{page.desc}</p>
                  <div className="flex items-center gap-1 text-primary text-xs mt-2 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore <ChevronRight className="w-3 h-3" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="py-24 px-6 border-t border-border/30">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="relative p-10 rounded-3xl border border-primary/20 bg-primary/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative space-y-5">
                <h2 className="text-3xl md:text-4xl font-black">Ready to run your auction?</h2>
                <p className="text-muted-foreground text-base max-w-md mx-auto">
                  Start with a free 2-team trial. No credit card, no setup fee. Your first professional auction in under 15 minutes.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => navigate("/organizer")}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-primary text-black font-black text-base hover:bg-primary/90 transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] inline-flex items-center justify-center gap-2"
                  >
                    Start Free <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href={`https://wa.me/918707488250?text=${config.whatsappText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-border font-semibold text-base hover:bg-card/50 transition-all inline-flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4 text-green-400" /> WhatsApp Us
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">Free trial · 2 teams · No card required</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="border-t border-border/30 py-10 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="col-span-2 md:col-span-1 space-y-3">
                <div className="flex items-center gap-2">
                  <img src="/bidwar-logo-transparent.png" alt="BidWar" className="h-7 w-auto" />
                  <span className="font-black text-base">BIDWAR</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">India's live sports auction platform for franchise tournaments.</p>
                <a href="https://wa.me/918707488250" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> +91 8707488250
                </a>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Sports</p>
                {[
                  ["Cricket Auction Software", "/cricket-auction-software"],
                  ["Football Player Auction", "/football-player-auction"],
                  ["Kabaddi Auction Platform", "/kabaddi-auction-platform"],
                  ["Esports Auction System", "/esports-auction-system"],
                ].map(([label, href]) => (
                  <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">More</p>
                {[
                  ["Business League Auction", "/business-league-auction"],
                  ["Live Player Bidding", "/live-player-bidding"],
                  ["Tournament Auction Platform", "/tournament-auction-platform"],
                  ["Pricing", "/#pricing"],
                  ["FAQ", "/#faq"],
                ].map(([label, href]) => (
                  <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Legal</p>
                {[
                  ["Terms of Service", "/legal/terms"],
                  ["Privacy Policy", "/legal/privacy"],
                  ["Acceptable Use", "/legal/acceptable-use"],
                ].map(([label, href]) => (
                  <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
                ))}
              </div>
            </div>
            <div className="border-t border-border/30 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} BidWar. All rights reserved.</p>
              <p className="text-xs text-muted-foreground">India's Live Sports Auction Platform</p>
            </div>
          </div>
        </footer>

        {/* ── WhatsApp Float ───────────────────────────────── */}
        <a
          href={`https://wa.me/918707488250?text=${config.whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-3"
        >
          <motion.span
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2, duration: 0.4 }}
            className="hidden sm:block bg-[#111113] border border-border text-xs font-semibold text-white px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
          >
            Chat with us on WhatsApp
          </motion.span>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.5, type: "spring", stiffness: 260, damping: 20 }}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_24px_rgba(37,211,102,0.4)] hover:shadow-[0_4px_32px_rgba(37,211,102,0.6)] transition-all hover:scale-110"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
          >
            <MessageCircle className="w-6 h-6 text-white fill-white" />
          </motion.div>
        </a>

      </div>
    </>
  );
}
