/**
 * Sport-aware CSV and Excel import/export helpers for bulk player upload.
 * Supports dynamic role_spec_groups columns with legacy header aliases.
 */

import { parseIndianMobile } from "@workspace/api-base/mobile";
import { jerseySizeLabel, normalizeJerseySize, type JerseySize } from "@workspace/api-base/jersey-size";
import { normalizeLowerSize, type LowerSize } from "@workspace/api-base/lower-size";
import { getSportCapabilities } from "@workspace/platform-core";

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

export interface CategoryOption {
  id: number;
  name: string;
  minBid?: number | null;
}

export interface TeamOption {
  id: number;
  name: string;
  shortCode?: string | null;
}

export interface ParsePlayerFileOptions {
  catalog?: SportSpecCatalog | null;
  categories?: CategoryOption[];
  teams?: TeamOption[];
  defaultMinBid?: number;
}

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

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[*_]/g, " ").replace(/\s+/g, " ").trim();
}

export function slugifyHeader(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export function isCricketSport(sportSlug: string | null | undefined): boolean {
  return getSportCapabilities(sportSlug).hasLegacyCricketSpecs;
}

export function buildBaseCsvHeaders(sportSlug: string | null | undefined): string[] {
  const headers: string[] = [...BASE_HEADERS];
  if (getSportCapabilities(sportSlug).hasLegacyCricketSpecs) {
    headers.push(...CRICKET_ONLY_HEADERS);
  }
  return headers;
}

export async function fetchSportSpecCatalog(sportSlug: string): Promise<SportSpecCatalog> {
  const sport = sportSlug.trim().toLowerCase();
  if (!sport) {
    return { sportSlug: "", roles: [], groupsByRole: new Map(), allGroupNames: [] };
  }
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
  const sportSlug = catalog?.sportSlug ?? "";
  const caps = getSportCapabilities(sportSlug);
  const base = buildBaseCsvHeaders(sportSlug);
  const specCols = catalog?.allGroupNames.map(slugifyHeader) ?? (
    caps.hasLegacyCricketSpecs ? [...LEGACY_CRICKET_SPEC_HEADERS] : []
  );
  return [...base, ...specCols].join(",");
}

export function buildCsvTemplateExampleRow(catalog: SportSpecCatalog | null): string {
  const sportSlug = catalog?.sportSlug ?? "";
  const caps = getSportCapabilities(sportSlug);
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
    jerseySizeLabel(example.jerseySize),
    example.achievements,
    example.mobileNumber,
    example.email,
    example.availabilityDates,
  ];

  if (caps.hasLegacyCricketSpecs) {
    cells.push(example.cricheroUrl ?? "");
  }

  if (catalog?.allGroupNames.length) {
    for (const groupName of catalog.allGroupNames) {
      const slug = slugifyHeader(groupName);
      cells.push(example.specs?.[slug] ?? "");
    }
  } else if (caps.hasLegacyCricketSpecs) {
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
  mobileNumber?: string;
  categoryId?: number;
  categoryName?: string;
  teamId?: number;
  teamName?: string;
  role?: string;
  city?: string;
  age?: number;
  gender?: "M" | "F";
  jerseyNumber?: string;
  jerseySize?: JerseySize;
  lowerSize?: LowerSize;
  achievements?: string;
  email?: string;
  availabilityDates?: string;
  cricheroUrl?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  specialization?: string;
  playerTag?: string;
  status?: "available" | "retained" | "sold" | "unsold";
  retainedPrice?: number;
  photoUrl?: string;
  isNonPlayingMember?: boolean;
  specifications?: { specGroupId: number; value: string }[];
  rowNumber?: number;
  validationErrors?: string[];
  validationWarnings?: string[];
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

function normalizeGender(raw?: string): "M" | "F" | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "m" || s === "male" || s.startsWith("m")) return "M";
  if (s === "f" || s === "female" || s.startsWith("f")) return "F";
  return undefined;
}

function normalizePlayerTag(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const clean = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["captain", "vice_captain", "owner", "co_owner", "booster", "icon", "star_player"].includes(clean)) {
    return clean;
  }
  return undefined;
}

function normalizeStatus(raw?: string): "available" | "retained" | "sold" | "unsold" | undefined {
  if (!raw?.trim()) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === "retained" || lower === "retain") return "retained";
  if (lower === "available") return "available";
  if (lower === "sold") return "sold";
  if (lower === "unsold") return "unsold";
  return undefined;
}

