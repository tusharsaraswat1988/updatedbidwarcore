import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  ownerSessionsTable,
  pushSubscriptionsTable,
  teamsTable,
} from "@workspace/db";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  clearOwnerSessionCookie,
  setOwnerSessionCookie,
  verifyOwnerSessionJwt,
  OWNER_COOKIE_NAME,
} from "./jwt";

const OWNER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type VerifiedOwnerSession = {
  sessionId: string;
  tournamentId: number;
  teamId: number;
  verifiedAt: Date;
  expiresAt: Date;
};

function readOwnerCookie(req: Request): string | undefined {
  const raw = req.cookies?.[OWNER_COOKIE_NAME];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export async function createVerifiedOwnerSession(
  res: Response,
  tournamentId: number,
  teamId: number,
): Promise<VerifiedOwnerSession> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OWNER_SESSION_TTL_MS);
  const sessionId = randomUUID();

  await db.insert(ownerSessionsTable).values({
    id: sessionId,
    tournamentId,
    teamId,
    verifiedAt: now,
    expiresAt,
    lastSeenAt: now,
  });

  setOwnerSessionCookie(res, { sessionId, tournamentId, teamId });

  return { sessionId, tournamentId, teamId, verifiedAt: now, expiresAt };
}

export async function touchOwnerSession(sessionId: string): Promise<void> {
  await db
    .update(ownerSessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(ownerSessionsTable.id, sessionId));
}

export async function loadOwnerSession(sessionId: string): Promise<VerifiedOwnerSession | null> {
  const [row] = await db
    .select()
    .from(ownerSessionsTable)
    .where(eq(ownerSessionsTable.id, sessionId));
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return {
    sessionId: row.id,
    tournamentId: row.tournamentId,
    teamId: row.teamId,
    verifiedAt: row.verifiedAt,
    expiresAt: row.expiresAt,
  };
}

export type OwnerSessionAuthResult =
  | { ok: true; session: VerifiedOwnerSession }
  | { ok: false; status: 401 | 403; error: string };

/** Validates owner session cookie + DB row for the requested tournament/team. */
export async function requireVerifiedOwnerSession(
  req: Request,
  tournamentId: number,
  teamId: number,
): Promise<OwnerSessionAuthResult> {
  const token = readOwnerCookie(req);
  if (!token) {
    return { ok: false, status: 401, error: "Owner session required" };
  }

  const claims = verifyOwnerSessionJwt(token);
  if (!claims) {
    return { ok: false, status: 401, error: "Invalid or expired owner session" };
  }

  if (claims.tournamentId !== tournamentId || claims.teamId !== teamId) {
    return { ok: false, status: 403, error: "Owner session not authorized for this team" };
  }

  const session = await loadOwnerSession(claims.sessionId);
  if (!session) {
    return { ok: false, status: 401, error: "Owner session expired" };
  }

  if (session.tournamentId !== tournamentId || session.teamId !== teamId) {
    return { ok: false, status: 403, error: "Owner session not authorized for this team" };
  }

  void touchOwnerSession(session.sessionId);
  return { ok: true, session };
}

export async function revokeOwnerSession(
  req: Request,
  res: Response,
  tournamentId: number,
  teamId: number,
): Promise<boolean> {
  const auth = await requireVerifiedOwnerSession(req, tournamentId, teamId);
  if (!auth.ok) return false;

  await deleteOwnerSessionById(auth.session.sessionId);
  clearOwnerSessionCookie(res);
  return true;
}

export async function deleteOwnerSessionById(sessionId: string): Promise<void> {
  await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.ownerSessionId, sessionId));
  await db.delete(ownerSessionsTable).where(eq(ownerSessionsTable.id, sessionId));
}

export async function deletePushSubscriptionsForTeam(
  tournamentId: number,
  teamId: number,
): Promise<void> {
  await db
    .delete(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.tournamentId, tournamentId),
      eq(pushSubscriptionsTable.teamId, teamId),
    ));
}

export async function deleteOwnerSessionsForTeam(
  tournamentId: number,
  teamId: number,
): Promise<void> {
  const sessions = await db
    .select({ id: ownerSessionsTable.id })
    .from(ownerSessionsTable)
    .where(and(
      eq(ownerSessionsTable.tournamentId, tournamentId),
      eq(ownerSessionsTable.teamId, teamId),
    ));

  if (sessions.length === 0) return;

  const ids = sessions.map((s) => s.id);
  await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.ownerSessionId, ids));
  await db.delete(ownerSessionsTable).where(inArray(ownerSessionsTable.id, ids));
}

export async function deleteOwnerSessionsForTournament(tournamentId: number): Promise<void> {
  const sessions = await db
    .select({ id: ownerSessionsTable.id })
    .from(ownerSessionsTable)
    .where(eq(ownerSessionsTable.tournamentId, tournamentId));

  if (sessions.length > 0) {
    const ids = sessions.map((s) => s.id);
    await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.ownerSessionId, ids));
  }

  await db.delete(ownerSessionsTable).where(eq(ownerSessionsTable.tournamentId, tournamentId));
}

/** Removes expired sessions and orphaned / unverified push subscriptions. */
export async function cleanupStalePushData(): Promise<void> {
  const now = new Date();

  const expiredSessions = await db
    .select({ id: ownerSessionsTable.id })
    .from(ownerSessionsTable)
    .where(lt(ownerSessionsTable.expiresAt, now));

  if (expiredSessions.length > 0) {
    const ids = expiredSessions.map((s) => s.id);
    await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.ownerSessionId, ids));
    await db.delete(ownerSessionsTable).where(inArray(ownerSessionsTable.id, ids));
  }

  // Legacy rows without verification metadata (should not exist post-migration).
  await db
    .delete(pushSubscriptionsTable)
    .where(sql`${pushSubscriptionsTable.verifiedAt} IS NULL OR ${pushSubscriptionsTable.ownerSessionId} IS NULL`);

  // Subscriptions pointing at deleted sessions.
  await db.execute(sql`
    DELETE FROM push_subscriptions ps
    WHERE ps.owner_session_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM owner_sessions os
        WHERE os.id = ps.owner_session_id
          AND os.expires_at > NOW()
      )
  `);

  // Subscriptions for teams that no longer exist.
  await db.execute(sql`
    DELETE FROM push_subscriptions ps
    WHERE NOT EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = ps.team_id AND t.tournament_id = ps.tournament_id
    )
  `);
}

export async function assertTeamInTournament(
  tournamentId: number,
  teamId: number,
): Promise<boolean> {
  const [team] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)));
  return !!team;
}
