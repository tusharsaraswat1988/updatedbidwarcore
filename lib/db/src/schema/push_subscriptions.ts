import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id:             serial("id").primaryKey(),
    tournamentId:   integer("tournament_id").notNull(),
    teamId:         integer("team_id").notNull(),
    endpoint:       text("endpoint").notNull().unique(),
    p256dh:         text("p256dh").notNull(),
    auth:           text("auth").notNull(),
    /** Set when subscription is created from a verified owner session. */
    verifiedAt:     timestamp("verified_at"),
    ownerSessionId: text("owner_session_id"),
    lastSeenAt:     timestamp("last_seen_at"),
    createdAt:      timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ix_push_subscriptions_tournament_id").on(t.tournamentId),
    index("ix_push_subscriptions_owner_session_id").on(t.ownerSessionId),
  ],
);
