/**
 * Team Owner auth API wrappers — reuses existing onboarding + verify-access APIs.
 * Flow intentionally mirrors owner-app: mobile → tournament → access code → panel.
 */

import {
  clearOwnerSession,
  logoutOwnerPushAndSession,
  persistOwnerSession,
  verifyOwnerAccessCode,
  type VerifyOwnerAccessResult,
} from "@workspace/api-base/owner-auth";
import {
  clearTeamOwnerSessionMarkers,
  markTeamOwnerSessionActive,
  type TeamOwnerSessionContext,
} from "./session";

export type OwnerOnboardingEntry = {
  tournamentId: number;
  tournamentName: string;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string | null;
  teamLogoUrl: string | null;
  licenseStatus: string;
  tournamentStatus: string;
  auctionStatus: string | null;
  requiresAccessCode: boolean;
};

const ONBOARDING_ENTRIES_KEY = "bidwar.role.team-owner.onboardingEntries";

export function saveOnboardingEntries(entries: OwnerOnboardingEntry[]) {
  sessionStorage.setItem(ONBOARDING_ENTRIES_KEY, JSON.stringify(entries));
}

export function loadOnboardingEntries(): OwnerOnboardingEntry[] {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_ENTRIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OwnerOnboardingEntry[];
  } catch {
    return [];
  }
}

export function clearOnboardingEntries() {
  sessionStorage.removeItem(ONBOARDING_ENTRIES_KEY);
}

/** POST /api/owner/onboarding/lookup — unchanged backend. */
export async function lookupOwnerTeams(mobile: string): Promise<OwnerOnboardingEntry[]> {
  const res = await fetch("/api/owner/onboarding/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: mobile.trim() }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Lookup failed. Please try again.");
  }

  const data = (await res.json()) as { entries?: OwnerOnboardingEntry[] };
  return data.entries ?? [];
}

export async function verifyAndPersistOwnerAccess(
  entry: OwnerOnboardingEntry,
  code: string,
  mobile?: string,
): Promise<VerifyOwnerAccessResult> {
  const result = await verifyOwnerAccessCode(entry.tournamentId, entry.teamId, code);
  if (result.ok) {
    persistOwnerSession(entry.teamId, code);
    const ctx: TeamOwnerSessionContext = {
      tournamentId: entry.tournamentId,
      teamId: entry.teamId,
      tournamentName: entry.tournamentName,
      teamName: entry.teamName,
      teamShortCode: entry.teamShortCode,
      teamColor: entry.teamColor,
      teamLogoUrl: entry.teamLogoUrl,
      mobile,
    };
    markTeamOwnerSessionActive(ctx);
  }
  return result;
}

/** Establish session for teams that do not require an access code. */
export async function establishOwnerWithoutCode(
  entry: OwnerOnboardingEntry,
  mobile?: string,
): Promise<boolean> {
  const result = await verifyOwnerAccessCode(entry.tournamentId, entry.teamId, "");
  if (!result.ok) return false;
  persistOwnerSession(entry.teamId, "");
  markTeamOwnerSessionActive({
    tournamentId: entry.tournamentId,
    teamId: entry.teamId,
    tournamentName: entry.tournamentName,
    teamName: entry.teamName,
    teamShortCode: entry.teamShortCode,
    teamColor: entry.teamColor,
    teamLogoUrl: entry.teamLogoUrl,
    mobile,
  });
  return true;
}

/** Logs out Team Owner only — does NOT touch Organizer session. */
export async function logoutTeamOwnerSession(
  tournamentId: number,
  teamId: number,
): Promise<void> {
  await logoutOwnerPushAndSession(tournamentId, teamId);
  clearOwnerSession(teamId);
  clearTeamOwnerSessionMarkers();
  clearOnboardingEntries();
}
