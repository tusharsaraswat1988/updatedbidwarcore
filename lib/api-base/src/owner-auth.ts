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

/** POST /api/tournaments/:tid/teams/:teamId/verify-access — server is the only verifier. */
export async function verifyOwnerAccessCode(
  tournamentId: number,
  teamId: number,
  code: string,
): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;

  const res = await fetch(
    `/api/tournaments/${tournamentId}/teams/${teamId}/verify-access`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalized }),
    },
  );

  if (!res.ok) return false;
  const body = (await res.json()) as { valid?: boolean };
  return body.valid === true;
}
