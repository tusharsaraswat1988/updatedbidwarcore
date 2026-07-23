/**
 * Single source of truth for owner access-code auth (browser session + verify API).
 * Used by owner-app AccessCode and OwnerRoute — no duplicate verification elsewhere.
 */

export function ownerVerifiedSessionKey(teamId: number): string {
  return `owner_verified_${teamId}`;
}

export function ownerAccessCodeSessionKey(teamId: number): string {
  return `owner_code_${teamId}`;
}

export function isOwnerSessionVerified(teamId: number): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(ownerVerifiedSessionKey(teamId)) === "1";
}

export function getStoredOwnerAccessCode(teamId: number): string | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  const code = sessionStorage.getItem(ownerAccessCodeSessionKey(teamId));
  return code ?? undefined;
}

export function persistOwnerSession(teamId: number, accessCode: string): void {
  const normalized = accessCode.trim().toUpperCase();
  sessionStorage.setItem(ownerVerifiedSessionKey(teamId), "1");
  sessionStorage.setItem(ownerAccessCodeSessionKey(teamId), normalized);
}

export function clearOwnerSession(teamId: number): void {
  sessionStorage.removeItem(ownerVerifiedSessionKey(teamId));
  sessionStorage.removeItem(ownerAccessCodeSessionKey(teamId));
}

export function teamNeedsAccessCode(team: {
  requiresAccessCode?: boolean;
  accessCode?: string | null;
}): boolean {
  return team.requiresAccessCode ?? !!team.accessCode;
}

export type VerifyOwnerAccessResult =
  | { ok: true; sessionId?: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "lockout"; lockoutRemainingSec: number };

const ownerFetchInit: RequestInit = {
  credentials: "include",
  headers: { "Content-Type": "application/json" },
};

/** POST /api/tournaments/:tid/teams/:teamId/verify-access — server is the only verifier. */
export async function verifyOwnerAccessCode(
  tournamentId: number,
  teamId: number,
  code: string,
): Promise<VerifyOwnerAccessResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "invalid" };

  const res = await fetch(
    `/api/tournaments/${tournamentId}/teams/${teamId}/verify-access`,
    {
      ...ownerFetchInit,
      method: "POST",
      body: JSON.stringify({ code: normalized }),
    },
  );

  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { lockoutRemainingSec?: number };
    return {
      ok: false,
      reason: "lockout",
      lockoutRemainingSec: body.lockoutRemainingSec ?? 0,
    };
  }

  if (!res.ok) return { ok: false, reason: "invalid" };
  const body = (await res.json()) as { valid?: boolean; sessionId?: string };
  return body.valid === true
    ? { ok: true, sessionId: body.sessionId }
    : { ok: false, reason: "invalid" };
}

/**
 * Ensures a verified server-side owner session (httpOnly cookie) exists.
 * Call after access-code gate or for teams without a required access code.
 */
export async function establishOwnerServerSession(
  tournamentId: number,
  teamId: number,
  code?: string,
): Promise<{ ok: true; sessionId?: string } | { ok: false }> {
  const normalized = (code ?? "").trim().toUpperCase();
  const res = await fetch(
    `/api/tournaments/${tournamentId}/teams/${teamId}/verify-access`,
    {
      ...ownerFetchInit,
      method: "POST",
      body: JSON.stringify({ code: normalized }),
    },
  );

  if (res.status === 429 || !res.ok) return { ok: false };
  const body = (await res.json()) as { valid?: boolean; sessionId?: string };
  return body.valid === true
    ? { ok: true, sessionId: body.sessionId }
    : { ok: false };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

/** Subscribe to push after verified owner session cookie is present. */
export async function subscribeOwnerPush(
  tournamentId: number,
  teamId: number,
): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const keyRes = await fetch("/api/vapid-public-key");
    if (!keyRes.ok) return false;
    const { publicKey } = (await keyRes.json()) as { publicKey: string };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subJson = sub.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    const res = await fetch(
      `/api/tournaments/${tournamentId}/push-subscribe?teamId=${teamId}`,
      {
        ...ownerFetchInit,
        method: "POST",
        body: JSON.stringify(subJson),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Logout: remove DB subscription, revoke server session, unsubscribe browser. */
export async function logoutOwnerPushAndSession(
  tournamentId: number,
  teamId: number,
): Promise<void> {
  try {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const subJson = sub.toJSON() as { endpoint?: string };
        if (subJson.endpoint) {
          await fetch(
            `/api/tournaments/${tournamentId}/push-unsubscribe?teamId=${teamId}`,
            {
              ...ownerFetchInit,
              method: "POST",
              body: JSON.stringify({ endpoint: subJson.endpoint }),
            },
          );
        }
        await sub.unsubscribe();
      }
    }
  } catch {
    // Best-effort cleanup
  }

  try {
    await fetch(
      `/api/tournaments/${tournamentId}/teams/${teamId}/owner-session/revoke`,
      { ...ownerFetchInit, method: "POST" },
    );
  } catch {
    // Best-effort cleanup
  }
}

/** GET owner-access-lockout — current IP lockout status (owner-app polling). */
export async function fetchOwnerAccessLockoutStatus(
  tournamentId: number,
  teamId: number,
): Promise<{ locked: boolean; lockoutRemainingSec: number }> {
  try {
    const res = await fetch(
      `/api/tournaments/${tournamentId}/teams/${teamId}/owner-access-lockout`,
    );
    if (!res.ok) return { locked: false, lockoutRemainingSec: 0 };
    const body = (await res.json()) as { locked?: boolean; lockoutRemainingSec?: number };
    return {
      locked: body.locked === true,
      lockoutRemainingSec: body.lockoutRemainingSec ?? 0,
    };
  } catch {
    return { locked: false, lockoutRemainingSec: 0 };
  }
}

/** POST reset-access-lockout — tournament organiser or admin only. */
export async function resetOwnerAccessLockout(
  tournamentId: number,
  teamId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(
      `/api/tournaments/${tournamentId}/teams/${teamId}/reset-access-lockout`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return {
        success: false,
        message: body.error ?? `Unlock failed (${res.status})`,
      };
    }
    return {
      success: body.success === true,
      message: body.message ?? "Owner access lockout cleared",
    };
  } catch {
    return { success: false, message: "Network error — could not reach server" };
  }
}
