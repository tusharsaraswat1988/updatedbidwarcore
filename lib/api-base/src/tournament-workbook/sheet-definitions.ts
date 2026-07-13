import type { WorkbookSheetDefinition } from "./types";
import { BMW_MANIFEST_SHEET } from "./manifest";

export const PLAYER_STATUS_VALUES = [
  "available",
  "sold",
  "unsold",
  "retained",
  "withdrawn",
] as const;

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  sold: "Sold",
  unsold: "Unsold",
  retained: "Retained",
  withdrawn: "Withdrawn",
};

/** Canonical BMW reference sheet names — stable forever */
export const REF_SHEET_CATEGORIES = "_REF_Categories";
export const REF_SHEET_TEAMS = "_REF_Teams";
export const REF_SHEET_STATUS = "_REF_Status";
export const REF_SHEET_ROLES = "_REF_Roles";
export const REF_SHEET_SETTINGS = "_REF_Settings";
export const REF_SHEET_YES_NO = "_REF_YesNo";
export const REF_SHEET_SPORTS = "_REF_Sports";
export const REF_SHEET_GENDER = "_REF_Gender";

/** @deprecated Legacy TMW ref sheet names — read-only compat */
export const LEGACY_REF_SHEET_CATEGORIES = "_Ref_Categories";
export const LEGACY_REF_SHEET_TEAMS = "_Ref_Teams";
export const LEGACY_REF_SHEET_STATUS = "_Ref_Status";
export const LEGACY_REF_SHEET_ROLES = "_Ref_Roles";

export const INSTRUCTIONS_SHEET = "00_Instructions";
export const SUMMARY_SHEET = "00_Summary";

/** Data sheets used as live dropdown sources in exported workbooks */
export const BMW_CATEGORY_SHEET = "02_Categories";
export const BMW_TEAM_SHEET = "04_Teams";
export const BMW_CATEGORY_NAME_HEADER = "Category Name";
export const BMW_TEAM_NAME_HEADER = "Team Name";

