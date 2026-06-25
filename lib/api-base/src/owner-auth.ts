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
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "lockout"; lockoutRemainingSec: number };

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
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  const body = (await res.json()) as { valid?: boolean };
  return body.valid === true ? { ok: true } : { ok: false, reason: "invalid" };
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
