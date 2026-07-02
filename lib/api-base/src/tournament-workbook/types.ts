/** BidWar Master Workbook (BMW) — BidWar's official tournament data exchange format */

export {
  BMW_VERSION,
  BMW_SPEC_VERSION,
  BMW_COMPATIBILITY_VERSION,
  BMW_IMPORT_ENGINE_VERSION,
  BMW_GENERATOR_VERSION,
  BMW_TEMPLATE_VERSION,
  TMW_VERSION,
} from "./manifest";

export type WorkbookImportMode =
  | "create_tournament"
  | "update_tournament"
  | "merge_data"
  | "replace_data"
  | "clone_tournament"
  | "dry_run"
  | "rollback_previous";

export const WORKBOOK_IMPORT_MODES: WorkbookImportMode[] = [
  "create_tournament",
  "update_tournament",
  "merge_data",
  "replace_data",
  "clone_tournament",
  "dry_run",
  "rollback_previous",
];

export type WorkbookSourceType = "excel" | "google_sheets" | "zip_package" | "google_drive_folder";

export type FieldEditability = "readonly" | "editable" | "auto";

export type WorkbookFieldType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "date"
  | "url"
  | "photo_url"
  | "category_ref"
  | "team_ref"
  | "json"
  | "asset_ref";

export interface WorkbookFieldDefinition {
  key: string;
  label: string;
  type: WorkbookFieldType;
  editability: FieldEditability;
  required?: boolean;
  enumValues?: readonly string[];
  enumLabels?: Record<string, string>;
  /** DB entity + column mapping for import commit */
  entity?: string;
  column?: string;
  description?: string;
  /** Sport-specific — only shown/validated for matching sports */
  sportFilter?: string[];
}

export interface WorkbookSheetDefinition {
  /** Internal sheet name — never rename */
  name: string;
  title: string;
  order: number;
  fields: WorkbookFieldDefinition[];
  /** Columns to freeze (1-based count from left) */
  freezeColumns?: number;
  hidden?: boolean;
}

export type WorkbookSheetData = Record<string, unknown>[];

export interface ParsedWorkbook {
  version: string;
  sheets: Record<string, WorkbookSheetData>;
  sourceType: WorkbookSourceType;
  sourceLabel?: string;
  manifest?: import("./manifest.ts").BmwManifest | null;
  isLegacy?: boolean;
  /** Local media files from ZIP package import */
  localMedia?: Record<string, string>;
}

export type WorkbookIssue = {
  sheet: string;
  row: number;
  column?: string;
  identity?: string;
  severity: "error" | "warning" | "suggestion";
  message: string;
  code?: string;
};

export type WorkbookPreviewSummary = {
  rowsTotal: number;
  creates: number;
  updates: number;
  skips: number;
  deletes: number;
  errors: number;
  warnings: number;
  suggestions: number;
  changedFields: string[];
  sheetsProcessed: string[];
};

export type WorkbookValidationResult = {
  valid: boolean;
  mode: WorkbookImportMode;
  dryRun: boolean;
  issues: WorkbookIssue[];
  summary: WorkbookPreviewSummary;
  /** Staged changes keyed by sheet */
  staged: Record<string, unknown>;
  health?: import("./health-score.ts").WorkbookHealthScore;
  diffs?: import("./field-diff.ts").FieldDiff[];
  aiSuggestions?: import("./ai-suggestions.ts").ImportSuggestion[];
  manifest?: import("./manifest.ts").BmwManifest | null;
};

export type PlayerIdentityMatch = {
  strategy: "registration_code" | "registration_id" | "mobile" | "email" | "name_dob" | "create_new";
  playerId?: number;
  isNew: boolean;
};

/** Asset entity types for 09_Assets sheet */
export type AssetEntityType = "Player" | "Team" | "Tournament" | "Sponsor" | "Category" | "Organizer";
export type AssetMediaType = "Photo" | "Logo" | "Banner" | "Video" | "Document";
export type AssetSource = "Google Drive" | "Google Photos" | "Dropbox" | "OneDrive" | "Direct URL" | "Local" | "S3" | "Azure";
export type AssetStatus = "Pending" | "Downloaded" | "Uploaded" | "Failed" | "Skipped";

export type WorkbookAssetRow = {
  entityType: AssetEntityType;
  entityName: string;
  mediaType: AssetMediaType;
  source: AssetSource;
  url: string;
  targetFolder?: string;
  status?: AssetStatus;
};
