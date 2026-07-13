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
    label: "Branding",
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
    label: "Categories",
    href: (tid) => `${badmintonHubPath(tid)}/categories`,
    isActive: (path) => pathEndsWithSection(path, "categories"),
  },
  {
    id: "scoring_format",
    label: "Match Format",
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
    label: "Draw & Fixtures",
    href: (tid) => `${badmintonHubPath(tid)}/fixtures`,
    isActive: (path) => pathEndsWithSection(path, "fixtures"),
  },
  {
    id: "schedule",
    label: "Scheduling",
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
    return { kind: "link", href: `${hub}/fixtures`, label: "Back to Draw & Fixtures" };
  }

  if (/\/badminton\/fixtures/.test(pathname)) {
    return { kind: "link", href: `${hub}/categories`, label: "Back to Categories" };
  }

  if (/\/badminton\/matches\/?$/.test(pathname) || /\/badminton\/matches\?/.test(pathname)) {
    return { kind: "link", href: `${hub}/schedule`, label: "Back to Scheduling" };
  }

  if (/\/badminton\/courts/.test(pathname)) {
    return { kind: "link", href: `${hub}/scoring-format`, label: "Back to Match Format" };
  }

  if (/\/badminton\/scoring-format/.test(pathname)) {
    return { kind: "link", href: `${hub}/categories`, label: "Back to Categories" };
  }

  if (/\/badminton\/categories/.test(pathname)) {
    return { kind: "link", href: `${hub}/players`, label: "Back to Players" };
  }

  if (/\/badminton\/players/.test(pathname)) {
    return { kind: "link", href: `${hub}/branding`, label: "Back to Branding" };
  }

  if (/\/badminton\/branding/.test(pathname)) {
    return { kind: "link", href: hub, label: "Back to Command Center" };
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
