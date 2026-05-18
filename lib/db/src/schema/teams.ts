import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  name: text("name").notNull(),
  shortCode: text("short_code").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerMobile: text("owner_mobile"),
  color: text("color").default("#3B82F6"),
  logoUrl: text("logo_url"),
  purse: integer("purse").notNull().default(10000000),
  purseUsed: integer("purse_used").notNull().default(0),
  isBiddingEnabled: boolean("is_bidding_enabled").notNull().default(true),
  accessCode: text("access_code"),
  // WhatsApp consent (Meta-compliant opt-in for team owner)
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
  whatsappConsentAt: timestamp("whatsapp_consent_at", { withTimezone: true }),
  whatsappConsentMethod: text("whatsapp_consent_method"), // "whatsapp_otp_verified"|"web_checkbox"|"organizer_declaration"|"web_fallback"
  whatsappConsentIp: text("whatsapp_consent_ip"),
  whatsappConsentOrgId: integer("whatsapp_consent_org_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
