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
  needsMobile?: boolean;
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

/** Mirrors auction-platform LoginGuardStatus — production login hardening. */
export type LoginGuardStatus = {
  tier: "normal" | "captcha" | "cooldown";
  failures: number;
  cooldownRemainingSec: number;
  captchaRequired: boolean;
  captcha?: { captchaId: string; question: string };
  turnstileSiteKey?: string;
};

export async function fetchAuthConfig(): Promise<{
  smsOtpEnabled: boolean;
  turnstileSiteKey: string | null;
}> {
  try {
    const r = await apiFetch("/auth/config");
    if (!r.ok) return { smsOtpEnabled: false, turnstileSiteKey: null };
    const d = (await r.json()) as { smsOtpEnabled?: boolean; turnstileSiteKey?: string | null };
    return {
      smsOtpEnabled: !!d.smsOtpEnabled,
      turnstileSiteKey: d.turnstileSiteKey ?? null,
    };
  } catch {
    return { smsOtpEnabled: false, turnstileSiteKey: null };
  }
}

export async function fetchLoginGuardStatus(identifier: string): Promise<LoginGuardStatus> {
  try {
    const q = encodeURIComponent(identifier);
    const r = await apiFetch(`/auth/organizer-account/login/status?identifier=${q}`);
    if (!r.ok) {
      return {
        tier: "normal",
        failures: 0,
        cooldownRemainingSec: 0,
        captchaRequired: false,
      };
    }
    return r.json();
  } catch {
    return {
      tier: "normal",
      failures: 0,
      cooldownRemainingSec: 0,
      captchaRequired: false,
    };
  }
}

/** Reuses existing Organizer account login API — same payload as organizer portal. */
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
    // 5xx / other errors: do NOT treat as logged out (avoids session flash / false logout)
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
export function organizerGoogleSignInUrl(
  nextPath: string,
  opts?: { nativeApp?: "android" | "ios" },
): string {
  const params = new URLSearchParams({ next: nextPath });
  if (opts?.nativeApp) params.set("native_app", opts.nativeApp);
  return `/api/auth/google?${params.toString()}`;
}

/** Capacitor: exchange Custom Tabs handoff token for WebView session cookie. */
export async function exchangeGoogleNativeHandoff(handoff: string): Promise<{
  success: boolean;
  error?: string;
  organizer?: OrganizerInfo;
}> {
  try {
    const r = await apiFetch("/auth/google/native-handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handoff }),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      return { success: false, error: d.error || "Google sign-in handoff failed" };
    }
    const d = (await r.json()) as { organizer?: OrganizerInfo };
    if (d.organizer) {
      markOrganizerSessionActive(toProfileCache(d.organizer));
    } else {
      markOrganizerSessionActive();
    }
    return { success: true, organizer: d.organizer };
  } catch {
    return { success: false, error: "Google sign-in handoff failed" };
  }
}

function toProfileCache(o: OrganizerInfo): OrganizerProfileCache {
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    mobile: o.mobile,
  };
}
