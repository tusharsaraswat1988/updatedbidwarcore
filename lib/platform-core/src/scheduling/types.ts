import type { ValidationIssue, ValidationSeverity } from "../catalog/resolve/types.ts";
import type { FixtureSource } from "../fixture/types.ts";

export type SchedulingSource = FixtureSource;

export type SchedulingPlanKindId =
  | "tournament"
  | "league"
  | "knockout"
  | "practice"
  | "custom"
  | string;

export type SchedulingStrategyId =
  | "manual"
  | "sequential"
  | "parallel"
  | "round_robin_optimized"
  | "knockout_optimized"
  | "balanced"
  | "future"
  | string;

export type ResourceKindId =
  | "court"
  | "ground"
  | "arena"
  | "mat"
  | "table"
  | "lane"
  | "track"
  | "virtual"
  | "future"
  | string;

export type SchedulingLifecycleStatusId =
  | "draft"
  | "generated"
  | "validated"
  | "locked"
  | "ready"
  | "executed"
  | "archived";

export type ScheduleSlotStatusId =
  | "available"
  | "reserved"
  | "assigned"
  | "blocked"
  | string;

export type ResourceAssignmentStatusId = "planned" | "confirmed" | string;

/** Stable platform identity — independent of matches, resources, dates, slots, conflicts. */
export type SchedulingIdentity = {
  id: string;
  tournamentId: number;
  planKindId: SchedulingPlanKindId;
  source: SchedulingSource;
  /** 1:1 with EPIC-06 Fixture Identity. */
  fixtureId: string;
};

/**
 * Working Scheduling Configuration.
 * Never includes resources, slots, assigned matches, conflicts, or lifecycle.
 */
export type SchedulingConfiguration = {
  schedulingId: string;
  tournamentId: number;
  strategyId: SchedulingStrategyId;
  workingDays: readonly string[];
  operatingHours: { start: string | null; end: string | null };
  bufferMinutes: number | null;
  parallelLimit: number | null;
  resourcePreferences: Record<string, unknown> | null;
  breakRules: Record<string, unknown> | null;
  venueRules: Record<string, unknown> | null;
  customSettings: Record<string, unknown> | null;
  locked: boolean;
  planVersion: number | null;
};

export type SchedulingLifecycle = {
  schedulingId: string;
  tournamentId: number;
  status: SchedulingLifecycleStatusId;
  locked: boolean;
};

/** Schedule Slot — execution opportunity. Not a Match, Court, Venue, or Fixture. */
export type ScheduleSlot = {
  slotId: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  availability: "available" | "unavailable" | string;
  status: ScheduleSlotStatusId;
  /** Match Blueprint id from Fixture View — optional. */
  blueprintId: string | null;
};

/**
 * Resource Assignment — Slot → Resource binding.
 * Changing assignment must not change Slot Identity.
 */
export type ResourceAssignment = {
  assignmentId: string;
  slotId: string;
  resourceKindId: ResourceKindId;
  /** Bridged instance id (e.g. court:3, venue:12). */
  resourceId: string;
  resourceDisplayName: string;
  status: ResourceAssignmentStatusId;
  priority: number | null;
};

/** Catalog-compatible resource reference exposed via Scheduling View. */
export type SchedulingResourceRef = {
  resourceId: string;
  resourceKindId: ResourceKindId;
  displayName: string;
  source: SchedulingSource;
};

export type SchedulingConfigurationHistoryPayload = {
  schemaVersion: string;
  strategyId: SchedulingStrategyId;
  workingDays: readonly string[];
  operatingHours: { start: string | null; end: string | null };
  bufferMinutes: number | null;
  parallelLimit: number | null;
  resourcePreferences: Record<string, unknown> | null;
  breakRules: Record<string, unknown> | null;
  venueRules: Record<string, unknown> | null;
  customSettings: Record<string, unknown> | null;
  slots: readonly ScheduleSlot[];
  assignments: readonly ResourceAssignment[];
  validationSummary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    issues: readonly ValidationIssue[];
  };
  frozenAt: string;
};

export type SchedulingConfigurationHistoryEntry = {
  schedulingId: string;
  tournamentId: number;
  version: number;
  payload: SchedulingConfigurationHistoryPayload;
  frozenAt: string;
  frozenBy: string | null;
};

export type SchedulingValidationResult = {
  issues: readonly ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  readiness: "ready" | "almost_ready" | "not_ready";
};

export type SchedulingReadiness = SchedulingValidationResult["readiness"];

export const SCHEDULING_CONFIGURATION_SCHEMA_VERSION = "1.0.0";

export const SCHEDULING_LIFECYCLE_ORDER: readonly SchedulingLifecycleStatusId[] = [
  "draft",
  "generated",
  "validated",
  "locked",
  "ready",
  "executed",
  "archived",
] as const;

export type { ValidationIssue, ValidationSeverity };
