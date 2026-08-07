/**
 * Per-sport capability declarations for SportsShell / Mission Control.
 *
 * Generic Sports UI must branch on capabilities — never hard-code cricket
 * concepts (Playing XI, overs, LBW) into shared chrome.
 */

import type { SportCapabilities } from "./sports-shell-types";

const CRICKET_CAPABILITIES: SportCapabilities = {
  sportId: "cricket",
  sportLabel: "Cricket",
  hasPlayingXi: true,
  hasOvers: true,
  hasCaptain: true,
  hasCourts: false,
  hasDraw: false,
  hasStandings: true,
  hasStatistics: true,
  hasMatchCenter: true,
  hasPublicTournament: true,
  hasBroadcast: false,
};

const BADMINTON_CAPABILITIES: SportCapabilities = {
  sportId: "badminton",
  sportLabel: "Badminton",
  hasPlayingXi: false,
  hasOvers: false,
  hasCaptain: false,
  hasCourts: true,
  hasDraw: true,
  hasStandings: true,
  hasStatistics: true,
  hasMatchCenter: false,
  hasPublicTournament: false,
  hasBroadcast: true,
};

const UNKNOWN_CAPABILITIES: SportCapabilities = {
  sportId: "unknown",
  sportLabel: "Sports",
  hasPlayingXi: false,
  hasOvers: false,
  hasCaptain: false,
  hasCourts: false,
  hasDraw: false,
  hasStandings: false,
  hasStatistics: false,
  hasMatchCenter: false,
  hasPublicTournament: false,
  hasBroadcast: false,
};

export function getSportCapabilities(sport: string | null | undefined): SportCapabilities {
  const key = (sport ?? "").toLowerCase();
  if (key === "cricket") return CRICKET_CAPABILITIES;
  if (key === "badminton") return BADMINTON_CAPABILITIES;
  return { ...UNKNOWN_CAPABILITIES, sportId: key || "unknown" };
}

export function isCricketCapabilities(caps: SportCapabilities): boolean {
  return caps.sportId === "cricket";
}

export function isBadmintonCapabilities(caps: SportCapabilities): boolean {
  return caps.sportId === "badminton";
}
