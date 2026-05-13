import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizersTable = pgTable("organizers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  mobile: text("mobile").unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  googleEmail: text("google_email"),
  licenseStatus: text("license_status").notNull().default("pending"),
  maxTournaments: integer("max_tournaments").notNull().default(1),
  notes: text("notes"),
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
