import {
  Award,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  Radio,
  Scale,
  Settings,
  Shield,
  Table2,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  cricketAwardsPath,
  cricketDashboardPath,
  cricketFixturesPath,
  cricketLinksPath,
  cricketLiveControlPath,
  cricketOfficialsPath,
  cricketPlayersPath,
  cricketReportsPath,
  cricketRulesPath,
  cricketScheduleOpsPath,
  cricketScoreHubPath,
  cricketSettingsPath,
  cricketStandingsOpsPath,
  cricketStatsOpsPath,
  cricketTeamsPath,
} from "./cricket-routes";
import type { SportNavConfig, SportNavItem, SportNavSection } from "./sports-shell-types";
import { sportsMissionControlPath } from "@workspace/api-base/scoring-urls";
import { getSportCapabilities } from "./sport-capabilities";

function navPathname(path: string): string {
  const noHash = path.split("#")[0] ?? path;
  return noHash.split("?")[0] ?? noHash;
}

function scoreSection(path: string, section: string): boolean {
  return navPathname(path).includes(`/score/${section}`);
}

function isMatchesListPath(path: string, tournamentId: number): boolean {
  const pathname = navPathname(path);
  const base = cricketScoreHubPath(tournamentId);
  if (pathname === base || pathname === `${base}/`) return true;
  if (scoreSection(path, "live-control") || scoreSection(path, "links")) return false;
  return new RegExp(`^${base}/\\d+(/live)?/?$`).test(pathname);
}

function isDashboardPath(path: string): boolean {
  return scoreSection(path, "dashboard");
}

function isMissionControlPath(path: string, tournamentId: number): boolean {
  const pathname = navPathname(path);
  const home = sportsMissionControlPath(tournamentId);
  return pathname === home || pathname === `${home}/`;
}

/** Warm lazy route chunks before the user clicks a sidebar link. */
const PRELOAD: Record<string, () => Promise<unknown>> = {
  missionControl: () => import("../pages/sports/mission-control"),
  dashboard: () => import("../pages/cricket/dashboard"),
  settings: () => import("../pages/cricket/settings"),
  rules: () => import("../pages/cricket/rules"),
  teams: () => import("../pages/cricket/teams"),
  players: () => import("../pages/cricket/players"),
  matches: () => import("../pages/scoring-match-list"),
  matchCenter: () => import("../pages/cricket/match-center"),
  liveControl: () => import("../pages/cricket/live-control"),
  links: () => import("../pages/cricket/links"),
  schedule: () => import("../pages/scoring-schedule"),
  fixtures: () => import("../pages/cricket/fixtures"),
  standings: () => import("../pages/cricket/standings"),
  stats: () => import("../pages/cricket/stats"),
  officials: () => import("../pages/cricket/officials"),
  awards: () => import("../pages/cricket/awards"),
  reports: () => import("../pages/cricket/reports"),
};

const preloaded = new Set<string>();

function preloadNav(id: string) {
  if (preloaded.has(id)) return;
  const loader = PRELOAD[id];
  if (!loader) return;
  preloaded.add(id);
  void loader();
}

/** Preload all cricket organizer route chunks in background idle time */
export function preloadAllCricketChunks() {
  const ids = Object.keys(PRELOAD);
  for (const id of ids) {
    preloadNav(id);
  }
}

/**
 * Primary cricket organizer destinations — Simplified 5-Zone Navigation.
 */
