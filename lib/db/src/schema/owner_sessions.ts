import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

/** Verified owner browser session — created after successful access-code verification. */
export const ownerSessionsTable = pgTable(
  "owner_sessions",
  {
    id:           text("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    teamId:       integer("team_id").notNull(),
    verifiedAt:   timestamp("verified_at").notNull().defaultNow(),
    expiresAt:    timestamp("expires_at").notNull(),
    lastSeenAt:   timestamp("last_seen_at").notNull().defaultNow(),
    createdAt:    timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ix_owner_sessions_tournament_team").on(t.tournamentId, t.teamId),
    index("ix_owner_sessions_expires_at").on(t.expiresAt),
  ],
);
