import { and, eq, count } from "drizzle-orm";
import {
  db,
  cricketRulePresetsTable,
  scoringMatchesTable,
  scoringFixturesTable,
  tournamentsTable,
  type CricketRulePreset,
} from "@workspace/db";

export type CreateCricketRulePresetInput = {
  name: string;
  description?: string | null;
  variantId?: string;
  ruleProfileId?: string;
  ruleProfileVersion?: string;
  ruleOverridesJson?: Record<string, unknown> | null;
  squadRulesJson?: Record<string, unknown> | null;
  isDefault?: boolean;
};

export type UpdateCricketRulePresetInput = {
  name?: string;
  description?: string | null;
  variantId?: string;
  ruleProfileId?: string;
  ruleProfileVersion?: string;
  ruleOverridesJson?: Record<string, unknown> | null;
  squadRulesJson?: Record<string, unknown> | null;
  isDefault?: boolean;
};

/**
 * Ensures at least one default Rule Preset exists for a tournament.
 * If none exist, seeds one from the tournament's existing rule settings.
 */
export async function ensureDefaultCricketRulePreset(
  tournamentId: number,
): Promise<CricketRulePreset> {
  const existing = await db
    .select()
    .from(cricketRulePresetsTable)
    .where(eq(cricketRulePresetsTable.tournamentId, tournamentId))
    .orderBy(cricketRulePresetsTable.id);

  if (existing.length > 0) {
    const defaultPreset = existing.find((p) => p.isDefault) || existing[0];
    return defaultPreset;
  }

  // Auto-seed default preset from tournament configuration
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const variantId = tournament?.variantId || "cricket.box";
  const ruleProfileId = tournament?.ruleProfileId || "cricket.box.corporate_standard";
  const ruleProfileVersion = tournament?.ruleProfileVersion || "1.0.0";
  const ruleOverridesJson = (tournament?.ruleOverridesJson as Record<string, unknown> | null) || null;
  const squadRulesJson = (tournament?.squadRulesJson as Record<string, unknown> | null) || null;

  const [seeded] = await db
    .insert(cricketRulePresetsTable)
    .values({
      tournamentId,
      name: "Default Match Rules",
      description: "Standard rules for tournament matches",
      variantId,
      ruleProfileId,
      ruleProfileVersion,
      ruleOverridesJson,
      squadRulesJson,
      isDefault: true,
    })
    .returning();

  return seeded;
}

/**
 * Lists all Rule Presets for a tournament.
 */
export async function listCricketRulePresets(
  tournamentId: number,
): Promise<CricketRulePreset[]> {
  await ensureDefaultCricketRulePreset(tournamentId);

  return db
    .select()
    .from(cricketRulePresetsTable)
    .where(eq(cricketRulePresetsTable.tournamentId, tournamentId))
    .orderBy(cricketRulePresetsTable.id);
}

/**
 * Gets a specific Rule Preset by ID and verifies tournament ownership (tenant isolation).
 */
