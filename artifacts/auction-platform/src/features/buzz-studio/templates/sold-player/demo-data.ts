/**
 * Buzz Studio — Sold Player Demo Data
 *
 * Six realistic scenarios for development and visual testing.
 * No auction imports. No database. Pure SoldPlayerContract objects.
 */

import { SportType } from "../../types/sport-types";
import type { SoldPlayerContract } from "./SoldPlayer.types";

/* ─── Scenario 1 — Full data, all fields present ─────────────────────────── */

/**
 * Full scenario: player image, team logo, bid count, designation.
 * The "happy path" — everything renders.
 */
export const demoFullData: SoldPlayerContract = {
  playerName: "Rahul Sharma",
  playerImageUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=RS",
  teamName: "Varanasi Warriors",
  teamLogoUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=VW",
  sport: SportType.Cricket,
  soldPrice: 75000,
  soldPriceDisplay: "₹75,000",
  bidCount: 12,
  designation: "All Rounder",
};

/* ─── Scenario 2 — No player image (monogram fallback) ───────────────────── */

/**
 * Tests PlayerSlot monogram fallback.
 * "Arjun Mehta" → initials "AM" rendered in the avatar circle.
 */
export const demoNoPlayerImage: SoldPlayerContract = {
  playerName: "Arjun Mehta",
  playerImageUrl: undefined,
  teamName: "Rajpur Royals",
  teamLogoUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=RR",
  sport: SportType.Football,
  soldPrice: 45000,
  soldPriceDisplay: "₹45,000",
  bidCount: 7,
  designation: "Goalkeeper",
};

/* ─── Scenario 3 — No team logo (team monogram fallback) ─────────────────── */

/**
 * Tests TeamSlot monogram fallback.
 * "Mysore Mavericks" → initials "MM" in team logo circle.
 */
export const demoNoTeamLogo: SoldPlayerContract = {
  playerName: "Kiran Nair",
  playerImageUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=KN",
  teamName: "Mysore Mavericks",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  soldPrice: 120000,
  soldPriceDisplay: "₹1,20,000",
  bidCount: 18,
  designation: "Batsman",
};

/* ─── Scenario 4 — High value player ─────────────────────────────────────── */

/**
 * Tests PriceDisplay with a large rupee value.
 * ₹5,00,000 — Indian grouping validation.
 * Marquee signing — high bid count, star designation.
 */
export const demoHighValue: SoldPlayerContract = {
  playerName: "Vikas Pandey",
  playerImageUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=VP",
  teamName: "Mumbai Sharks",
  teamLogoUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=MS",
  sport: SportType.Cricket,
  soldPrice: 500000,
  soldPriceDisplay: "₹5,00,000",
  bidCount: 31,
  designation: "Captain",
};

/* ─── Scenario 5 — Badminton player ──────────────────────────────────────── */

/**
 * Tests SportBadge with a non-cricket sport.
 * Badminton 🏸 badge should render correctly.
 * No image, no team logo — both monogram fallbacks active.
 */
export const demoBadminton: SoldPlayerContract = {
  playerName: "Priya Shankar",
  playerImageUrl: undefined,
  teamName: "Hyderabad Hawks",
  teamLogoUrl: undefined,
  sport: SportType.Badminton,
  soldPrice: 90000,
  soldPriceDisplay: "₹90,000",
  bidCount: 9,
  designation: "Doubles Specialist",
};

/* ─── Scenario 6 — No bid count ──────────────────────────────────────────── */

/**
 * Tests layout when `bidCount` is absent.
 * The bid count row should not render.
 * Also tests no designation field.
 */
export const demoNoBidCount: SoldPlayerContract = {
  playerName: "Sandeep Raju",
  playerImageUrl: "https://placehold.co/200x200/1a1a1a/FBBF24?text=SR",
  teamName: "Pune Panthers",
  teamLogoUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=PP",
  sport: SportType.Kabaddi,
  soldPrice: 200000,
  soldPriceDisplay: "₹2,00,000",
  bidCount: undefined,
  designation: undefined,
};

/* ─── All scenarios export ──────────────────────────────────────────────── */

export const ALL_DEMO_SCENARIOS: SoldPlayerContract[] = [
  demoFullData,
  demoNoPlayerImage,
  demoNoTeamLogo,
  demoHighValue,
  demoBadminton,
  demoNoBidCount,
];

export const DEMO_SCENARIO_LABELS: Record<string, string> = {
  demoFullData: "Full data",
  demoNoPlayerImage: "No player image",
  demoNoTeamLogo: "No team logo",
  demoHighValue: "High value (₹5L)",
  demoBadminton: "Badminton — both monograms",
  demoNoBidCount: "No bid count / designation",
};