/** All BMW data sheets — metadata-driven; new fields auto-appear in export/import */
export const BMW_SHEETS: WorkbookSheetDefinition[] = [
  {
    name: "01_Tournament",
    title: "Tournament Details",
    order: 1,
    freezeColumns: 1,
    fields: [
      { key: "name", label: "Tournament Name", type: "string", editability: "editable", required: true, entity: "tournament", column: "name" },
      { key: "sport", label: "Sport", type: "string", editability: "editable", required: true, entity: "tournament", column: "sport", description: "Cricket, Badminton, Football, Volleyball, Kabaddi, Tennis, Table Tennis, etc." },
      { key: "season", label: "Season", type: "string", editability: "editable" },
      { key: "logo", label: "Logo", type: "photo_url", editability: "editable", entity: "tournament", column: "logoUrl" },
      { key: "banner", label: "Banner", type: "photo_url", editability: "editable", entity: "tournament", column: "mainBannerUrl" },
      { key: "venue", label: "Venue", type: "string", editability: "editable", entity: "tournament", column: "venue" },
      { key: "city", label: "City", type: "string", editability: "editable", entity: "tournament", column: "city" },
      { key: "description", label: "Description", type: "string", editability: "editable" },
      { key: "auctionDate", label: "Auction Date", type: "date", editability: "editable", entity: "tournament", column: "auctionDate" },
      { key: "matchDates", label: "Match Dates", type: "string", editability: "editable", entity: "tournament", column: "matchDates" },
      { key: "currency", label: "Currency", type: "string", editability: "editable" },
      { key: "budget", label: "Budget", type: "number", editability: "editable", entity: "tournament", column: "basePurse" },
      { key: "minBid", label: "Minimum Bid", type: "number", editability: "editable", entity: "tournament", column: "minBid" },
      { key: "bidIncrement", label: "Bid Increment", type: "number", editability: "editable", entity: "tournament", column: "bidIncrement" },
      { key: "status", label: "Status", type: "enum", editability: "editable", entity: "tournament", column: "status", enumValues: ["setup", "active", "paused", "completed"] },
      { key: "timezone", label: "Timezone", type: "string", editability: "editable" },
      { key: "organizer", label: "Organizer", type: "string", editability: "editable", entity: "tournament", column: "organizerName" },
      { key: "photosFolder", label: "Player Photos Folder", type: "url", editability: "editable", description: "Google Drive folder URL for bulk photo import" },
    ],
  },
  {
    name: "02_Categories",
    title: "Categories",
    order: 2,
    freezeColumns: 1,
    fields: [
      { key: "name", label: "Category Name", type: "string", editability: "editable", required: true, entity: "category", column: "name" },
      { key: "code", label: "Category Code", type: "string", editability: "editable" },
      { key: "gender", label: "Gender", type: "string", editability: "editable" },
      { key: "ageGroup", label: "Age Group", type: "string", editability: "editable" },
      { key: "priority", label: "Priority", type: "number", editability: "editable", entity: "category", column: "sortOrder" },
      { key: "minPlayers", label: "Min Players", type: "number", editability: "editable" },
      { key: "maxPlayers", label: "Max Players", type: "number", editability: "editable", entity: "category", column: "maxPlayers" },
      { key: "budget", label: "Budget", type: "number", editability: "editable", entity: "category", column: "minBid" },
      { key: "status", label: "Status", type: "string", editability: "editable" },
      { key: "remarks", label: "Remarks", type: "string", editability: "editable" },
    ],
  },
  {
    name: "03_Players",
    title: "Players",
    order: 3,
    freezeColumns: 3,
    fields: [
      { key: "registrationCode", label: "Registration Code", type: "string", editability: "auto", required: false, description: "Portable identity — recommended unique identifier (never a database ID)" },
      { key: "playerId", label: "BidWar Player ID", type: "number", editability: "readonly", required: false, entity: "player", column: "id", description: "Stable database ID from export — do not edit. Used for round-trip Replace/Merge imports." },
      { key: "name", label: "Player Name", type: "string", editability: "editable", required: true, entity: "player", column: "name" },
      { key: "mobile", label: "Mobile", type: "string", editability: "editable", entity: "player", column: "mobileNumber" },
      { key: "email", label: "Email", type: "string", editability: "editable", entity: "player", column: "email" },
      { key: "dob", label: "DOB", type: "date", editability: "editable" },
      { key: "gender", label: "Gender", type: "enum", editability: "editable", entity: "player", column: "gender", enumValues: ["M", "F", ""], enumLabels: { M: "Male", F: "Female", "": "Not specified" } },
      { key: "city", label: "City", type: "string", editability: "editable", entity: "player", column: "city" },
      { key: "state", label: "State", type: "string", editability: "editable" },
      { key: "country", label: "Country", type: "string", editability: "editable" },
      { key: "photoUrl", label: "Photo URL", type: "photo_url", editability: "editable", entity: "player", column: "photoUrl" },
      { key: "category", label: "Category", type: "category_ref", editability: "editable", entity: "player", column: "categoryId" },
      { key: "subCategory", label: "Sub Category", type: "string", editability: "editable", entity: "tournament_profile", column: "subCategory" },
      { key: "role", label: "Role", type: "string", editability: "editable", entity: "player", column: "role", description: "Sport-specific — see _REF_Roles" },
      { key: "baseValue", label: "Base Value", type: "number", editability: "editable", entity: "player", column: "basePrice" },
      { key: "seed", label: "Seed", type: "number", editability: "editable", entity: "tournament_profile", column: "seedRank" },
      { key: "priority", label: "Priority", type: "number", editability: "editable", entity: "tournament_profile", column: "priority" },
      { key: "rating", label: "Rating", type: "number", editability: "editable", entity: "tournament_profile", column: "rating" },
      { key: "auctionOrder", label: "Auction Order", type: "number", editability: "editable", entity: "player", column: "serialNo" },
      { key: "status", label: "Status", type: "enum", editability: "editable", entity: "player", column: "status", enumValues: PLAYER_STATUS_VALUES, enumLabels: STATUS_LABELS },
      { key: "currentTeam", label: "Current Team", type: "team_ref", editability: "editable", entity: "player", column: "teamId" },
      { key: "retained", label: "Retained", type: "boolean", editability: "editable" },
      { key: "retainedPrice", label: "Retained Price", type: "number", editability: "editable", entity: "player", column: "retainedPrice" },
      { key: "soldPrice", label: "Sold Price", type: "number", editability: "editable", entity: "player", column: "soldPrice" },
      { key: "captain", label: "Captain", type: "boolean", editability: "editable" },
      { key: "viceCaptain", label: "Vice Captain", type: "boolean", editability: "editable" },
      { key: "wildcard", label: "Wildcard", type: "boolean", editability: "editable", entity: "tournament_profile", column: "isWildcard" },
      { key: "specialTags", label: "Special Tags", type: "string", editability: "editable", entity: "player", column: "playerTag" },
      { key: "remarks", label: "Remarks", type: "string", editability: "editable", entity: "tournament_profile", column: "remarks" },
    ],
  },
  {
    name: "04_Teams",
    title: "Teams",
    order: 4,
    freezeColumns: 1,
    fields: [
      { key: "name", label: "Team Name", type: "string", editability: "editable", required: true, entity: "team", column: "name" },
      { key: "ownerName", label: "Owner Name", type: "string", editability: "editable", entity: "team", column: "ownerName" },
      { key: "ownerMobile", label: "Owner Mobile", type: "string", editability: "editable", entity: "team", column: "ownerMobile" },
      { key: "email", label: "Email", type: "string", editability: "editable", entity: "team", column: "ownerEmail" },
      { key: "logoUrl", label: "Logo URL", type: "photo_url", editability: "editable", entity: "team", column: "logoUrl" },
      { key: "primaryColor", label: "Primary Color", type: "string", editability: "editable", entity: "team", column: "color" },
      { key: "secondaryColor", label: "Secondary Color", type: "string", editability: "editable" },
      { key: "budget", label: "Budget", type: "number", editability: "editable", entity: "team", column: "purse" },
      { key: "remainingBudget", label: "Remaining Budget", type: "number", editability: "auto", entity: "team", column: "purseUsed" },
      { key: "manager", label: "Manager", type: "string", editability: "editable" },
      { key: "coach", label: "Coach", type: "string", editability: "editable" },
      { key: "captain", label: "Captain", type: "string", editability: "editable" },
      { key: "remarks", label: "Remarks", type: "string", editability: "editable" },
    ],
  },
  {
    name: "05_Sponsors",
    title: "Sponsors",
    order: 5,
    freezeColumns: 1,
    fields: [
      { key: "name", label: "Sponsor Name", type: "string", editability: "editable", required: true, entity: "sponsor", column: "name" },
      { key: "category", label: "Category", type: "string", editability: "editable", entity: "sponsor", column: "type" },
      { key: "priority", label: "Priority", type: "number", editability: "editable", entity: "sponsor", column: "sponsorPriority" },
      { key: "logoUrl", label: "Logo URL", type: "photo_url", editability: "editable", entity: "sponsor", column: "url" },
      { key: "website", label: "Website", type: "url", editability: "editable" },
      { key: "status", label: "Status", type: "string", editability: "editable" },
      { key: "remarks", label: "Remarks", type: "string", editability: "editable" },
    ],
  },
  {
    name: "06_Auction_Settings",
    title: "Auction Settings",
    order: 6,
    fields: [
      { key: "auctionTimer", label: "Auction Timer", type: "number", editability: "editable", entity: "tournament", column: "timerSeconds" },
      { key: "bidTimer", label: "Bid Timer", type: "number", editability: "editable", entity: "tournament", column: "bidTimerSeconds" },
      { key: "bidIncrement", label: "Bid Increment", type: "number", editability: "editable", entity: "tournament", column: "bidIncrement" },
      { key: "minBid", label: "Reserve Price", type: "number", editability: "editable", entity: "tournament", column: "minBid" },
      { key: "playerSelectionMode", label: "Nomination Rules", type: "enum", editability: "editable", entity: "tournament", column: "playerSelectionMode", enumValues: ["sequential", "random", "manual"] },
      { key: "bidExtensionEnabled", label: "Pause Rules", type: "boolean", editability: "editable", entity: "tournament", column: "bidExtensionEnabled" },
    ],
  },
  {
    name: "07_Match_Settings",
    title: "Match Settings",
    order: 7,
    fields: [
      { key: "scoringEnabled", label: "Scoring Enabled", type: "boolean", editability: "editable", entity: "tournament", column: "scoringEnabled" },
      { key: "scoringPhase", label: "Scoring Phase", type: "string", editability: "editable", entity: "tournament", column: "scoringPhase" },
      { key: "sportRules", label: "Sport Specific Settings", type: "json", editability: "editable", entity: "tournament", column: "scoringSettingsJson", description: "JSON — sport-specific match configuration" },
    ],
  },
  {
    name: "08_Organizers",
    title: "Organizers",
    order: 8,
    fields: [
      { key: "name", label: "Name", type: "string", editability: "editable", entity: "tournament", column: "organizerName" },
      { key: "email", label: "Email", type: "string", editability: "editable", entity: "tournament", column: "organizerEmail" },
      { key: "mobile", label: "Mobile", type: "string", editability: "editable", entity: "tournament", column: "organizerMobile" },
      { key: "role", label: "Role", type: "string", editability: "editable" },
      { key: "permission", label: "Permission", type: "string", editability: "editable" },
      { key: "status", label: "Status", type: "string", editability: "editable" },
    ],
  },
  {
    name: "09_Assets",
    title: "Assets",
    order: 9,
    fields: [
      { key: "entityType", label: "Entity Type", type: "enum", editability: "editable", required: true, enumValues: ["Player", "Team", "Tournament", "Sponsor", "Category", "Organizer"] },
      { key: "entityName", label: "Entity Name", type: "string", editability: "editable", required: true },
      { key: "mediaType", label: "Media Type", type: "enum", editability: "editable", required: true, enumValues: ["Photo", "Logo", "Banner", "Video", "Document"] },
      { key: "source", label: "Source", type: "enum", editability: "editable", enumValues: ["Google Drive", "Google Photos", "Dropbox", "OneDrive", "Direct URL", "Local", "S3", "Azure"] },
      { key: "url", label: "URL", type: "url", editability: "editable" },
      { key: "targetFolder", label: "Target Folder", type: "string", editability: "editable" },
      { key: "status", label: "Status", type: "enum", editability: "auto", enumValues: ["Pending", "Downloaded", "Uploaded", "Failed", "Skipped"] },
    ],
  },
];

