/** Normalize owner mobile for lookup (matches WhatsApp webhook convention). */
export function normalizeOwnerMobile(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^0/, "91");
}

export const ELIGIBLE_OWNER_LICENSE_STATUSES = ["trial", "active"] as const;

export type OwnerOnboardingRow = {
  tournamentId: number;
  tournamentName: string;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string | null;
  teamLogoUrl: string | null;
  licenseStatus: string;
  tournamentStatus: string;
  auctionStatus: string | null;
  accessCode: string | null;
};

export type OwnerOnboardingEntry = {
  tournamentId: number;
  tournamentName: string;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string | null;
  teamLogoUrl: string | null;
  licenseStatus: string;
  tournamentStatus: string;
  auctionStatus: string | null;
  requiresAccessCode: boolean;
};

export function isEligibleOwnerTournament(row: Pick<OwnerOnboardingRow, "licenseStatus" | "tournamentStatus"> & {
  adminLocked: boolean;
}): boolean {
  if (row.adminLocked) return false;
  if (!ELIGIBLE_OWNER_LICENSE_STATUSES.includes(row.licenseStatus as (typeof ELIGIBLE_OWNER_LICENSE_STATUSES)[number])) {
    return false;
  }
  if (row.tournamentStatus === "completed") return false;
  if (row.licenseStatus === "completed") return false;
  return true;
}

export function rowToOwnerOnboardingEntry(row: OwnerOnboardingRow): OwnerOnboardingEntry {
  return {
    tournamentId: row.tournamentId,
    tournamentName: row.tournamentName,
    teamId: row.teamId,
    teamName: row.teamName,
    teamShortCode: row.teamShortCode,
    teamColor: row.teamColor,
    teamLogoUrl: row.teamLogoUrl,
    licenseStatus: row.licenseStatus,
    tournamentStatus: row.tournamentStatus,
    auctionStatus: row.auctionStatus,
    requiresAccessCode: !!row.accessCode,
  };
}

/** Live auctions first, then alphabetical by tournament + team name. */
export function sortOwnerOnboardingEntries(entries: OwnerOnboardingEntry[]): OwnerOnboardingEntry[] {
  return [...entries].sort((a, b) => {
    const aLive = a.auctionStatus === "active" ? 0 : 1;
    const bLive = b.auctionStatus === "active" ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    const t = a.tournamentName.localeCompare(b.tournamentName);
    if (t !== 0) return t;
    return a.teamName.localeCompare(b.teamName);
  });
}