function getRowField(row: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    const val = row[a] || row[normalizeHeader(a)] || row[slugifyHeader(a)];
    if (val != null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return "";
}

/**
 * Standard RFC-4180 CSV parser that properly preserves commas inside quotes.
 */
export function parseCsvRows(raw: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let current = "";

  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n") {
        row.push(current.trim());
        if (row.some((c) => c.length > 0)) {
          result.push(row);
        }
        row = [];
        current = "";
      } else {
        current += char;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((c) => c.length > 0)) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Parses structured row objects (from Excel sheet_to_json or CSV) into typed ParsedBulkPlayer items.
 */
export function parsePlayerSpreadsheetRows(
  rawRows: Record<string, unknown>[],
  options?: ParsePlayerFileOptions,
): ParsedBulkPlayer[] {
  const catalog = options?.catalog ?? null;
  const allowCrichero = getSportCapabilities(catalog?.sportSlug).hasLegacyCricketSpecs;
  const defaultMinBid = options?.defaultMinBid ?? 100000;
  const seenMobiles = new Set<string>();

  return rawRows.map((rawRow, index) => {
    const rowNumber = index + 2; // header is row 1
    const errors: string[] = [];
    const warnings: string[] = [];

    // Normalize keys in row
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      if (v == null) continue;
      const cleanVal = String(v).trim();
      row[normalizeHeader(k)] = cleanVal;
      row[slugifyHeader(k)] = cleanVal;
    }

    const name = getRowField(row, "name", "player name", "player");
    if (!name) {
      errors.push("Player name is required");
    }

    const mobileRaw = getRowField(row, "mobile number", "mobile", "mobile_number", "phone", "contact");
    let mobileNormalized: string | undefined = undefined;
    if (!mobileRaw) {
      errors.push("Mobile number is required");
    } else {
      const mobileParsed = parseIndianMobile(mobileRaw);
      if (!mobileParsed.ok) {
        errors.push(`Invalid mobile "${mobileRaw}": ${mobileParsed.error}`);
      } else if (seenMobiles.has(mobileParsed.normalized)) {
        errors.push(`Duplicate mobile ${mobileParsed.normalized} in upload file`);
      } else {
        seenMobiles.add(mobileParsed.normalized);
        mobileNormalized = mobileParsed.normalized;
      }
    }

    // Category Resolution
    const categoryRaw = getRowField(row, "category", "category name", "category_name", "cat");
    let categoryId: number | undefined;
    let categoryName: string | undefined;
    if (categoryRaw && options?.categories && options.categories.length > 0) {
      const catClean = categoryRaw.toLowerCase().trim();
      const matched = options.categories.find((c) => c.name.toLowerCase().trim() === catClean);
      if (matched) {
        categoryId = matched.id;
        categoryName = matched.name;
      } else {
        warnings.push(`Category "${categoryRaw}" not found in tournament; player will be unassigned`);
      }
    }

    // Team Resolution
    const teamRaw = getRowField(row, "team", "team name", "team_name", "team code", "team_code");
    let teamId: number | undefined;
    let teamName: string | undefined;
    if (teamRaw && options?.teams && options.teams.length > 0) {
      const tClean = teamRaw.toLowerCase().trim();
      const matched = options.teams.find(
        (t) =>
          t.name.toLowerCase().trim() === tClean ||
          (t.shortCode && t.shortCode.toLowerCase().trim() === tClean),
      );
      if (matched) {
        teamId = matched.id;
        teamName = matched.name;
      } else {
        warnings.push(`Team "${teamRaw}" not found in tournament`);
      }
    }

    // Base Price
    const basePriceRaw = getRowField(row, "base price", "base_price", "baseprice", "base value", "price");
    const basePriceNum = basePriceRaw ? parseInt(basePriceRaw.replace(/[^0-9]/g, ""), 10) : NaN;
    const basePrice = !isNaN(basePriceNum) && basePriceNum > 0 ? basePriceNum : defaultMinBid;

    // Retained Price & Status
    const statusRaw = getRowField(row, "status", "auction status");
    let status = normalizeStatus(statusRaw);
    if (!status && teamId) {
      status = "retained";
    } else if (!status) {
      status = "available";
    }

    const retainedPriceRaw = getRowField(row, "retained price", "retained_price", "retention price");
    const retainedPrice = retainedPriceRaw ? parseInt(retainedPriceRaw.replace(/[^0-9]/g, ""), 10) : undefined;

    // Role & Specifications
    const role = getRowField(row, "role", "player role") || undefined;
    const roleKey = role?.toLowerCase().trim() ?? "";
    const roleGroups = catalog?.groupsByRole.get(roleKey) ?? [];

    const specifications: { specGroupId: number; value: string }[] = [];
    const legacySlots: string[] = ["", "", ""];

    roleGroups.forEach((group, idx) => {
      const value = resolveSpecValueForGroup(group, idx, row, Object.keys(row));
      if (!value) return;
      specifications.push({ specGroupId: group.id, value });
      if (idx < 3) legacySlots[idx] = value;
    });

    if (specifications.length === 0 && !catalog) {
      legacySlots[0] = getRowField(row, "batting hand", "batting style", "battingstyle", "batting_style");
      legacySlots[1] = getRowField(row, "bowling arm", "bowling style", "bowlingstyle", "bowling_style");
      legacySlots[2] = getRowField(row, "specialization");
    }

    // Apparel sizes
    const jerseySizeRaw = getRowField(row, "jersey size", "jerseysize", "jersey_size");
    const jerseySize = normalizeJerseySize(jerseySizeRaw) ?? undefined;

    const lowerSizeRaw = getRowField(row, "lower size", "lowersize", "lower_size", "pant size");
    const lowerSize = normalizeLowerSize(lowerSizeRaw) ?? undefined;

    // Other attributes
    const city = getRowField(row, "city", "location") || undefined;
    const ageRaw = getRowField(row, "age");
    const age = ageRaw ? parseInt(ageRaw.replace(/[^0-9]/g, ""), 10) || undefined : undefined;
    const gender = normalizeGender(getRowField(row, "gender", "sex"));
    const jerseyNumber = getRowField(row, "jersey number", "jersey #", "jersey_number", "jersey no") || undefined;
    const achievements = getRowField(row, "achievements", "bio", "notes") || undefined;
    const email = getRowField(row, "email", "email address") || undefined;
    const availabilityDates = getRowField(row, "availability dates", "availability_dates", "availability") || undefined;
    const cricheroRaw = getRowField(row, "crichero url", "cricherourl", "crichero_url", "crichero") || undefined;
    const photoUrl = getRowField(row, "photo url", "photourl", "photo_url", "photo", "image") || undefined;
    const playerTag = normalizePlayerTag(getRowField(row, "player tag", "playertag", "player_tag", "tag"));

    return {
      name: name || "Unknown",
      mobileNumber: mobileNormalized || mobileRaw || undefined,
      basePrice,
      categoryId,
      categoryName,
      teamId,
      teamName,
      role,
      city,
      age,
      gender,
      jerseyNumber,
      jerseySize,
      lowerSize,
      achievements,
      email,
      availabilityDates,
      cricheroUrl: allowCrichero ? cricheroRaw : undefined,
      battingStyle: legacySlots[0] || undefined,
      bowlingStyle: legacySlots[1] || undefined,
      specialization: legacySlots[2] || undefined,
      status,
      retainedPrice,
      playerTag,
      photoUrl,
      specifications: specifications.length > 0 ? specifications : undefined,
      rowNumber,
      validationErrors: errors.length > 0 ? errors : undefined,
      validationWarnings: warnings.length > 0 ? warnings : undefined,
    };
  });
}

