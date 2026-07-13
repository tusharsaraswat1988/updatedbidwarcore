/**
 * Team Owner session markers — independent from Organizer storage.
 * Server session remains `bidwar_owner` cookie + owner sessionStorage keys
 * from `@workspace/api-base/owner-auth` (unchanged).
 */

const PREFIX = "bidwar.role.team-owner";

export const TEAM_OWNER_SESSION_KEYS = {
  active: `${PREFIX}.active`,
  context: `${PREFIX}.context`,
} as const;

export type TeamOwnerSessionContext = {
  tournamentId: number;
  teamId: number;
  tournamentName: string;
  teamName: string;
  teamShortCode: string;
  teamColor: string | null;
  teamLogoUrl: string | null;
  mobile?: string;
};

export function markTeamOwnerSessionActive(ctx: TeamOwnerSessionContext): void {
  try {
    localStorage.setItem(TEAM_OWNER_SESSION_KEYS.active, "1");
    localStorage.setItem(TEAM_OWNER_SESSION_KEYS.context, JSON.stringify(ctx));
  } catch {
    // ignore
  }
}

export function clearTeamOwnerSessionMarkers(): void {
  try {
    localStorage.removeItem(TEAM_OWNER_SESSION_KEYS.active);
    localStorage.removeItem(TEAM_OWNER_SESSION_KEYS.context);
  } catch {
    // ignore
  }
}

export function readTeamOwnerSessionContext(): TeamOwnerSessionContext | null {
  try {
    const raw = localStorage.getItem(TEAM_OWNER_SESSION_KEYS.context);
    if (!raw) return null;
    return JSON.parse(raw) as TeamOwnerSessionContext;
  } catch {
    return null;
  }
}

export function isTeamOwnerSessionMarked(): boolean {
  try {
    return localStorage.getItem(TEAM_OWNER_SESSION_KEYS.active) === "1";
  } catch {
    return false;
  }
}