export async function getCricketRulePreset(
  tournamentId: number,
  presetId: number,
): Promise<CricketRulePreset | null> {
  const [preset] = await db
    .select()
    .from(cricketRulePresetsTable)
    .where(
      and(
        eq(cricketRulePresetsTable.id, presetId),
        eq(cricketRulePresetsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  return preset || null;
}

/**
 * Creates a new Rule Preset for a tournament.
 */
export async function createCricketRulePreset(
  tournamentId: number,
  input: CreateCricketRulePresetInput,
): Promise<CricketRulePreset> {
  const name = (input.name || "").trim();
  if (!name) {
    throw new Error("Rule preset name is required");
  }

  if (input.isDefault) {
    // Unset isDefault for existing presets in this tournament
    await db
      .update(cricketRulePresetsTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(cricketRulePresetsTable.tournamentId, tournamentId));
  }

  const [created] = await db
    .insert(cricketRulePresetsTable)
    .values({
      tournamentId,
      name,
      description: input.description ?? null,
      variantId: input.variantId || "cricket.box",
      ruleProfileId: input.ruleProfileId || "cricket.box.corporate_standard",
      ruleProfileVersion: input.ruleProfileVersion || "1.0.0",
      ruleOverridesJson: input.ruleOverridesJson ?? null,
      squadRulesJson: input.squadRulesJson ?? null,
      isDefault: Boolean(input.isDefault),
    })
    .returning();

  return created;
}

/**
 * Updates an existing Rule Preset.
 */
export async function updateCricketRulePreset(
  tournamentId: number,
  presetId: number,
  patch: UpdateCricketRulePresetInput,
): Promise<CricketRulePreset> {
  const existing = await getCricketRulePreset(tournamentId, presetId);
  if (!existing) {
    throw new Error("Rule preset not found");
  }

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("Rule preset name cannot be empty");
  }

  if (patch.isDefault) {
    await db
      .update(cricketRulePresetsTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(cricketRulePresetsTable.tournamentId, tournamentId));
  }

  const [updated] = await db
    .update(cricketRulePresetsTable)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.variantId !== undefined ? { variantId: patch.variantId } : {}),
      ...(patch.ruleProfileId !== undefined ? { ruleProfileId: patch.ruleProfileId } : {}),
      ...(patch.ruleProfileVersion !== undefined ? { ruleProfileVersion: patch.ruleProfileVersion } : {}),
      ...(patch.ruleOverridesJson !== undefined ? { ruleOverridesJson: patch.ruleOverridesJson } : {}),
      ...(patch.squadRulesJson !== undefined ? { squadRulesJson: patch.squadRulesJson } : {}),
      ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cricketRulePresetsTable.id, presetId),
        eq(cricketRulePresetsTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  return updated;
}

/**
 * Deletes a Rule Preset.
 * Rejects deletion with 409 if referenced by any matches or fixtures.
 */
export async function deleteCricketRulePreset(
  tournamentId: number,
  presetId: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const existing = await getCricketRulePreset(tournamentId, presetId);
  if (!existing) {
    return { ok: false, status: 404, error: "Rule preset not found" };
  }

  // Check if any matches reference this preset
  const [matchRefCount] = await db
    .select({ val: count() })
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.rulePresetId, presetId),
      ),
    );

  if (matchRefCount && matchRefCount.val > 0) {
    return {
      ok: false,
      status: 409,
      error: `Cannot delete Rule Preset "${existing.name}" because it is currently assigned to ${matchRefCount.val} match(es).`,
    };
  }

  // Check if any fixtures reference this preset
  const [fixtureRefCount] = await db
    .select({ val: count() })
    .from(scoringFixturesTable)
    .where(
      and(
        eq(scoringFixturesTable.tournamentId, tournamentId),
        eq(scoringFixturesTable.rulePresetId, presetId),
      ),
    );

  if (fixtureRefCount && fixtureRefCount.val > 0) {
    return {
      ok: false,
      status: 409,
      error: `Cannot delete Rule Preset "${existing.name}" because it is currently assigned to ${fixtureRefCount.val} fixture(s).`,
    };
  }

  // Check count of total presets
  const presets = await db
    .select({ id: cricketRulePresetsTable.id, isDefault: cricketRulePresetsTable.isDefault })
    .from(cricketRulePresetsTable)
    .where(eq(cricketRulePresetsTable.tournamentId, tournamentId));

  if (presets.length <= 1) {
    return {
      ok: false,
      status: 409,
      error: "Cannot delete the only Rule Preset of a tournament.",
    };
  }

  await db
    .delete(cricketRulePresetsTable)
    .where(
      and(
        eq(cricketRulePresetsTable.id, presetId),
        eq(cricketRulePresetsTable.tournamentId, tournamentId),
      ),
    );

  // If deleted preset was default, promote another preset to default
  if (existing.isDefault) {
    const remaining = presets.filter((p) => p.id !== presetId);
    if (remaining.length > 0) {
      await db
        .update(cricketRulePresetsTable)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(
          and(
            eq(cricketRulePresetsTable.id, remaining[0].id),
            eq(cricketRulePresetsTable.tournamentId, tournamentId),
          ),
        );
    }
  }

  return { ok: true, status: 200 };
}

/**
 * Resolves the effective Rule Preset for a match.
 * Priority: match.rulePresetId -> fixture.rulePresetId -> tournament default preset.
 */
export async function resolveMatchRulePreset(
  tournamentId: number,
  match: typeof scoringMatchesTable.$inferSelect,
): Promise<CricketRulePreset> {
  // 1. Explicit match preset
  if (match.rulePresetId != null) {
    const preset = await getCricketRulePreset(tournamentId, match.rulePresetId);
    if (preset) return preset;
  }

  // 2. Fixture preset (if linked)
  if (match.fixtureId != null) {
    const [fixture] = await db
      .select({ rulePresetId: scoringFixturesTable.rulePresetId })
      .from(scoringFixturesTable)
      .where(
        and(
          eq(scoringFixturesTable.tournamentId, tournamentId),
          eq(scoringFixturesTable.id, match.fixtureId),
        ),
      )
      .limit(1);

    if (fixture?.rulePresetId != null) {
      const preset = await getCricketRulePreset(tournamentId, fixture.rulePresetId);
      if (preset) return preset;
    }
  }

  // 3. Tournament default preset
  return ensureDefaultCricketRulePreset(tournamentId);
}
