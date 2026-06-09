/**
 * Tournament-specific player initials — stored on tournament_player_profiles.
 * Unique within a tournament; stable once assigned.
 */

import type { BadmintonPlayer } from "@workspace/db";
import {
  allocateProfileInitials,
  ensureTournamentProfile,
  syncBadmintonShortNameFromProfile,
} from "./tournament-profile";

export function computeBaseInitials(
  firstName: string,
  lastName: string,
  displayName?: string | null,
): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (first && last) {
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }

  const label = (displayName ?? `${first} ${last}`).trim();
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (parts.length === 1) {
    const p = parts[0];
    return (p.charAt(0) + (p.charAt(1) ?? p.charAt(0))).toUpperCase();
  }
  return "P";
}

export function resolveUniqueInitials(base: string, used: Set<string>): string {
  const normalizedBase = base.toUpperCase();
  if (!used.has(normalizedBase)) return normalizedBase;

  let n = 2;
  while (used.has(`${normalizedBase}${n}`)) {
    n++;
  }
  return `${normalizedBase}${n}`;
}

/** @deprecated use allocateProfileInitials — kept for tests */
export async function allocateTournamentInitials(
  tournamentId: number,
  input: {
    firstName: string;
    lastName: string;
    displayName?: string | null;
    excludePlayerId?: number;
  },
): Promise<string> {
  return allocateProfileInitials(tournamentId, {
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: input.displayName,
  });
}

/** Return stable tournament initials via profile layer; sync badminton short_name for compat. */
export async function ensureTournamentInitials(player: BadmintonPlayer): Promise<string> {
  if (!player.masterPlayerId) {
    return player.shortName?.trim().toUpperCase() ?? "P";
  }

  const profile = await ensureTournamentProfile(player.tournamentId, player.masterPlayerId, {
    displayName: player.displayName ?? undefined,
    photoOverrideUrl: player.photoUrl,
  });

  if (profile.initials !== player.shortName) {
    await syncBadmintonShortNameFromProfile(
      player.tournamentId,
      player.masterPlayerId,
      profile.initials,
    );
  }

  return profile.initials;
}
