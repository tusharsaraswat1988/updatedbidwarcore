import type { PlayerIdentityMatch } from "./types";
import {
  buildRegistrationCode,
  normalizeMobile,
  normalizeRegistrationCode,
  getRegistrationCodeFromRow,
  getPlayerIdFromWorkbookRow,
} from "./sheet-definitions";

export type ExistingPlayerRecord = {
  id: number;
  name: string;
  mobileNumber: string;
  email: string | null;
  age: number | null;
  dob?: string | null;
  registrationCode?: string;
  /** @deprecated Use registrationCode */
  registrationId?: string;
};

/**
 * Identity resolution priority:
 * 1. BidWar Player ID (from export)
 * 2. Registration Code
 * 3. Mobile
 * 4. Email
 * 5. Name + Mobile
 * 6. Name + DOB
 * 7. Create New Record
 */
export function resolvePlayerIdentity(
  row: Record<string, unknown>,
  existing: ExistingPlayerRecord[],
  auctionCode?: string | null,
): PlayerIdentityMatch {
  const playerIdFromRow = getPlayerIdFromWorkbookRow(row);
  if (playerIdFromRow != null) {
    const byId = existing.find((p) => p.id === playerIdFromRow);
    if (byId) return { strategy: "player_id", playerId: byId.id, isNew: false };
  }

  const regCode = getRegistrationCodeFromRow(row);
  const mobile = normalizeMobile(row["Mobile"] ?? row.mobile);
  const email = String(row["Email"] ?? row.email ?? "").trim().toLowerCase();
  const name = String(row["Player Name"] ?? row.name ?? "").trim();
  const dob = String(row["DOB"] ?? row.dob ?? "").trim();

  const portableCode = (p: ExistingPlayerRecord) =>
    p.registrationCode ?? p.registrationId ?? buildRegistrationCode(p.mobileNumber, p.name, auctionCode);

  if (regCode) {
    const normalizedReg = normalizeRegistrationCode(regCode);
    const byReg = existing.find(
      (p) => normalizeRegistrationCode(portableCode(p)) === normalizedReg,
    );
    if (byReg) return { strategy: "registration_code", playerId: byReg.id, isNew: false };
  }

  if (mobile.length >= 10) {
    const byMobile = existing.find((p) => normalizeMobile(p.mobileNumber) === mobile);
    if (byMobile) return { strategy: "mobile", playerId: byMobile.id, isNew: false };
  }

  if (email) {
    const byEmail = existing.find((p) => (p.email ?? "").toLowerCase() === email);
    if (byEmail) return { strategy: "email", playerId: byEmail.id, isNew: false };
  }

  if (name && mobile.length >= 10) {
    const byNameMobile = existing.find(
      (p) =>
        p.name.trim().toLowerCase() === name.toLowerCase()
        && normalizeMobile(p.mobileNumber) === mobile,
    );
    if (byNameMobile) return { strategy: "name_mobile", playerId: byNameMobile.id, isNew: false };
  }

  if (name && dob) {
    const byNameDob = existing.find((p) => {
      const pDob = p.dob ?? (p.age != null ? String(p.age) : "");
      return p.name.toLowerCase() === name.toLowerCase() && (dob === pDob || !pDob);
    });
    if (byNameDob) return { strategy: "name_dob", playerId: byNameDob.id, isNew: false };
  }

  if (regCode && normalizeMobile(regCode).length >= 10) {
    const byMobileFromReg = existing.find(
      (p) => normalizeMobile(p.mobileNumber) === normalizeMobile(regCode),
    );
    if (byMobileFromReg) return { strategy: "registration_code", playerId: byMobileFromReg.id, isNew: false };
  }

  return { strategy: "create_new", isNew: true };
}

