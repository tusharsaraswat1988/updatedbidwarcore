import { apiFetch } from "@workspace/api-base";
import {
  clearOrganizerSessionMarkers,
  markOrganizerSessionActive,
  type OrganizerProfileCache,
} from "./session";

export type OrganizerInfo = {
  id: number;
  name: string;
  email: string | null;
  mobile: string;
  photoUrl?: string | null;
};

export type OrganizerTournament = {
  id: number;
  name: string;
  sport: string;
  status: string;
  licenseStatus: string;
  city: string | null;
  venue: string | null;
  auctionDate: string | null;
  createdAt: string;
};

export type LoginGuardStatus = {
  tier: string;
  failures: number;
  cooldownRemainingSec: number;
  captchaRequired: boolean;
};

/** Reuses existing Organizer account login API — no backend changes. */
export async function loginOrganizerAccount(
  identifier: string,
  password: string,
  captcha?: {
    turnstileToken?: string;
    captchaId?: string;
    captchaAnswer?: string;
  },
): Promise<{
  success: boolean;
  error?: string;
  organizer?: OrganizerInfo;
  tournaments?: OrganizerTournament[];
  loginGuard?: LoginGuardStatus;
}> {
  try {
    const r = await apiFetch("/auth/organizer-account/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password, ...captcha }),
    });
    const d = (await r.json()) as {
      error?: string;
      organizer?: OrganizerInfo;
      tournaments?: OrganizerTournament[];
      loginGuard?: LoginGuardStatus;
    };
    if (!r.ok) {
      return {
        success: false,
        error: d.error || "Login failed",
        loginGuard: d.loginGuard,
      };
    }
    if (d.organizer) {
      markOrganizerSessionActive(toProfileCache(d.organizer));
    }
    return { success: true, organizer: d.organizer, tournaments: d.tournaments };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function checkOrganizerAccountAuth(): Promise<{
  loggedIn: boolean;
  serverError?: boolean;
  organizer?: OrganizerInfo;
  tournaments?: OrganizerTournament[];
}> {
  try {
    const r = await apiFetch("/auth/organizer-account/me");
    if (r.status === 401 || r.status === 403) {
      clearOrganizerSessionMarkers();
      return { loggedIn: false };
    }
    if (!r.ok) return { loggedIn: false, serverError: true };
    const d = (await r.json()) as {
      loggedIn?: boolean;
      organizer?: OrganizerInfo;
      tournaments?: OrganizerTournament[];
    };
    if (d.loggedIn && d.organizer) {
      markOrganizerSessionActive(toProfileCache(d.organizer));
      return {
        loggedIn: true,
        organizer: d.organizer,
        tournaments: d.tournaments,
      };
    }
    clearOrganizerSessionMarkers();
    return { loggedIn: false };
  } catch {
    return { loggedIn: false, serverError: true };
  }
}

/** Logs out Organizer only — does NOT touch Team Owner session. */
export async function logoutOrganizerAccount(): Promise<void> {
  try {
    await apiFetch("/auth/organizer-account/logout", { method: "POST" });
  } catch {
    // best-effort
  }
  clearOrganizerSessionMarkers();
}

/** Existing Google OAuth entry — returns relative URL into API. */
export function organizerGoogleSignInUrl(nextPath: string): string {
  return `/api/auth/google?next=${encodeURIComponent(nextPath)}`;
}

function toProfileCache(o: OrganizerInfo): OrganizerProfileCache {
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    mobile: o.mobile,
  };
}
