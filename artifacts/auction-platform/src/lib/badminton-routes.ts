/** Organizer badminton hub + management routes under a tournament. */
export function isBadmintonOrganizerPath(path: string): boolean {
  return /^\/tournament\/\d+\/badminton(\/|$)/.test(path);
}

export function badmintonHubPath(tournamentId: number) {
  return `/tournament/${tournamentId}/badminton`;
}

/** Tournament director panel — pause, retirement, walkover (organizer login). */
export function badmintonMatchControlPath(tournamentId: number, matchId: number) {
  return `/tournament/${tournamentId}/badminton/matches/${matchId}/control`;
}

/** Umpire scoring tablet — PIN-protected, share with court official. */
export function badmintonUmpireScorerPath(matchId: number, tournamentId: number) {
  return `/badminton/${matchId}/score?tid=${tournamentId}`;
}

export type BadmintonHubNavItem = {
  id: string;
  label: string;
  href: (tournamentId: number) => string;
  isActive: (pathname: string, tournamentId: number) => boolean;
};

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
    isActive: (path) => path.includes("/badminton/branding"),
  },
  {
    id: "players",
    label: "Players",
    href: (tid) => `${badmintonHubPath(tid)}/players`,
    isActive: (path) => path.includes("/badminton/players"),
  },
  {
    id: "categories",
    label: "Categories",
    href: (tid) => `${badmintonHubPath(tid)}/categories`,
    isActive: (path) => path.includes("/badminton/categories"),
  },
  {
    id: "courts",
    label: "Courts",
    href: (tid) => `${badmintonHubPath(tid)}/courts`,
    isActive: (path) => path.includes("/badminton/courts"),
  },
  {
    id: "matches",
    label: "Matches",
    href: (tid) => `${badmintonHubPath(tid)}/matches`,
    isActive: (path) => path.includes("/badminton/matches"),
  },
  {
    id: "broadcast",
    label: "Broadcast",
    href: (tid) => `${badmintonHubPath(tid)}/broadcast`,
    isActive: (path) => path.includes("/badminton/broadcast"),
  },
  {
    id: "analytics",
    label: "Analytics",
    href: (tid) => `${badmintonHubPath(tid)}/analytics`,
    isActive: (path) => path.includes("/badminton/analytics"),
  },
];

export function getBadmintonHubBackNav(tournamentId: number, pathname: string) {
  const hub = badmintonHubPath(tournamentId);
  const matches = `${hub}/matches`;

  if (/\/badminton\/matches\/\d+\/control/.test(pathname)) {
    return { href: matches, label: "Back to Matches" };
  }

  if (pathname === hub || pathname === `${hub}/`) {
    return { href: `/tournament/${tournamentId}`, label: "Back to Auction Hub" };
  }

  return { href: hub, label: "Back to Command Center" };
}

export const BADMINTON_ROUTE_LOADING_CLASS = "min-h-screen bg-background dark";