/** Players in the tournament that are not matched by any row in 03_Players. */
export function findPlayersMissingFromWorkbook(
  playerRows: Record<string, unknown>[],
  existing: ExistingPlayerRecord[],
  auctionCode?: string | null,
): ExistingPlayerRecord[] {
  const retainedIds = new Set<number>();

  for (const row of playerRows) {
    const identity = resolvePlayerIdentity(row, existing, auctionCode);
    if (identity.playerId != null) {
      retainedIds.add(identity.playerId);
    }
  }

  return existing.filter((player) => !retainedIds.has(player.id));
}

export type ReplaceIdentityCoverage = {
  matchedExistingIds: Set<number>;
  newRowCount: number;
  missingExisting: ExistingPlayerRecord[];
};

export function assessReplaceIdentityCoverage(
  playerRows: Record<string, unknown>[],
  existing: ExistingPlayerRecord[],
  auctionCode?: string | null,
): ReplaceIdentityCoverage {
  const matchedExistingIds = new Set<number>();
  let newRowCount = 0;

  for (const row of playerRows) {
    const identity = resolvePlayerIdentity(row, existing, auctionCode);
    if (identity.playerId != null) matchedExistingIds.add(identity.playerId);
    else if (identity.isNew) newRowCount++;
  }

  const missingExisting = existing.filter((player) => !matchedExistingIds.has(player.id));
  return { matchedExistingIds, newRowCount, missingExisting };
}

/** Returns a user-facing error when replace import would wipe the roster due to bad identity matching. */
export function getReplaceDataSafetyError(
  coverage: ReplaceIdentityCoverage,
  existingCount: number,
): string | null {
  if (existingCount === 0) return null;
  if (coverage.matchedExistingIds.size + coverage.newRowCount === 0) return null;

  const matchedRatio = coverage.matchedExistingIds.size / existingCount;
  const deleteRatio = coverage.missingExisting.length / existingCount;

  if (coverage.matchedExistingIds.size === 0) {
    return `Replace import matched 0 of ${existingCount} existing players. Workbook rows must keep Registration Code, Mobile, or BidWar Player ID from export. Import blocked to prevent deleting your full roster. Re-export the workbook, avoid editing identity columns, or use Merge Data instead.`;
  }

  if (existingCount >= 5 && matchedRatio < 0.5) {
    return `Replace import only matched ${coverage.matchedExistingIds.size} of ${existingCount} existing players (${Math.round(matchedRatio * 100)}%). This usually means identity columns were changed or corrupted in Excel. Import blocked. Re-export and try again, or use Merge Data.`;
  }

  if (existingCount >= 10 && deleteRatio > 0.5 && matchedRatio < 0.75) {
    return `Replace import would remove ${coverage.missingExisting.length} of ${existingCount} players but only ${coverage.matchedExistingIds.size} workbook rows matched existing records. Import blocked — verify Registration Code / Mobile / BidWar Player ID columns.`;
  }

  return null;
}

export function detectDuplicateIdentities(
  rows: Record<string, unknown>[],
  auctionCode?: string | null,
): Array<{ row: number; message: string }> {
  const seen = new Map<string, number>();
  const dupes: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const regCode = getRegistrationCodeFromRow(row);
    const mobile = normalizeMobile(row["Mobile"]);
    const key = regCode || mobile || String(row["Player Name"] ?? "").trim().toLowerCase();
    if (!key) continue;

    const prev = seen.get(key);
    if (prev != null) {
      dupes.push({ row: i + 2, message: `Duplicate identity "${key}" (also on row ${prev})` });
    } else {
      seen.set(key, i + 2);
    }
  }

  return dupes;
}

export function detectDuplicateMobiles(
  rows: Record<string, unknown>[],
): Array<{ row: number; mobile: string; message: string }> {
  const seen = new Map<string, number>();
  const dupes: Array<{ row: number; mobile: string; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const mobile = normalizeMobile(rows[i]?.["Mobile"]);
    if (mobile.length < 10) continue;
    const prev = seen.get(mobile);
    if (prev != null) {
      dupes.push({ row: i + 2, mobile, message: `Duplicate mobile ${mobile} (also on row ${prev})` });
    } else {
      seen.set(mobile, i + 2);
    }
  }

  return dupes;
}
