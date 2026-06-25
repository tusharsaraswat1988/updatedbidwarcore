/**
 * Buzz Studio — Team Reveal Demo Data
 *
 * Six realistic scenarios for development and visual testing.
 * No auction imports. No database. Pure TeamRevealContract objects.
 */

import { SportType } from "../../types/sport-types";
import type { TeamRevealContract } from "./TeamReveal.types";

/* ─── Scenario 1 — Full data, all fields present ─────────────────────────── */

/**
 * Full scenario: team logo, captain image, player count, total spend.
 * The "happy path" — every visual section renders.
 */
export const demoFullCricket: TeamRevealContract = {
  teamName: "Mumbai Warriors",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=MW",
  sport: SportType.Cricket,
  captainName: "Rohit Verma",
  captainImageUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=RV",
  playerCount: 15,
  totalSpend: 32500000,
  totalSpendDisplay: "₹3.25Cr",
};

/* ─── Scenario 2 — No team logo (monogram fallback) ──────────────────────── */

/**
 * Tests TeamSlot monogram fallback.
 * "Rajpur Tigers" → initials "RT" in the logo circle.
 * Everything else is present including captain and spend.
 */
export const demoNoLogo: TeamRevealContract = {
  teamName: "Rajpur Tigers",
  teamLogoUrl: undefined,
  sport: SportType.Football,
  captainName: "Aditya Singh",
  captainImageUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=AS",
  playerCount: 18,
  totalSpend: 14750000,
  totalSpendDisplay: "₹1.475Cr",
};

/* ─── Scenario 3 — No captain (captain section hidden) ───────────────────── */

/**
 * Tests the conditional captain section.
 * When captainName is absent the entire captain row must not render.
 * Has logo and full stats to verify stats-only layout.
 */
export const demoNoCaptain: TeamRevealContract = {
  teamName: "Pune Invincibles",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=PI",
  sport: SportType.Kabaddi,
  captainName: undefined,
  captainImageUrl: undefined,
  playerCount: 12,
  totalSpend: 9800000,
  totalSpendDisplay: "₹98L",
};

/* ─── Scenario 4 — Cricket with high budget ──────────────────────────────── */

/**
 * Tests PriceDisplay with a very large INR value.
 * ₹5,20,00,000 — validates Indian number grouping in totalSpend formatting.
 * Marquee franchise with full squad.
 */
export const demoCricketHighBudget: TeamRevealContract = {
  teamName: "Delhi Thunderbolts",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=DT",
  sport: SportType.Cricket,
  captainName: "Vikas Pandey",
  captainImageUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=VP",
  playerCount: 20,
  totalSpend: 52000000,
  totalSpendDisplay: "₹5.2Cr",
};

/* ─── Scenario 5 — Badminton franchise ───────────────────────────────────── */

/**
 * Tests SportBadge with Badminton sport type.
 * No captain image — AvatarSlot renders monogram for captain.
 * Smaller squad typical for a racket sport franchise.
 */
export const demoBadminton: TeamRevealContract = {
  teamName: "Hyderabad Smashers",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=HS",
  sport: SportType.Badminton,
  captainName: "Priya Shankar",
  captainImageUrl: undefined,
  playerCount: 8,
  totalSpend: 5500000,
  totalSpendDisplay: "₹55L",
};

/* ─── Scenario 6 — Football franchise, no spend ──────────────────────────── */

/**
 * Tests layout when totalSpend is absent.
 * The spend stat card must not render, stats row shows only player count.
 * Also tests when only one stat is present (single-card stats row).
 */
export const demoFootballNoSpend: TeamRevealContract = {
  teamName: "Chennai FC",
  teamLogoUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=CF",
  sport: SportType.Football,
  captainName: "Arjun Mehta",
  captainImageUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=AM",
  playerCount: 16,
  totalSpend: undefined,
  totalSpendDisplay: undefined,
};

/* ─── All scenarios export ──────────────────────────────────────────────── */

export const ALL_DEMO_SCENARIOS: TeamRevealContract[] = [
  demoFullCricket,
  demoNoLogo,
  demoNoCaptain,
  demoCricketHighBudget,
  demoBadminton,
  demoFootballNoSpend,
];

export const DEMO_SCENARIO_LABELS: Record<string, string> = {
  demoFullCricket:       "Full data — Cricket",
  demoNoLogo:            "No team logo (monogram)",
  demoNoCaptain:         "No captain — Kabaddi",
  demoCricketHighBudget: "High budget — ₹5.2Cr",
  demoBadminton:         "Badminton franchise",
  demoFootballNoSpend:   "Football — no spend stat",
};
