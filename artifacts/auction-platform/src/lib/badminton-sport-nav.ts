import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  ListTree,
  Radio,
  Settings2,
  Trophy,
  Users,
} from "lucide-react";
import { badmintonHubPath, sportsHomePath } from "./badminton-routes";
import type { SportNavConfig, SportNavItem, SportNavSection } from "./sports-shell-types";
import { getSportCapabilities } from "./sport-capabilities";

/**
 * VNBL Phase 1 — Product IA sidebar (max 7 primary items).
 *
 * Temporary hosts point at existing pages until Phase 2 consolidation.
 * Legacy routes stay reachable; active-state maps them into the parent item.
 *
 * Spec: docs/ux/badminton-product-audit.md
 */

/** Pathname only — strip query/hash so active-state stays stable. */
function navPathname(path: string): string {
  const noHash = path.split("#")[0] ?? path;
  return noHash.split("?")[0] ?? noHash;
}

function sectionPath(path: string, section: string): boolean {
  return navPathname(path).includes(`/badminton/${section}`);
}

function queryParam(path: string, key: string): string | null {
  const raw = path.includes("?") ? (path.split("?")[1] ?? "") : "";
  const qs = raw.split("#")[0] ?? "";
  return new URLSearchParams(qs).get(key);
}

function isHubPath(path: string, tournamentId: number): boolean {
  const pathname = navPathname(path);
  const base = badmintonHubPath(tournamentId);
  return pathname === base || pathname === `${base}/`;
}

function isMatchControlPath(path: string): boolean {
  return /\/badminton\/matches\/\d+\/control/.test(navPathname(path));
}

function isMatchesListPath(path: string): boolean {
  const pathname = navPathname(path);
  return (
    /\/badminton\/matches\/?$/.test(pathname) ||
    (/\/badminton\/matches/.test(pathname) && !isMatchControlPath(pathname))
  );
}

function isControlPath(path: string): boolean {
  const pathname = navPathname(path);
  return /\/badminton\/control\/?$/.test(pathname) || pathname.endsWith("/badminton/control");
}

function setupSection(path: string): "identity" | "courts" | "rules" | null {
  if (sectionPath(path, "courts")) return "courts";
  if (sectionPath(path, "scoring-format")) return "rules";
  if (!sectionPath(path, "branding")) return null;
  const raw = queryParam(path, "section");
  if (raw === "courts") return "courts";
  if (raw === "rules") return "rules";
  return "identity";
}

function participantSection(path: string): "players" | "officials" | null {
  if (sectionPath(path, "scorers")) return "officials";
  if (!sectionPath(path, "players")) return null;
  return queryParam(path, "section") === "officials" ? "officials" : "players";
}

function structureSection(path: string): "events" | "draw" | null {
  if (sectionPath(path, "categories")) return "events";
  if (!sectionPath(path, "fixtures")) return null;
  const raw = queryParam(path, "section");
  if (raw === "events") return "events";
  if (raw === "draw") return "draw";
  // category deep-link opens Draw; bare /fixtures defaults to Events
  if (queryParam(path, "categoryId")) return "draw";
  return "events";
}

function resultsSection(path: string): "standings" | "summary" | "insights" | null {
  if (sectionPath(path, "summary")) return "summary";
  if (sectionPath(path, "analytics")) return "insights";
  if (sectionPath(path, "results")) return "standings";
  return null;
}

function isMissionControlPath(path: string, tournamentId: number): boolean {
  const pathname = navPathname(path);
  const home = sportsHomePath(tournamentId);
  return pathname === home || pathname === `${home}/`;
}

