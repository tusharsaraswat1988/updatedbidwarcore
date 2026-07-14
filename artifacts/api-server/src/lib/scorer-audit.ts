/**
 * Business audit for scorer / organizer scoring actions.
 * Do not mix with operational logs (auth failures, heartbeat, cleanup ticks).
 */

import { db, scorerAuditLogTable, type ScorerAuditActorType } from "@workspace/db";

export const SCORER_AUDIT_ACTIONS = [
  "login",
  "logout",
  "lock_acquired",
  "lock_released",
  "lock_expired",
  "lock_reacquired",
  "force_unlock",
  "point_added",
  "point_removed",
  "undo",
  "redo",
  "service_changed",
  "side_changed",
  "match_started",
  "match_finished",
  "timeout",
  "interval",
  "court_change_ack",
] as const;

export type ScorerAuditAction = (typeof SCORER_AUDIT_ACTIONS)[number] | string;

export type WriteScorerAuditInput = {
  actorType: ScorerAuditActorType;
  actorId?: string | null;
  scorerId?: number | null;
  sessionId?: string | null;
  tournamentId?: number | null;
  matchId?: number | null;
  sport?: string | null;
  action: ScorerAuditAction;
  payload?: Record<string, unknown> | null;
};

export async function writeScorerAudit(input: WriteScorerAuditInput): Promise<void> {
  await db.insert(scorerAuditLogTable).values({
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    scorerId: input.scorerId ?? null,
    sessionId: input.sessionId ?? null,
    tournamentId: input.tournamentId ?? null,
    matchId: input.matchId ?? null,
    sport: input.sport ?? null,
    action: input.action,
    payload: input.payload ?? null,
  });
}
