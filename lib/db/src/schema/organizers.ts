import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizersTable = pgTable("organizers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  mobile: text("mobile").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  googleEmail: text("google_email"),
  /** Google Sheets OAuth — refresh token for exporting player rosters. */
  googleSheetsRefreshToken: text("google_sheets_refresh_token"),
  googleSheetsAccessToken: text("google_sheets_access_token"),
  googleSheetsTokenExpiry: timestamp("google_sheets_token_expiry", { withTimezone: true }),
  googleSheetsConnectedEmail: text("google_sheets_connected_email"),
  licenseStatus: text("license_status").notNull().default("active"),
  maxTournaments: integer("max_tournaments").notNull().default(1),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  photoPublicId: text("photo_public_id"),
  // WhatsApp consent (Meta-compliant opt-in for organizer account)
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
  whatsappConsentAt: timestamp("whatsapp_consent_at", { withTimezone: true }),
  whatsappConsentMethod: text("whatsapp_consent_method"), // "whatsapp_otp_verified"|"web_checkbox"|"organizer_declaration"|"web_fallback"
  whatsappConsentIp: text("whatsapp_consent_ip"),
  /** True only after SMS OTP verification (or grandfathered real mobile / admin override). */
  phoneVerified: boolean("phone_verified").notNull().default(false),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrganizerSchema = createInsertSchema(organizersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganizer = z.infer<typeof insertOrganizerSchema>;
export type Organizer = typeof organizersTable.$inferSelect;
