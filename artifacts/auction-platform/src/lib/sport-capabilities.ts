/**
 * Per-sport capability declarations for SportsShell / Mission Control.
 *
 * Flag/label source of truth: `@workspace/platform-core`.
 * This module attaches Live Ops deep links (UI routes) on top.
 *
 * Generic Sports UI must branch on capabilities — never hard-code cricket
 * concepts (Playing XI, overs, LBW) into shared chrome.
 */

import {
  filterPlayerTagOptions as filterPlayerTagOptionsCore,
  getSportCapabilities as getCoreSportCapabilities,
  type SportCapabilityFlags,
} from "@workspace/platform-core";
import {
  cricketDashboardPath,
  cricketFixturesPath,
  cricketScheduleOpsPath,
  cricketScoreHubPath,
  cricketStandingsOpsPath,
  cricketStatsOpsPath,
} from "./cricket-routes";
import { badmintonHubPath } from "./badminton-routes";
import { cricketFanHomePath, cricketObsLiveAppPath } from "./tournament-navigation";
import type { SportCapabilities, SportLiveOpsLink } from "./sports-shell-types";

export {
  isTeamFormationSupportedByCapabilities,
  isTeamRoleSupportedByCapabilities,
  playingTeamRoleIds,
} from "@workspace/platform-core";

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
  {
    id: "broadcast",
    title: "Cricket OBS",
    description: "Transparent scorebug for OBS Browser Source.",
    buildHref: ({ tournamentId }) => cricketObsLiveAppPath(tournamentId),
    external: true,
  },
];

const BADMINTON_LIVE_OPS: SportLiveOpsLink[] = [
  {
    id: "mission_control",
    title: "Operator Controls",
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
    SportCapabilityFlags,
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

function withLiveOps(core: SportCapabilityFlags): SportCapabilities {
  if (core.sportId === "cricket") {
    return {
      ...core,
      liveOpsLinks: filterLiveOpsLinks(CRICKET_LIVE_OPS, core),
      liveOpsPeekLines: [
        "Cricket dashboard & matches",
        "LED display",
        "Cricket OBS",
      ],
      missionControlDestinations: {
        // Start Setup / competition → cricket dashboard (Sports-owned entry)
        tournament: cricketDashboardPath,
        // Teams live in Auction; fixtures is the first Sports-owned setup page
        fixtures: cricketFixturesPath,
        schedule: cricketScheduleOpsPath,
        scoring: cricketScoreHubPath,
      },
    };
  }
  if (core.sportId === "badminton") {
    return {
      ...core,
      liveOpsLinks: filterLiveOpsLinks(BADMINTON_LIVE_OPS, core),
      liveOpsPeekLines: [
        "Operator Controls",
        "LED display",
        "Broadcast / OBS",
      ],
      missionControlDestinations: {
        teams: (tid) => `${badmintonHubPath(tid)}/players`,
        fixtures: (tid) => `${badmintonHubPath(tid)}/fixtures`,
        schedule: (tid) => `${badmintonHubPath(tid)}/schedule`,
        scoring: (tid) => `${badmintonHubPath(tid)}/matches`,
        tournament: (tid) => `${badmintonHubPath(tid)}/branding`,
      },
    };
  }
  return {
    ...core,
    liveOpsLinks: [],
    liveOpsPeekLines: ["Sport live control", "LED display"],
  };
}

export function getSportCapabilities(sport: string | null | undefined): SportCapabilities {
  return withLiveOps(getCoreSportCapabilities(sport));
}

/** Filter player tag options to those supported by the sport. */
export function filterPlayerTagOptions<T extends { value: string }>(
  caps: Pick<SportCapabilities, "hasCaptain">,
  options: readonly T[],
): T[] {
  return filterPlayerTagOptionsCore(caps, options);
}

/** @deprecated Prefer capability flags — shared UI must not branch on sport id. */
export function isCricketCapabilities(caps: SportCapabilities): boolean {
  return caps.sportId === "cricket";
}

/** @deprecated Prefer capability flags — shared UI must not branch on sport id. */
export function isBadmintonCapabilities(caps: SportCapabilities): boolean {
  return caps.sportId === "badminton";
}
