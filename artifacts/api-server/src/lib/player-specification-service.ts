import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import {
  db,
  playerSpecValuesTable,
  roleSpecGroupsTable,
  sportRolesTable,
  sportsTable,
  tournamentsTable,
} from "@workspace/db";

export type PlayerSpecificationInput = {
  specGroupId: number;
  value: string;
};

export type PlayerSpecification = {
  specGroupId: number;
  groupName: string;
  displayOrder: number;
  value: string;
};

export type DbExecutor = Pick<typeof db, "select" | "insert" | "delete" | "update">;

type RoleSpecGroupRow = {
  id: number;
  groupName: string;
  displayOrder: number;
  optional: boolean;
};

function normalizeInputs(specifications: PlayerSpecificationInput[]): PlayerSpecificationInput[] {
  const byGroup = new Map<number, string>();
  for (const spec of specifications) {
    const value = spec.value?.trim();
    if (!value || !Number.isInteger(spec.specGroupId) || spec.specGroupId <= 0) continue;
    byGroup.set(spec.specGroupId, value);
  }
  return [...byGroup.entries()].map(([specGroupId, value]) => ({ specGroupId, value }));
}

async function fetchGroupMeta(
  specGroupIds: number[],
  executor: DbExecutor = db,
): Promise<Map<number, { groupName: string; displayOrder: number }>> {
  if (specGroupIds.length === 0) return new Map();
  const rows = await executor
    .select({
      id: roleSpecGroupsTable.id,
      groupName: roleSpecGroupsTable.groupName,
      displayOrder: roleSpecGroupsTable.displayOrder,
    })
    .from(roleSpecGroupsTable)
    .where(inArray(roleSpecGroupsTable.id, specGroupIds));
  return new Map(rows.map((r) => [r.id, { groupName: r.groupName, displayOrder: r.displayOrder }]));
}

export async function legacyFieldsFromSpecificationInputs(
  specifications: PlayerSpecificationInput[],
): Promise<{
  battingStyle: string | null;
  bowlingStyle: string | null;
  specialization: string | null;
}> {
  const normalized = normalizeInputs(specifications);
  if (normalized.length === 0) {
    return { battingStyle: null, bowlingStyle: null, specialization: null };
  }
  const meta = await fetchGroupMeta(normalized.map((s) => s.specGroupId));
  const asSpecs: PlayerSpecification[] = normalized.map((s) => ({
    specGroupId: s.specGroupId,
    groupName: meta.get(s.specGroupId)?.groupName ?? "Spec",
    displayOrder: meta.get(s.specGroupId)?.displayOrder ?? 0,
    value: s.value,
  }));
  return legacyFieldsFromSpecifications(asSpecs);
}

export class PlayerSpecificationService {
  constructor(private readonly executor: DbExecutor = db) {}

  async getPlayerSpecifications(playerId: number): Promise<PlayerSpecification[]> {
    const rows = await this.executor
      .select({
        specGroupId: playerSpecValuesTable.specGroupId,
        valueText: playerSpecValuesTable.valueText,
        groupName: roleSpecGroupsTable.groupName,
        displayOrder: roleSpecGroupsTable.displayOrder,
      })
      .from(playerSpecValuesTable)
      .innerJoin(roleSpecGroupsTable, eq(playerSpecValuesTable.specGroupId, roleSpecGroupsTable.id))
      .where(eq(playerSpecValuesTable.playerId, playerId))
      .orderBy(asc(roleSpecGroupsTable.displayOrder), asc(playerSpecValuesTable.specGroupId));

    return rows.map((row) => ({
      specGroupId: row.specGroupId,
      groupName: row.groupName,
      displayOrder: row.displayOrder,
      value: row.valueText,
    }));
  }

