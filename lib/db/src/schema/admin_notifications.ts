import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/** Platform admin in-app notification inbox. */
export const adminNotificationsTable = pgTable(
  "admin_notifications",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    priority: text("priority").notNull().default("info"),
    category: text("category").notNull().default("System"),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    actionUrl: text("action_url"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("ix_admin_notifications_is_read").on(t.isRead),
    index("ix_admin_notifications_priority").on(t.priority),
    index("ix_admin_notifications_type").on(t.type),
    index("ix_admin_notifications_created_at").on(t.createdAt),
  ],
);

/** Single-row platform settings for admin notification delivery. */
export const adminNotificationSettingsTable = pgTable("admin_notification_settings", {
  id: serial("id").primaryKey(),
  adminName: text("admin_name").notNull().default(""),
  adminEmail: text("admin_email").notNull().default(""),
  adminMobile: text("admin_mobile"),
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(true),
  inAppNotificationsEnabled: boolean("in_app_notifications_enabled").notNull().default(true),
  liveNotificationsEnabled: boolean("live_notifications_enabled").notNull().default(true),
  notificationSoundEnabled: boolean("notification_sound_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AdminNotification = typeof adminNotificationsTable.$inferSelect;
export type InsertAdminNotification = typeof adminNotificationsTable.$inferInsert;
export type AdminNotificationSettings = typeof adminNotificationSettingsTable.$inferSelect;
