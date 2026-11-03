import type { Request, Response } from "express";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import {
  db,
  organizerSessionsTable,
  generateOrganizerSessionId,
  type OrganizerSession,
} from "@workspace/db";
import {
  COOKIE_NAME,
  JWT_EXPIRY,
  type AuthClaims,
  computeTokenHash,
  setAuthCookie,
  clearAuthCookie,
  signAuthJwt,
} from "./jwt";
import { authCookieBaseOptions } from "./auth-cookie-options";
import { logger } from "./logger";

export interface CreateOrganizerSessionOptions {
  organizerAccountId?: number;
  tournamentId?: number;
  sessionScope?: "account" | "tournament_password";
  memberId?: string | null;
  claims: AuthClaims;
  req?: Request;
  ttlSec?: number;
}

/**
 * Returns true if strict database session validation is enforced.
 * Defaults to true unless explicitly disabled during legacy migration window.
 */
export function isOrganizerSessionRevocationEnforced(): boolean {
  if (process.env.ENFORCE_ORGANIZER_SESSION_REVOCATION === "false") {
    return false;
  }
  return true;
}

function extractRequestMeta(req?: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
} {
  if (!req) {
    return { ipAddress: null, userAgent: null, deviceName: null };
  }
  const xff = req.headers["x-forwarded-for"];
  const ip = typeof xff === "string" ? xff.split(",")[0]?.trim() : (req.socket?.remoteAddress ?? null);
  const ua = (req.headers["user-agent"] as string) || null;
  let device = "Browser";
  if (ua) {
    if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
      device = ua.includes("Android") ? "Android" : ua.includes("iPhone") ? "iPhone" : "Mobile";
    } else if (ua.includes("Macintosh")) {
      device = "Mac";
    } else if (ua.includes("Windows")) {
      device = "Windows";
    } else if (ua.includes("Linux")) {
      device = "Linux";
    }
  }
  return { ipAddress: ip ?? null, userAgent: ua, deviceName: device };
}

/**
 * Creates an immutable server-side session row and mints a JWT bound to that session.
 */
export async function createOrganizerSession(
  res: Response,
  options: CreateOrganizerSessionOptions,
): Promise<{ sessionId: string; token: string; tokenHash: string }> {
  const sessionId = generateOrganizerSessionId();
  const now = new Date();
  const ttl = options.ttlSec ?? JWT_EXPIRY;
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  const meta = extractRequestMeta(options.req);

  const claimsWithSession: AuthClaims = {
    ...options.claims,
    sessionId,
  };

  const { token, tokenHash } = setAuthCookie(res, claimsWithSession);

  const scope =
    options.sessionScope ??
    (options.tournamentId && !options.organizerAccountId
      ? "tournament_password"
      : "account");

  await db.insert(organizerSessionsTable).values({
    id: sessionId,
    organizerAccountId: options.organizerAccountId ?? null,
    memberId: options.memberId ?? null,
    tournamentId: options.tournamentId ?? null,
    sessionScope: scope,
    tokenHash,
    deviceName: meta.deviceName,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    expiresAt,
    revokedAt: null,
    createdAt: now,
    lastSeenAt: now,
  });

  return { sessionId, token, tokenHash };
}

/**
 * Loads active session from database if unrevoked and unexpired.
 */
