import type {
  FixtureConfiguration,
  FixtureConfigurationHistoryPayload,
  FixtureNode,
  FixtureValidationResult,
} from "./types.ts";
import { FIXTURE_CONFIGURATION_SCHEMA_VERSION } from "./types.ts";

/**
 * Build immutable locked configuration payload.
 * Includes locked Configuration + locked Node/Blueprint structure.
 * Never schedules, runtime matches, results, or standings.
 */
export function buildFixtureConfigurationHistoryPayload(
  configuration: FixtureConfiguration,
  nodes: readonly FixtureNode[],
  validation: FixtureValidationResult,
  frozenAt: string,
): FixtureConfigurationHistoryPayload {
  return {
    schemaVersion: FIXTURE_CONFIGURATION_SCHEMA_VERSION,
    name: configuration.name,
    typeId: configuration.typeId,
    competitionFormat: configuration.competitionFormat,
    numberOfRounds: configuration.numberOfRounds,
    legs: configuration.legs,
    groups: configuration.groups,
    qualificationRules: configuration.qualificationRules
      ? { ...configuration.qualificationRules }
      : null,
    thirdPlaceMatch: configuration.thirdPlaceMatch,
    placementRules: configuration.placementRules
      ? { ...configuration.placementRules }
      : null,
    customSettings: configuration.customSettings
      ? { ...configuration.customSettings }
      : null,
    nodes: nodes.map((n) => ({
      ...n,
      advancements: [...n.advancements],
      blueprint: n.blueprint
        ? {
            ...n.blueprint,
            sides: n.blueprint.sides.map((s) => ({ ...s })),
            advancementRuleIds: [...n.blueprint.advancementRuleIds],
          }
        : null,
    })),
    validationSummary: {
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      infoCount: validation.infoCount,
      issues: validation.issues,
    },
    frozenAt,
  };
}
