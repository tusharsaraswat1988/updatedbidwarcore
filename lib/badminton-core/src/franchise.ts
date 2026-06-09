/** Resolve auction franchise metadata with backward-compatible field names. */

export type FranchiseFields = {
  franchiseName?: string;
  franchiseLogoUrl?: string;
  /** @deprecated informational auction franchise — use franchiseName */
  teamName?: string;
  /** @deprecated use franchiseLogoUrl */
  teamLogoUrl?: string;
  flagUrl?: string;
};

export function resolveFranchiseName(info: FranchiseFields): string | undefined {
  return info.franchiseName ?? info.teamName;
}

export function resolveFranchiseLogoUrl(info: FranchiseFields): string | undefined {
  return info.franchiseLogoUrl ?? info.teamLogoUrl ?? info.flagUrl;
}
