import {
  CalendarClock,
  LayoutDashboard,
  ListTree,
  Radio,
  Settings2,
  Trophy,
  Users,
} from "lucide-react";
import { badmintonHubPath } from "./badminton-routes";
import type { SportNavConfig, SportNavItem, SportNavSection } from "./sports-shell-types";

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

/** Warm lazy route chunks before the user clicks a sidebar link. */
const PRELOAD: Record<string, () => Promise<unknown>> = {
  dashboard: () => import("../pages/badminton/tournament-hub"),
  setup: () => import("../pages/badminton/branding"),
  participants: () => import("../pages/badminton/players"),
  structure: () => import("../pages/badminton/fixtures"),
  schedule: () => import("../pages/badminton/schedule"),
  live: () => import("../pages/badminton/control-center"),
  results: () => import("../pages/badminton/results"),
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
 * Primary organizer destinations — tournament lifecycle order.
 * Do not add sidebar items without an IA review (max 7).
 */
export const BADMINTON_PRIMARY_NAV: SportNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: badmintonHubPath,
    isActive: isHubPath,
    icon: LayoutDashboard,
    preload: () => preloadNav("dashboard"),
  },
  {
    id: "setup",
    label: "Tournament Setup",
    // Temporary host — Phase 2 merges branding / courts / scoring-format / brand assets
    href: (tid) => `${badmintonHubPath(tid)}/branding`,
    isActive: (path) =>
      sectionPath(path, "branding") ||
      sectionPath(path, "scoring-format") ||
      sectionPath(path, "courts"),
    icon: Settings2,
    preload: () => preloadNav("setup"),
  },
  {
    id: "participants",
    label: "Participants",
    // Temporary host — Phase 2 merges players / officials / scorers / entries
    href: (tid) => `${badmintonHubPath(tid)}/players`,
    isActive: (path) => sectionPath(path, "players") || sectionPath(path, "scorers"),
    icon: Users,
    preload: () => preloadNav("participants"),
  },
  {
    id: "structure",
    label: "Tournament Structure",
    // Temporary host — Phase 2 merges events / draw / fixtures / format
    href: (tid) => `${badmintonHubPath(tid)}/fixtures`,
    isActive: (path) =>
      sectionPath(path, "fixtures") || sectionPath(path, "categories"),
    icon: ListTree,
    preload: () => preloadNav("structure"),
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
    label: "Live Control",
    // Temporary host — Mission Control (control center); broadcast is in-page
    href: (tid) => `${badmintonHubPath(tid)}/control`,
    isActive: (path) =>
      isControlPath(path) ||
      sectionPath(path, "broadcast") ||
      isMatchControlPath(path) ||
      isMatchesListPath(path),
    icon: Radio,
    preload: () => preloadNav("live"),
  },
  {
    id: "results",
    label: "Results",
    // Temporary host — Phase 2 merges summary / analytics into Results
    href: (tid) => `${badmintonHubPath(tid)}/results`,
    isActive: (path) =>
      sectionPath(path, "results") ||
      sectionPath(path, "summary") ||
      sectionPath(path, "analytics"),
    icon: Trophy,
    preload: () => preloadNav("results"),
  },
];

/**
 * Badminton sidebar for SportsShell — flat lifecycle nav (no module sections).
 */
export function getBadmintonSportNav(): SportNavConfig {
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
  };
}

/** Hub path helper re-export for SportsShell home active-state checks. */
export { badmintonHubPath };
