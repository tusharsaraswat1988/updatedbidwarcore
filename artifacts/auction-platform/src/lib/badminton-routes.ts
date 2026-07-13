/** Organizer badminton hub + management routes under a tournament. */
export function isBadmintonOrganizerPath(path: string): boolean {
  return /^\/tournament\/\d+\/badminton(\/|$)/.test(path);
}

export function badmintonHubPath(tournamentId: number) {
  return `/tournament/${tournamentId}/badminton`;
}

/** Tournament director / pre-match Match Control (organizer login). */
export function badmintonMatchControlPath(tournamentId: number, matchId: number) {
  return `/tournament/${tournamentId}/badminton/matches/${matchId}/control`;
}

/** Umpire scoring tablet — PIN-protected, share with court official. */
export function badmintonUmpireScorerPath(matchId: number, tournamentId: number) {
  return `/badminton/${matchId}/score?tid=${tournamentId}`;
}

/** Recommended scorer entry — PIN once, then pick a match. */
export function badmintonScorerHomePath(tournamentId: number) {
  return `/badminton/scorer?tid=${tournamentId}`;
}

/** Results & Standings — read-only post-scoring layer. */
export function badmintonResultsPath(tournamentId: number) {
  return `${badmintonHubPath(tournamentId)}/results`;
}

/** Tournament Summary & Awards — official closing page. */
export function badmintonSummaryPath(tournamentId: number) {
  return `${badmintonHubPath(tournamentId)}/summary`;
}

export type BadmintonHubNavItem = {
  id: string;
  label: string;
  href: (tournamentId: number) => string;
  isActive: (pathname: string, tournamentId: number) => boolean;
};

function pathEndsWithSection(path: string, section: string): boolean {
  return path.includes(`/badminton/${section}`);
}

/** Main organizer sections — shown on every badminton hub page. */
export const BADMINTON_HUB_NAV: BadmintonHubNavItem[] = [
  {
    id: "hub",
    label: "Command Center",
    href: badmintonHubPath,
    isActive: (path, tid) => {
      const base = badmintonHubPath(tid);
      return path === base || path === `${base}/`;
    },
  },
  {
    id: "branding",
    label: "Tournament Details",
    href: (tid) => `${badmintonHubPath(tid)}/branding`,
    isActive: (path) => pathEndsWithSection(path, "branding"),
  },
  {
    id: "players",
    label: "Players",
    href: (tid) => `${badmintonHubPath(tid)}/players`,
    isActive: (path) => pathEndsWithSection(path, "players"),
  },
  {
    id: "categories",
    label: "Events",
    href: (tid) => `${badmintonHubPath(tid)}/categories`,
    isActive: (path) => pathEndsWithSection(path, "categories"),
  },
  {
    id: "scoring_format",
    label: "Scoring Rules",
    href: (tid) => `${badmintonHubPath(tid)}/scoring-format`,
    isActive: (path) => pathEndsWithSection(path, "scoring-format"),
  },
  {
    id: "courts",
    label: "Courts",
    href: (tid) => `${badmintonHubPath(tid)}/courts`,
    isActive: (path) => pathEndsWithSection(path, "courts"),
  },
  {
    id: "fixtures",
    label: "Tournament Draw",
    href: (tid) => `${badmintonHubPath(tid)}/fixtures`,
    isActive: (path) => pathEndsWithSection(path, "fixtures"),
  },
  {
    id: "schedule",
    label: "Court Schedule",
    href: (tid) => `${badmintonHubPath(tid)}/schedule`,
    isActive: (path) => pathEndsWithSection(path, "schedule"),
  },
  {
    id: "matches",
    label: "Matches",
    href: (tid) => `${badmintonHubPath(tid)}/matches`,
    // Exclude Match Control deep link so Matches is not falsely active
    isActive: (path) =>
      /\/badminton\/matches\/?$/.test(path) ||
      (/\/badminton\/matches/.test(path) && !/\/matches\/\d+\/control/.test(path)),
  },
  {
    id: "control",
    label: "Control Center",
    href: (tid) => `${badmintonHubPath(tid)}/control`,
    isActive: (path) =>
      /\/badminton\/control\/?$/.test(path) || path.endsWith("/badminton/control"),
  },
  {
    id: "results",
    label: "Results",
    href: (tid) => `${badmintonHubPath(tid)}/results`,
    isActive: (path) => pathEndsWithSection(path, "results"),
  },
  {
    id: "summary",
    label: "Summary",
    href: (tid) => `${badmintonHubPath(tid)}/summary`,
    isActive: (path) => pathEndsWithSection(path, "summary"),
  },
  {
    id: "broadcast",
    label: "Broadcast",
    href: (tid) => `${badmintonHubPath(tid)}/broadcast`,
    isActive: (path) => pathEndsWithSection(path, "broadcast"),
  },
  {
    id: "analytics",
    label: "Analytics",
    href: (tid) => `${badmintonHubPath(tid)}/analytics`,
    isActive: (path) => pathEndsWithSection(path, "analytics"),
  },
];

