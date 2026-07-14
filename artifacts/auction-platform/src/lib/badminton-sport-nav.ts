import {
  Activity,
  BarChart3,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Link2,
  MapPin,
  Radio,
  Settings2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import {
  BADMINTON_HUB_NAV,
  badmintonHubPath,
  type BadmintonHubNavItem,
} from "@/lib/badminton-routes";
import type { SportNavConfig, SportNavItem, SportNavSection } from "@/lib/sports-shell-types";

const ICONS: Record<string, SportNavItem["icon"]> = {
  hub: LayoutDashboard,
  branding: ClipboardList,
  players: UserPlus,
  categories: Users,
  scoring_format: Settings2,
  courts: MapPin,
  fixtures: Trophy,
  schedule: CalendarClock,
  matches: Activity,
  control: Radio,
  results: Trophy,
  summary: ClipboardList,
  broadcast: Link2,
  analytics: BarChart3,
};

/** Warm lazy route chunks before the user clicks a sidebar link. */
const PRELOAD: Record<string, () => Promise<unknown>> = {
  hub: () => import("@/pages/badminton/tournament-hub"),
  branding: () => import("@/pages/badminton/branding"),
  players: () => import("@/pages/badminton/players"),
  categories: () => import("@/pages/badminton/categories"),
  scoring_format: () => import("@/pages/badminton/scoring-format"),
  courts: () => import("@/pages/badminton/courts"),
  fixtures: () => import("@/pages/badminton/fixtures"),
  schedule: () => import("@/pages/badminton/schedule"),
  matches: () => import("@/pages/badminton/matches"),
  control: () => import("@/pages/badminton/control-center"),
  results: () => import("@/pages/badminton/results"),
  summary: () => import("@/pages/badminton/summary"),
  broadcast: () => import("@/pages/badminton/broadcast"),
  analytics: () => import("@/pages/badminton/analytics"),
};

const preloaded = new Set<string>();

function preloadNav(id: string) {
  if (preloaded.has(id)) return;
  const loader = PRELOAD[id];
  if (!loader) return;
  preloaded.add(id);
  void loader();
}

function toSportItem(item: BadmintonHubNavItem): SportNavItem {
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    isActive: item.isActive,
    icon: ICONS[item.id],
    preload: PRELOAD[item.id] ? () => preloadNav(item.id) : undefined,
  };
}

function byId(id: string): SportNavItem {
  const found = BADMINTON_HUB_NAV.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Unknown badminton hub nav id: ${id}`);
  }
  return toSportItem(found);
}

/**
 * Badminton sidebar sections for SportsShell.
 * Same destinations as BADMINTON_HUB_NAV — Auction-style vertical grouping.
 */
export function getBadmintonSportNav(): SportNavConfig {
  const sections: SportNavSection[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      items: [
        {
          ...byId("hub"),
          label: "Tournament Dashboard",
        },
      ],
    },
    {
      id: "setup",
      label: "Setup",
      items: [
        { ...byId("branding"), label: "Tournament Information" },
        byId("players"),
        { ...byId("categories"), label: "Teams / Events" },
        { ...byId("scoring_format"), label: "Scoring Format" },
        { ...byId("courts"), label: "Venues & Courts" },
        { ...byId("fixtures"), label: "Fixtures" },
        { ...byId("schedule"), label: "Match Schedule" },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        byId("matches"),
        {
          ...byId("control"),
          label: "Operator Panel",
          hint: "Live tournament control",
        },
        byId("results"),
        { ...byId("summary"), label: "Publish / Summary" },
      ],
    },
    {
      id: "broadcast",
      label: "Broadcast",
      items: [
        {
          ...byId("broadcast"),
          label: "Display & Broadcast",
          hint: "LED · OBS · Public · Umpire",
        },
      ],
    },
    {
      id: "insights",
      label: "Reports",
      items: [byId("analytics")],
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
