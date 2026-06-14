import type { tournamentsTable } from "@workspace/db";
import type { teamsTable } from "@workspace/db";
import type { playersTable } from "@workspace/db";
import type { categoriesTable } from "@workspace/db";
import type { organizersTable } from "@workspace/db";

type Tournament = typeof tournamentsTable.$inferSelect;
type Team = typeof teamsTable.$inferSelect;
type Player = typeof playersTable.$inferSelect;
type Category = typeof categoriesTable.$inferSelect;
type Organizer = typeof organizersTable.$inferSelect;

const SENSITIVE_TOURNAMENT_KEYS = new Set(["organizerPassword", "exportToken"]);

export function snapshotTournament(t: Tournament): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t)) {
    if (SENSITIVE_TOURNAMENT_KEYS.has(k)) {
      out[k] = v ? "[redacted]" : null;
      continue;
    }
    if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

export function snapshotTeam(t: Team): Record<string, unknown> {
  return {
    id: t.id,
    tournamentId: t.tournamentId,
    name: t.name,
    shortCode: t.shortCode,
    ownerName: t.ownerName,
    ownerMobile: t.ownerMobile,
    ownerEmail: t.ownerEmail,
    purse: t.purse,
    purseUsed: t.purseUsed,
    isBiddingEnabled: t.isBiddingEnabled,
    accessCode: t.accessCode ? "[redacted]" : null,
    color: t.color,
    logoUrl: t.logoUrl,
  };
}

export function snapshotPlayer(p: Player): Record<string, unknown> {
  return {
    id: p.id,
    tournamentId: p.tournamentId,
    name: p.name,
    role: p.role,
    status: p.status,
    teamId: p.teamId,
    categoryId: p.categoryId,
    gender: p.gender,
    basePrice: p.basePrice,
    soldPrice: p.soldPrice,
    retainedPrice: p.retainedPrice,
    mobileNumber: p.mobileNumber,
    email: p.email,
    playerTag: p.playerTag,
    isNonPlayingMember: p.isNonPlayingMember,
  };
}

export function snapshotCategory(c: Category): Record<string, unknown> {
  return {
    id: c.id,
    tournamentId: c.tournamentId,
    name: c.name,
    minBid: c.minBid,
    bidTiers: c.bidTiers,
    maxPlayers: c.maxPlayers,
    colorCode: c.colorCode,
    sortOrder: c.sortOrder,
  };
}

export function snapshotOrganizer(o: Organizer): Record<string, unknown> {
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    mobile: o.mobile,
    licenseStatus: o.licenseStatus,
    maxTournaments: o.maxTournaments,
    hasPassword: !!o.passwordHash,
  };
}

export function computeFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Array<{ field: string; old: unknown; new: unknown }> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: Array<{ field: string; old: unknown; new: unknown }> = [];
  for (const field of keys) {
    const oldVal = before[field];
    const newVal = after[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field, old: oldVal ?? null, new: newVal ?? null });
    }
  }
  return changes;
}
