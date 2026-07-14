import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Global scorer identity — independent of tournament officials roster. */
export const scorerAccountsTable = pgTable(
  "scorer_accounts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    mobile: text("mobile").notNull(),
    pinHash: text("pin_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("uq_scorer_accounts_mobile").on(t.mobile)],
);

/** Active login sessions for scorers (unlimited concurrent sessions). */
export const scorerSessionsTable = pgTable(
  "scorer_sessions",
  {
    id: text("id").primaryKey(),
    scorerId: integer("scorer_id").notNull(),
    deviceName: text("device_name"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("ix_scorer_sessions_scorer_id").on(t.scorerId),
    index("ix_scorer_sessions_expires_at").on(t.expiresAt),
  ],
);

/**
 * Sport-agnostic match lock — one active lock per canonical match_id
 * (`scoring_matches.id`). Lock service never knows which sport owns the match.
 */
export const scorerMatchLocksTable = pgTable(
  "scorer_match_locks",
  {
    matchId: integer("match_id").primaryKey(),
    scorerId: integer("scorer_id").notNull(),
    sessionId: text("session_id").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ix_scorer_match_locks_session_id").on(t.sessionId),
    index("ix_scorer_match_locks_last_heartbeat").on(t.lastHeartbeatAt),
  ],
);

export type ScorerAuditActorType = "scorer" | "organizer" | "admin" | "system";

/** Business audit trail for scorer / organizer scoring actions. */
export const scorerAuditLogTable = pgTable(
  "scorer_audit_log",
  {
    id: serial("id").primaryKey(),
    actorType: text("actor_type").notNull().$type<ScorerAuditActorType>(),
    actorId: text("actor_id"),
    scorerId: integer("scorer_id"),
    sessionId: text("session_id"),
    tournamentId: integer("tournament_id"),
    matchId: integer("match_id"),
    sport: text("sport"),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_scorer_audit_log_match_id").on(t.matchId),
    index("ix_scorer_audit_log_tournament_id").on(t.tournamentId),
    index("ix_scorer_audit_log_scorer_id").on(t.scorerId),
    index("ix_scorer_audit_log_created_at").on(t.createdAt),
    index("ix_scorer_audit_log_action").on(t.action),
  ],
);

export type ScorerAccount = typeof scorerAccountsTable.$inferSelect;
export type ScorerSession = typeof scorerSessionsTable.$inferSelect;
export type ScorerMatchLock = typeof scorerMatchLocksTable.$inferSelect;
export type ScorerAuditLog = typeof scorerAuditLogTable.$inferSelect;
