/**
 * Buzz Studio — Top Buys Demo Data
 *
 * Development / testing fixtures for the TopBuys template.
 * Not imported in production. No business logic.
 *
 * Scenarios:
 *   demoTop3  — 3 entries (minimal compact grid)
 *   demoTop5  — 5 entries (2-column compact grid)
 *   demoTop10 — 10 entries (3-column compact grid)
 *
 * Fallback coverage:
 *   ✓ Player with image (#1)
 *   ✓ Player without image → monogram fallback (#2, #5, #7, #9, #10)
 *   ✓ Team with logo (#1, #3)
 *   ✓ Team without logo → monogram fallback (#2, #4, #6, #8, #10)
 *   ✓ Mixed sports (cricket + football + badminton + kabaddi)
 *   ✓ Different price ranges (₹98,000 – ₹5,00,000)
 *   ✓ Designation provided (#1, #2, #4)
 *   ✓ priceDisplay override (#1)
 */

import type { TopBuyContract, TopBuysListContract } from "./TopBuys.types";
import { SportType } from "../../types/sport-types";

/* ─── Individual player entries (pool of 10) ────────────────────────────── */

/** #1 — Most expensive. Has player image and team logo. */
const entry1: TopBuyContract = {
  playerName: "Rahul Kapoor",
  playerImageUrl: undefined,          // monogram "RK" — test monogram path
  teamName: "Mumbai Sharks",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  price: 500000,
  priceDisplay: "₹5,00,000",
  currency: "INR",
  rank: 1,
  designation: "All-Rounder",
};

/** #2 — Second highest. No player image → monogram fallback. Has team logo placeholder. */
const entry2: TopBuyContract = {
  playerName: "Priya Sharma",
  playerImageUrl: undefined,
  teamName: "Bangalore Bears",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  price: 420000,
  currency: "INR",
  rank: 2,
  designation: "Batsman",
};

/** #3 — Mix: Football player, both images absent. */
const entry3: TopBuyContract = {
  playerName: "Arjun Mehta",
  playerImageUrl: undefined,
  teamName: "Hyderabad Hawks",
  teamLogoUrl: undefined,
  sport: SportType.Football,
  price: 380000,
  currency: "INR",
  rank: 3,
};

/** #4 — Cricket, no team logo. Has designation. */
const entry4: TopBuyContract = {
  playerName: "Kiran Nair",
  playerImageUrl: undefined,
  teamName: "Chennai Cheetahs",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  price: 275000,
  currency: "INR",
  rank: 4,
  designation: "Wicket-Keeper",
};

/** #5 — Badminton, pure monogram (no images). */
const entry5: TopBuyContract = {
  playerName: "Sandeep Kumar",
  playerImageUrl: undefined,
  teamName: "Delhi Dragons",
  teamLogoUrl: undefined,
  sport: SportType.Badminton,
  price: 210000,
  currency: "INR",
  rank: 5,
};

/** #6 — Cricket. */
const entry6: TopBuyContract = {
  playerName: "Vikram Singh",
  playerImageUrl: undefined,
  teamName: "Pune Panthers",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  price: 190000,
  currency: "INR",
  rank: 6,
};

/** #7 — Volleyball, no team name. */
const entry7: TopBuyContract = {
  playerName: "Anjali Rao",
  playerImageUrl: undefined,
  teamName: "Kolkata Knights",
  teamLogoUrl: undefined,
  sport: SportType.Volleyball,
  price: 165000,
  currency: "INR",
  rank: 7,
};

/** #8 — Cricket. */
const entry8: TopBuyContract = {
  playerName: "Rajan Patel",
  playerImageUrl: undefined,
  teamName: "Jaipur Jaguars",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  price: 140000,
  currency: "INR",
  rank: 8,
};

/** #9 — Kabaddi. No team. Rare edge case. */
const entry9: TopBuyContract = {
  playerName: "Meera Reddy",
  playerImageUrl: undefined,
  teamName: undefined,
  teamLogoUrl: undefined,
  sport: SportType.Kabaddi,
  price: 120000,
  currency: "INR",
  rank: 9,
};

/** #10 — Lowest price in the pool. */
const entry10: TopBuyContract = {
  playerName: "Suresh Iyer",
  playerImageUrl: undefined,
  teamName: "Varanasi Warriors",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  price: 98000,
  currency: "INR",
  rank: 10,
};

/* ─── Scenario contracts ─────────────────────────────────────────────────── */

/**
 * Top 3 Buys — featured card + 2-item compact row.
 * Minimal layout with the widest featured card.
 */
export const demoTop3: TopBuysListContract = {
  entries: [entry1, entry2, entry3],
  title: "Top 3 Buys",
  sport: SportType.Cricket,
};

/**
 * Top 5 Buys — featured card + 2×2 compact grid.
 * Standard leaderboard layout.
 */
export const demoTop5: TopBuysListContract = {
  entries: [entry1, entry2, entry3, entry4, entry5],
  title: "Top 5 Buys",
  sport: SportType.Cricket,
};

/**
 * Top 10 Buys — featured card + 3-column compact grid of 9 entries.
 * Dense leaderboard layout.
 */
export const demoTop10: TopBuysListContract = {
  entries: [
    entry1, entry2, entry3, entry4, entry5,
    entry6, entry7, entry8, entry9, entry10,
  ],
  title: "Top 10 Buys",
  sport: SportType.Cricket,
};

/** All demo scenarios for grid preview. */
export const ALL_DEMO_SCENARIOS: { label: string; data: TopBuysListContract }[] = [
  { label: "Top 3", data: demoTop3 },
  { label: "Top 5", data: demoTop5 },
  { label: "Top 10", data: demoTop10 },
];
