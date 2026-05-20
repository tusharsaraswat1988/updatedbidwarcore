import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel, Monitor, Smartphone, Users, Radio, Zap, Check,
  ArrowRight, ChevronDown, Plus, Star, Cloud, Wifi,
  ShieldCheck, Clock, ChevronRight, Trophy, BarChart3, Tv,
} from "lucide-react";
import { SeoHead } from "@/components/seo-head";

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
  features: { icon: React.ElementType; title: string; desc: string }[];
  useCases: { title: string; desc: string }[];
  faqs: { q: string; a: string }[];
};

// ─── Page Configs ─────────────────────────────────────────────────────────────

export const SPORT_CONFIGS: Record<string, SportPageConfig> = {

  "cricket-auction-software": {
    title: "Cricket Auction Software | IPL-Style Player Auction Platform — BidWar",
    description: "Run professional cricket player auctions with BidWar's IPL-style auction software. Real-time bidding, LED broadcast display, team owner mobile panels. Free trial — 2 teams, no credit card.",
    canonical: "https://www.bidwar.in/cricket-auction-software",
    eyebrow: "Cricket Auction Software",
    h1: <>IPL-Style <span className="text-primary">Cricket Auction</span> Software</>,
    subheading: "Run franchise cricket player auctions like the IPL — complete with player categories, team purse limits, real-time bidding panels, and a broadcast-quality LED display for your audience.",
    breadcrumbLabel: "Cricket Auction Software",
    heroStats: [
      { label: "Platforms Supported", value: "All Devices" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial Teams", value: "2 Teams" },
      { label: "Live Sync Latency", value: "< 1 second" },
    ],
    features: [
      { icon: Gavel, title: "IPL-Style Player Categories", desc: "Create Platinum, Gold, Silver, and Emerging tiers with custom reserve prices and bid increments — exactly like professional franchise auctions." },
      { icon: Monitor, title: "Broadcast LED Display", desc: "Full-screen display for projectors and smart TVs. Animated player cards, live bid counter, team purse strip, and SOLD stamp — broadcast-ready." },
      { icon: Smartphone, title: "Team Owner Mobile Panels", desc: "Every franchise owner bids from their own phone. One-tap bid button, real-time purse balance, squad overview — no app download needed." },
      { icon: Radio, title: "OBS Streaming Overlay", desc: "Transparent overlay for YouTube and Facebook Live streams. Player photo, bid bar, and team ticker — turn your cricket auction into a broadcast event." },
      { icon: Zap, title: "Player Self-Registration", desc: "Players register via a QR code link with name, photo, role (batsman, bowler, all-rounder, wicket-keeper), and stats. Auto-fills your auction roster." },
      { icon: BarChart3, title: "Post-Auction Reports", desc: "Detailed analytics after every auction — top sold players, team-wise spend, purse utilization, and full bid history. Export and share instantly." },
    ],
    useCases: [
      { title: "T20 & T10 Club Leagues", desc: "Run franchise auctions for local T20, T10, and box cricket leagues with full team management and live bidding." },
      { title: "Corporate Cricket Tournaments", desc: "Manage business cricket league auctions with sponsor branding, streaming overlay, and operator-controlled sessions." },
      { title: "District & State Championships", desc: "Scale to 30-team state-level cricket franchises with complete purse tracking, player categories, and LED displays." },
    ],
    faqs: [
      { q: "What is cricket auction software?", a: "Cricket auction software is a digital platform that lets tournament organizers run live IPL-style player auctions. It handles player categories, team purse limits, real-time bidding from team owners, an LED broadcast display for the audience, and a complete bid history — replacing manual auction boards with an automated, professional system." },
      { q: "How does BidWar's cricket auction work?", a: "The operator controls the session from a dashboard — selecting players, starting bid timers, and recording bids from each team. Team owners place bids from their smartphones via dedicated panels. The LED display shows the live action on a projector or TV. Everything syncs in real time across all devices." },
      { q: "Can I run IPL-style player categories in BidWar?", a: "Yes. BidWar supports custom player categories (Platinum, Gold, Silver, Emerging or any names you choose), each with its own minimum bid price and bid increment. This mirrors the exact format used in IPL, CPL, and other professional franchise leagues." },
      { q: "How many teams does BidWar support for cricket auctions?", a: "BidWar scales from 2 teams (free trial) to 30 teams on the Champion plan. Pricing scales with team count — you pay only for the size of your tournament." },
      { q: "Can I stream my cricket auction on YouTube or Facebook Live?", a: "Yes. BidWar includes an OBS-compatible streaming overlay that shows the player photo, live bid amount, team ticker, and bid progress bar directly in your livestream — giving your cricket auction a professional TV broadcast look." },
    ],
  },

  "football-player-auction": {
    title: "Football Player Auction Software | Live Franchise Bidding — BidWar",
    description: "Run live football player auctions with BidWar. Franchise bidding, team budgets, mobile owner panels, and broadcast LED display. Ideal for football leagues across India. Free trial available.",
    canonical: "https://www.bidwar.in/football-player-auction",
    eyebrow: "Football Player Auction",
    h1: <>Football Player <span className="text-primary">Auction Software</span> for Franchise Leagues</>,
    subheading: "Conduct live football franchise auctions with real-time bidding, team budget management, and a broadcast-quality display screen — designed for everything from local 5-a-side leagues to full 11-a-side championships.",
    breadcrumbLabel: "Football Player Auction",
    heroStats: [
      { label: "Player Roles", value: "GK, DEF, MID, FWD" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial Teams", value: "2 Teams" },
      { label: "Sync Speed", value: "Real-Time" },
    ],
    features: [
      { icon: Users, title: "Position-Based Bidding", desc: "Organise players by goalkeeper, defender, midfielder, and forward. Set different reserve prices per position category for authentic football auction structure." },
      { icon: Monitor, title: "LED Display for Venues", desc: "Full-screen display mode for projectors and TVs. Shows the player being auctioned, current bid, leading team, and team purse balances in broadcast quality." },
      { icon: Smartphone, title: "Mobile Bidding Panels", desc: "Each team owner bids instantly from their smartphone. No app download required — just open the link, see the live bid, and tap to raise." },
      { icon: Gavel, title: "Operator Control Room", desc: "Run the full auction from a tablet. Nominate players, start timers, accept bids, mark sold or unsold, and undo the last action — complete control." },
      { icon: Zap, title: "Player Registration via QR", desc: "Players self-register with name, photo, preferred position, and stats through a QR code link. Eliminates manual data entry for the organizer." },
      { icon: Cloud, title: "Cloud-Based, No Install", desc: "Everything runs in a browser. Operator dashboard, owner panels, and display screen all sync live — from any venue, any device, anywhere." },
    ],
    useCases: [
      { title: "5-a-Side & Futsal Leagues", desc: "Run franchise auctions for indoor football and futsal leagues with team budgets, player categories, and mobile bidding." },
      { title: "11-a-Side Club Tournaments", desc: "Full 11-a-side football franchise auctions with position-based categories, purse limits, and LED display screens." },
      { title: "Corporate Football Events", desc: "Business football league player drafts with sponsor branding, OBS streaming overlay, and professional auction setup." },
    ],
    faqs: [
      { q: "How does football player auction software work?", a: "Football auction software lets organizers run live player bidding sessions for franchise leagues. The operator nominates players, starts bid timers, and accepts bids from team owners who bid from their smartphones. A large LED display shows the live auction to the audience. BidWar manages all of this in real time from one platform." },
      { q: "Can I categorise football players by position?", a: "Yes. BidWar allows you to create player categories by position — goalkeeper, defender, midfielder, forward — each with its own minimum bid price and bid increment. You can also set squad size rules per category to enforce minimum and maximum players per position." },
      { q: "Is BidWar suitable for local football leagues?", a: "Yes. BidWar's free trial supports 2-team auctions at no cost, and paid plans start from small club sizes. It's been used for 5-a-side futsal leagues, box football tournaments, and full 11-a-side district championships." },
      { q: "Can team owners bid from their phones during a football auction?", a: "Yes. Every team owner gets a dedicated mobile bidding panel that works on any smartphone browser — no app download needed. They see the current player, current bid, and their remaining purse. Bidding is a single tap." },
      { q: "Does BidWar support football auction live streaming?", a: "Yes. BidWar includes an OBS-compatible transparent overlay for YouTube and Facebook Live streams, showing the auctioned player's photo, live bid amount, and team ticker — perfect for broadcasting your football auction event online." },
    ],
  },

  "kabaddi-auction-platform": {
    title: "Kabaddi Auction Platform | PKL-Style Player Bidding — BidWar",
    description: "Professional kabaddi auction platform for PKL-style franchise leagues. Player categories, live bidding, LED broadcast display, and team owner mobile panels. Free trial for 2 teams.",
    canonical: "https://www.bidwar.in/kabaddi-auction-platform",
    eyebrow: "Kabaddi Auction Platform",
    h1: <>Kabaddi Auction Platform for <span className="text-primary">PKL-Style</span> Leagues</>,
    subheading: "Run professional kabaddi franchise auctions inspired by the Pro Kabaddi League — with raider, defender, and all-rounder categories, team purse management, and a live broadcast display for your audience.",
    breadcrumbLabel: "Kabaddi Auction Platform",
    heroStats: [
      { label: "Player Roles", value: "Raider, Defender, All-Rounder" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial Teams", value: "2 Teams" },
      { label: "Sync", value: "Real-Time" },
    ],
    features: [
      { icon: Trophy, title: "PKL-Inspired Player Categories", desc: "Create raider, defender, and all-rounder categories with custom reserve prices and bid increments matching the Pro Kabaddi League format." },
      { icon: Monitor, title: "LED Display for Arenas", desc: "Broadcast-quality full-screen display for projectors and TVs — shows the live player card, current bid, leading team, and SOLD animation." },
      { icon: Smartphone, title: "Team Owner Bidding Panels", desc: "Each franchise owner bids from their smartphone with a one-tap panel, live purse balance, and real-time squad overview. No app needed." },
      { icon: Gavel, title: "Auction Operator Dashboard", desc: "Full operator control from a tablet — nominate players, start timers, accept bids, mark SOLD/UNSOLD, and undo. Zero cables, zero complexity." },
      { icon: BarChart3, title: "Purse & Squad Analytics", desc: "Live purse tracking for all teams during the auction, and full post-auction reports with spend breakdown, top picks, and team composition." },
      { icon: Zap, title: "Player QR Registration", desc: "Players self-register with name, photo, role, and key stats via a QR code link. Auto-populates your auction player list without manual entry." },
    ],
    useCases: [
      { title: "District Kabaddi Leagues", desc: "Run PKL-format district franchise auctions with raider/defender categories, team budgets, and live LED display." },
      { title: "State-Level Championships", desc: "Scale to state-level kabaddi franchise auctions with up to 30 teams, complete purse management, and broadcast overlays." },
      { title: "Corporate Kabaddi Events", desc: "Business kabaddi league auctions with sponsor branding, streaming capability, and professional auction management." },
    ],
    faqs: [
      { q: "What is a kabaddi auction platform?", a: "A kabaddi auction platform is software that lets tournament organizers run live PKL-style franchise player auctions. It manages player categories (raiders, defenders, all-rounders), team purse limits, real-time bidding from team owners, and a broadcast display for the venue audience." },
      { q: "Can BidWar replicate the Pro Kabaddi League auction format?", a: "Yes. BidWar supports custom player categories that mirror the PKL format — raiders, defenders, all-rounders — each with their own minimum bid prices and bid increments. You can also set squad composition rules (minimum raiders required per team, for example)." },
      { q: "How many teams can participate in a BidWar kabaddi auction?", a: "BidWar supports 2 to 30 teams depending on your plan. The free trial supports 2 teams. Paid plans scale from 4-team Starter up to 30-team Champion, making it suitable for both local and state-level kabaddi leagues." },
      { q: "Does BidWar work for local kabaddi tournaments?", a: "Absolutely. BidWar is designed for kabaddi tournaments of all sizes — from 2-team local village auctions to 16-team district championships. Setup takes under 15 minutes, and team owners bid from their own phones without downloading any app." },
      { q: "Can I display the kabaddi auction on a projector screen?", a: "Yes. BidWar's LED Display Mode is purpose-built for projectors and large TVs at auction venues. It shows the current player, live bid amount, leading team, team purse bars, and an animated SOLD stamp — broadcast-quality for your audience." },
    ],
  },

  "esports-auction-system": {
    title: "Esports Auction System | Live Gaming Team Draft Platform — BidWar",
    description: "Run professional esports player auctions and team drafts with BidWar. Real-time bidding, organizer control panel, team owner mobile panels for esports franchise leagues. Free trial available.",
    canonical: "https://www.bidwar.in/esports-auction-system",
    eyebrow: "Esports Auction System",
    h1: <>Esports Auction System for <span className="text-primary">Team Drafts</span> & Player Bidding</>,
    subheading: "Run professional esports franchise player auctions with real-time bidding, role-based player categories (IGL, entry fragger, support), team budget management, and a live display screen for your audience.",
    breadcrumbLabel: "Esports Auction System",
    heroStats: [
      { label: "Player Roles", value: "IGL, Fragger, Support" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial Teams", value: "2 Teams" },
      { label: "Platform", value: "Browser-Based" },
    ],
    features: [
      { icon: Users, title: "Role-Based Player Categories", desc: "Categorise esports players by IGL, entry fragger, support, AWPer, or any custom role. Set reserve prices and bid increments per category." },
      { icon: Monitor, title: "Live Auction Display Screen", desc: "Full-screen display showing the current player being auctioned, live bid amount, leading team, and remaining team budgets — perfect for LAN events." },
      { icon: Smartphone, title: "Team Manager Bidding Panels", desc: "Each team manager bids from their device with a one-tap panel, live wallet balance, and squad roster view. Works on any browser." },
      { icon: Gavel, title: "Auction Host Control Panel", desc: "Full control for the auction host — nominate players, start timers, accept bids, mark sold or pass, undo last action. Runs from any browser." },
      { icon: Radio, title: "Stream Overlay for Twitch / YouTube", desc: "OBS-compatible transparent overlay showing player profile, live bid bar, and team ticker — broadcast your esports draft to your online audience." },
      { icon: Cloud, title: "No Download Required", desc: "Everything runs in the browser. No software installation on LAN PCs. Operator, bidders, and display screen all sync in real time." },
    ],
    useCases: [
      { title: "BGMI & PUBG Mobile Franchise Auctions", desc: "Run squad draft auctions for mobile esports leagues with role categories, team budgets, and live bidding." },
      { title: "Valorant & CS2 Team Drafts", desc: "Franchise player auctions for PC esports teams with IGL, fragger, and support categories, purse limits, and broadcast display." },
      { title: "College & Corporate Esports Leagues", desc: "Manage esports franchise auctions for college championships and corporate gaming events with professional operator tools." },
    ],
    faqs: [
      { q: "What is an esports auction system?", a: "An esports auction system is a platform that lets tournament organizers run live franchise player auctions for esports leagues. Teams bid on players in real time, with the auction host controlling the session from a dashboard and all bids syncing instantly across all connected devices." },
      { q: "Can I use BidWar for BGMI or Valorant team drafts?", a: "Yes. BidWar works for any esports title — BGMI, PUBG Mobile, Valorant, CS2, Free Fire, or any game. You define the player categories (IGL, entry fragger, support, etc.) and the auction runs the same way regardless of the game." },
      { q: "Does BidWar work for online esports auctions?", a: "Yes. BidWar is fully cloud-based. All participants — the auction host, team managers, and the display screen — access it through a browser from anywhere. This makes it ideal for online esports drafts where teams are in different locations." },
      { q: "Can I stream my esports auction on YouTube or Twitch?", a: "Yes. BidWar includes an OBS-compatible streaming overlay that displays the current player, live bid amount, team ticker, and bid progress bar. You can broadcast your draft live on YouTube, Twitch, or Facebook Live with professional-looking visuals." },
      { q: "How is an esports auction different from a normal draft?", a: "In a standard draft, teams pick players in rotation. In an auction draft, each player is put up for bidding and all teams compete with a fixed budget — making every pick strategic and exciting. BidWar automates the entire auction process, from player nomination to SOLD confirmation." },
    ],
  },

  "business-league-auction": {
    title: "Business Sports League Auction Software | Corporate Cricket & Football — BidWar",
    description: "Run professional corporate cricket and football franchise auctions with BidWar. Sponsor branding, OBS streaming overlay, real-time bidding for business leagues. Free trial — no credit card.",
    canonical: "https://www.bidwar.in/business-league-auction",
    eyebrow: "Business Sports League Auction",
    h1: <>Business Sports League <span className="text-primary">Auction Software</span></>,
    subheading: "Elevate your corporate sports event with a professional franchise auction — sponsor branding, LED display screens, live streaming overlay, and real-time bidding panels for every team owner.",
    breadcrumbLabel: "Business League Auction",
    heroStats: [
      { label: "Sports Supported", value: "Cricket, Football, Kabaddi" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Free Trial Teams", value: "2 Teams" },
      { label: "Streaming", value: "OBS Overlay" },
    ],
    features: [
      { icon: Trophy, title: "Sponsor Branding Support", desc: "Customise your auction with sponsor logos on the LED display, player cards, and broadcast overlay — perfect for corporate events with brand partners." },
      { icon: Radio, title: "Live Streaming Overlay", desc: "OBS-compatible transparent overlay for YouTube and Facebook Live. Shows player photo, live bid amount, and team ticker — broadcast-quality corporate events." },
      { icon: Monitor, title: "Projector & LED Display", desc: "Full-screen broadcast display for your venue projector or smart TV. Animated player cards, live bid counter, SOLD animation, and team purse strips." },
      { icon: Smartphone, title: "Executive Bidding Panels", desc: "Each business team owner bids from their smartphone or laptop with a one-tap panel and live budget tracker. No app download, no technical setup." },
      { icon: Gavel, title: "Professional Auction Control", desc: "Run the auction like a seasoned host — control pacing, accept bids, mark SOLD or unsold, undo actions, and manage multiple teams simultaneously." },
      { icon: BarChart3, title: "Event Reports & Analytics", desc: "Post-event reports showing highest sold players, team-wise spend, category analysis, and complete bid history — ideal for post-event social content." },
    ],
    useCases: [
      { title: "Corporate Cricket Leagues", desc: "Run business cricket franchise auctions with sponsor branding, live streaming, and professional operator-controlled bidding sessions." },
      { title: "Office Sports Day Events", desc: "Transform your sports day into a professional franchise auction event with mobile bidding, LED display, and live commentary support." },
      { title: "Industry Association Tournaments", desc: "Manage multi-company sports league franchise auctions with complete team management, purse limits, and post-event analytics." },
    ],
    faqs: [
      { q: "What is a business sports league auction?", a: "A business sports league auction is a franchise player bidding event run at corporate sports tournaments — where company teams bid for players with a fixed budget. BidWar provides the full auction infrastructure: operator control, mobile bidding panels, LED display, and live streaming overlay for a professional event experience." },
      { q: "Can BidWar display sponsor logos during the auction?", a: "Yes. BidWar's LED Display Mode supports sponsor logo rotation and custom branding. Your sponsor logos appear on the full-screen display during the event, making it ideal for corporate tournaments with brand partners." },
      { q: "Is BidWar suitable for small 6-8 team corporate tournaments?", a: "Yes. BidWar's Starter (4 teams, ₹5,000) and Pro (8 teams, ₹6,000) plans are purpose-built for business league sizes. Setup takes under 15 minutes and team owners bid from their existing smartphones." },
      { q: "Can I live-stream my corporate auction event?", a: "Yes. BidWar includes an OBS-compatible streaming overlay that works with YouTube Live, Facebook Live, and any OBS-supported streaming platform. It shows the player card, live bid amount, and team ticker in a professional broadcast format." },
      { q: "Does BidWar work for multi-sport corporate events?", a: "Yes. BidWar supports cricket, football, kabaddi, volleyball, badminton, and esports in the same platform. You can run separate auctions for each sport under different tournament setups within the same account." },
    ],
  },

  "live-player-bidding": {
    title: "Live Player Bidding Platform | Real-Time Sports Auction Software — BidWar",
    description: "Real-time live player bidding platform for sports tournaments. Team owner mobile panels, LED broadcast display, operator control — all synced live across every screen. Free trial available.",
    canonical: "https://www.bidwar.in/live-player-bidding",
    eyebrow: "Live Player Bidding Platform",
    h1: <>Live Player <span className="text-primary">Bidding Platform</span> for Sports Auctions</>,
    subheading: "A purpose-built real-time bidding engine for sports franchise auctions — team owners bid from their phones, the operator controls the session from a dashboard, and a broadcast screen shows the live action to your audience.",
    breadcrumbLabel: "Live Player Bidding",
    heroStats: [
      { label: "Bid Sync Latency", value: "< 1 second" },
      { label: "Concurrent Bidders", value: "Unlimited" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Platform", value: "100% Browser" },
    ],
    features: [
      { icon: Wifi, title: "Real-Time Bid Synchronisation", desc: "Every bid, timer update, and SOLD event propagates across all connected devices in under one second — operator, owners, and display screen stay perfectly in sync." },
      { icon: Smartphone, title: "Mobile Bidding for Every Owner", desc: "Each team owner gets their own dedicated bidding panel accessible from any smartphone. One-tap bid button, live purse balance, squad view — no app required." },
      { icon: Monitor, title: "Audience Display Screen", desc: "Full-screen broadcast display for projectors and smart TVs. Shows current player, live bid counter, leading team, and team purse strips for the audience." },
      { icon: Gavel, title: "Operator Bid Controls", desc: "The auction operator accepts or overrides bids, starts and pauses timers, uses quick-bid buttons per team, and can undo the last bid — complete session control." },
      { icon: Clock, title: "Configurable Bid Timers", desc: "Set auction timers and bid timers independently per tournament. Countdown shows on every screen simultaneously — creating genuine bidding urgency." },
      { icon: ShieldCheck, title: "Purse Protection Built-In", desc: "BidWar automatically prevents teams from bidding beyond their remaining purse balance. No manual tracking — the system enforces squad composition rules in real time." },
    ],
    useCases: [
      { title: "Franchise Cricket Auctions", desc: "IPL-style live bidding for cricket leagues with player categories, purse limits, and broadcast LED display." },
      { title: "Football & Kabaddi Drafts", desc: "Real-time franchise bidding for football and kabaddi leagues with mobile owner panels and projector display." },
      { title: "Multi-Sport League Events", desc: "Run live bidding auctions for any sport with the same platform, same operator workflow, same broadcast-quality display." },
    ],
    faqs: [
      { q: "How does live player bidding work in BidWar?", a: "The auction operator nominates a player and starts the bid timer. All team owners see the player on their mobile panels and can tap once to place a bid. The operator sees incoming bids in real time and can accept or extend. When the timer ends, the player is marked SOLD to the highest bidder. The LED display shows all of this live to the audience." },
      { q: "How many team owners can bid simultaneously?", a: "All team owners in a session can see and place bids simultaneously in real time. There is no limit on concurrent bidders — the platform handles all bids and syncs them across every screen." },
      { q: "What happens if two owners bid at the same time?", a: "BidWar records bids in order of arrival. The operator sees all incoming bids in real time and can choose to accept the highest bid or extend the timer for further competition. The system handles simultaneous bids gracefully without conflicts." },
      { q: "Can I pause the live auction mid-session?", a: "Yes. The operator can pause the auction at any time, take a break, and resume — the auction state is preserved exactly where it was left. BidWar also includes a dedicated Break Timer mode for scheduled intermissions." },
      { q: "Does BidWar prevent overbidding beyond team budgets?", a: "Yes. BidWar tracks each team's purse in real time and automatically prevents bids that would exceed the remaining balance. Teams cannot bid beyond what they can afford — the system enforces this rule automatically without manual oversight." },
    ],
  },

  "tournament-auction-platform": {
    title: "Tournament Auction Platform | Run Your Sports Auction Live — BidWar",
    description: "Complete tournament auction platform for cricket, football, kabaddi, and more. Manage teams, bids, purses, and live display screens from one platform. Free trial — 2 teams, no credit card.",
    canonical: "https://www.bidwar.in/tournament-auction-platform",
    eyebrow: "Tournament Auction Platform",
    h1: <>Tournament Auction Platform for <span className="text-primary">Live Sports Events</span></>,
    subheading: "One platform to manage your entire tournament auction — from player registration and team setup to live bidding, LED display, streaming overlay, and post-auction analytics.",
    breadcrumbLabel: "Tournament Auction Platform",
    heroStats: [
      { label: "Sports Supported", value: "7 Sports" },
      { label: "Max Teams", value: "30 Teams" },
      { label: "Setup Time", value: "< 15 min" },
      { label: "Deployment", value: "Cloud-Based" },
    ],
    features: [
      { icon: Trophy, title: "Complete Tournament Management", desc: "Create and manage multiple tournaments from one account. Add teams, players, categories, purse values, squad rules, and auction settings — all in one place." },
      { icon: Gavel, title: "Live Auction Engine", desc: "Operator-controlled live bidding with configurable timers, quick-bid buttons, SOLD/UNSOLD actions, undo, and full bid history tracking." },
      { icon: Monitor, title: "Broadcast LED Display", desc: "Full-screen display mode for projectors and TVs. Animated player cards, live bid counter, SOLD stamp, team purse strip, and sponsor logo support." },
      { icon: Users, title: "Multi-Device Owner Panels", desc: "All team owners bid simultaneously from their smartphones. Each panel is private, shows live purse balance, and requires no app installation." },
      { icon: Radio, title: "OBS Streaming Integration", desc: "Transparent overlay for YouTube Live, Facebook Live, and OBS. Player photo, bid bar, team ticker — professional broadcast quality." },
      { icon: BarChart3, title: "Analytics & Reports", desc: "Real-time team purse tracking during the auction, plus comprehensive post-auction reports: top sold players, spend breakdown, category analysis, and bid history export." },
    ],
    useCases: [
      { title: "Cricket, Football & Kabaddi Leagues", desc: "Run franchise auctions for any sport with the same platform, same workflow, same broadcast-quality display." },
      { title: "School & College Championships", desc: "Inter-school and inter-college league auctions with simple setup, category-based bidding, and operator-controlled sessions." },
      { title: "State & National Level Events", desc: "Scale to 30-team national franchise auctions with full purse management, squad rules, and broadcast streaming." },
    ],
    faqs: [
      { q: "What is a tournament auction platform?", a: "A tournament auction platform is end-to-end software for running live sports franchise player auctions. It covers player registration, team and purse management, live bidding sessions, LED display screens, streaming overlays, and post-auction reports — everything from setup to wrap-up in one system." },
      { q: "Which sports does BidWar support?", a: "BidWar supports cricket, football, kabaddi, badminton, volleyball, esports, and other franchise sports. You can create custom player roles and categories for any sport, making the platform adaptable beyond the listed sports." },
      { q: "How quickly can I set up a tournament auction on BidWar?", a: "Most organizers go from signup to a live auction in under 15 minutes. You create a tournament, add your teams and purse values, add players (or use QR self-registration), and press Start Auction. The operator, owner, and display interfaces all load instantly." },
      { q: "Can I run multiple tournaments on the same account?", a: "Yes. BidWar supports multiple tournaments per organizer account. Each tournament has its own teams, players, categories, and auction history — completely isolated from other tournaments." },
      { q: "Is BidWar a one-time payment or subscription?", a: "BidWar is a per-tournament license. You pay once for a tournament and have unlimited use for that event — no monthly subscriptions, no recurring charges. The free trial plan supports 2-team auctions at no cost." },
    ],
  },
};

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

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
        <section className="relative pt-6 pb-20 px-6 overflow-hidden">
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
              <a href="/#pricing" className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-border text-foreground font-semibold text-base hover:bg-card/50 transition-all flex items-center justify-center gap-2">
                View Pricing
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

        {/* ── Features ─────────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Platform Features</div>
              <h2 className="text-3xl md:text-4xl font-black">Everything your auction needs</h2>
              <p className="text-muted-foreground text-base max-w-xl mx-auto">
                BidWar handles every part of your auction day — from player registration to post-event reports.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-card/20 border border-border rounded-2xl p-6 hover:border-primary/30 hover:bg-card/40 transition-all"
                >
                  <f.icon className="w-5 h-5 text-primary mb-3" />
                  <h3 className="font-bold text-sm text-white mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Use Cases ────────────────────────────────────── */}
        <section className="py-20 px-6 bg-white/[0.015] border-t border-border/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Who uses this</div>
              <h2 className="text-3xl md:text-4xl font-black">Built for tournaments at every level</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {config.useCases.map((u, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-card/20 border border-border rounded-2xl p-6"
                >
                  <h3 className="font-bold text-sm text-white mb-2">{u.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{u.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 space-y-3">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">FAQ</div>
              <h2 className="text-3xl md:text-4xl font-black">Common questions</h2>
            </div>
            <div className="space-y-3">
              {config.faqs.map((f, i) => (
                <FaqItem key={i} q={f.q} a={f.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="py-24 px-6 border-t border-border/30">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-black">Ready to run your auction?</h2>
            <p className="text-muted-foreground text-base">
              Start with a free 2-team trial — no credit card, no setup fee. Your first live auction in under 15 minutes.
            </p>
            <button
              onClick={() => navigate("/organizer")}
              className="px-8 py-4 rounded-xl bg-primary text-black font-black text-lg hover:bg-primary/90 transition-all hover:shadow-[0_0_40px_rgba(234,179,8,0.4)] inline-flex items-center gap-2"
            >
              Start Free <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-xs text-muted-foreground">Free trial · 2 teams · No card required</p>
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
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Platform</p>
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
              <p className="text-xs text-muted-foreground">© 2025 BidWar. All rights reserved.</p>
              <p className="text-xs text-muted-foreground">India's Live Sports Auction Platform</p>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
