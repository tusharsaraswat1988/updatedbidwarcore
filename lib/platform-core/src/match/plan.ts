import type {
  MatchConfiguration,
  MatchConfigurationHistoryPayload,
  MatchValidationResult,
} from "./types.ts";
import { MATCH_CONFIGURATION_SCHEMA_VERSION } from "./types.ts";

/** Build immutable locked configuration payload (no score/events/officials/roster). */
export function buildMatchConfigurationHistoryPayload(
  configuration: MatchConfiguration,
  validation: MatchValidationResult,
  frozenAt: string,
): MatchConfigurationHistoryPayload {
  return {
    schemaVersion: MATCH_CONFIGURATION_SCHEMA_VERSION,
    name: configuration.name,
    displayName: configuration.displayName,
    typeId: configuration.typeId,
    venue: configuration.venue,
    surface: configuration.surface,
    scheduledDate: configuration.scheduledDate,
    scheduledTime: configuration.scheduledTime,
    visibility: configuration.visibility,
    branding: { ...configuration.branding },
    validationSummary: {
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      infoCount: validation.infoCount,
      issues: validation.issues,
    },
    frozenAt,
  };
}
