/**
 * Sport-aware CSV import/export helpers for bulk player upload.
 * Supports dynamic role_spec_groups columns with legacy header aliases.
 */

import { parseIndianMobile } from "@workspace/api-base/mobile";
import { normalizeJerseySize, type JerseySize } from "@workspace/api-base/jersey-size";

export type SpecGroupDef = {
  id: number;
  roleId: number;
  roleName: string;
  groupName: string;
  displayOrder: number;
};

export type SportSpecCatalog = {
  sportSlug: string;
  roles: { id: number; roleName: string }[];
  groupsByRole: Map<string, SpecGroupDef[]>;
  allGroupNames: string[];
};

const BASE_HEADERS = [
  "name",
  "basePrice",
  "role",
  "city",
  "age",
  "gender",
  "jerseyNumber",
  "jerseySize",
  "achievements",
  "mobileNumber",
  "email",
  "availabilityDates",
  "cricheroUrl",
] as const;

/** Legacy CSV headers mapped to positional slots when role spec groups exist. */
const LEGACY_SPEC_ALIASES: Record<string, number> = {
  battingstyle: 0,
  batting_style: 0,
  "batting style": 0,
  "batting hand": 0,
  bowlingstyle: 1,
  bowling_style: 1,
  "bowling style": 1,
  "bowling type": 1,
  specialization: 2,
  role_spec: 2,
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugifyHeader(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function fetchSportSpecCatalog(sportSlug: string): Promise<SportSpecCatalog> {
  const sport = sportSlug.trim().toLowerCase() || "cricket";
  const rolesRes = await fetch(`/api/sports/by-slug/${encodeURIComponent(sport)}/roles`);
  if (!rolesRes.ok) throw new Error(`Failed to load roles for ${sport}`);
  const roles = (await rolesRes.json()) as { id: number; roleName: string }[];

  const groupsByRole = new Map<string, SpecGroupDef[]>();
  const nameSet = new Set<string>();

  await Promise.all(
    roles.map(async (role) => {
      const specsRes = await fetch(`/api/sports/roles/${role.id}/specs`);
      if (!specsRes.ok) return;
      const groups = (await specsRes.json()) as {
        id: number;
        roleId: number;
        groupName: string;
        displayOrder: number;
      }[];
      const sorted = [...groups]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((g) => ({
          id: g.id,
          roleId: g.roleId,
          roleName: role.roleName,
          groupName: g.groupName,
          displayOrder: g.displayOrder,
        }));
      groupsByRole.set(role.roleName.toLowerCase().trim(), sorted);
      for (const g of sorted) nameSet.add(g.groupName);
    }),
  );

  return {
    sportSlug: sport,
    roles,
    groupsByRole,
    allGroupNames: [...nameSet].sort((a, b) => a.localeCompare(b)),
  };
}

export function buildCsvTemplateHeaders(catalog: SportSpecCatalog | null): string {
  const specCols = catalog?.allGroupNames.map(slugifyHeader) ?? [
    "battingStyle",
    "bowlingStyle",
    "specialization",
  ];
  return [...BASE_HEADERS, ...specCols].join(",");
}

export function buildCsvTemplateExampleRow(catalog: SportSpecCatalog | null): string {
  if (catalog?.sportSlug === "badminton") {
    return [
      "Animesh Thakur",
      "100000",
      "Singles Player",
      "Delhi",
      "28",
      "M",
      "7",
      "M",
      "District champion",
      "9876543210",
      "animesh@example.com",
      "All dates",
      "",
      "Left Hand",
      "Attacking",
      "Intermediate",
      "Indoor",
    ].join(",");
  }
  return [
    "Rohit Sharma",
    "1000000",
    "Batsman",
    "Mumbai",
    "36",
    "M",
    "45",
    "L",
    "IPL Winner",
    "9876543210",
    "rohit@example.com",
    "18-20 March",
    "https://crichero.com/rohit",
    "Right Hand",
    "Right Arm Medium",
    "Top order",
  ].join(",");
}

export type ParsedBulkPlayer = {
  name: string;
  basePrice: number;
  role?: string;
  city?: string;
  age?: number;
  gender?: "M" | "F";
  jerseyNumber?: string;
  jerseySize?: JerseySize;
  achievements?: string;
  mobileNumber?: string;
  email?: string;
  availabilityDates?: string;
  cricheroUrl?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  specialization?: string;
  specifications?: { specGroupId: number; value: string }[];
};

function resolveSpecValueForGroup(
  group: SpecGroupDef,
  groupIndex: number,
  row: Record<string, string>,
  headers: string[],
): string | undefined {
  const slug = slugifyHeader(group.groupName);
  const direct =
    row[slug] ||
    row[normalizeHeader(group.groupName)] ||
    row[group.groupName.toLowerCase()];
  if (direct?.trim()) return direct.trim();

  for (const [alias, slot] of Object.entries(LEGACY_SPEC_ALIASES)) {
    if (slot !== groupIndex) continue;
    const legacyVal = row[alias];
    if (legacyVal?.trim()) return legacyVal.trim();
  }

  return undefined;
}

export function parsePlayerCsv(
  raw: string,
  catalog: SportSpecCatalog | null,
): ParsedBulkPlayer[] {
  const lines = raw.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] || "";
    });

    const role = row["role"] || undefined;
    const roleKey = role?.toLowerCase().trim() ?? "";
    const roleGroups = catalog?.groupsByRole.get(roleKey) ?? [];

    const specifications: { specGroupId: number; value: string }[] = [];
    const legacySlots: string[] = ["", "", ""];

    roleGroups.forEach((group, idx) => {
      const value = resolveSpecValueForGroup(group, idx, row, headers);
      if (!value) return;
      specifications.push({ specGroupId: group.id, value });
      if (idx < 3) legacySlots[idx] = value;
    });

    if (specifications.length === 0 && !catalog) {
      legacySlots[0] = row["battingstyle"] || row["batting_style"] || "";
      legacySlots[1] = row["bowlingstyle"] || row["bowling_style"] || "";
      legacySlots[2] = row["specialization"] || "";
    }

    const mobileRaw = row["mobilenumber"] || row["mobile_number"] || row["mobile"] || "";
    const mobileParsed = mobileRaw ? parseIndianMobile(mobileRaw) : null;

    const genderRaw = (row["gender"] || "").trim().toUpperCase();

    return {
      name: row["name"] || "Unknown",
      basePrice: parseInt(row["baseprice"] || row["base_price"] || "100000", 10) || 100000,
      role,
      city: row["city"] || undefined,
      age: row["age"] ? parseInt(row["age"], 10) : undefined,
      gender: genderRaw === "M" || genderRaw === "F" ? genderRaw : undefined,
      jerseyNumber: row["jerseynumber"] || row["jersey_number"] || undefined,
      jerseySize: normalizeJerseySize(row["jerseysize"] || row["jersey_size"]) ?? undefined,
      achievements: row["achievements"] || undefined,
      mobileNumber:
        mobileParsed?.ok ? mobileParsed.normalized : mobileRaw || undefined,
      email: row["email"] || undefined,
      availabilityDates:
        row["availabilitydates"] || row["availability_dates"] || row["availability"] || undefined,
      cricheroUrl: row["cricherourl"] || row["crichero_url"] || row["crichero"] || undefined,
      battingStyle: legacySlots[0] || undefined,
      bowlingStyle: legacySlots[1] || undefined,
      specialization: legacySlots[2] || undefined,
      specifications: specifications.length > 0 ? specifications : undefined,
    };
  });
}
