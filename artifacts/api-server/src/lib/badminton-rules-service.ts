/**
 * Universal Rules-Driven Tournament Engine — Rules Service
 *
 * Manages tournament rules profiles (BWF Official, Corporate, Recreational, Custom),
 * profile resolution, lifecycle snapshotting, and category rules bindings.
 */

import { and, eq, or, isNull, desc } from "drizzle-orm";
import {
  db,
  badmintonCategoriesTable,
  badmintonRulesProfilesTable,
  type BadmintonCategory,
  type BadmintonRulesProfileRow,
} from "@workspace/db";
import {
  type BadmintonRulesProfile,
  validateRulesProfile,
  BUILT_IN_RULES_PROFILES,
  BWF_OFFICIAL_INDIVIDUAL_PROFILE,
  BWF_OFFICIAL_TEAM_PROFILE,
  CORPORATE_GROUP_KNOCKOUT_PROFILE,
  CORPORATE_KNOCKOUT_PROFILE,
  CORPORATE_ROUND_ROBIN_PROFILE,
  CORPORATE_TEAM_LEAGUE_PROFILE,
  RECREATIONAL_FAST_PROFILE,
} from "@workspace/badminton-core";

function serializeProfileRow(row: BadmintonRulesProfileRow): BadmintonRulesProfile {
  const cfg = (row.configJson || {}) as Partial<BadmintonRulesProfile>;
  return {
    ...BWF_OFFICIAL_INDIVIDUAL_PROFILE,
    ...cfg,
    id: String(row.id),
    name: row.name,
    description: row.description ?? "",
    profileType: (row.profileType || "custom") as BadmintonRulesProfile["profileType"],
    schemaVersion: row.schemaVersion,
    profileVersion: row.profileVersion,
    rulesSource: row.rulesSource ?? "Organizer Defined",
    rulesSourceEffectiveDate: row.rulesSourceEffectiveDate ?? "",
    isOfficialBwf: row.isOfficialBwf,
    scoring: cfg.scoring ?? BWF_OFFICIAL_INDIVIDUAL_PROFILE.scoring,
    draw: cfg.draw ?? BWF_OFFICIAL_INDIVIDUAL_PROFILE.draw,
    standings: cfg.standings ?? BWF_OFFICIAL_INDIVIDUAL_PROFILE.standings,
    discipline: cfg.discipline ?? BWF_OFFICIAL_INDIVIDUAL_PROFILE.discipline,
    eligibility: cfg.eligibility ?? BWF_OFFICIAL_INDIVIDUAL_PROFILE.eligibility,
    allowedEventTypes: cfg.allowedEventTypes ?? ["singles", "doubles"],
    participantType: cfg.participantType ?? "individual",
    teamTieRubbers: cfg.teamTieRubbers,
    metadata: {
      ...(cfg.metadata || {}),
      dbId: row.id,
      tournamentId: row.tournamentId,
      profileKey: row.profileKey,
      isTemplate: row.isTemplate,
      isLocked: row.isLocked,
    },
  };
}

/**
 * List all available rules profiles for a tournament:
 * Includes built-in official/corporate templates and custom profiles created for this tournament.
 */
export async function listAvailableProfiles(
  tournamentId?: number,
): Promise<BadmintonRulesProfile[]> {
  const builtinProfiles = BUILT_IN_RULES_PROFILES;

  let customRows: BadmintonRulesProfileRow[] = [];
  try {
    if (tournamentId) {
      customRows = await db
        .select()
        .from(badmintonRulesProfilesTable)
        .where(
          or(
            eq(badmintonRulesProfilesTable.tournamentId, tournamentId),
            isNull(badmintonRulesProfilesTable.tournamentId),
          ),
        )
        .orderBy(desc(badmintonRulesProfilesTable.createdAt));
    } else {
      customRows = await db
        .select()
        .from(badmintonRulesProfilesTable)
        .where(isNull(badmintonRulesProfilesTable.tournamentId))
        .orderBy(desc(badmintonRulesProfilesTable.createdAt));
    }
  } catch (err) {
    console.warn("Could not query badminton_rules_profiles table; using built-ins", err);
  }

  const customProfiles = customRows.map(serializeProfileRow);
  const profileMap = new Map<string, BadmintonRulesProfile>();
  for (const p of builtinProfiles) {
    profileMap.set(p.id, p);
  }
  for (const cp of customProfiles) {
    profileMap.set(cp.id, cp);
  }

  return Array.from(profileMap.values());
}

/**
 * Resolve a rules profile by its ID (database serial) or profileKey string.
 */
export async function getRulesProfileByIdOrKey(
  identifier: string | number,
  tournamentId?: number,
): Promise<BadmintonRulesProfile | null> {
  const isNumeric =
    typeof identifier === "number" ||
    (typeof identifier === "string" && /^\d+$/.test(identifier.trim()));

  if (isNumeric) {
    const numId = typeof identifier === "number" ? identifier : Number.parseInt(identifier.trim(), 10);
    try {
      const [row] = await db
        .select()
        .from(badmintonRulesProfilesTable)
        .where(eq(badmintonRulesProfilesTable.id, numId))
        .limit(1);
      if (row) return serializeProfileRow(row);
    } catch {
      // Fall through to key lookup
    }
  }

  const key = String(identifier).trim();
  const builtin = BUILT_IN_RULES_PROFILES.find((p) => p.id === key);
  if (builtin) return builtin;

  try {
    const conditions = [eq(badmintonRulesProfilesTable.profileKey, key)];
    if (tournamentId) {
      conditions.push(
        or(
          eq(badmintonRulesProfilesTable.tournamentId, tournamentId),
          isNull(badmintonRulesProfilesTable.tournamentId),
        )!,
      );
    }
    const [row] = await db
      .select()
      .from(badmintonRulesProfilesTable)
      .where(and(...conditions))
      .orderBy(desc(badmintonRulesProfilesTable.createdAt))
      .limit(1);

    if (row) return serializeProfileRow(row);
  } catch {
    // ignore
  }

  return null;
}

