import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments.js";
import { organizersTable } from "./organizers.js";

export const tournamentLicenseRequestsTable = pgTable(
  "tournament_license_requests",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournamentsTable.id, { onDelete: "cascade" }),
    organizerId: integer("organizer_id")
      .notNull()
      .references(() => organizersTable.id, { onDelete: "cascade" }),
    requestedModules: text("requested_modules").notNull().default("auction"), // 'auction' | 'scoring' | 'both'
    status: text("status").notNull().default("pending"), // 'pending' | 'granted' | 'rejected'
    organizerMobile: text("organizer_mobile"),
    notes: text("notes"),

    // Payment verification audit fields
    paymentVerified: boolean("payment_verified").notNull().default(false),
    paymentAmount: integer("payment_amount"),
    paymentMode: text("payment_mode"), // 'upi' | 'bank_transfer' | 'cash' | 'waiver' | 'other'
    paymentRef: text("payment_ref"), // UTR / transaction reference / receipt ID
    verifiedBy: text("verified_by"), // Admin user email / identifier
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_tournament_license_requests_tournament_id").on(t.tournamentId),
    index("ix_tournament_license_requests_organizer_id").on(t.organizerId),
    index("ix_tournament_license_requests_status").on(t.status),
    index("ix_tournament_license_requests_created_at").on(t.createdAt),
  ],
);

export const insertTournamentLicenseRequestSchema = createInsertSchema(tournamentLicenseRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTournamentLicenseRequest = z.infer<typeof insertTournamentLicenseRequestSchema>;
export type TournamentLicenseRequest = typeof tournamentLicenseRequestsTable.$inferSelect;
