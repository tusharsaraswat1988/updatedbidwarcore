/**
 * @deprecated Use @workspace/api-base/tournament-workbook — kept for legacy auction-only imports.
 * Export/import uses this schema — new fields added here appear automatically in Excel.
 *
 * Registration fields (name, mobile, email, etc.) are intentionally excluded.
 * Auction roster fields on `players` + tournament profile extensions on `tournament_player_profiles`.
 */

export type AuctionFieldSource = "player" | "tournament_profile";

export type AuctionFieldType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "category_ref"
  | "team_ref";

export interface AuctionFieldDefinition {
  /** Internal key used in API payloads */
  key: string;
  /** Excel column header */
  label: string;
  source: AuctionFieldSource;
  /** Drizzle / DB column name (camelCase) */
  column: string;
  type: AuctionFieldType;
  editable: boolean;
  enumValues?: readonly string[];
  /** Display labels for enum values in export (key = stored value) */
  enumLabels?: Record<string, string>;
}

/** Locked identifier columns — present in export, never writable via import */
export const AUCTION_LOCKED_COLUMNS = [
  { key: "playerId", label: "Player ID", source: "player" as const, column: "id" },
  {
    key: "tournamentPlayerId",
    label: "Tournament Player ID",
    source: "tournament_profile" as const,
    column: "id",
  },
  { key: "tournamentId", label: "Tournament ID", source: "player" as const, column: "tournamentId" },
] as const;

export const PLAYER_AUCTION_STATUS_VALUES = [
  "available",
  "sold",
  "unsold",
  "retained",
  "withdrawn",
] as const;

export const PLAYER_TAG_VALUES = [
  "captain",
  "vice_captain",
  "owner",
  "co_owner",
  "booster",
  "icon",
  "star_player",
] as const;

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  sold: "Sold",
  unsold: "Unsold",
  retained: "Retained",
  withdrawn: "Withdrawn",
};

const TAG_LABELS: Record<string, string> = {
  captain: "Captain",
  vice_captain: "Vice Captain",
  owner: "Owner",
  co_owner: "Co-Owner",
  booster: "Booster",
  icon: "Icon",
  star_player: "Star Player",
};

/** Editable auction fields — dynamically drives export columns and import validation */
export const AUCTION_EDITABLE_FIELDS: AuctionFieldDefinition[] = [
  {
    key: "category",
    label: "Category",
    source: "player",
    column: "categoryId",
    type: "category_ref",
    editable: true,
  },
  {
    key: "subCategory",
    label: "Sub Category",
    source: "tournament_profile",
    column: "subCategory",
    type: "string",
    editable: true,
  },
  {
    key: "baseValue",
    label: "Base Value",
    source: "player",
    column: "basePrice",
    type: "number",
    editable: true,
  },
  {
    key: "auctionOrder",
    label: "Auction Order",
    source: "player",
    column: "serialNo",
    type: "number",
    editable: true,
  },
  {
    key: "auctionBatch",
    label: "Auction Batch",
    source: "tournament_profile",
    column: "auctionBatch",
    type: "string",
    editable: true,
  },
  {
    key: "seed",
    label: "Seed",
    source: "tournament_profile",
    column: "seedRank",
    type: "number",
    editable: true,
  },
  {
    key: "rating",
    label: "Rating",
    source: "tournament_profile",
    column: "rating",
    type: "number",
    editable: true,
  },
  {
    key: "priority",
    label: "Priority",
    source: "tournament_profile",
    column: "priority",
    type: "number",
    editable: true,
  },
  {
    key: "status",
    label: "Status",
    source: "player",
    column: "status",
    type: "enum",
    editable: true,
    enumValues: PLAYER_AUCTION_STATUS_VALUES,
    enumLabels: STATUS_LABELS,
  },
  {
    key: "currentTeam",
    label: "Current Team",
    source: "player",
    column: "teamId",
    type: "team_ref",
    editable: true,
  },
  {
    key: "soldPrice",
    label: "Sold Price",
    source: "player",
    column: "soldPrice",
    type: "number",
    editable: true,
  },
  {
    key: "retainedPrice",
    label: "Retained Price",
    source: "player",
    column: "retainedPrice",
    type: "number",
    editable: true,
  },
  {
    key: "wildcard",
    label: "Wildcard",
    source: "tournament_profile",
    column: "isWildcard",
    type: "boolean",
    editable: true,
  },
  {
    key: "captainEligible",
    label: "Captain Eligible",
    source: "player",
    column: "playerTag",
    type: "enum",
    editable: true,
    enumValues: PLAYER_TAG_VALUES,
    enumLabels: TAG_LABELS,
  },
  {
    key: "nonPlayingMember",
    label: "Non-Playing Member",
    source: "player",
    column: "isNonPlayingMember",
    type: "boolean",
    editable: true,
  },
  {
    key: "role",
    label: "Role",
    source: "player",
    column: "role",
    type: "string",
    editable: true,
  },
  {
    key: "specialization",
    label: "Specialization",
    source: "player",
    column: "specialization",
    type: "string",
    editable: true,
  },
  {
    key: "remarks",
    label: "Remarks",
    source: "tournament_profile",
    column: "remarks",
    type: "string",
    editable: true,
  },
  {
    key: "profileCategory",
    label: "Profile Category Label",
    source: "tournament_profile",
    column: "category",
    type: "string",
    editable: true,
  },
];

