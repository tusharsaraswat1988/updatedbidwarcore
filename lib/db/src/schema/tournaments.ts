import { pgTable, text, serial, timestamp, integer, boolean, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  organizerId: integer("organizer_id"),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("cricket"),
  // Dynamic sport reference (Phase 2) — nullable for backward compat
  sportId: integer("sport_id"),
  // Unique 8-char auction code e.g. "RC732504" (Phase 1)
  auctionCode: text("auction_code"),
  venue: text("venue"),
  auctionDate: text("auction_date"),
  auctionTime: text("auction_time"), // 24h format, e.g. "14:00"
  organizerName: text("organizer_name"),
  organizerMobile: text("organizer_mobile"),
  organizerEmail: text("organizer_email"),
  organizerPassword: text("organizer_password"),
  logoUrl: text("logo_url"),
  sponsorLogos: text("sponsor_logos"),
  basePurse: integer("base_purse").notNull().default(10000000),
  minBid: integer("min_bid").notNull().default(100000),
  bidIncrement: integer("bid_increment").notNull().default(100000),
  bidTier1UpTo: integer("bid_tier1_up_to").notNull().default(100000),
  bidTier1Increment: integer("bid_tier1_increment").notNull().default(25000),
  bidTier2UpTo: integer("bid_tier2_up_to").notNull().default(200000),
  bidTier2Increment: integer("bid_tier2_increment").notNull().default(50000),
  bidTier3Increment: integer("bid_tier3_increment").notNull().default(100000),
  bidTiers: text("bid_tiers"),
  timerSeconds: integer("timer_seconds").notNull().default(10),
  bidTimerSeconds: integer("bid_timer_seconds").notNull().default(10),
  /** When enabled, bids in the last N seconds extend the timer instead of full reset */
  bidExtensionEnabled: boolean("bid_extension_enabled").notNull().default(false),
  bidExtensionThresholdSeconds: integer("bid_extension_threshold_seconds").notNull().default(3),
  bidExtensionSeconds: integer("bid_extension_seconds").notNull().default(5),
  playerSelectionMode: text("player_selection_mode").notNull().default("random"),
  status: text("status").notNull().default("setup"),
  // Player registration link controls
  registrationDeadline: text("registration_deadline"),
  registrationLimit: integer("registration_limit"),
  /** When true, public re-registration by mobile restores withdrawn players to the auction pool without organizer reinstate */
  autoApproveWithdrawnReRegistration: boolean("auto_approve_withdrawn_re_registration").notNull().default(false),
  // Registration payment verification (isolated from auction workflows)
  enableRegistrationPayment: boolean("enable_registration_payment").notNull().default(false),
  registrationFee: integer("registration_fee"),
  upiId: text("upi_id"),
  paymentVerificationMethod: text("payment_verification_method"), // utr | screenshot | utr_and_screenshot
  paymentCollectionMode: text("payment_collection_mode").notNull().default("manual_verification"),
  /** When enabled, public registration requires accepting organizer declaration points */
  enableRegistrationDeclaration: boolean("enable_registration_declaration").notNull().default(false),
  /** Newline-separated declaration/consent points shown on player registration form */
  registrationDeclarationText: text("registration_declaration_text"),
  /** Bid value assignment mode: system (default) or player self-selection at registration */
  bidValueMode: text("bid_value_mode").notNull().default("system"),
  /** JSON array of allowed bid values when bid_value_mode = player, e.g. [500,1000,1500] */
  bidValueOptions: text("bid_value_options"),
  // Super admin controls
  licenseStatus: text("license_status").notNull().default("trial"),
  licenseGrantedAt: timestamp("license_granted_at", { withTimezone: true }),
  licenseGrantedBy: text("license_granted_by"),
  adminLocked: boolean("admin_locked").notNull().default(false),
  adminLockedAt: timestamp("admin_locked_at", { withTimezone: true }),
  resetCount: integer("reset_count").notNull().default(0),
  lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
  lastResetBy: text("last_reset_by"),
  minimumSquadSize: integer("minimum_squad_size").notNull().default(0),
  maximumSquadSize: integer("maximum_squad_size").notNull().default(0),
  audioEnabled: boolean("audio_enabled").notNull().default(true),
  masterVolume: integer("master_volume").notNull().default(80),
  countdownSoundEnabled: boolean("countdown_sound_enabled").notNull().default(true),
  countdownSoundUrl: text("countdown_sound_url"),
  countdownSoundVolume: integer("countdown_sound_volume").notNull().default(70),
  soldSoundEnabled: boolean("sold_sound_enabled").notNull().default(true),
  soldSoundUrl: text("sold_sound_url"),
  soldSoundVolume: integer("sold_sound_volume").notNull().default(80),
  // Break-end sound (plays on LED display when a break countdown expires)
  breakEndMusicEnabled: boolean("break_end_sound_enabled").notNull().default(false),
  breakEndMusicUrl: text("break_end_sound_url"),
  breakEndMusicVolume: integer("break_end_sound_volume").notNull().default(80),
  // Cheer messages (live viewer interactive reactions)
  cheerMessagesEnabled: boolean("cheer_messages_enabled").notNull().default(true),
  cheerMessagePresets: text("cheer_message_presets"), // JSON array of up to 10 strings
  cheerCooldownSeconds: integer("cheer_cooldown_seconds").notNull().default(2),
  cheerHeatMeterEnabled: boolean("cheer_heat_meter_enabled").notNull().default(false),
  cheerFanBattleEnabled: boolean("cheer_fan_battle_enabled").notNull().default(false),
  // Main Banner — full-screen broadcast overlay for felicitation/announcements
  mainBannerUrl: text("main_banner_url"),
  mainBannerEnabled: boolean("main_banner_enabled").notNull().default(false),
  mainBannerFit: text("main_banner_fit").notNull().default("cover"),
  // BidWar Local — premium offline auction feature
  localModeEnabled: boolean("local_mode_enabled").notNull().default(false),
  exportToken: text("export_token"),
  exportTokenExpiresAt: timestamp("export_token_expires_at", { withTimezone: true }),
  // Replay prevention: set to now() after a successful /sync call;
  // subsequent /sync attempts with the same token are rejected.
  exportTokenSyncedAt: timestamp("export_token_synced_at", { withTimezone: true }),
  // Operational visibility: updated on every successful /mirror call.
  exportTokenLastMirrorAt: timestamp("export_token_last_mirror_at", { withTimezone: true }),
  // Match schedule — comma-separated ISO dates e.g. "2025-03-18,2025-03-19"
  // When set, player availability is shown as date checkboxes instead of free text.
  // When null/empty, availability field is hidden everywhere.
  matchDates: text("match_dates"),
  /** Organizer toggles for optional public registration form fields. */
  registrationFieldsJson: jsonb("registration_fields_json").$type<{
    hidden?: string[];
  }>(),
  // Scoring module (orthogonal to auction status)
  scoringEnabled: boolean("scoring_enabled").notNull().default(false),
  scoringPhase: text("scoring_phase").notNull().default("disabled"),
  /** Optional delegate PIN for scoring without organizer JWT (V1). */
  scoringPin: text("scoring_pin"),
  scoringSettingsJson: jsonb("scoring_settings_json").$type<Record<string, unknown>>(),
  /** Per-tournament module feature flags — see @workspace/api-base/tournament-features */
  featuresJson: jsonb("features_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
},
(t) => [
  uniqueIndex("ix_tournaments_auction_code").on(t.auctionCode),
]);

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
