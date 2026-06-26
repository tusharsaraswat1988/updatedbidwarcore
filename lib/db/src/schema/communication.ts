import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Communication delivery channels — email first; others plug in later. */
export const COMMUNICATION_CHANNELS = ["email", "sms", "whatsapp", "push", "in_app"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

/** Job lifecycle statuses. */
export const COMMUNICATION_JOB_STATUSES = [
  "draft",
  "pending",
  "ready_to_send",
  "queued",
  "processing",
  "delivered",
  "opened",
  "clicked",
  "soft_bounce",
  "hard_bounce",
  "spam",
  "failed",
  "cancelled",
] as const;
export type CommunicationJobStatus = (typeof COMMUNICATION_JOB_STATUSES)[number];

export const COMMUNICATION_PENDING_REASONS = [
  "email_missing",
  "template_disabled",
  "template_draft",
  "recipient_deleted",
  "validation_failed",
  "temporary_error",
  "auto_send_off",
] as const;
export type CommunicationPendingReason = (typeof COMMUNICATION_PENDING_REASONS)[number];

/** Reusable global assets (logos, footers, signatures, brand colors). */
export const communicationAssetsTable = pgTable(
  "communication_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    assetKey: text("asset_key").notNull(),
    assetType: text("asset_type").notNull(), // logo | banner | footer | signature | social_icons | brand_color
    content: text("content").notNull(), // URL, HTML snippet, or JSON for colors
    mimeType: text("mime_type"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_communication_assets_asset_key").on(t.assetKey),
    index("ix_communication_assets_asset_type").on(t.assetType),
  ],
);

/** Email templates — editable, versioned, auto-send configurable. */
export const communicationTemplatesTable = pgTable(
  "communication_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    internalKey: text("internal_key").notNull(),
    subject: text("subject").notNull().default(""),
    htmlBody: text("html_body").notNull().default(""),
    headerImageAssetId: uuid("header_image_asset_id"),
    footerHtml: text("footer_html"),
    signatureHtml: text("signature_html"),
    isActive: boolean("is_active").notNull().default(true),
    autoSend: boolean("auto_send").notNull().default(true),
    isDraft: boolean("is_draft").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    currentVersion: integer("current_version").notNull().default(1),
    eventType: text("event_type"), // maps to business event e.g. TEAM_OWNER_REGISTERED
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_communication_templates_internal_key").on(t.internalKey),
    index("ix_communication_templates_event_type").on(t.eventType),
    index("ix_communication_templates_is_active").on(t.isActive),
    index("ix_communication_templates_is_draft").on(t.isDraft),
  ],
);

/** Immutable template versions — sent emails reference the version used. */
export const communicationTemplateVersionsTable = pgTable(
  "communication_template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    headerImageAssetId: uuid("header_image_asset_id"),
    footerHtml: text("footer_html"),
    signatureHtml: text("signature_html"),
    changeNote: text("change_note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_communication_template_versions_tpl_ver").on(t.templateId, t.versionNumber),
    index("ix_communication_template_versions_template_id").on(t.templateId),
  ],
);

/**
 * Communication jobs — one job = one outbound message to one recipient.
 * Never send email directly from business logic; always create a job.
 */
export const communicationJobsTable = pgTable(
  "communication_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull().default("email"),
    templateId: uuid("template_id"),
    templateVersionId: uuid("template_version_id"),
    templateInternalKey: text("template_internal_key"),
    tournamentId: integer("tournament_id"),
    triggeredByEvent: text("triggered_by_event"),
    entityType: text("entity_type"), // team | player | organizer | sponsor | custom
    entityId: integer("entity_id"),
    status: text("status").notNull().default("pending"),
    pendingReason: text("pending_reason"),
    subject: text("subject"),
    htmlBody: text("html_body"),
    mergeData: jsonb("merge_data").$type<Record<string, unknown>>().notNull().default({}),
    /** Prevents duplicate automatic jobs for same event + entity + channel. */
    idempotencyKey: text("idempotency_key").notNull(),
    /** Parent job when resending — original job stays immutable. */
    parentJobId: uuid("parent_job_id"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(5),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    sentBy: text("sent_by").notNull().default("system"), // system | admin | bulk
    createdByAdmin: text("created_by_admin"),
    providerMessageId: text("provider_message_id"),
    errorMessage: text("error_message"),
    bulkCampaignId: uuid("bulk_campaign_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("ux_communication_jobs_idempotency_key").on(t.idempotencyKey),
    index("ix_communication_jobs_status").on(t.status),
    index("ix_communication_jobs_channel").on(t.channel),
    index("ix_communication_jobs_template_id").on(t.templateId),
    index("ix_communication_jobs_tournament_id").on(t.tournamentId),
    index("ix_communication_jobs_entity").on(t.entityType, t.entityId),
    index("ix_communication_jobs_created_at").on(t.createdAt),
    index("ix_communication_jobs_next_retry_at").on(t.nextRetryAt),
    index("ix_communication_jobs_pending_reason").on(t.pendingReason),
    index("ix_communication_jobs_bulk_campaign_id").on(t.bulkCampaignId),
  ],
);

/** Recipient details per job — supports future multi-recipient channels. */
export const communicationJobRecipientsTable = pgTable(
  "communication_job_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull(),
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    recipientRole: text("recipient_role"), // team_owner | player | organiser | sponsor | operator | custom
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_communication_job_recipients_job_id").on(t.jobId),
    index("ix_communication_job_recipients_email").on(t.recipientEmail),
    index("ix_communication_job_recipients_role").on(t.recipientRole),
  ],
);

/** Full audit trail for every status change, retry, edit, resend. */
export const communicationLogsTable = pgTable(
  "communication_logs",
  {
    id: serial("id").primaryKey(),
    jobId: uuid("job_id"),
    templateId: uuid("template_id"),
    templateVersionId: uuid("template_version_id"),
    action: text("action").notNull(), // created | status_changed | send_attempt | retry | resend | cancelled | edited
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    channel: text("channel").notNull().default("email"),
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    createdBy: text("created_by"),
    triggeredBy: text("triggered_by"),
    ipAddress: text("ip_address"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_communication_logs_job_id").on(t.jobId),
    index("ix_communication_logs_action").on(t.action),
    index("ix_communication_logs_created_at").on(t.createdAt),
    index("ix_communication_logs_recipient_email").on(t.recipientEmail),
  ],
);

/** Global communication settings (defaults, retry policy, etc.). */
export const communicationSettingsTable = pgTable(
  "communication_settings",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type CommunicationAsset = typeof communicationAssetsTable.$inferSelect;
export type InsertCommunicationAsset = typeof communicationAssetsTable.$inferInsert;
export type CommunicationTemplate = typeof communicationTemplatesTable.$inferSelect;
export type InsertCommunicationTemplate = typeof communicationTemplatesTable.$inferInsert;
export type CommunicationTemplateVersion = typeof communicationTemplateVersionsTable.$inferSelect;
export type CommunicationJob = typeof communicationJobsTable.$inferSelect;
export type InsertCommunicationJob = typeof communicationJobsTable.$inferInsert;
export type CommunicationJobRecipient = typeof communicationJobRecipientsTable.$inferSelect;
export type CommunicationLog = typeof communicationLogsTable.$inferSelect;
export type CommunicationSetting = typeof communicationSettingsTable.$inferSelect;
