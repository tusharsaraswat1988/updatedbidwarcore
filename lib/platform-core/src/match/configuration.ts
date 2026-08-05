import type {
  MatchBranding,
  MatchConfiguration,
  MatchTypeId,
  MatchVisibilityId,
} from "./types.ts";

/** Minimal runtime columns for Working Configuration — never leaked upward. */
export type ScoringMatchRuntimeColumns = {
  id: number;
  tournamentId: number;
  matchLabel?: string | null;
  displayName?: string | null;
  matchTypeId?: string | null;
  venue?: string | null;
  surface?: string | null;
  scheduledAt?: Date | string | null;
  visibility?: string | null;
  brandingJson?: Record<string, unknown> | null;
  configurationLocked?: boolean | null;
};

function splitScheduled(scheduledAt: Date | string | null | undefined): {
  scheduledDate: string | null;
  scheduledTime: string | null;
} {
  if (!scheduledAt) return { scheduledDate: null, scheduledTime: null };
  const d = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt;
  if (Number.isNaN(d.getTime())) return { scheduledDate: null, scheduledTime: null };
  const iso = d.toISOString();
  return {
    scheduledDate: iso.slice(0, 10),
    scheduledTime: iso.slice(11, 16),
  };
}

export function resolveMatchConfiguration(
  row: ScoringMatchRuntimeColumns,
  opts?: { planVersion?: number | null },
): MatchConfiguration {
  const { scheduledDate, scheduledTime } = splitScheduled(row.scheduledAt);
  const brandingRaw = row.brandingJson && typeof row.brandingJson === "object" ? row.brandingJson : {};
  const branding: MatchBranding = {
    primaryColor:
      typeof brandingRaw.primaryColor === "string" ? brandingRaw.primaryColor : null,
    secondaryColor:
      typeof brandingRaw.secondaryColor === "string" ? brandingRaw.secondaryColor : null,
    logoUrl: typeof brandingRaw.logoUrl === "string" ? brandingRaw.logoUrl : null,
  };
  const name = (row.matchLabel && row.matchLabel.trim()) || `Match ${row.id}`;
  const displayName = (row.displayName && row.displayName.trim()) || name;

  return {
    matchId: String(row.id),
    tournamentId: row.tournamentId,
    name,
    displayName,
    typeId: (row.matchTypeId ?? "league") as MatchTypeId,
    venue: row.venue ?? null,
    surface: row.surface ?? null,
    scheduledDate,
    scheduledTime,
    visibility: (row.visibility ?? "tournament") as MatchVisibilityId,
    branding,
    locked: !!row.configurationLocked,
    planVersion: opts?.planVersion ?? null,
  };
}
