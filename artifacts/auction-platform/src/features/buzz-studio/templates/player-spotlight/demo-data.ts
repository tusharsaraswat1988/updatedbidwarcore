/**
 * Player Spotlight — Demo Data
 *
 * FOR DEVELOPMENT USE ONLY.
 * Not exported from the feature barrel.
 * Not used in production.
 */

import { SportType } from "../../types/sport-types";
import type { PlayerSpotlightData } from "./PlayerSpotlight.types";

/* ── Case 1: No image, full data ─────────────────────────────────────────── */
export const DEMO_NO_IMAGE: PlayerSpotlightData = {
  playerName: "Rahul Sharma",
  teamName: "Varanasi Warriors",
  playerImageUrl: undefined,
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  designation: "Captain",
  city: "Varanasi",
};

/* ── Case 2: With player image, no team logo ─────────────────────────────── */
export const DEMO_WITH_PLAYER_IMAGE: PlayerSpotlightData = {
  playerName: "Virat Kohli",
  teamName: "Royal Challengers",
  playerImageUrl: "https://placehold.co/400x400/1a1a1a/FBBF24?text=VK",
  teamLogoUrl: undefined,
  sport: SportType.Cricket,
  designation: "Batsman",
  city: "Delhi",
};

/* ── Case 3: Both images present ─────────────────────────────────────────── */
export const DEMO_FULL_IMAGES: PlayerSpotlightData = {
  playerName: "Saina Nehwal",
  teamName: "Delhi Smashers",
  playerImageUrl: "https://placehold.co/400x400/1a1a1a/FBBF24?text=SN",
  teamLogoUrl: "https://placehold.co/100x100/1a1a1a/FBBF24?text=DS",
  sport: SportType.Badminton,
  designation: "Shuttler",
  city: "Hyderabad",
};

/* ── Case 4: Player name only ────────────────────────────────────────────── */
export const DEMO_NAME_ONLY: PlayerSpotlightData = {
  playerName: "Sunil Chhetri",
  sport: SportType.Football,
};

/* ── Case 5: Different sport ─────────────────────────────────────────────── */
export const DEMO_KABADDI: PlayerSpotlightData = {
  playerName: "Pardeep Narwal",
  teamName: "Patna Pirates",
  sport: SportType.Kabaddi,
  designation: "Raider",
  city: "Patna",
};

/* ── Case 6: Volleyball ──────────────────────────────────────────────────── */
export const DEMO_VOLLEYBALL: PlayerSpotlightData = {
  playerName: "Jimmy George",
  teamName: "Kerala Strikers",
  sport: SportType.Volleyball,
  designation: "Attacker",
  city: "Kochi",
};

/** All demo scenarios in one array — useful for rendering a preview grid. */
export const ALL_DEMO_SCENARIOS: PlayerSpotlightData[] = [
  DEMO_NO_IMAGE,
  DEMO_WITH_PLAYER_IMAGE,
  DEMO_FULL_IMAGES,
  DEMO_NAME_ONLY,
  DEMO_KABADDI,
  DEMO_VOLLEYBALL,
];
