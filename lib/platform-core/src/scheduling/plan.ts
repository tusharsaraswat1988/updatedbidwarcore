import type {
  ResourceAssignment,
  ScheduleSlot,
  SchedulingConfiguration,
  SchedulingConfigurationHistoryPayload,
  SchedulingValidationResult,
} from "./types.ts";
import { SCHEDULING_CONFIGURATION_SCHEMA_VERSION } from "./types.ts";

/**
 * Build immutable locked configuration payload.
 * Includes locked Configuration + Slot + Resource Assignment structure.
 * Never runtime matches, results, or actual start/end times.
 */
export function buildSchedulingConfigurationHistoryPayload(
  configuration: SchedulingConfiguration,
  slots: readonly ScheduleSlot[],
  assignments: readonly ResourceAssignment[],
  validation: SchedulingValidationResult,
  frozenAt: string,
): SchedulingConfigurationHistoryPayload {
  return {
    schemaVersion: SCHEDULING_CONFIGURATION_SCHEMA_VERSION,
    strategyId: configuration.strategyId,
    workingDays: [...configuration.workingDays],
    operatingHours: { ...configuration.operatingHours },
    bufferMinutes: configuration.bufferMinutes,
    parallelLimit: configuration.parallelLimit,
    resourcePreferences: configuration.resourcePreferences
      ? { ...configuration.resourcePreferences }
      : null,
    breakRules: configuration.breakRules ? { ...configuration.breakRules } : null,
    venueRules: configuration.venueRules ? { ...configuration.venueRules } : null,
    customSettings: configuration.customSettings
      ? { ...configuration.customSettings }
      : null,
    slots: slots.map((s) => ({ ...s })),
    assignments: assignments.map((a) => ({ ...a })),
    validationSummary: {
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      infoCount: validation.infoCount,
      issues: validation.issues,
    },
    frozenAt,
  };
}
