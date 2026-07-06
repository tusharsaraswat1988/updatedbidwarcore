import type { PlayerIdentityMatch } from "./types";
import { buildRegistrationCode, normalizeMobile, getRegistrationCodeFromRow } from "./sheet-definitions";

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
 * 1. Registration Code
 * 2. Mobile
 * 3. Email
 * 4. Name + DOB
 * 5. Create New Record
 */
export function resolvePlayerIdentity(
  row: Record<string, unknown>,
  existing: ExistingPlayerRecord[],
  auctionCode?: string | null,
): PlayerIdentityMatch {
  const regCode = getRegistrationCodeFromRow(row);
  const mobile = normalizeMobile(row["Mobile"] ?? row.mobile);
  const email = String(row["Email"] ?? row.email ?? "").trim().toLowerCase();
  const name = String(row["Player Name"] ?? row.name ?? "").trim();
  const dob = String(row["DOB"] ?? row.dob ?? "").trim();

  const portableCode = (p: ExistingPlayerRecord) =>
    p.registrationCode ?? p.registrationId ?? buildRegistrationCode(p.mobileNumber, p.name, auctionCode);

  if (regCode) {
    const byReg = existing.find((p) => portableCode(p) === regCode);
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

  if (name && dob) {
    const byNameDob = existing.find((p) => {
      const pDob = p.dob ?? (p.age != null ? String(p.age) : "");
      return p.name.toLowerCase() === name.toLowerCase() && (dob === pDob || !pDob);
    });
    if (byNameDob) return { strategy: "name_dob", playerId: byNameDob.id, isNew: false };
  }

  if (regCode && normalizeMobile(regCode).length >= 10) {
    const byMobileFromReg = existing.find((p) => normalizeMobile(p.mobileNumber) === normalizeMobile(regCode));
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