export type BadmintonHubBackNav =
  | { kind: "link"; href: string; label: string }
  | { kind: "history"; label: string };

/**
 * Contextual back control — follows setup / ops workflow, avoids dead ends.
 */
export function getBadmintonHubBackNav(tournamentId: number, pathname: string): BadmintonHubBackNav {
  const hub = badmintonHubPath(tournamentId);

  if (/\/badminton\/matches\/\d+\/control/.test(pathname)) {
    return { kind: "link", href: `${hub}/control`, label: "Back to Control Center" };
  }

  if (/\/badminton\/control\/?$/.test(pathname)) {
    return { kind: "link", href: hub, label: "Back to Command Center" };
  }

  if (/\/badminton\/results\/?$/.test(pathname)) {
    return { kind: "link", href: `${hub}/control`, label: "Back to Control Center" };
  }

  if (/\/badminton\/summary\/?$/.test(pathname)) {
    return { kind: "link", href: `${hub}/results`, label: "Back to Results" };
  }

  if (/\/badminton\/schedule/.test(pathname)) {
    return { kind: "link", href: `${hub}/fixtures`, label: "Back to Tournament Draw" };
  }

  if (/\/badminton\/fixtures/.test(pathname)) {
    return { kind: "link", href: `${hub}/courts`, label: "Back to Courts" };
  }

  if (/\/badminton\/matches\/?$/.test(pathname) || /\/badminton\/matches\?/.test(pathname)) {
    return { kind: "link", href: `${hub}/schedule`, label: "Back to Court Schedule" };
  }

  if (/\/badminton\/courts/.test(pathname)) {
    return { kind: "link", href: `${hub}/scoring-format`, label: "Back to Scoring Rules" };
  }

  if (/\/badminton\/scoring-format/.test(pathname)) {
    return { kind: "link", href: `${hub}/categories`, label: "Back to Events" };
  }

  if (/\/badminton\/categories/.test(pathname)) {
    return { kind: "link", href: `${hub}/players`, label: "Back to Players" };
  }

  if (/\/badminton\/players/.test(pathname)) {
    return { kind: "link", href: `${hub}/branding`, label: "Back to Tournament Details" };
  }

  if (/\/badminton\/branding/.test(pathname)) {
    return { kind: "link", href: hub, label: "Back" };
  }

  if (/\/badminton\/broadcast/.test(pathname) || /\/badminton\/analytics/.test(pathname)) {
    return { kind: "link", href: `${hub}/control`, label: "Back to Control Center" };
  }

  if (pathname === hub || pathname === `${hub}/`) {
    return { kind: "history", label: "Back" };
  }

  return { kind: "link", href: hub, label: "Back to Command Center" };
}

export const BADMINTON_ROUTE_LOADING_CLASS = "min-h-screen bg-background dark";

// ── Tournament Mode (navigation priority only) ────────────────────────────────

export type BadmintonTournamentMode = "setup" | "live" | "completed";

export type BadmintonTournamentModeSignals = {
  /** Tournament lifecycle status from GET /tournaments/:id */
  tournamentStatus?: string | null;
  /** Count of matches with status "live" (from dashboard). */
  matchesLive?: number | null;
  /** Count of matches with status "completed" (from dashboard). */
  matchesCompleted?: number | null;
};

/**
 * Automatic Tournament Mode detection from existing tournament + dashboard signals.
 * Navigation priority only — does not change permissions, routing, or lifecycle.
 *
 * - completed → tournament.status === "completed"
 * - live → at least one match has started (live or completed count > 0)
 * - setup → no match has started yet
 */
export function detectBadmintonTournamentMode(
  signals: BadmintonTournamentModeSignals,
): BadmintonTournamentMode {
  if (signals.tournamentStatus === "completed") {
    return "completed";
  }
  const live = signals.matchesLive ?? 0;
  const completed = signals.matchesCompleted ?? 0;
  if (live > 0 || completed > 0) {
    return "live";
  }
  return "setup";
}

