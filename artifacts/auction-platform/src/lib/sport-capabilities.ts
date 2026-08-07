/**
 * Per-sport capability declarations for SportsShell / Mission Control.
 *
 * Generic Sports UI must branch on capabilities — never hard-code cricket
 * concepts (Playing XI, overs, LBW) into shared chrome.
 */

import {
  cricketDashboardPath,
  cricketScoreHubPath,
  cricketStandingsOpsPath,
  cricketStatsOpsPath,
} from "./cricket-routes";
import { badmintonHubPath } from "./badminton-routes";
import { cricketFanHomePath } from "./tournament-navigation";
import type { SportCapabilities, SportLiveOpsLink } from "./sports-shell-types";

const CRICKET_LIVE_OPS: SportLiveOpsLink[] = [
  {
    id: "dashboard",
    title: "Cricket Dashboard",
    description: "Today's matches, pending actions, standings.",
    buildHref: ({ tournamentId, encodedReturnTo }) =>
      `${cricketDashboardPath(tournamentId)}?from=${encodedReturnTo}`,
  },
  {
    id: "match_center",
    title: "Match Command Center",
    description: "Create and open matches for scoring.",
    buildHref: ({ tournamentId, encodedReturnTo }) =>
      `${cricketScoreHubPath(tournamentId)}?from=${encodedReturnTo}`,
  },
  {
    id: "standings",
    title: "Standings",
    description: "Points table and NRR.",
    buildHref: ({ tournamentId }) => cricketStandingsOpsPath(tournamentId),
  },
  {
    id: "statistics",
    title: "Statistics",
    description: "Runs, wickets, SR, economy, and more.",
    buildHref: ({ tournamentId }) => cricketStatsOpsPath(tournamentId),
  },
  {
    id: "public",
    title: "Public Cricket Page",
    description: "Fan-facing fixtures, standings, and stats.",
    buildHref: ({ tournamentId }) => cricketFanHomePath(tournamentId),
  },
];

const BADMINTON_LIVE_OPS: SportLiveOpsLink[] = [
  {
    id: "mission_control",
    title: "Badminton Mission Control",
    description: "Courts, queues, and live match control.",
    buildHref: ({ tournamentId, encodedReturnTo }) =>
      `${badmintonHubPath(tournamentId)}/control?from=${encodedReturnTo}`,
  },
  {
    id: "broadcast",
    title: "Broadcast / OBS",
    description: "Badminton broadcast director surfaces.",
    buildHref: ({ tournamentId, encodedReturnTo }) =>
      `${badmintonHubPath(tournamentId)}/broadcast?from=${encodedReturnTo}`,
  },
];

function filterLiveOpsLinks(
  links: SportLiveOpsLink[],
  caps: Pick<
    SportCapabilities,
    "hasMatchCenter" | "hasStandings" | "hasStatistics" | "hasPublicTournament" | "hasBroadcast"
  >,
): SportLiveOpsLink[] {
  return links.filter((link) => {
    if (link.id === "match_center") return caps.hasMatchCenter;
    if (link.id === "standings") return caps.hasStandings;
    if (link.id === "statistics") return caps.hasStatistics;
    if (link.id === "public") return caps.hasPublicTournament;
    if (link.id === "broadcast") return caps.hasBroadcast;
    return true;
  });
}

const CRICKET_CAPABILITIES_BASE: Omit<SportCapabilities, "liveOpsLinks" | "liveOpsPeekLines"> = {
  sportId: "cricket",
  sportLabel: "Cricket",
  hasPlayingXi: true,
  hasBench: true,
  hasOvers: true,
  hasCaptain: true,
  hasCourts: false,
  hasDraw: false,
  hasStandings: true,
  hasStatistics: true,
  hasMatchCenter: true,
  hasPublicTournament: true,
  hasBroadcast: false,
  hasPowerplay: true,
  hasLBW: true,
  hasRetire: true,
  hasSuperOver: true,
  hasOfficials: true,
  hasCoinToss: true,
  hasBoundaries: true,
  hasSets: false,
  hasServiceSide: false,
  hasLegacyCricketSpecs: true,
  playingSquadLabel: "Playing XI",
  benchLabel: "Bench",
  statisticsDescription: "Runs, wickets, SR, economy, and more.",
  publicTournamentDescription: "Fan-facing fixtures, standings, and stats.",
};

