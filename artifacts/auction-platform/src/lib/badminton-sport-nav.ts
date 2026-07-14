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

function toSportItem(item: BadmintonHubNavItem): SportNavItem {
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    isActive: item.isActive,
    icon: ICONS[item.id],
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
        { ...byId("scoring_format"), label: "Scoring Settings" },
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