  async getSpecificationsForPlayers(playerIds: number[]): Promise<Map<number, PlayerSpecification[]>> {
    const result = new Map<number, PlayerSpecification[]>();
    if (playerIds.length === 0) return result;

    const rows = await this.executor
      .select({
        playerId: playerSpecValuesTable.playerId,
        specGroupId: playerSpecValuesTable.specGroupId,
        valueText: playerSpecValuesTable.valueText,
        groupName: roleSpecGroupsTable.groupName,
        displayOrder: roleSpecGroupsTable.displayOrder,
      })
      .from(playerSpecValuesTable)
      .innerJoin(roleSpecGroupsTable, eq(playerSpecValuesTable.specGroupId, roleSpecGroupsTable.id))
      .where(inArray(playerSpecValuesTable.playerId, playerIds))
      .orderBy(asc(playerSpecValuesTable.playerId), asc(roleSpecGroupsTable.displayOrder));

    for (const row of rows) {
      const list = result.get(row.playerId) ?? [];
      list.push({
        specGroupId: row.specGroupId,
        groupName: row.groupName,
        displayOrder: row.displayOrder,
        value: row.valueText,
      });
      result.set(row.playerId, list);
    }
    return result;
  }

  async savePlayerSpecifications(
    playerId: number,
    specifications: PlayerSpecificationInput[],
  ): Promise<void> {
    await this.replacePlayerSpecifications(playerId, specifications);
  }

  async updatePlayerSpecifications(
    playerId: number,
    specifications: PlayerSpecificationInput[],
  ): Promise<void> {
    await this.replacePlayerSpecifications(playerId, specifications);
  }

  async deletePlayerSpecifications(playerId: number): Promise<void> {
    await this.executor
      .delete(playerSpecValuesTable)
      .where(eq(playerSpecValuesTable.playerId, playerId));
  }

  private async replacePlayerSpecifications(
    playerId: number,
    specifications: PlayerSpecificationInput[],
  ): Promise<void> {
    const normalized = normalizeInputs(specifications);
    const specGroupIds = normalized.map((s) => s.specGroupId);

    await db.transaction(async (tx) => {
      if (normalized.length === 0) {
        await tx.delete(playerSpecValuesTable).where(eq(playerSpecValuesTable.playerId, playerId));
        return;
      }

      await tx
        .delete(playerSpecValuesTable)
        .where(
          and(
            eq(playerSpecValuesTable.playerId, playerId),
            notInArray(playerSpecValuesTable.specGroupId, specGroupIds),
          ),
        );

      for (const spec of normalized) {
        await tx
          .insert(playerSpecValuesTable)
          .values({
            playerId,
            specGroupId: spec.specGroupId,
            valueText: spec.value,
          })
          .onConflictDoUpdate({
            target: [playerSpecValuesTable.playerId, playerSpecValuesTable.specGroupId],
            set: { valueText: spec.value, updatedAt: new Date() },
          });
      }
    });
  }
}

export const playerSpecificationService = new PlayerSpecificationService();

export async function resolveRoleSpecGroups(
  tournamentId: number,
  role: string | null | undefined,
  executor: DbExecutor = db,
): Promise<RoleSpecGroupRow[]> {
  if (!role?.trim()) return [];

  const [tournament] = await executor
    .select({ sport: tournamentsTable.sport })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament?.sport) return [];

  const slug = tournament.sport.trim().toLowerCase();
  const [sport] = await executor
    .select({ id: sportsTable.id })
    .from(sportsTable)
    .where(and(eq(sportsTable.slug, slug), eq(sportsTable.active, true)))
    .limit(1);
  if (!sport) return [];

  const roles = await executor
    .select({ id: sportRolesTable.id, roleName: sportRolesTable.roleName })
    .from(sportRolesTable)
    .where(and(eq(sportRolesTable.sportId, sport.id), eq(sportRolesTable.active, true)));

  const normalizedRole = role.trim().toLowerCase();
  const matched = roles.find((r) => r.roleName.toLowerCase().trim() === normalizedRole);
  if (!matched) return [];

  return loadGroupsForRole(matched.id, executor);
}