function hubNavById(id: string): BadmintonHubNavItem {
  const found = BADMINTON_HUB_NAV.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Unknown badminton hub nav id: ${id}`);
  }
  return found;
}

function withLabel(item: BadmintonHubNavItem, label: string): BadmintonHubNavItem {
  return { ...item, label };
}

/** Setup modules collapsed under a single "Setup" section in LIVE / COMPLETED. */
export const BADMINTON_SETUP_NAV_IDS = [
  "branding",
  "players",
  "categories",
  "scoring_format",
  "courts",
  "fixtures",
  "schedule",
] as const;

/**
 * Match Control — same matches route; also active on per-match control deep-links.
 * Label used in LIVE primary (existing Matches item excludes control deep-links).
 */
export const BADMINTON_MATCH_CONTROL_NAV: BadmintonHubNavItem = {
  id: "match_control",
  label: "Match Control",
  href: (tid) => `${badmintonHubPath(tid)}/matches`,
  isActive: (path) => /\/badminton\/matches/.test(path),
};

/**
 * Live Scoring — opens Control Center (Open Scoring lives there).
 * Same route as Control Center; distinct label for LIVE priority nav.
 */
export const BADMINTON_LIVE_SCORING_NAV: BadmintonHubNavItem = {
  id: "live_scoring",
  label: "Live Scoring",
  href: (tid) => `${badmintonHubPath(tid)}/control`,
  isActive: (path) =>
    /\/badminton\/control\/?$/.test(path) || path.endsWith("/badminton/control"),
};

/** Archive — completed-mode label for the matches list (same route). */
export const BADMINTON_ARCHIVE_NAV: BadmintonHubNavItem = withLabel(
  hubNavById("matches"),
  "Archive",
);

/** Tournament Summary — completed-mode label for Command Center hub. */
export const BADMINTON_TOURNAMENT_SUMMARY_NAV: BadmintonHubNavItem = withLabel(
  hubNavById("hub"),
  "Tournament Summary",
);

export type BadmintonHubNavLayout = {
  mode: BadmintonTournamentMode;
  primary: BadmintonHubNavItem[];
  secondary: BadmintonHubNavItem[];
  /** Setup items collapsed under a single section (LIVE / COMPLETED). Empty in SETUP. */
  setupCollapsed: BadmintonHubNavItem[];
  /**
   * Remaining catalog items still reachable (not primary/secondary/setup).
   * Keeps access without changing routes.
   */
  more: BadmintonHubNavItem[];
  /** Visual-only: setup links appear read-only in COMPLETED (permissions unchanged). */
  setupReadOnly: boolean;
};

function idsOf(items: BadmintonHubNavItem[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

/**
 * Builds primary / secondary / collapsed-setup nav for the current Tournament Mode.
 * Broadcast is included in LIVE primary when `broadcastEnabled` is true.
 * Does not change routing — only prioritizes existing hub destinations.
 */
export function getBadmintonHubNavLayout(options: {
  mode: BadmintonTournamentMode;
  broadcastEnabled?: boolean;
}): BadmintonHubNavLayout {
  const { mode, broadcastEnabled = true } = options;
  const setupItems = BADMINTON_SETUP_NAV_IDS.map((id) => hubNavById(id));

  if (mode === "setup") {
    const primary = [
      hubNavById("branding"),
      hubNavById("players"),
      hubNavById("categories"),
      hubNavById("scoring_format"),
      hubNavById("courts"),
      hubNavById("fixtures"),
      hubNavById("schedule"),
    ];
    const secondary = [hubNavById("control"), hubNavById("results")];
    const used = idsOf([...primary, ...secondary]);
    const more = BADMINTON_HUB_NAV.filter((item) => !used.has(item.id));
    return {
      mode,
      primary,
      secondary,
      setupCollapsed: [],
      more,
      setupReadOnly: false,
    };
  }

  if (mode === "live") {
    const primary: BadmintonHubNavItem[] = [
      hubNavById("control"),
      BADMINTON_MATCH_CONTROL_NAV,
      BADMINTON_LIVE_SCORING_NAV,
      hubNavById("results"),
    ];
    if (broadcastEnabled) {
      primary.push(hubNavById("broadcast"));
    }
    const used = new Set<string>([
      ...idsOf(primary),
      ...BADMINTON_SETUP_NAV_IDS,
    ]);
    // Matches list is covered by Match Control; hub/analytics (+ broadcast if off) remain in More
    used.add("matches");
    const more = BADMINTON_HUB_NAV.filter((item) => !used.has(item.id));
    return {
      mode,
      primary,
      secondary: [],
      setupCollapsed: setupItems,
      more,
      setupReadOnly: false,
    };
  }

  // completed
  const primary = [
    hubNavById("results"),
    BADMINTON_TOURNAMENT_SUMMARY_NAV,
    hubNavById("analytics"),
    BADMINTON_ARCHIVE_NAV,
  ];
  const used = new Set<string>([
    ...idsOf(primary),
    ...BADMINTON_SETUP_NAV_IDS,
    "matches", // Archive covers matches
    "hub", // Tournament Summary covers hub
  ]);
  const more = BADMINTON_HUB_NAV.filter((item) => !used.has(item.id));
  return {
    mode,
    primary,
    secondary: [],
    setupCollapsed: setupItems,
    more,
    setupReadOnly: true,
  };
}

export const BADMINTON_TOURNAMENT_MODE_LABEL: Record<
  BadmintonTournamentMode,
  string
> = {
  setup: "Setup",
  live: "Live",
  completed: "Completed",
};