/** @deprecated Use BMW_SHEETS */
export const TMW_SHEETS = BMW_SHEETS;

export function getSheetByName(name: string): WorkbookSheetDefinition | undefined {
  return BMW_SHEETS.find((s) => s.name === name);
}

export function getSheetFieldLabels(sheetName: string): string[] {
  const sheet = getSheetByName(sheetName);
  return sheet?.fields.map((f) => f.label) ?? [];
}

export function buildFieldLabelMap(sheetName: string): Map<string, import("./types.ts").WorkbookFieldDefinition> {
  const sheet = getSheetByName(sheetName);
  const map = new Map<string, import("./types.ts").WorkbookFieldDefinition>();
  if (!sheet) return map;
  for (const f of sheet.fields) {
    map.set(f.label.toLowerCase(), f);
  }
  return map;
}

/** Portable Registration Code — no database IDs */
export function buildRegistrationCode(mobile: string | null | undefined, name: string, auctionCode?: string | null): string {
  const normalizedMobile = (mobile ?? "").replace(/\D/g, "");
  if (normalizedMobile.length >= 10) return normalizedMobile;
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32);
  const prefix = auctionCode?.trim() || "BID";
  return `${prefix}-${slug}`;
}

/** @deprecated Use buildRegistrationCode */
export const buildRegistrationId = buildRegistrationCode;

