/** Resolve auction franchise metadata with backward-compatible field names. */
export function resolveFranchiseName(info) {
    return info.franchiseName ?? info.teamName;
}
export function resolveFranchiseLogoUrl(info) {
    return info.franchiseLogoUrl ?? info.teamLogoUrl ?? info.flagUrl;
}