export async function loadActiveOrganizerSession(
  sessionId: string,
): Promise<OrganizerSession | null> {
  const now = new Date();
  const [session] = await db
    .select()
    .from(organizerSessionsTable)
    .where(
      and(
        eq(organizerSessionsTable.id, sessionId),
        isNull(organizerSessionsTable.revokedAt),
        gt(organizerSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);

  return session ?? null;
}

/**
 * Validates session existence, expiry, revocation, and token hash equality.
 */
export async function validateOrganizerSession(
  sessionId: string,
  rawToken: string,
): Promise<{ valid: boolean; session?: OrganizerSession; reason?: string }> {
  const session = await loadActiveOrganizerSession(sessionId);
  if (!session) {
    return { valid: false, reason: "revoked_or_expired" };
  }

  const incomingHash = computeTokenHash(rawToken);
  if (session.tokenHash !== incomingHash) {
    return { valid: false, reason: "token_hash_mismatch" };
  }

  return { valid: true, session };
}

/**
 * Revokes a single organizer session immediately.
 */
export async function revokeOrganizerSession(sessionId: string): Promise<void> {
  await db
    .update(organizerSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(organizerSessionsTable.id, sessionId));
}

/**
 * Revokes all sessions belonging to an organizer account (global logout / password change).
 */
export async function revokeAllOrganizerSessions(
  organizerAccountId: number,
  exceptSessionId?: string,
): Promise<void> {
  const conditions = [
    eq(organizerSessionsTable.organizerAccountId, organizerAccountId),
    isNull(organizerSessionsTable.revokedAt),
  ];
  if (exceptSessionId) {
    conditions.push(ne(organizerSessionsTable.id, exceptSessionId));
  }

  await db
    .update(organizerSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
}

/**
 * Rotates token hash and claims on an existing active session.
 * Used when tournament authorizations change (e.g. logging out of one tournament).
 */
export async function rotateOrganizerSessionClaims(
  res: Response,
  sessionId: string,
  newClaims: AuthClaims,
): Promise<{ token: string; tokenHash: string }> {
  const updatedClaims: AuthClaims = {
    ...newClaims,
    sessionId,
  };
  const token = signAuthJwt(updatedClaims);
  const tokenHash = computeTokenHash(token);

  res.cookie(COOKIE_NAME, token, authCookieBaseOptions(res, JWT_EXPIRY));

  await db
    .update(organizerSessionsTable)
    .set({
      tokenHash,
      lastSeenAt: new Date(),
    })
    .where(eq(organizerSessionsTable.id, sessionId));

  return { token, tokenHash };
}

/**
 * Non-blocking throttled touch of lastSeenAt (maximum once per 5 minutes per session).
 */
export function touchOrganizerSessionThrottled(session: OrganizerSession): void {
  const now = Date.now();
  const lastSeen = session.lastSeenAt.getTime();
  if (now - lastSeen < 5 * 60 * 1000) {
    return;
  }
  // Fire and forget
  void db
    .update(organizerSessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(organizerSessionsTable.id, session.id))
    .catch((err) => {
      logger.debug({ err, sessionId: session.id }, "Failed to update organizer session lastSeenAt");
    });
}

/**
 * Transparently upgrades a legacy stateless JWT to a database-backed session during migration.
 */
export async function upgradeLegacyTokenToSession(
  req: Request,
  res: Response,
  claims: AuthClaims,
  rawToken: string,
): Promise<boolean> {
  try {
    const meta = extractRequestMeta(req);
    const sessionId = generateOrganizerSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + JWT_EXPIRY * 1000);

    const upgradedClaims: AuthClaims = {
      ...claims,
      sessionId,
    };
    const { token, tokenHash } = setAuthCookie(res, upgradedClaims);

    await db.insert(organizerSessionsTable).values({
      id: sessionId,
      organizerAccountId: claims.organizerAccountId ?? null,
      tournamentId: null,
      sessionScope: claims.organizerAccountId ? "account" : "tournament_password",
      tokenHash,
      deviceName: meta.deviceName,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      expiresAt,
      revokedAt: null,
      createdAt: now,
      lastSeenAt: now,
    });

    claims.sessionId = sessionId;
    logger.info(
      {
        organizerAccountId: claims.organizerAccountId,
        sessionId,
      },
      "Transparently upgraded legacy stateless organizer JWT to database session",
    );
    return true;
  } catch (err) {
    logger.warn({ err }, "Failed to upgrade legacy organizer JWT to database session");
    return false;
  }
}
