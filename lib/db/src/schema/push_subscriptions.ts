import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id:           serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  teamId:       integer("team_id").notNull(),
  endpoint:     text("endpoint").notNull().unique(),
  p256dh:       text("p256dh").notNull(),
  auth:         text("auth").notNull(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});
