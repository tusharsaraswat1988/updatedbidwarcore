/**
 * Cricket organizer routes under /tournament/:id/score/*
 * Public fan surfaces stay at /tournament/:id/cricket/*
 */

/** Organizer cricket scoring paths (SportsShell). */
export function isCricketOrganizerPath(path: string): boolean {
  return /^\/tournament\/\d+\/score(\/|$)/.test(path);
}

/** Cricket Match Command Center / match list. */
export function cricketScoreHubPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/score`;
}

export function cricketDashboardPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/dashboard`;
}

export function cricketFixturesPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/fixtures`;
}

export function cricketScheduleOpsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/schedule`;
}

export function cricketStandingsOpsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/standings`;
}

export function cricketStatsOpsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/stats`;
}

export function cricketTeamsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/teams`;
}

export function cricketPlayersPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/players`;
}

/** Identity, sponsors, venue music/banner (Sports overlay). */
export function cricketSettingsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/settings`;
}

export function cricketOfficialsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/officials`;
}

export function cricketAwardsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/awards`;
}

export function cricketReportsPath(tournamentId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/reports`;
}

/** Canonical Corporate Match Center for one match. */
export function cricketMatchCenterPath(tournamentId: number, matchId: number): string {
  return `${cricketScoreHubPath(tournamentId)}/${matchId}`;
}

/** @deprecated Prefer cricketMatchCenterPath — same URL. */
export function cricketMatchOpsPath(tournamentId: number, matchId: number): string {
  return cricketMatchCenterPath(tournamentId, matchId);
}

/** Live Control (scorer pad) — launched from Match Center. */
export function cricketLiveControlPath(tournamentId: number, matchId: number): string {
  return `${cricketMatchCenterPath(tournamentId, matchId)}/live`;
}

/** Reserved score subpaths — not numeric match IDs. */
export const CRICKET_SCORE_STATIC_SEGMENTS = new Set([
  "dashboard",
  "settings",
  "teams",
  "players",
  "fixtures",
  "schedule",
  "standings",
  "stats",
  "officials",
  "awards",
  "reports",
]);

export const CRICKET_ROUTE_LOADING_CLASS = "min-h-screen bg-background";