export function getExportColumnHeaders(): string[] {
  return [
    ...AUCTION_LOCKED_COLUMNS.map((c) => c.label),
    ...AUCTION_EDITABLE_FIELDS.map((f) => f.label),
  ];
}

export function buildLabelToFieldMap(): Map<string, AuctionFieldDefinition> {
  const map = new Map<string, AuctionFieldDefinition>();
  for (const field of AUCTION_EDITABLE_FIELDS) {
    map.set(field.label.toLowerCase(), field);
  }
  return map;
}

export function buildLockedLabelMap(): Map<string, (typeof AUCTION_LOCKED_COLUMNS)[number]> {
  const map = new Map<string, (typeof AUCTION_LOCKED_COLUMNS)[number]>();
  for (const col of AUCTION_LOCKED_COLUMNS) {
    map.set(col.label.toLowerCase(), col);
  }
  return map;
}

export function formatFieldForExport(
  field: AuctionFieldDefinition,
  raw: unknown,
  ctx: {
    categoryMap: Record<number, string>;
    teamMap: Record<number, string>;
  },
): string | number {
  if (raw == null || raw === "") return "";

  switch (field.type) {
    case "category_ref": {
      const id = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      return Number.isFinite(id) ? (ctx.categoryMap[id] ?? String(id)) : "";
    }
    case "team_ref": {
      const id = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      return Number.isFinite(id) ? (ctx.teamMap[id] ?? String(id)) : "";
    }
    case "boolean":
      return raw === true || raw === "true" || raw === "yes" || raw === "1" ? "Yes" : "No";
    case "enum": {
      const str = String(raw);
      return field.enumLabels?.[str] ?? str;
    }
    case "number":
      return typeof raw === "number" ? raw : parseInt(String(raw), 10) || "";
    default:
      return String(raw);
  }
}

export function normalizeBooleanInput(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  if (["yes", "true", "1", "y"].includes(s)) return true;
  if (["no", "false", "0", "n"].includes(s)) return false;
  return null;
}

export function normalizeStatusInput(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  const byLabel = Object.entries(STATUS_LABELS).find(
    ([, label]) => label.toLowerCase() === s,
  );
  if (byLabel) return byLabel[0];
  if ((PLAYER_AUCTION_STATUS_VALUES as readonly string[]).includes(s)) return s;
  return null;
}

export function normalizeTagInput(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase().replace(/\s+/g, "_");
  const byLabel = Object.entries(TAG_LABELS).find(
    ([, label]) => label.toLowerCase().replace(/\s+/g, "_") === s.replace(/\s+/g, "_"),
  );
  if (byLabel) return byLabel[0];
  if ((PLAYER_TAG_VALUES as readonly string[]).includes(s as (typeof PLAYER_TAG_VALUES)[number])) {
    return s;
  }
  return null;
}
