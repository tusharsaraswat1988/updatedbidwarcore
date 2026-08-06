import { z } from "zod";
import { CatalogRegistry } from "@workspace/platform-core/catalog";

/** Additive create-body fields for platform catalog bindings. */
export const tournamentCatalogBindingSchema = z.object({
  variantId: z.string().min(1).optional(),
  competitionTypeId: z.string().min(1).optional(),
  ruleProfileId: z.string().min(1).optional(),
  ruleProfileVersion: z.string().min(1).optional(),
  presentationProfileId: z.string().min(1).optional(),
  presentationProfileVersion: z.string().min(1).optional(),
  /** EPIC-03 — confirmed Working Configuration ids (optional on create). */
  registrationModeId: z.string().min(1).optional(),
  teamFormationStrategyId: z.string().min(1).optional(),
  squadRules: z.record(z.string(), z.unknown()).optional(),
});

export type TournamentCatalogBindingInput = z.infer<typeof tournamentCatalogBindingSchema>;

export type CatalogBindingColumns = {
  variantId: string | null;
  competitionTypeId: string | null;
  ruleProfileId: string | null;
  ruleProfileVersion: string | null;
  presentationProfileId: string | null;
  presentationProfileVersion: string | null;
  registrationModeId: string | null;
  teamFormationStrategyId: string | null;
  squadRulesJson: Record<string, unknown> | null;
};

/**
 * Validate and normalize catalog bindings for tournament create.
 * - If no binding fields are sent → ok with all null (legacy-compatible create).
 * - If any binding field is sent → all required fields must be present and compatible.
 */
export function resolveCatalogBindingsForCreate(
  sportSlug: string,
  input: TournamentCatalogBindingInput,
):
  | { ok: true; columns: CatalogBindingColumns }
  | { ok: false; error: string } {
  const anyBinding =
    !!input.variantId ||
    !!input.competitionTypeId ||
    !!input.ruleProfileId ||
    !!input.presentationProfileId;

  const competitionConfigColumns = {
    registrationModeId: input.registrationModeId ?? null,
    teamFormationStrategyId: input.teamFormationStrategyId ?? null,
    squadRulesJson: input.squadRules ?? null,
  };

  if (competitionConfigColumns.registrationModeId) {
    if (!CatalogRegistry.getRegistrationMode(competitionConfigColumns.registrationModeId)) {
      return { ok: false, error: "Unknown registrationModeId" };
    }
  }
  if (competitionConfigColumns.teamFormationStrategyId) {
    if (
      !CatalogRegistry.getTeamFormationStrategy(competitionConfigColumns.teamFormationStrategyId)
    ) {
      return { ok: false, error: "Unknown teamFormationStrategyId" };
    }
  }

  if (!anyBinding) {
    return {
      ok: true,
      columns: {
        variantId: null,
        competitionTypeId: null,
        ruleProfileId: null,
        ruleProfileVersion: null,
        presentationProfileId: null,
        presentationProfileVersion: null,
        ...competitionConfigColumns,
      },
    };
  }

  if (
    !input.variantId ||
    !input.competitionTypeId ||
    !input.ruleProfileId ||
    !input.presentationProfileId
  ) {
    return {
      ok: false,
      error:
        "When setting catalog bindings, variantId, competitionTypeId, ruleProfileId, and presentationProfileId are required",
    };
  }

  const validated = CatalogRegistry.validateCreateBindings({
    sportId: sportSlug,
    variantId: input.variantId,
    competitionTypeId: input.competitionTypeId,
    ruleProfileId: input.ruleProfileId,
    ruleProfileVersion: input.ruleProfileVersion,
    presentationProfileId: input.presentationProfileId,
    presentationProfileVersion: input.presentationProfileVersion,
  });

  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  if (
    competitionConfigColumns.registrationModeId &&
    !CatalogRegistry.listRegistrationModes(validated.bindings.competitionTypeId).some(
      (m) => m.id === competitionConfigColumns.registrationModeId,
    )
  ) {
    return {
      ok: false,
      error: "registrationModeId is not compatible with competitionTypeId",
    };
  }

  return {
    ok: true,
    columns: {
      variantId: validated.bindings.variantId,
      competitionTypeId: validated.bindings.competitionTypeId,
      ruleProfileId: validated.bindings.ruleProfileId,
      ruleProfileVersion: validated.bindings.ruleProfileVersion,
      presentationProfileId: validated.bindings.presentationProfileId,
      presentationProfileVersion: validated.bindings.presentationProfileVersion,
      ...competitionConfigColumns,
    },
  };
}

export function catalogBindingSerializerFields(t: {
  variantId?: string | null;
  competitionTypeId?: string | null;
  ruleProfileId?: string | null;
  ruleProfileVersion?: string | null;
  presentationProfileId?: string | null;
  presentationProfileVersion?: string | null;
  sport?: string | null;
}) {
  const resolved = CatalogRegistry.resolveLegacyBindings({
    sport: t.sport,
    variantId: t.variantId,
    competitionTypeId: t.competitionTypeId,
    ruleProfileId: t.ruleProfileId,
    ruleProfileVersion: t.ruleProfileVersion,
    presentationProfileId: t.presentationProfileId,
    presentationProfileVersion: t.presentationProfileVersion,
  });

  return {
    variantId: t.variantId ?? null,
    competitionTypeId: t.competitionTypeId ?? null,
    ruleProfileId: t.ruleProfileId ?? null,
    ruleProfileVersion: t.ruleProfileVersion ?? null,
    presentationProfileId: t.presentationProfileId ?? null,
    presentationProfileVersion: t.presentationProfileVersion ?? null,
    registrationModeId: (t as { registrationModeId?: string | null }).registrationModeId ?? null,
    teamFormationStrategyId:
      (t as { teamFormationStrategyId?: string | null }).teamFormationStrategyId ?? null,
    businessStageId: (t as { businessStageId?: string | null }).businessStageId ?? null,
    /** Always-present resolved refs for engines (Legacy Profile when unbound). */
    resolvedCatalogBindings: resolved,
  };
}