async function loadGroupsForRole(roleId: number, executor: DbExecutor): Promise<RoleSpecGroupRow[]> {
  return executor
    .select({
      id: roleSpecGroupsTable.id,
      groupName: roleSpecGroupsTable.groupName,
      displayOrder: roleSpecGroupsTable.displayOrder,
      optional: roleSpecGroupsTable.optional,
    })
    .from(roleSpecGroupsTable)
    .where(and(eq(roleSpecGroupsTable.roleId, roleId), eq(roleSpecGroupsTable.active, true)))
    .orderBy(asc(roleSpecGroupsTable.displayOrder));
}

export function legacyFieldsFromSpecifications(
  specifications: PlayerSpecification[],
): {
  battingStyle: string | null;
  bowlingStyle: string | null;
  specialization: string | null;
} {
  const sorted = [...specifications].sort((a, b) => a.displayOrder - b.displayOrder);
  return {
    battingStyle: sorted[0]?.value ?? null,
    bowlingStyle: sorted[1]?.value ?? null,
    specialization: sorted[2]?.value ?? null,
  };
}

export function specificationsFromLegacyFields(
  groups: RoleSpecGroupRow[],
  legacy: {
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    specialization?: string | null;
  },
): PlayerSpecificationInput[] {
  const legacyValues = [legacy.battingStyle, legacy.bowlingStyle, legacy.specialization];
  const sortedGroups = [...groups].sort((a, b) => a.displayOrder - b.displayOrder);
  const specs: PlayerSpecificationInput[] = [];
  for (let i = 0; i < sortedGroups.length; i++) {
    const value = legacyValues[i]?.trim();
    if (!value) continue;
    specs.push({ specGroupId: sortedGroups[i]!.id, value });
  }
  return specs;
}

export async function buildSpecificationsForSave(
  tournamentId: number,
  role: string | null | undefined,
  input: {
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    specialization?: string | null;
    specifications?: PlayerSpecificationInput[] | null;
  },
): Promise<PlayerSpecificationInput[]> {
  if (input.specifications?.length) {
    return normalizeInputs(input.specifications);
  }
  const groups = await resolveRoleSpecGroups(tournamentId, role);
  return specificationsFromLegacyFields(groups, input);
}

export async function validateRequiredRoleSpecifications(
  tournamentId: number,
  role: string | null | undefined,
  input: {
    specifications?: PlayerSpecificationInput[] | null;
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    specialization?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const groups = await resolveRoleSpecGroups(tournamentId, role);
  const requiredGroups = groups.filter((group) => !group.optional);
  if (requiredGroups.length === 0) return { ok: true };

  const resolvedSpecs = input.specifications?.length
    ? normalizeInputs(input.specifications)
    : specificationsFromLegacyFields(groups, input);

  for (const group of requiredGroups) {
    const value = resolvedSpecs.find((spec) => spec.specGroupId === group.id)?.value?.trim();
    if (!value) {
      return { ok: false, error: `${group.groupName} is required.` };
    }
  }

  return { ok: true };
}

export function mergePlayerLegacyFieldsFromSpecifications<
  T extends {
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    specialization?: string | null;
  },
>(player: T, specifications: PlayerSpecification[]): T {
  if (specifications.length === 0) return player;
  const legacy = legacyFieldsFromSpecifications(specifications);
  return {
    ...player,
    battingStyle: legacy.battingStyle ?? player.battingStyle ?? null,
    bowlingStyle: legacy.bowlingStyle ?? player.bowlingStyle ?? null,
    specialization: legacy.specialization ?? player.specialization ?? null,
  };
}

export async function copyPlayerSpecifications(
  sourcePlayerId: number,
  targetPlayerId: number,
): Promise<void> {
  const specs = await playerSpecificationService.getPlayerSpecifications(sourcePlayerId);
  if (specs.length === 0) return;
  await playerSpecificationService.savePlayerSpecifications(
    targetPlayerId,
    specs.map((s) => ({ specGroupId: s.specGroupId, value: s.value })),
  );
}
