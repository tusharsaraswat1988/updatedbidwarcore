/**
 * Tournament-specific player initials (badminton_players.short_name).
 * Unique within a tournament; stable once assigned.
 */

import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { badmintonPlayersTable, type BadmintonPlayer } from "@workspace/db";

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

export async function getUsedInitialsInTournament(
  tournamentId: number,
  excludePlayerId?: number,
): Promise<Set<string>> {
  const rows = await db
    .select({ id: badmintonPlayersTable.id, shortName: badmintonPlayersTable.shortName })
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, tournamentId),
        isNotNull(badmintonPlayersTable.shortName),
        excludePlayerId ? ne(badmintonPlayersTable.id, excludePlayerId) : undefined,
      ),
    );

  return new Set(
    rows
      .map((r) => r.shortName?.trim().toUpperCase())
      .filter((s): s is string => Boolean(s)),
  );
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

export async function allocateTournamentInitials(
  tournamentId: number,
  input: {
    firstName: string;
    lastName: string;
    displayName?: string | null;
    excludePlayerId?: number;
  },
): Promise<string> {
  const base = computeBaseInitials(input.firstName, input.lastName, input.displayName);
  const used = await getUsedInitialsInTournament(tournamentId, input.excludePlayerId);
  return resolveUniqueInitials(base, used);
}

/** Return stable tournament initials; assign or fix collisions if needed. */
export async function ensureTournamentInitials(player: BadmintonPlayer): Promise<string> {
  const existing = player.shortName?.trim();
  if (existing) {
    const used = await getUsedInitialsInTournament(player.tournamentId, player.id);
    const normalized = existing.toUpperCase();
    if (!used.has(normalized)) return normalized;
  }

  const initials = await allocateTournamentInitials(player.tournamentId, {
    firstName: player.firstName,
    lastName: player.lastName,
    displayName: player.displayName,
    excludePlayerId: player.id,
  });

  if (initials !== player.shortName) {
    await db
      .update(badmintonPlayersTable)
      .set({ shortName: initials, updatedAt: new Date() })
      .where(eq(badmintonPlayersTable.id, player.id));
  }

  return initials;
}