export const CRICKET_PRIMARY_NAV: SportNavItem[] = [
  {
    id: "teams",
    label: "Teams & Players",
    href: cricketTeamsPath,
    isActive: (path) => scoreSection(path, "teams") || scoreSection(path, "players"),
    icon: Users,
    preload: () => {
      preloadNav("teams");
      preloadNav("players");
    },
    children: [
      {
        id: "teams-list",
        label: "Franchise Teams",
        href: cricketTeamsPath,
        isActive: (path) => scoreSection(path, "teams"),
        preload: () => preloadNav("teams"),
      },
      {
        id: "players-list",
        label: "Player Roster",
        href: cricketPlayersPath,
        isActive: (path) => scoreSection(path, "players"),
        preload: () => preloadNav("players"),
      },
    ],
  },
  {
    id: "fixtures",
    label: "Fixtures & Schedule",
    href: cricketFixturesPath,
    isActive: (path) =>
      scoreSection(path, "fixtures") || scoreSection(path, "schedule"),
    icon: ListOrdered,
    preload: () => preloadNav("fixtures"),
    children: [
      {
        id: "fixtures-browser",
        label: "Match Fixtures",
        href: cricketFixturesPath,
        isActive: (path) => scoreSection(path, "fixtures"),
        preload: () => preloadNav("fixtures"),
      },
      {
        id: "fixtures-schedule",
        label: "Schedule & Generate",
        href: cricketScheduleOpsPath,
        isActive: (path) => scoreSection(path, "schedule"),
        preload: () => preloadNav("schedule"),
      },
    ],
  },
  {
    id: "matches",
    label: "Matches & Live Control",
    href: cricketScoreHubPath,
    isActive: (path, tid) =>
      isMatchesListPath(path, tid) ||
      scoreSection(path, "live-control") ||
      scoreSection(path, "links"),
    icon: Radio,
    preload: () => {
      preloadNav("matches");
      preloadNav("matchCenter");
      preloadNav("liveControl");
      preloadNav("links");
    },
    children: [
      {
        id: "matches-hub",
        label: "Matches Hub",
        href: cricketScoreHubPath,
        isActive: (path, tid) => isMatchesListPath(path, tid),
        preload: () => preloadNav("matches"),
      },
      {
        id: "matches-live-control",
        label: "Live Control Console",
        href: cricketLiveControlPath,
        isActive: (path) => scoreSection(path, "live-control"),
        preload: () => preloadNav("liveControl"),
      },
      {
        id: "matches-links",
        label: "Links",
        href: cricketLinksPath,
        isActive: (path) => scoreSection(path, "links"),
        preload: () => preloadNav("links"),
      },
    ],
  },
  {
    id: "standings",
    label: "Standings & Stats",
    href: cricketStandingsOpsPath,
    isActive: (path) =>
      scoreSection(path, "standings") ||
      scoreSection(path, "stats") ||
      scoreSection(path, "reports") ||
      scoreSection(path, "awards"),
    icon: Trophy,
    preload: () => {
      preloadNav("standings");
      preloadNav("stats");
      preloadNav("reports");
    },
    children: [
      {
        id: "standings-table",
        label: "Points Table",
        href: cricketStandingsOpsPath,
        isActive: (path) => scoreSection(path, "standings"),
        preload: () => preloadNav("standings"),
      },
      {
        id: "stats-leaderboards",
        label: "Top Players & Stats",
        href: cricketStatsOpsPath,
        isActive: (path) => scoreSection(path, "stats"),
        preload: () => preloadNav("stats"),
      },
      {
        id: "stats-reports",
        label: "Reports & Awards",
        href: cricketReportsPath,
        isActive: (path) => scoreSection(path, "reports") || scoreSection(path, "awards"),
        preload: () => preloadNav("reports"),
      },
    ],
  },
  {
    id: "settings",
    label: "Settings & Rules",
    href: cricketSettingsPath,
    isActive: (path) =>
      scoreSection(path, "settings") ||
      scoreSection(path, "rules") ||
      scoreSection(path, "officials"),
    icon: Settings,
    preload: () => preloadNav("settings"),
    children: [
      {
        id: "settings-tournament",
        label: "Tournament Info & Branding",
        href: cricketSettingsPath,
        isActive: (path) => scoreSection(path, "settings"),
        preload: () => preloadNav("settings"),
      },
      {
        id: "settings-rules",
        label: "Match Rules & Format",
        href: cricketRulesPath,
        isActive: (path) => scoreSection(path, "rules"),
        preload: () => preloadNav("rules"),
      },
      {
        id: "settings-officials",
        label: "Umpires & Scorers",
        href: cricketOfficialsPath,
        isActive: (path) => scoreSection(path, "officials"),
        preload: () => preloadNav("officials"),
      },
    ],
  },
];

export function getCricketSportNav(): SportNavConfig {
  const capabilities = getSportCapabilities("cricket");
  const sections: SportNavSection[] = [
    {
      id: "primary",
      label: "",
      items: CRICKET_PRIMARY_NAV,
    },
  ];

  return {
    sportId: "cricket",
    sportLabel: "Cricket",
    sections,
    capabilities,
  };
}

export { cricketScoreHubPath };
