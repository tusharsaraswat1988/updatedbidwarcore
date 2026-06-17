import type { teamsTable } from "@workspace/db";

type TeamRow = typeof teamsTable.$inferSelect;

/** Organizer/admin team — full owner and access fields. */
export function privateTeamSerializer(t: TeamRow) {
  return {
    id: t.id,
    tournamentId: t.tournamentId,
    name: t.name,
    shortCode: t.shortCode,
    ownerName: t.ownerName,
    ownerMobile: t.ownerMobile,
    ownerEmail: t.ownerEmail ?? null,
    ownerPhotoUrl: t.ownerPhotoUrl,
    color: t.color,
    logoUrl: t.logoUrl,
    purse: t.purse,
    purseUsed: t.purseUsed,
    isBiddingEnabled: t.isBiddingEnabled,
    accessCode: t.accessCode,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Public display — team identity and purse only; no owner PII or access codes. */
export function publicTeamSerializer(t: TeamRow) {
  return {
    id: t.id,
    tournamentId: t.tournamentId,
    name: t.name,
    shortCode: t.shortCode,
    color: t.color,
    logoUrl: t.logoUrl,
    purse: t.purse,
    purseUsed: t.purseUsed,
    isBiddingEnabled: t.isBiddingEnabled,
    requiresAccessCode: !!t.accessCode,
    createdAt: t.createdAt.toISOString(),
  };
}
