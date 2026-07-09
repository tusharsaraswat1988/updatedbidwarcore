/**
 * After registration closes, existing players may still update photo + role/specs
 * while the tournament is in setup. Other profile fields stay organizer-only.
 */

export function profileUpdatesAllowedForTournamentStatus(
  tournamentStatus: string | null | undefined,
): boolean {
  return (tournamentStatus ?? "setup") === "setup";
}

export type ClosedRegistrationUpdateInput = {
  role?: string | null;
  photoUrl?: string | null;
  photoPublicId?: string | null;
};

export type LegacySpecFields = {
  battingStyle: string | null;
  bowlingStyle: string | null;
  specialization: string | null;
};

/** Whitelist for public self-update when registration is closed. */
export function buildClosedPublicRegistrationProfileUpdates(
  input: ClosedRegistrationUpdateInput,
  legacySpecFields: LegacySpecFields,
): {
  role: string | null;
  photoUrl: string | null;
  photoPublicId: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  specialization: string | null;
} {
  return {
    role: input.role ?? null,
    photoUrl: input.photoUrl ?? null,
    photoPublicId: input.photoPublicId ?? null,
    battingStyle: legacySpecFields.battingStyle,
    bowlingStyle: legacySpecFields.bowlingStyle,
    specialization: legacySpecFields.specialization,
  };
}
