import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { workbookMappingProfilesTable } from "@workspace/db";
import type { WorkbookMappingProfile, MappingProfileField } from "@workspace/api-base/tournament-workbook";

export async function listMappingProfiles(opts: {
  tournamentId?: number;
  organizerId?: number;
}): Promise<WorkbookMappingProfile[]> {
  const conditions = [];
  if (opts.tournamentId) conditions.push(eq(workbookMappingProfilesTable.tournamentId, opts.tournamentId));
  if (opts.organizerId) conditions.push(eq(workbookMappingProfilesTable.organizerId, opts.organizerId));

  const rows = conditions.length > 0
    ? await db.select().from(workbookMappingProfilesTable).where(and(...conditions)).orderBy(desc(workbookMappingProfilesTable.lastUsedAt))
    : await db.select().from(workbookMappingProfilesTable).orderBy(desc(workbookMappingProfilesTable.lastUsedAt));

  return rows.map(rowToProfile);
}

export async function getMappingProfile(id: number): Promise<WorkbookMappingProfile | null> {
  const [row] = await db.select().from(workbookMappingProfilesTable).where(eq(workbookMappingProfilesTable.id, id)).limit(1);
  return row ? rowToProfile(row) : null;
}

export async function saveMappingProfile(
  profile: Omit<WorkbookMappingProfile, "id" | "createdAt" | "lastUsedAt" | "useCount">,
): Promise<WorkbookMappingProfile> {
  const [row] = await db.insert(workbookMappingProfilesTable).values({
    name: profile.name,
    organizerId: profile.organizerId ?? null,
    tournamentId: profile.tournamentId ?? null,
    sourceLabel: profile.sourceLabel ?? null,
    sport: profile.sport ?? null,
    fieldsJson: profile.fields,
    createdBy: profile.createdBy ?? "system",
  }).returning();
  return rowToProfile(row!);
}

export async function updateMappingProfile(
  id: number,
  updates: Partial<Pick<WorkbookMappingProfile, "name" | "fields" | "sourceLabel" | "sport">>,
): Promise<WorkbookMappingProfile | null> {
  const [row] = await db.update(workbookMappingProfilesTable).set({
    ...(updates.name != null ? { name: updates.name } : {}),
    ...(updates.fields != null ? { fieldsJson: updates.fields } : {}),
    ...(updates.sourceLabel != null ? { sourceLabel: updates.sourceLabel } : {}),
    ...(updates.sport != null ? { sport: updates.sport } : {}),
  }).where(eq(workbookMappingProfilesTable.id, id)).returning();
  return row ? rowToProfile(row) : null;
}

export async function deleteMappingProfile(id: number): Promise<boolean> {
  const result = await db.delete(workbookMappingProfilesTable).where(eq(workbookMappingProfilesTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function recordMappingProfileUse(id: number): Promise<void> {
  const [existing] = await db.select().from(workbookMappingProfilesTable).where(eq(workbookMappingProfilesTable.id, id)).limit(1);
  if (!existing) return;
  await db.update(workbookMappingProfilesTable).set({
    lastUsedAt: new Date(),
    useCount: (existing.useCount ?? 0) + 1,
  }).where(eq(workbookMappingProfilesTable.id, id));
}

function rowToProfile(row: typeof workbookMappingProfilesTable.$inferSelect): WorkbookMappingProfile {
  return {
    id: row.id,
    name: row.name,
    organizerId: row.organizerId,
    tournamentId: row.tournamentId,
    sourceLabel: row.sourceLabel ?? undefined,
    sport: row.sport ?? undefined,
    fields: (row.fieldsJson ?? []) as MappingProfileField[],
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString(),
    useCount: row.useCount ?? 0,
  };
}
