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

/** Scorer tablet — JWT login (mobile + personal PIN). */
export function badmintonScorerMatchPath(matchId: number, tournamentId: number) {
  return `/badminton/${matchId}/score?tid=${tournamentId}`;
}

/**
 * Court official / umpire console — same JWT scorer session as Scorer,
 * with umpire-oriented chrome only (S4-05 MVP).
 * Native mobile badminton app is future work — this is a thin web alias.
 */
export function badmintonUmpireMatchPath(matchId: number, tournamentId: number) {
  return `/badminton/${matchId}/umpire?tid=${tournamentId}`;
}

/** Recommended scorer entry — sign in once, then pick a match. */
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

/**
 * Legacy hub destinations remapped to Phase 2 IA hosts.
 * Prefer these over raw `/categories`, `/courts`, `/broadcast`, etc.
 */
export function badmintonIaLiveControlPath(tournamentId: number, focus?: "broadcast") {
  const base = `${badmintonHubPath(tournamentId)}/control`;
  return focus === "broadcast" ? `${base}?focus=broadcast` : base;
}

export function badmintonIaStructureEventsPath(tournamentId: number) {
  return `${badmintonHubPath(tournamentId)}/fixtures?section=events`;
}

export function badmintonIaStructureDrawPath(tournamentId: number) {
  return `${badmintonHubPath(tournamentId)}/fixtures?section=draw`;
}

export function badmintonIaSetupCourtsPath(tournamentId: number) {
  return `${badmintonHubPath(tournamentId)}/branding?section=courts`;
}

export function badmintonIaSetupRulesPath(tournamentId: number) {
  return `${badmintonHubPath(tournamentId)}/branding?section=rules`;
}

export function badmintonIaParticipantsOfficialsPath(tournamentId: number) {
  return `${badmintonHubPath(tournamentId)}/players?section=officials`;
}

export const BADMINTON_ROUTE_LOADING_CLASS = "lovable-theme min-h-screen bg-background dark";

// ── Tournament Mode (navigation priority / dashboard signals) ─────────────────

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

export const BADMINTON_TOURNAMENT_MODE_LABEL: Record<
  BadmintonTournamentMode,
  string
> = {
  setup: "Setup",
  live: "Live",
  completed: "Completed",
};
