import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    categoryId: integer("category_id"),
    teamId: integer("team_id"),
    name: text("name").notNull(),
    city: text("city"),
    role: text("role"),
    battingStyle: text("batting_style"),
    bowlingStyle: text("bowling_style"),
    age: integer("age"),
    photoUrl: text("photo_url"),
    basePrice: integer("base_price").notNull().default(100000),
    soldPrice: integer("sold_price"),
    retainedPrice: integer("retained_price"),
    status: text("status").notNull().default("available"), // available | sold | unsold | retained
    jerseyNumber: text("jersey_number"),
    achievements: text("achievements"),
    mobileNumber: text("mobile_number").notNull().default(""),
    cricheroUrl: text("crichero_url"),
    availabilityDates: text("availability_dates"),
    specialization: text("specialization"),
    // Global identity — links this tournament-scoped player to a cross-tournament
    // canonical identity in global_players. Null until manually or automatically linked.
    globalPlayerId: text("global_player_id"),
    // WhatsApp consent (Meta-compliant opt-in)
    whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
    whatsappConsentAt: timestamp("whatsapp_consent_at", { withTimezone: true }),
    whatsappConsentMethod: text("whatsapp_consent_method"), // "whatsapp_otp_verified"|"web_checkbox"|"organizer_declaration"|"web_fallback"
    whatsappConsentIp: text("whatsapp_consent_ip"),
    whatsappConsentOrgId: integer("whatsapp_consent_org_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_players_tournament_id").on(t.tournamentId),
    index("ix_players_mobile_number").on(t.mobileNumber),
    index("ix_players_name").on(t.name),
    index("ix_players_global_player_id").on(t.globalPlayerId),
  ],
);

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
