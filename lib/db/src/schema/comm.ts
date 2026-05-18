import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ─── Consent Tokens ────────────────────────────────────────────────────────────
// Short-lived tokens sent via SMS to link a mobile number to a wa.me consent flow.
export const consentTokensTable = pgTable(
  "consent_tokens",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull().unique(),
    recipientType: text("recipient_type").notNull(), // "player"|"team_owner"|"organizer"
    recipientId: integer("recipient_id").notNull(),
    mobile: text("mobile").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("ix_consent_tokens_token").on(t.token),
    index("ix_consent_tokens_mobile").on(t.mobile),
  ],
);

// ─── OTP Sessions ─────────────────────────────────────────────────────────────
// Short-lived OTP for identity verification in the WhatsApp consent bot flow.
export const otpSessionsTable = pgTable(
  "otp_sessions",
  {
    id: serial("id").primaryKey(),
    mobile: text("mobile").notNull(),
    otpHash: text("otp_hash").notNull(), // bcrypt hash of the 6-digit OTP
    purpose: text("purpose").notNull().default("wa_consent"), // "wa_consent"
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("ix_otp_sessions_mobile").on(t.mobile),
  ],
);

// ─── Comm Logs ────────────────────────────────────────────────────────────────
// Full audit trail of every message sent (WhatsApp, SMS, or both).
export const commLogsTable = pgTable(
  "comm_logs",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id"),
    recipientType: text("recipient_type").notNull(), // "player"|"team_owner"|"organizer"|"manual"
    recipientId: integer("recipient_id"),
    recipientMobile: text("recipient_mobile").notNull(),
    channel: text("channel").notNull(), // "whatsapp"|"sms"|"both"
    templateName: text("template_name"), // Meta template name, null for free-form
    messageContent: text("message_content").notNull(),
    sentByAdminId: text("sent_by_admin_id"), // null = automated (scheduler)
    blastId: text("blast_id"), // groups messages from a single blast operation
    deliveryStatus: text("delivery_status").notNull().default("pending"), // "pending"|"sent"|"delivered"|"read"|"failed"
    deliveryUpdatedAt: timestamp("delivery_updated_at", { withTimezone: true }),
    metaMessageId: text("meta_message_id"), // WhatsApp message SID from Meta/Twilio
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_comm_logs_tournament_id").on(t.tournamentId),
    index("ix_comm_logs_recipient_mobile").on(t.recipientMobile),
    index("ix_comm_logs_sent_at").on(t.sentAt),
    index("ix_comm_logs_blast_id").on(t.blastId),
  ],
);

// ─── Consent Blast Log ────────────────────────────────────────────────────────
// Deduplication guard for the 24-hour automated consent blast scheduler.
export const consentBlastLogTable = pgTable(
  "consent_blast_log",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    mobile: text("mobile").notNull(),
    blastDate: text("blast_date").notNull(), // "YYYY-MM-DD"
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_consent_blast_log").on(t.tournamentId, t.mobile, t.blastDate),
  ],
);

// ─── WhatsApp Quality Log ─────────────────────────────────────────────────────
// Records Meta quality rating events for the WhatsApp Business number.
export const waQualityLogTable = pgTable(
  "wa_quality_log",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(), // "quality_update"|"template_status_update"
    phoneNumber: text("phone_number"),
    qualityRating: text("quality_rating"), // "GREEN"|"YELLOW"|"RED"
    templateName: text("template_name"),
    templateStatus: text("template_status"), // "APPROVED"|"REJECTED"|"PAUSED"
    rawPayload: text("raw_payload"), // JSON stringified webhook body
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type ConsentToken = typeof consentTokensTable.$inferSelect;
export type OtpSession = typeof otpSessionsTable.$inferSelect;
export type CommLog = typeof commLogsTable.$inferSelect;
export type ConsentBlastEntry = typeof consentBlastLogTable.$inferSelect;
export type WaQualityEvent = typeof waQualityLogTable.$inferSelect;
