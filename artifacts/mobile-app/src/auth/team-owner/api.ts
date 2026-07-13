/**
 * Team Owner auth API wrappers — reuses shared onboarding + verify-access APIs.
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
  type OwnerOnboardingEntry,
  type OwnerDeepLink,
  parseOwnerDeepLink,
  saveOnboardingEntries,
  loadOnboardingEntries,
  clearOnboardingEntries,
  lookupOwnerTeams,
  resolveAfterMobileLookup,
} from "@workspace/api-base/owner-onboarding";
import {
  clearTeamOwnerSessionMarkers,
  markTeamOwnerSessionActive,
  type TeamOwnerSessionContext,
} from "./session";

export type { OwnerOnboardingEntry, OwnerDeepLink };

export {
  parseOwnerDeepLink,
  saveOnboardingEntries,
  loadOnboardingEntries,
  clearOnboardingEntries,
  lookupOwnerTeams,
  resolveAfterMobileLookup,
};

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
