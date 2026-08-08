import {
  Award,
  ClipboardList,
  LayoutDashboard,
  ListOrdered,
  Radio,
  Table2,
  Trophy,
  Users,
} from "lucide-react";
import {
  cricketAwardsPath,
  cricketDashboardPath,
  cricketFixturesPath,
  cricketOfficialsPath,
  cricketReportsPath,
  cricketScheduleOpsPath,
  cricketScoreHubPath,
  cricketStandingsOpsPath,
  cricketStatsOpsPath,
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
  matches: () => import("../pages/scoring-match-list"),
  matchCenter: () => import("../pages/cricket/match-center"),
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

/**
 * Primary cricket organizer destinations — Sports product only.
 * No Auction deep links (Teams / Players / Settings stay in Auction).
 */
export const CRICKET_PRIMARY_NAV: SportNavItem[] = [
  {
    id: "mission-control",
    label: "Tournament Dashboard",
    href: sportsMissionControlPath,
    isActive: (path, tid) => isMissionControlPath(path, tid),
    icon: ClipboardList,
    preload: () => preloadNav("missionControl"),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    href: cricketDashboardPath,
    isActive: (path) => isDashboardPath(path),
    icon: LayoutDashboard,
    preload: () => preloadNav("dashboard"),
  },
  {
    id: "matches",
    label: "Matches & Scoring",
    href: cricketScoreHubPath,
    isActive: (path, tid) => isMatchesListPath(path, tid),
    icon: Radio,
    preload: () => {
      preloadNav("matches");
      preloadNav("matchCenter");
    },
  },
  {
    id: "fixtures",
    label: "Fixtures",
    href: cricketFixturesPath,
    isActive: (path) =>
      scoreSection(path, "fixtures") || scoreSection(path, "schedule"),
    icon: ListOrdered,
    preload: () => preloadNav("fixtures"),
    children: [
      {
        id: "fixtures-browser",
        label: "Fixture browser",
        href: cricketFixturesPath,
        isActive: (path) => scoreSection(path, "fixtures"),
        preload: () => preloadNav("fixtures"),
      },
      {
        id: "fixtures-schedule",
        label: "Schedule & generate",
        href: cricketScheduleOpsPath,
        isActive: (path) => scoreSection(path, "schedule"),
        preload: () => preloadNav("schedule"),
      },
    ],
  },
  {
    id: "standings",
    label: "Standings",
    href: cricketStandingsOpsPath,
    isActive: (path) => scoreSection(path, "standings"),
    icon: Table2,
    preload: () => preloadNav("standings"),
  },
  {
    id: "stats",
    label: "Statistics",
    href: cricketStatsOpsPath,
    isActive: (path) => scoreSection(path, "stats"),
    icon: Trophy,
    preload: () => preloadNav("stats"),
  },
  {
    id: "officials",
    label: "Officials",
    href: cricketOfficialsPath,
    isActive: (path) => scoreSection(path, "officials"),
    icon: Users,
    preload: () => preloadNav("officials"),
  },
  {
    id: "closeout",
    label: "Closeout",
    href: cricketAwardsPath,
    isActive: (path) =>
      scoreSection(path, "awards") || scoreSection(path, "reports"),
    icon: Award,
    preload: () => preloadNav("awards"),
    children: [
      {
        id: "closeout-awards",
        label: "Awards",
        href: cricketAwardsPath,
        isActive: (path) => scoreSection(path, "awards"),
        preload: () => preloadNav("awards"),
      },
      {
        id: "closeout-reports",
        label: "Reports",
        href: cricketReportsPath,
        isActive: (path) => scoreSection(path, "reports"),
        preload: () => preloadNav("reports"),
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