export function normalizeMobile(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  const raw = String(value).trim();
  if (/e/i.test(raw)) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return String(Math.trunc(parsed));
  }
  return raw.replace(/\D/g, "");
}

export function normalizeRegistrationCode(code: string): string {
  const trimmed = code.trim();
  const asMobile = normalizeMobile(trimmed);
  if (asMobile.length >= 10) return asMobile;
  return trimmed.toLowerCase();
}

/** Read stable player id from BMW row (export round-trip). */
export function getPlayerIdFromWorkbookRow(row: Record<string, unknown>): number | null {
  const raw = row["BidWar Player ID"] ?? row["Player ID"] ?? row.playerId;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Resolve registration code from row — supports legacy "Registration ID" header */
export function getRegistrationCodeFromRow(row: Record<string, unknown>): string {
  return String(
    row["Registration Code"] ?? row["Registration ID"] ?? row.registrationCode ?? row.registrationId ?? "",
  ).trim();
}

export const HIDDEN_SHEETS = [
  BMW_MANIFEST_SHEET,
  SUMMARY_SHEET,
  REF_SHEET_CATEGORIES,
  REF_SHEET_TEAMS,
  REF_SHEET_STATUS,
  REF_SHEET_ROLES,
  REF_SHEET_SETTINGS,
  REF_SHEET_YES_NO,
  REF_SHEET_SPORTS,
  REF_SHEET_GENDER,
  LEGACY_REF_SHEET_CATEGORIES,
  LEGACY_REF_SHEET_TEAMS,
  LEGACY_REF_SHEET_STATUS,
  LEGACY_REF_SHEET_ROLES,
  INSTRUCTIONS_SHEET,
] as const;

export function isHiddenSheet(name: string): boolean {
  return HIDDEN_SHEETS.includes(name as typeof HIDDEN_SHEETS[number])
    || name.startsWith("_REF_")
    || name.startsWith("_Ref_")
    || name === BMW_MANIFEST_SHEET;
}
