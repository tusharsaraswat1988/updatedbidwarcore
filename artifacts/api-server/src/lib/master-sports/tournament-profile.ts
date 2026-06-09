/**
 * Tournament player profile layer — tournament-specific identity keyed by master player id.
 */

import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  tournamentPlayerProfilesTable,
  globalPlayersTable,
  badmintonPlayersTable,
  type TournamentPlayerProfile,
  type GlobalPlayer,
} from "@workspace/db";
import {
  computeBaseInitials,
  resolveUniqueInitials,
} from "./tournament-initials";

export async function getUsedInitialsInTournamentProfiles(
  tournamentId: number,
  excludeProfileId?: number,
): Promise<Set<string>> {
  const rows = await db
    .select({ id: tournamentPlayerProfilesTable.id, initials: tournamentPlayerProfilesTable.initials })
    .from(tournamentPlayerProfilesTable)
    .where(
      and(
        eq(tournamentPlayerProfilesTable.tournamentId, tournamentId),
        isNotNull(tournamentPlayerProfilesTable.initials),
        excludeProfileId ? ne(tournamentPlayerProfilesTable.id, excludeProfileId) : undefined,
      ),
    );

  return new Set(
    rows
      .map((r) => r.initials.trim().toUpperCase())
      .filter(Boolean),
  );
}

export async function allocateProfileInitials(
  tournamentId: number,
  input: {
    firstName: string;
    lastName: string;
    displayName?: string | null;
    excludeProfileId?: number;
  },
): Promise<string> {
  const base = computeBaseInitials(input.firstName, input.lastName, input.displayName);
  const used = await getUsedInitialsInTournamentProfiles(tournamentId, input.excludeProfileId);
  return resolveUniqueInitials(base, used);
}

export async function getTournamentProfile(
  tournamentId: number,
  masterPlayerId: string,
): Promise<TournamentPlayerProfile | null> {
  const [row] = await db
    .select()
    .from(tournamentPlayerProfilesTable)
    .where(
      and(
        eq(tournamentPlayerProfilesTable.tournamentId, tournamentId),
        eq(tournamentPlayerProfilesTable.masterPlayerId, masterPlayerId),
      ),
    )
    .limit(1);

  return row ?? null;
}

function nameFieldsFromMaster(mp: GlobalPlayer) {
  const firstName = mp.firstName ?? mp.canonicalName.split(" ")[0] ?? "Player";
  const lastName = mp.lastName ?? mp.canonicalName.split(" ").slice(1).join(" ") ?? "";
  const displayName =
    mp.displayName ?? mp.canonicalName ?? [firstName, lastName].filter(Boolean).join(" ");
  return { firstName, lastName, displayName };
}

/** Ensure stable tournament profile + unique initials for a master player. */
export async function ensureTournamentProfile(
  tournamentId: number,
  masterPlayerId: string,
  overrides?: {
    displayName?: string;
    photoOverrideUrl?: string | null;
    category?: string | null;
    seedRank?: number | null;
  },
): Promise<TournamentPlayerProfile> {
  const existing = await getTournamentProfile(tournamentId, masterPlayerId);
  if (existing) {
    const used = await getUsedInitialsInTournamentProfiles(tournamentId, existing.id);
    const normalized = existing.initials.trim().toUpperCase();
    let initials = normalized;
    if (used.has(normalized)) {
      const [mp] = await db
        .select()
        .from(globalPlayersTable)
        .where(eq(globalPlayersTable.id, masterPlayerId))
        .limit(1);
      if (mp) {
        const { firstName, lastName, displayName } = nameFieldsFromMaster(mp);
        initials = await allocateProfileInitials(tournamentId, {
          firstName,
          lastName,
          displayName,
          excludeProfileId: existing.id,
        });
      }
    }

    const patch: Record<string, unknown> = {};
    if (initials !== existing.initials) patch.initials = initials;
    if (overrides?.displayName && overrides.displayName !== existing.displayName) {
      patch.displayName = overrides.displayName;
    }
    if (overrides?.photoOverrideUrl !== undefined) {
      patch.photoOverrideUrl = overrides.photoOverrideUrl;
    }
    if (overrides?.category !== undefined) patch.category = overrides.category;
    if (overrides?.seedRank !== undefined) patch.seedRank = overrides.seedRank;

    if (Object.keys(patch).length > 0) {
      const [updated] = await db
        .update(tournamentPlayerProfilesTable)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(tournamentPlayerProfilesTable.id, existing.id))
        .returning();
      return updated ?? { ...existing, ...patch };
    }

    return existing;
  }

  const [mp] = await db
    .select()
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.id, masterPlayerId))
    .limit(1);

  if (!mp) {
    throw new Error("Master player not found");
  }

  const { firstName, lastName, displayName } = nameFieldsFromMaster(mp);
  const initials = await allocateProfileInitials(tournamentId, {
    firstName,
    lastName,
    displayName: overrides?.displayName ?? displayName,
  });

  const [profile] = await db
    .insert(tournamentPlayerProfilesTable)
    .values({
      tournamentId,
      masterPlayerId,
      displayName: overrides?.displayName ?? displayName,
      initials,
      photoOverrideUrl: overrides?.photoOverrideUrl ?? mp.photoUrl,
      category: overrides?.category ?? null,
      seedRank: overrides?.seedRank ?? null,
    })
    .returning();

  return profile;
}

/** Keep badminton_players.short_name aligned with profile initials (legacy scorer compat). */
export async function syncBadmintonShortNameFromProfile(
  tournamentId: number,
  masterPlayerId: string,
  initials: string,
): Promise<void> {
  await db
    .update(badmintonPlayersTable)
    .set({ shortName: initials, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, tournamentId),
        eq(badmintonPlayersTable.masterPlayerId, masterPlayerId),
      ),
    );
}
