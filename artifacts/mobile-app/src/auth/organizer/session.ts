/**
 * Organizer session markers — independent from Team Owner storage.
 * Server session remains the httpOnly `bidwar_auth` cookie (unchanged API).
 * These keys are client-only UX markers for the mobile organizer stack.
 */

const PREFIX = "bidwar.role.organizer";

export const ORGANIZER_SESSION_KEYS = {
  active: `${PREFIX}.active`,
  profile: `${PREFIX}.profile`,
} as const;

export type OrganizerProfileCache = {
  id: number;
  name: string;
  email: string | null;
  mobile: string;
};

export function markOrganizerSessionActive(profile?: OrganizerProfileCache): void {
  try {
    localStorage.setItem(ORGANIZER_SESSION_KEYS.active, "1");
    if (profile) {
      localStorage.setItem(ORGANIZER_SESSION_KEYS.profile, JSON.stringify(profile));
    }
  } catch {
    // ignore
  }
}

export function clearOrganizerSessionMarkers(): void {
  try {
    localStorage.removeItem(ORGANIZER_SESSION_KEYS.active);
    localStorage.removeItem(ORGANIZER_SESSION_KEYS.profile);
  } catch {
    // ignore
  }
}

export function readOrganizerProfileCache(): OrganizerProfileCache | null {
  try {
    const raw = localStorage.getItem(ORGANIZER_SESSION_KEYS.profile);
    if (!raw) return null;
    return JSON.parse(raw) as OrganizerProfileCache;
  } catch {
    return null;
  }
}

export function isOrganizerSessionMarked(): boolean {
  try {
    return localStorage.getItem(ORGANIZER_SESSION_KEYS.active) === "1";
  } catch {
    return false;
  }
}
