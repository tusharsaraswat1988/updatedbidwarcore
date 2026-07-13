/** Canonical path prefix for the shared BidWar mobile app (must match vite `base`). */
export const MOBILE_APP_BASE = "/mobile";

/** Role IDs for the dual-auth (and future multi-role) mobile shell. */
export const MOBILE_ROLE_IDS = [
  "organizer",
  "team-owner",
  // Future: "operator", "scorer", "umpire", "volunteer", "spectator"
] as const;

export type MobileRoleId = (typeof MOBILE_ROLE_IDS)[number];

export function isMobileRoleId(value: string | null | undefined): value is MobileRoleId {
  return MOBILE_ROLE_IDS.includes(value as MobileRoleId);
}

/** localStorage key for last selected role (shared branding shell only — not auth). */
export const MOBILE_LAST_ROLE_KEY = "bidwar.mobile.lastRole";

export function mobileAppPath(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `${MOBILE_APP_BASE}/`;
  return `${MOBILE_APP_BASE}${normalized}`;
}

export function mobileRoleSelectionPath(): string {
  return mobileAppPath("/select-role");
}

export function mobileOrganizerLoginPath(): string {
  return mobileAppPath("/organizer/login");
}

export function mobileOrganizerDashboardPath(): string {
  return mobileAppPath("/organizer/dashboard");
}

export function mobileOrganizerSettingsPath(): string {
  return mobileAppPath("/organizer/settings");
}

export function mobileTeamOwnerLoginPath(): string {
  return mobileAppPath("/team-owner/login");
}

export function mobileTeamOwnerPanelPath(tournamentId: number, teamId: number): string {
  return mobileAppPath(`/team-owner/panel/${tournamentId}/${teamId}`);
}

export function mobileTeamOwnerSettingsPath(): string {
  return mobileAppPath("/team-owner/settings");
}

/** Absolute URL for OAuth `next` redirects back into the mobile organizer stack. */
export function mobileOrganizerDashboardPublicUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${mobileOrganizerDashboardPath()}`;
}
