import type {
  SchedulingConfiguration,
  SchedulingPlanKindId,
  SchedulingStrategyId,
} from "./types.ts";
import { encodeSchedulingId } from "./ids.ts";

export type SchedulingConfigBlob = {
  strategyId?: string | null;
  workingDays?: string[] | null;
  operatingHours?: { start?: string | null; end?: string | null } | null;
  bufferMinutes?: number | null;
  parallelLimit?: number | null;
  resourcePreferences?: Record<string, unknown> | null;
  breakRules?: Record<string, unknown> | null;
  venueRules?: Record<string, unknown> | null;
  customSettings?: Record<string, unknown> | null;
  planKindId?: string | null;
};

export type DrawSchedulingRuntimeColumns = {
  id: number;
  tournamentId: number;
  source: "badminton" | "cricket";
  schedulingStrategyId?: string | null;
  schedulingLifecycleStatus?: string | null;
  schedulingConfigurationLocked?: boolean | null;
  metaOrConfigJson?: Record<string, unknown> | null;
};

function readBlob(raw: Record<string, unknown> | null | undefined): SchedulingConfigBlob {
  if (!raw || typeof raw !== "object") return {};
  const nested = raw.platformScheduling;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as SchedulingConfigBlob;
  }
  return {};
}

export function resolveSchedulingConfiguration(
  row: DrawSchedulingRuntimeColumns,
  opts?: { planVersion?: number | null },
): SchedulingConfiguration {
  const blob = readBlob(row.metaOrConfigJson);
  const hours = blob.operatingHours ?? {};
  return {
    schedulingId: encodeSchedulingId(row.source, row.id),
    tournamentId: row.tournamentId,
    strategyId: (row.schedulingStrategyId ?? blob.strategyId ?? "manual") as SchedulingStrategyId,
    workingDays: blob.workingDays ?? [],
    operatingHours: {
      start: hours.start ?? null,
      end: hours.end ?? null,
    },
    bufferMinutes: blob.bufferMinutes ?? null,
    parallelLimit: blob.parallelLimit ?? null,
    resourcePreferences: blob.resourcePreferences ?? null,
    breakRules: blob.breakRules ?? null,
    venueRules: blob.venueRules ?? null,
    customSettings: blob.customSettings ?? null,
    locked: !!row.schedulingConfigurationLocked,
    planVersion: opts?.planVersion ?? null,
  };
}

export function resolvePlanKindId(
  row: DrawSchedulingRuntimeColumns,
  fixtureTypeId?: string | null,
): SchedulingPlanKindId {
  const blob = readBlob(row.metaOrConfigJson);
  if (blob.planKindId) return blob.planKindId;
  if (fixtureTypeId === "knockout") return "knockout";
  if (fixtureTypeId === "league" || fixtureTypeId === "round_robin") return "league";
  if (fixtureTypeId === "practice") return "practice";
  return "tournament";
}

export function mergeSchedulingConfigBlob(
  existing: Record<string, unknown> | null | undefined,
  patch: SchedulingConfigBlob,
): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const prev = readBlob(base);
  base.platformScheduling = {
    ...prev,
    ...patch,
    ...(patch.operatingHours
      ? {
          operatingHours: {
            ...(prev.operatingHours ?? {}),
            ...patch.operatingHours,
          },
        }
      : {}),
  };
  return base;
}
