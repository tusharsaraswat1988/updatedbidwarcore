import type { FixtureConfiguration, FixtureTypeId } from "./types.ts";
import { encodeFixtureId } from "./ids.ts";

/** Product config blob stored inside runtime meta/config JSON — never leaked upward. */
export type FixtureConfigBlob = {
  competitionFormat?: string | null;
  numberOfRounds?: number | null;
  legs?: number | null;
  groups?: number | null;
  qualificationRules?: Record<string, unknown> | null;
  thirdPlaceMatch?: boolean | null;
  placementRules?: Record<string, unknown> | null;
  customSettings?: Record<string, unknown> | null;
};

/** Minimal badminton draw columns for Working Configuration. */
export type BadmintonDrawRuntimeColumns = {
  id: number;
  tournamentId: number;
  roundName: string;
  totalRounds?: number | null;
  drawKind?: string | null;
  fixtureTypeId?: string | null;
  configurationLocked?: boolean | null;
  metaJson?: Record<string, unknown> | null;
};

/** Minimal scoring draw columns for Working Configuration. */
export type ScoringDrawRuntimeColumns = {
  id: number;
  tournamentId: number;
  name: string;
  format: string;
  fixtureTypeId?: string | null;
  configurationLocked?: boolean | null;
  configJson?: Record<string, unknown> | null;
};

function readBlob(raw: Record<string, unknown> | null | undefined): FixtureConfigBlob {
  if (!raw || typeof raw !== "object") return {};
  const nested = raw.platformFixture;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as FixtureConfigBlob;
  }
  return {};
}

function inferTypeFromBadminton(row: BadmintonDrawRuntimeColumns): FixtureTypeId {
  if (row.fixtureTypeId) return row.fixtureTypeId;
  const kind = (row.drawKind ?? "").toLowerCase();
  if (kind.includes("group") || kind === "league") return "league";
  if (kind.includes("knockout") || kind === "generated") return "knockout";
  return "custom";
}

function inferTypeFromScoring(row: ScoringDrawRuntimeColumns): FixtureTypeId {
  if (row.fixtureTypeId) return row.fixtureTypeId;
  const format = row.format;
  if (format === "knockout") return "knockout";
  if (format === "round_robin") return "round_robin";
  if (format === "league") return "league";
  if (format === "league_knockout") return "group";
  return "custom";
}

export function resolveBadmintonFixtureConfiguration(
  row: BadmintonDrawRuntimeColumns,
  opts?: { planVersion?: number | null },
): FixtureConfiguration {
  const blob = readBlob(row.metaJson);
  return {
    fixtureId: encodeFixtureId("badminton", row.id),
    tournamentId: row.tournamentId,
    name: row.roundName?.trim() || `Fixture ${row.id}`,
    typeId: inferTypeFromBadminton(row),
    competitionFormat: blob.competitionFormat ?? row.drawKind ?? null,
    numberOfRounds: blob.numberOfRounds ?? row.totalRounds ?? null,
    legs: blob.legs ?? null,
    groups: blob.groups ?? null,
    qualificationRules: blob.qualificationRules ?? null,
    thirdPlaceMatch: !!blob.thirdPlaceMatch,
    placementRules: blob.placementRules ?? null,
    customSettings: blob.customSettings ?? null,
    locked: !!row.configurationLocked,
    planVersion: opts?.planVersion ?? null,
  };
}

export function resolveScoringFixtureConfiguration(
  row: ScoringDrawRuntimeColumns,
  opts?: { planVersion?: number | null; groupCount?: number | null },
): FixtureConfiguration {
  const blob = readBlob(row.configJson as Record<string, unknown> | null);
  const cfg = row.configJson ?? {};
  return {
    fixtureId: encodeFixtureId("cricket", row.id),
    tournamentId: row.tournamentId,
    name: row.name?.trim() || `Fixture ${row.id}`,
    typeId: inferTypeFromScoring(row),
    competitionFormat: blob.competitionFormat ?? row.format,
    numberOfRounds: blob.numberOfRounds ?? null,
    legs: blob.legs ?? (cfg.doubleRoundRobin ? 2 : 1),
    groups: blob.groups ?? opts?.groupCount ?? (Array.isArray(cfg.groups) ? cfg.groups.length : null),
    qualificationRules:
      blob.qualificationRules ??
      (cfg.knockoutTeamsPerGroup != null
        ? { knockoutTeamsPerGroup: cfg.knockoutTeamsPerGroup }
        : null),
    thirdPlaceMatch: !!blob.thirdPlaceMatch,
    placementRules: blob.placementRules ?? null,
    customSettings: blob.customSettings ?? null,
    locked: !!row.configurationLocked,
    planVersion: opts?.planVersion ?? null,
  };
}

export function mergeFixtureConfigBlob(
  existing: Record<string, unknown> | null | undefined,
  patch: FixtureConfigBlob,
): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const prev = readBlob(base);
  base.platformFixture = {
    ...prev,
    ...patch,
  };
  return base;
}
