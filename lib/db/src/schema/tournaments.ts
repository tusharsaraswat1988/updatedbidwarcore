import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  organizerId: integer("organizer_id"),
  name: text("name").notNull(),
  sport: text("sport").notNull().default("cricket"),
  venue: text("venue"),
  auctionDate: text("auction_date"),
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
  timerSeconds: integer("timer_seconds").notNull().default(30),
  bidTimerSeconds: integer("bid_timer_seconds").notNull().default(15),
  playerSelectionMode: text("player_selection_mode").notNull().default("sequential"),
  status: text("status").notNull().default("setup"),
  // Super admin controls
  licenseStatus: text("license_status").notNull().default("trial"),
  licenseGrantedAt: timestamp("license_granted_at", { withTimezone: true }),
  licenseGrantedBy: text("license_granted_by"),
  adminLocked: boolean("admin_locked").notNull().default(false),
  adminLockedAt: timestamp("admin_locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