const CRICKET_CAPABILITIES: SportCapabilities = {
  ...CRICKET_CAPABILITIES_BASE,
  liveOpsLinks: filterLiveOpsLinks(CRICKET_LIVE_OPS, CRICKET_CAPABILITIES_BASE),
  liveOpsPeekLines: [
    "Cricket dashboard & matches",
    "LED display",
    "Public tournament page",
  ],
};

const BADMINTON_CAPABILITIES_BASE: Omit<SportCapabilities, "liveOpsLinks" | "liveOpsPeekLines"> = {
  sportId: "badminton",
  sportLabel: "Badminton",
  hasPlayingXi: false,
  hasBench: false,
  hasOvers: false,
  hasCaptain: false,
  hasCourts: true,
  hasDraw: true,
  hasStandings: true,
  hasStatistics: true,
  hasMatchCenter: false,
  hasPublicTournament: false,
  hasBroadcast: true,
  hasPowerplay: false,
  hasLBW: false,
  hasRetire: false,
  hasSuperOver: false,
  hasOfficials: true,
  hasCoinToss: false,
  hasBoundaries: false,
  hasSets: true,
  hasServiceSide: true,
  hasLegacyCricketSpecs: false,
  playingSquadLabel: "Lineup",
  benchLabel: "Reserves",
  statisticsDescription: "Match results, head-to-head, and player form.",
  publicTournamentDescription: "Fan-facing draws and results.",
};

const BADMINTON_CAPABILITIES: SportCapabilities = {
  ...BADMINTON_CAPABILITIES_BASE,
  liveOpsLinks: filterLiveOpsLinks(BADMINTON_LIVE_OPS, BADMINTON_CAPABILITIES_BASE),
  liveOpsPeekLines: [
    "Badminton Mission Control",
    "LED display",
    "Broadcast / OBS",
  ],
};

const UNKNOWN_CAPABILITIES_BASE: Omit<SportCapabilities, "liveOpsLinks" | "liveOpsPeekLines" | "sportId"> = {
  sportLabel: "Sports",
  hasPlayingXi: false,
  hasBench: false,
  hasOvers: false,
  hasCaptain: false,
  hasCourts: false,
  hasDraw: false,
  hasStandings: false,
  hasStatistics: false,
  hasMatchCenter: false,
  hasPublicTournament: false,
  hasBroadcast: false,
  hasPowerplay: false,
  hasLBW: false,
  hasRetire: false,
  hasSuperOver: false,
  hasOfficials: false,
  hasCoinToss: false,
  hasBoundaries: false,
  hasSets: false,
  hasServiceSide: false,
  hasLegacyCricketSpecs: false,
  playingSquadLabel: "Lineup",
  benchLabel: "Reserves",
  statisticsDescription: "Tournament statistics.",
  publicTournamentDescription: "Public tournament page.",
};

export function getSportCapabilities(sport: string | null | undefined): SportCapabilities {
  const key = (sport ?? "").toLowerCase();
  if (key === "cricket") return CRICKET_CAPABILITIES;
  if (key === "badminton") return BADMINTON_CAPABILITIES;
  return {
    ...UNKNOWN_CAPABILITIES_BASE,
    sportId: key || "unknown",
    liveOpsLinks: [],
    liveOpsPeekLines: ["Sport live control", "LED display"],
  };
}

/** Filter player tag options to those supported by the sport. */
export function filterPlayerTagOptions<T extends { value: string }>(
  caps: SportCapabilities,
  options: readonly T[],
): T[] {
  return options.filter((opt) => {
    if (opt.value === "captain" || opt.value === "vice_captain") {
      return caps.hasCaptain;
    }
    return true;
  });
}

/** @deprecated Prefer capability flags — shared UI must not branch on sport id. */
export function isCricketCapabilities(caps: SportCapabilities): boolean {
  return caps.sportId === "cricket";
}

/** @deprecated Prefer capability flags — shared UI must not branch on sport id. */
export function isBadmintonCapabilities(caps: SportCapabilities): boolean {
  return caps.sportId === "badminton";
}