/**
 * Parses raw CSV text into ParsedBulkPlayer items.
 */
export function parsePlayerCsv(
  raw: string,
  catalog: SportSpecCatalog | null,
  options?: ParsePlayerFileOptions,
): ParsedBulkPlayer[] {
  const lines = parseCsvRows(raw);
  if (lines.length < 2) return [];

  const headers = lines[0]!.map((h) => h.trim());
  const rawRows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i]!;
    const rowObj: Record<string, string> = {};
    headers.forEach((h, hIdx) => {
      rowObj[h] = vals[hIdx] ?? "";
    });
    rawRows.push(rowObj);
  }

  return parsePlayerSpreadsheetRows(rawRows, {
    ...options,
    catalog: catalog ?? options?.catalog ?? null,
  });
}

/**
 * Parses any uploaded File (.xlsx, .xls, .csv) into ParsedBulkPlayer items.
 */
export async function parsePlayerFile(
  file: File,
  options?: ParsePlayerFileOptions,
): Promise<ParsedBulkPlayer[]> {
  const isExcel =
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel";

  if (isExcel) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    // Pick first non-reference sheet
    const sheetName =
      wb.SheetNames.find(
        (s) => !s.startsWith("_REF") && !s.toLowerCase().includes("instruction"),
      ) || wb.SheetNames[0];

    if (!sheetName) throw new Error("No readable worksheet found in the uploaded file.");
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error("Worksheet could not be read.");

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    return parsePlayerSpreadsheetRows(rawRows, options);
  }

  // Fallback to text CSV reading
  const text = await file.text();
  return parsePlayerCsv(text, options?.catalog ?? null, options);
}