/**
 * Resolve the authoritative rules profile for a category.
 * Precedence:
 * 1. Category rulesSnapshotJson (immutable frozen snapshot for in-progress or completed category)
 * 2. Category rulesProfileId lookup (if linked to a specific profile)
 * 3. Default built-in profile derived from category drawType and matchType
 */
export async function resolveCategoryRules(
  tournamentId: number,
  categoryId: number,
): Promise<BadmintonRulesProfile> {
  const [category] = await db
    .select()
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!category) {
    return BWF_OFFICIAL_INDIVIDUAL_PROFILE;
  }

  // 1. Frozen snapshot takes absolute precedence
  if (category.rulesSnapshotJson) {
    const parsed = validateRulesProfile(category.rulesSnapshotJson);
    if (parsed.success && parsed.data) {
      return parsed.data;
    }
  }

  // 2. Explicit rulesProfileId
  if (category.rulesProfileId != null) {
    const profile = await getRulesProfileByIdOrKey(category.rulesProfileId, tournamentId);
    if (profile) return profile;
  }

  // 3. Fallback based on drawType
  switch (category.drawType) {
    case "group_knockout":
      return CORPORATE_GROUP_KNOCKOUT_PROFILE;
    case "round_robin":
      return CORPORATE_ROUND_ROBIN_PROFILE;
    case "knockout":
    default:
      return CORPORATE_KNOCKOUT_PROFILE;
  }
}

/**
 * Create a new custom rules profile for a tournament.
 */
export async function createTournamentProfile(
  tournamentId: number,
  input: unknown,
): Promise<BadmintonRulesProfile> {
  const validation = validateRulesProfile(input);
  if (!validation.success || !validation.data) {
    throw new Error(`Invalid rules profile: ${validation.errors?.join("; ") || "Schema validation failed"}`);
  }

  const profile = validation.data;
  const [inserted] = await db
    .insert(badmintonRulesProfilesTable)
    .values({
      tournamentId,
      profileKey: profile.id,
      name: profile.name,
      description: profile.description || null,
      profileType: profile.profileType,
      schemaVersion: profile.schemaVersion,
      profileVersion: profile.profileVersion,
      rulesSource: profile.rulesSource || null,
      rulesSourceEffectiveDate: profile.rulesSourceEffectiveDate || null,
      isOfficialBwf: profile.isOfficialBwf ?? false,
      isTemplate: false,
      isLocked: false,
      configJson: profile as unknown as Record<string, unknown>,
    })
    .returning();

  return serializeProfileRow(inserted);
}

/**
 * Clone an existing rules profile (template or tournament) to make customized adjustments.
 */
export async function cloneProfileForTournament(
  tournamentId: number,
  sourceKeyOrId: string | number,
  overrides?: {
    name?: string;
    description?: string;
    profileKey?: string;
  },
): Promise<BadmintonRulesProfile> {
  const source = await getRulesProfileByIdOrKey(sourceKeyOrId, tournamentId);
  if (!source) {
    throw new Error(`Source profile '${sourceKeyOrId}' not found.`);
  }

  const newKey =
    overrides?.profileKey ||
    `${source.id}_custom_${Date.now()}`;
  const newName = overrides?.name || `${source.name} (Custom)`;
  const newDescription = overrides?.description || source.description;

  const clonedConfig: BadmintonRulesProfile = {
    ...source,
    id: newKey,
    name: newName,
    description: newDescription,
    profileType: "custom",
    isOfficialBwf: false,
  };

  return createTournamentProfile(tournamentId, clonedConfig);
}

/**
 * Attach a rules profile to a tournament category.
 * Optionally snapshots the rules immediately to freeze them.
 */
export async function attachRulesProfileToCategory(
  tournamentId: number,
  categoryId: number,
  profileKeyOrId: string | number,
  snapshotNow: boolean = false,
): Promise<{ category: BadmintonCategory; profile: BadmintonRulesProfile }> {
  const profile = await getRulesProfileByIdOrKey(profileKeyOrId, tournamentId);
  if (!profile) {
    throw new Error(`Rules profile '${profileKeyOrId}' not found.`);
  }

  const matchFormatJson = {
    totalGames: profile.scoring.totalGames,
    pointsPerGame: profile.scoring.pointsPerGame,
    deuceAt: profile.scoring.deuceAt ?? 0,
    maxPoints: profile.scoring.maxPoints,
    midGameSideChange: profile.scoring.midGameSideChange,
  };

  const numProfileId = typeof profile.metadata?.dbId === "number" ? (profile.metadata.dbId as number) : null;
  const updateValues: Partial<BadmintonCategory> = {
    rulesProfileId: numProfileId,
    matchFormatJson,
    updatedAt: new Date(),
  };

  if (snapshotNow) {
    updateValues.rulesSnapshotJson = profile as unknown as Record<string, unknown>;
  }

  const [updated] = await db
    .update(badmintonCategoriesTable)
    .set(updateValues)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error(`Category ${categoryId} in tournament ${tournamentId} not found.`);
  }

  return { category: updated, profile };
}

/**
 * Freeze and snapshot the active rules profile for a category.
 * Used when a category starts its draw or publishes official results.
 */
export async function snapshotCategoryRules(
  tournamentId: number,
  categoryId: number,
): Promise<BadmintonRulesProfile> {
  const profile = await resolveCategoryRules(tournamentId, categoryId);

  await db
    .update(badmintonCategoriesTable)
    .set({
      rulesSnapshotJson: profile as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    );

  return profile;
}
