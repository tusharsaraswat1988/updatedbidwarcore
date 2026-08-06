import type {
  TeamBranding,
  TeamConfiguration,
  TeamLifecycleStatusId,
  TeamTheme,
  TeamTypeId,
  TeamVisibilityId,
} from "./types.ts";

/** Minimal runtime columns used to resolve Working Configuration — never leaked upward. */
export type AuctionTeamRuntimeColumns = {
  id: number;
  tournamentId: number;
  name: string;
  shortCode: string;
  color?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  displayName?: string | null;
  teamTypeId?: string | null;
  visibility?: string | null;
  themeJson?: Record<string, unknown> | null;
  lifecycleStatus?: string | null;
  configurationLocked?: boolean | null;
};

export function resolveTeamConfiguration(
  row: AuctionTeamRuntimeColumns,
  opts?: { planVersion?: number | null },
): TeamConfiguration {
  const branding: TeamBranding = {
    primaryColor: row.color ?? null,
    secondaryColor: row.secondaryColor ?? null,
    logoUrl: row.logoUrl ?? null,
  };
  const theme: TeamTheme =
    row.themeJson && typeof row.themeJson === "object" ? { ...row.themeJson } : {};
  const locked = !!row.configurationLocked;
  const status = (row.lifecycleStatus ?? (locked ? "locked" : "draft")) as TeamLifecycleStatusId;

  return {
    teamId: String(row.id),
    tournamentId: row.tournamentId,
    name: row.name,
    displayName: (row.displayName && row.displayName.trim()) || row.name,
    shortName: row.shortCode,
    logoUrl: row.logoUrl ?? null,
    branding,
    visibility: (row.visibility ?? "tournament") as TeamVisibilityId,
    typeId: (row.teamTypeId ?? "competitive") as TeamTypeId,
    status,
    theme,
    locked,
    planVersion: opts?.planVersion ?? null,
  };
}
