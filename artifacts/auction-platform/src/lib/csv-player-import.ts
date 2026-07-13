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

/** Shared identity/contact columns — cricket-only fields are added separately. */
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
] as const;

const CRICKET_ONLY_HEADERS = ["cricheroUrl"] as const;

const LEGACY_CRICKET_SPEC_HEADERS = [
  "battingStyle",
  "bowlingStyle",
  "specialization",
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

type ExampleProfile = {
  name: string;
  basePrice: string;
  role: string;
  city: string;
  age: string;
  gender: string;
  jerseyNumber: string;
  jerseySize: string;
  achievements: string;
  mobileNumber: string;
  email: string;
  availabilityDates: string;
  cricheroUrl?: string;
  /** Example values keyed by slugified group name */
  specs?: Record<string, string>;
};

const EXAMPLE_BY_SPORT: Record<string, ExampleProfile> = {
  cricket: {
    name: "Rohit Sharma",
    basePrice: "1000000",
    role: "Batsman",
    city: "Mumbai",
    age: "36",
    gender: "M",
    jerseyNumber: "45",
    jerseySize: "L",
    achievements: "IPL Winner",
    mobileNumber: "9876543210",
    email: "rohit@example.com",
    availabilityDates: "18-20 March",
    cricheroUrl: "https://crichero.com/rohit",
    specs: {
      batting_hand: "Right-hand",
      bowling_style: "Right Arm Medium",
      bowling_arm: "Right-arm",
      battingstyle: "Right Hand",
      bowlingstyle: "Right Arm Medium",
      specialization: "Top order",
    },
  },
  football: {
    name: "Sunil Chhetri",
    basePrice: "500000",
    role: "Forward",
    city: "Bengaluru",
    age: "39",
    gender: "M",
    jerseyNumber: "11",
    jerseySize: "M",
    achievements: "National team captain",
    mobileNumber: "9876543210",
    email: "sunil@example.com",
    availabilityDates: "All dates",
    specs: { preferred_foot: "Right" },
  },
  badminton: {
    name: "Animesh Thakur",
    basePrice: "100000",
    role: "Singles Player",
    city: "Delhi",
    age: "28",
    gender: "M",
    jerseyNumber: "7",
    jerseySize: "M",
    achievements: "District champion",
    mobileNumber: "9876543210",
    email: "animesh@example.com",
    availabilityDates: "All dates",
    specs: {
      playing_hand: "Left Hand",
      playing_style: "Attacking",
      experience: "Intermediate",
      court_preference: "Indoor",
    },
  },
  kabaddi: {
    name: "Pardeep Narwal",
    basePrice: "500000",
    role: "Raider",
    city: "Hisar",
    age: "27",
    gender: "M",
    jerseyNumber: "9",
    jerseySize: "M",
    achievements: "Pro Kabaddi star",
    mobileNumber: "9876543210",
    email: "pardeep@example.com",
    availabilityDates: "All dates",
  },
  volleyball: {
    name: "Amit Kumar",
    basePrice: "200000",
    role: "Outside Hitter",
    city: "Chennai",
    age: "24",
    gender: "M",
    jerseyNumber: "4",
    jerseySize: "L",
    achievements: "State champion",
    mobileNumber: "9876543210",
    email: "amit@example.com",
    availabilityDates: "All dates",
  },
  esports: {
    name: "Pro Player",
    basePrice: "150000",
    role: "Fragger",
    city: "Hyderabad",
    age: "21",
    gender: "M",
    jerseyNumber: "1",
    jerseySize: "M",
    achievements: "LAN finalist",
    mobileNumber: "9876543210",
    email: "pro@example.com",
    availabilityDates: "All dates",
  },
  other: {
    name: "Player One",
    basePrice: "100000",
    role: "Player",
    city: "Delhi",
    age: "25",
    gender: "M",
    jerseyNumber: "10",
    jerseySize: "M",
    achievements: "",
    mobileNumber: "9876543210",
    email: "player@example.com",
    availabilityDates: "All dates",
  },
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugifyHeader(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isCricketSport(sportSlug: string | null | undefined): boolean {
  return (sportSlug?.trim().toLowerCase() || "cricket") === "cricket";
}

export function buildBaseCsvHeaders(sportSlug: string | null | undefined): string[] {
  const headers: string[] = [...BASE_HEADERS];
  if (isCricketSport(sportSlug)) {
    headers.push(...CRICKET_ONLY_HEADERS);
  }
  return headers;
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
  const sportSlug = catalog?.sportSlug ?? "cricket";
  const base = buildBaseCsvHeaders(sportSlug);
  const specCols = catalog?.allGroupNames.map(slugifyHeader) ?? [
    ...LEGACY_CRICKET_SPEC_HEADERS,
  ];
  return [...base, ...specCols].join(",");
}

export function buildCsvTemplateExampleRow(catalog: SportSpecCatalog | null): string {
  const sportSlug = catalog?.sportSlug ?? "cricket";
  const example =
    EXAMPLE_BY_SPORT[sportSlug] ?? EXAMPLE_BY_SPORT.other!;

  const cells: string[] = [
    example.name,
    example.basePrice,
    example.role,
    example.city,
    example.age,
    example.gender,
    example.jerseyNumber,
    example.jerseySize,
    example.achievements,
    example.mobileNumber,
    example.email,
    example.availabilityDates,
  ];

  if (isCricketSport(sportSlug)) {
    cells.push(example.cricheroUrl ?? "");
  }

  if (catalog?.allGroupNames.length) {
    for (const groupName of catalog.allGroupNames) {
      const slug = slugifyHeader(groupName);
      cells.push(example.specs?.[slug] ?? "");
    }
  } else if (isCricketSport(sportSlug)) {
    cells.push(
      example.specs?.battingstyle ?? "Right Hand",
      example.specs?.bowlingstyle ?? "Right Arm Medium",
      example.specs?.specialization ?? "Top order",
    );
  }

  return cells.join(",");
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
  _headers: string[],
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
  const allowCrichero = isCricketSport(catalog?.sportSlug);

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
    const cricheroRaw =
      row["cricherourl"] || row["crichero_url"] || row["crichero"] || undefined;

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
      cricheroUrl: allowCrichero ? cricheroRaw : undefined,
      battingStyle: legacySlots[0] || undefined,
      bowlingStyle: legacySlots[1] || undefined,
      specialization: legacySlots[2] || undefined,
      specifications: specifications.length > 0 ? specifications : undefined,
    };
  });
}
