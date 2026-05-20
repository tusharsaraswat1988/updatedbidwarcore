import { pgTable, serial, boolean, text, timestamp } from "drizzle-orm/pg-core";

// ─── SMS Notification Settings ────────────────────────────────────────────────
// Singleton row (at most one row). Controls DLT SMS notification toggles.
// All toggles default OFF. Master toggle (dltEnabled) gates all sub-toggles.
export const smsNotificationSettingsTable = pgTable("sms_notification_settings", {
  id: serial("id").primaryKey(),
  dltEnabled: boolean("dlt_enabled").notNull().default(false),
  teamOwnerEnabled: boolean("team_owner_enabled").notNull().default(false),
  teamOwnerTemplateId: text("team_owner_template_id"),
  playerSoldEnabled: boolean("player_sold_enabled").notNull().default(false),
  playerSoldTemplateId: text("player_sold_template_id"),
  viewerLinkEnabled: boolean("viewer_link_enabled").notNull().default(false),
  viewerLinkTemplateId: text("viewer_link_template_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SmsNotificationSettings = typeof smsNotificationSettingsTable.$inferSelect;
