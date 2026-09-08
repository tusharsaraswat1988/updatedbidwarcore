/**
 * Standalone Player Registration — isolated schema (sr_*).
 *
 * NO foreign keys to BidWar `players`, `tournaments`, `global_players`,
 * or `badminton_registrations`. Independently removable.
 */
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  bigserial,
} from "drizzle-orm/pg-core";

export const srTournamentsTable = pgTable(
  "sr_tournaments",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    bannerUrl: text("banner_url"),
    registrationTitle: text("registration_title").notNull(),
    registrationDescription: text("registration_description"),
    /** Fee in smallest currency unit interpretation for Phase 1: whole INR rupees. */
    registrationFee: integer("registration_fee").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
    contactName: text("contact_name"),
    contactMobile: text("contact_mobile"),
    contactEmail: text("contact_email"),
    termsAndConditions: text("terms_and_conditions"),
    privacyNotice: text("privacy_notice"),
    successMessage: text("success_message"),
    paymentInstructions: text("payment_instructions"),
    registrationIdPrefix: text("registration_id_prefix").notNull(),
    /** Next sequence value to allocate (atomic increment in service layer). */
    nextRegistrationSeq: integer("next_registration_seq").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    allowDuplicateRegistrations: boolean("allow_duplicate_registrations")
      .notNull()
      .default(false),
    requireDeclaration: boolean("require_declaration").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_sr_tournaments_slug").on(t.slug),
    index("ix_sr_tournaments_is_active").on(t.isActive),
  ],
);

export const srFormFieldsTable = pgTable(
  "sr_form_fields",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    fieldKey: text("field_key").notNull(),
    label: text("label").notNull(),
    fieldType: text("field_type").notNull(),
    section: text("section").notNull().default("personal"),
    required: boolean("required").notNull().default(false),
    optionsJson: jsonb("options_json").$type<string[] | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_sr_form_fields_tournament_key").on(t.tournamentId, t.fieldKey),
    index("ix_sr_form_fields_tournament_order").on(t.tournamentId, t.sortOrder),
  ],
);

export const srCategoriesTable = pgTable(
  "sr_categories",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    minAge: integer("min_age"),
    maxAge: integer("max_age"),
    gender: text("gender"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_sr_categories_tournament_code").on(t.tournamentId, t.code),
    index("ix_sr_categories_tournament").on(t.tournamentId),
  ],
);

export const srRegistrationsTable = pgTable(
  "sr_registrations",
  {
    id: serial("id").primaryKey(),
    registrationId: text("registration_id").notNull(),
    tournamentId: integer("tournament_id").notNull(),
    playerName: text("player_name").notNull(),
    parentName: text("parent_name"),
    dateOfBirth: text("date_of_birth").notNull(),
    calculatedAge: integer("calculated_age").notNull(),
    gender: text("gender").notNull(),
    mobile: text("mobile").notNull(),
    whatsapp: text("whatsapp"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    playingRole: text("playing_role").notNull(),
    battingStyle: text("batting_style"),
    bowlingStyle: text("bowling_style"),
    cricketExperience: text("cricket_experience"),
    previousTournamentExperience: text("previous_tournament_experience"),
    jerseySize: text("jersey_size"),
    preferredJerseyNumber: text("preferred_jersey_number"),
    categoryId: integer("category_id"),
    cricketDataJson: jsonb("cricket_data_json").$type<Record<string, unknown> | null>(),
    fieldValuesJson: jsonb("field_values_json").$type<Record<string, unknown> | null>(),
    status: text("status").notNull().default("PAYMENT_PENDING"),
    declarationAccepted: boolean("declaration_accepted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_sr_registrations_registration_id").on(t.registrationId),
    /** same player (mobile) + same standalone tournament = duplicate */
    uniqueIndex("uq_sr_registrations_tournament_mobile").on(t.tournamentId, t.mobile),
    index("ix_sr_registrations_tournament_status").on(t.tournamentId, t.status),
    index("ix_sr_registrations_email").on(t.email),
    index("ix_sr_registrations_player_name").on(t.playerName),
  ],
);

export const srPaymentsTable = pgTable(
  "sr_payments",
  {
    id: serial("id").primaryKey(),
    registrationPk: integer("registration_pk").notNull(),
    registrationId: text("registration_id").notNull(),
    provider: text("provider").notNull().default("razorpay"),
    orderId: text("order_id"),
    paymentId: text("payment_id"),
    /** Always set from tournament config — never from client. */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("PENDING"),
    gatewayMetadata: jsonb("gateway_metadata").$type<Record<string, unknown> | null>(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_sr_payments_registration_pk").on(t.registrationPk),
    index("ix_sr_payments_registration_id").on(t.registrationId),
    index("ix_sr_payments_status").on(t.status),
    // Partial unique indexes for order_id / payment_id are defined in migration SQL
    // (uq_sr_payments_order_id / uq_sr_payments_payment_id WHERE NOT NULL).
  ],
);

/**
 * Document metadata only — no public URL storage for sensitive ID/age proofs.
 * Private/signed storage access lands in a later phase.
 */
export const srDocumentsTable = pgTable(
  "sr_documents",
  {
    id: serial("id").primaryKey(),
    registrationPk: integer("registration_pk").notNull(),
    documentType: text("document_type").notNull(),
    storageProvider: text("storage_provider").notNull().default("pending"),
    /** Opaque storage key — never a public CDN URL for sensitive docs. */
    storageKey: text("storage_key"),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    status: text("status").notNull().default("pending_upload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_sr_documents_registration_pk").on(t.registrationPk),
    index("ix_sr_documents_type").on(t.documentType),
  ],
);

export const srAuditLogsTable = pgTable(
  "sr_audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tournamentId: integer("tournament_id"),
    registrationPk: integer("registration_pk"),
    registrationId: text("registration_id"),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    detailsJson: jsonb("details_json").$type<Record<string, unknown> | null>(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_sr_audit_tournament_time").on(t.tournamentId, t.createdAt),
    index("ix_sr_audit_registration").on(t.registrationPk, t.createdAt),
    index("ix_sr_audit_action").on(t.action, t.createdAt),
  ],
);

export type SrTournament = typeof srTournamentsTable.$inferSelect;
export type SrFormField = typeof srFormFieldsTable.$inferSelect;
export type SrCategory = typeof srCategoriesTable.$inferSelect;
export type SrRegistration = typeof srRegistrationsTable.$inferSelect;
export type SrPayment = typeof srPaymentsTable.$inferSelect;
export type SrDocument = typeof srDocumentsTable.$inferSelect;
export type SrAuditLog = typeof srAuditLogsTable.$inferSelect;
