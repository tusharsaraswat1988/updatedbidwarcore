import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const brandingAssetsTable = pgTable(
  "branding_assets",
  {
    id: serial("id").primaryKey(),
    assetType: text("asset_type").notNull(),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    width: integer("width"),
    height: integer("height"),
    fileSize: integer("file_size"),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("branding_assets_asset_type_active_idx").on(table.assetType),
  ],
);
