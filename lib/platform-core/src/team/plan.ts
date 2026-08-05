import type {
  TeamConfiguration,
  TeamConfigurationHistoryPayload,
  TeamValidationResult,
} from "./types.ts";
import { TEAM_CONFIGURATION_SCHEMA_VERSION } from "./types.ts";

/** Build immutable locked configuration payload (no roster / runtime). */
export function buildTeamConfigurationHistoryPayload(
  configuration: TeamConfiguration,
  validation: TeamValidationResult,
  frozenAt: string,
): TeamConfigurationHistoryPayload {
  return {
    schemaVersion: TEAM_CONFIGURATION_SCHEMA_VERSION,
    name: configuration.name,
    displayName: configuration.displayName,
    shortName: configuration.shortName,
    logoUrl: configuration.logoUrl,
    branding: { ...configuration.branding },
    visibility: configuration.visibility,
    typeId: configuration.typeId,
    status: "locked",
    theme: { ...configuration.theme },
    validationSummary: {
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      infoCount: validation.infoCount,
      issues: validation.issues,
    },
    frozenAt,
  };
}