/** Warm lazy route chunks before the user clicks a sidebar link. */
const PRELOAD: Record<string, () => Promise<unknown>> = {
  missionControl: () => import("../pages/sports/mission-control"),
  dashboard: () => import("../pages/badminton/tournament-hub"),
  setup: () => import("../pages/badminton/branding"),
  participants: () => import("../pages/badminton/players"),
  structure: () => import("../pages/badminton/fixtures"),
  schedule: () => import("../pages/badminton/schedule"),
  live: () => import("../pages/badminton/control-center"),
  matches: () => import("../pages/badminton/matches"),
  results: () => import("../pages/badminton/results"),
  "results-summary": () => import("../pages/badminton/summary"),
  "results-insights": () => import("../pages/badminton/analytics"),
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
 * Primary organizer destinations — Sports home + lifecycle ops.
 * Tournament Dashboard is Sports product home; remaining items are operational.
 */
export const BADMINTON_PRIMARY_NAV: SportNavItem[] = [
  {
    id: "mission-control",
    label: "Tournament Dashboard",
    href: sportsHomePath,
    isActive: (path, tid) => isMissionControlPath(path, tid),
    icon: ClipboardList,
    preload: () => preloadNav("missionControl"),
  },
  {
    id: "dashboard",
    label: "Operations",
    href: badmintonHubPath,
    isActive: isHubPath,
    icon: LayoutDashboard,
    preload: () => preloadNav("dashboard"),
  },
  {
    id: "setup",
    label: "Setup",
    href: (tid) => `${badmintonHubPath(tid)}/branding`,
    isActive: (path) =>
      sectionPath(path, "branding") ||
      sectionPath(path, "scoring-format") ||
      sectionPath(path, "courts"),
    icon: Settings2,
    preload: () => preloadNav("setup"),
    children: [
      {
        id: "setup-identity",
        label: "Identity & Branding",
        href: (tid) => `${badmintonHubPath(tid)}/branding`,
        isActive: (path) => setupSection(path) === "identity",
        preload: () => preloadNav("setup"),
      },
      {
        id: "setup-courts",
        label: "Courts",
        href: (tid) => `${badmintonHubPath(tid)}/branding?section=courts`,
        isActive: (path) => setupSection(path) === "courts",
        preload: () => preloadNav("setup"),
      },
      {
        id: "setup-rules",
        label: "Rules",
        href: (tid) => `${badmintonHubPath(tid)}/branding?section=rules`,
        isActive: (path) => setupSection(path) === "rules",
        preload: () => preloadNav("setup"),
      },
    ],
  },
  {
    id: "participants",
    label: "Teams & Players",
    href: (tid) => `${badmintonHubPath(tid)}/players`,
    isActive: (path) => sectionPath(path, "players") || sectionPath(path, "scorers"),
    icon: Users,
    preload: () => preloadNav("participants"),
    children: [
      {
        id: "participants-players",
        label: "Players",
        href: (tid) => `${badmintonHubPath(tid)}/players`,
        isActive: (path) => participantSection(path) === "players",
        preload: () => preloadNav("participants"),
      },
      {
        id: "participants-officials",
        label: "Officials",
        href: (tid) => `${badmintonHubPath(tid)}/players?section=officials`,
        isActive: (path) => participantSection(path) === "officials",
        preload: () => preloadNav("participants"),
      },
    ],
  },
  {
    id: "structure",
    label: "Fixtures",
    href: (tid) => `${badmintonHubPath(tid)}/fixtures`,
    isActive: (path) =>
      sectionPath(path, "fixtures") || sectionPath(path, "categories"),
    icon: ListTree,
    preload: () => preloadNav("structure"),
    children: [
      {
        id: "structure-events",
        label: "Events",
        href: (tid) => `${badmintonHubPath(tid)}/fixtures?section=events`,
        isActive: (path) => structureSection(path) === "events",
        preload: () => preloadNav("structure"),
      },
      {
        id: "structure-draw",
        label: "Draw",
        href: (tid) => `${badmintonHubPath(tid)}/fixtures?section=draw`,
        isActive: (path) => structureSection(path) === "draw",
        preload: () => preloadNav("structure"),
      },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    href: (tid) => `${badmintonHubPath(tid)}/schedule`,
    isActive: (path) => sectionPath(path, "schedule"),
    icon: CalendarClock,
    preload: () => preloadNav("schedule"),
  },
  {
    id: "live",
    label: "Live Operations",
    href: (tid) => `${badmintonHubPath(tid)}/control`,
    isActive: (path) =>
      isControlPath(path) ||
      sectionPath(path, "broadcast") ||
      isMatchControlPath(path) ||
      isMatchesListPath(path),
    icon: Radio,
    preload: () => preloadNav("live"),
    children: [
      {
        id: "live-control",
        label: "Operator Controls",
        href: (tid) => `${badmintonHubPath(tid)}/control`,
        isActive: (path) => isControlPath(path) || sectionPath(path, "broadcast"),
        preload: () => preloadNav("live"),
      },
      {
        id: "live-matches",
        label: "Matches & Scoring",
        href: (tid) => `${badmintonHubPath(tid)}/matches`,
        isActive: (path) => isMatchesListPath(path) || isMatchControlPath(path),
        preload: () => preloadNav("matches"),
      },
    ],
  },
  {
    id: "results",
    label: "Results",
    href: (tid) => `${badmintonHubPath(tid)}/results`,
    isActive: (path) =>
      sectionPath(path, "results") ||
      sectionPath(path, "summary") ||
      sectionPath(path, "analytics"),
    icon: Trophy,
    preload: () => preloadNav("results"),
    children: [
      {
        id: "results-standings",
        label: "Standings",
        href: (tid) => `${badmintonHubPath(tid)}/results`,
        isActive: (path) => resultsSection(path) === "standings",
        preload: () => preloadNav("results"),
      },
      {
        id: "results-summary",
        label: "Summary",
        href: (tid) => `${badmintonHubPath(tid)}/summary`,
        isActive: (path) => resultsSection(path) === "summary",
        preload: () => preloadNav("results-summary"),
      },
      {
        id: "results-insights",
        label: "Insights",
        href: (tid) => `${badmintonHubPath(tid)}/analytics`,
        isActive: (path) => resultsSection(path) === "insights",
        preload: () => preloadNav("results-insights"),
      },
    ],
  },
];

/**
 * Badminton sidebar for SportsShell — flat lifecycle nav (no module sections).
 */
export function getBadmintonSportNav(): SportNavConfig {
  const capabilities = getSportCapabilities("badminton");
  const sections: SportNavSection[] = [
    {
      id: "primary",
      // Empty label → flat list (SportsShell skips blank section headers)
      label: "",
      items: BADMINTON_PRIMARY_NAV,
    },
  ];

  return {
    sportId: "badminton",
    sportLabel: "Badminton",
    sections,
    capabilities,
  };
}

/** Hub path helper re-export for SportsShell home active-state checks. */
export { badmintonHubPath };
