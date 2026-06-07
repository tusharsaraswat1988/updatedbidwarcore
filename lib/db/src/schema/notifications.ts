import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Audit trail for all outbound notifications (email, SMS, WhatsApp). */
export const notificationLogsTable = pgTable(
  "notification_logs",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    channel: text("channel").notNull(), // "email" | "sms" | "whatsapp"
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    recipientMobile: text("recipient_mobile"),
    tournamentId: integer("tournament_id"),
    organizerId: integer("organizer_id"),
    /** Prevents duplicate automatic sends for the same event + entity + channel. */
    dedupKey: text("dedup_key").notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "sent" | "failed" | "skipped"
    subject: text("subject"),
    providerResponse: text("provider_response"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_notification_logs_dedup_key").on(t.dedupKey),
    index("ix_notification_logs_event_type").on(t.eventType),
    index("ix_notification_logs_channel").on(t.channel),
    index("ix_notification_logs_status").on(t.status),
    index("ix_notification_logs_tournament_id").on(t.tournamentId),
    index("ix_notification_logs_created_at").on(t.createdAt),
  ],
);

export type NotificationLog = typeof notificationLogsTable.$inferSelect;
export type InsertNotificationLog = typeof notificationLogsTable.$inferInsert;
