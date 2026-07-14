/**
 * Global scorer authentication: mobile + personal PIN → JWT + session.
 * Independent of tournament assignments (future-ready).
 */

import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, scorerAccountsTable, scorerSessionsTable } from "@workspace/db";
import { parseIndianMobile } from "@workspace/api-base/mobile";
import { signScorerJwt, verifyScorerJwt, type ScorerAuthClaims } from "./jwt";
import { hashScorerPin, verifyScorerPin } from "./scorer-pin-crypto";
import { writeScorerAudit } from "./scorer-audit";
import { logger } from "./logger";

export const SCORER_SESSION_TTL_SEC = 12 * 60 * 60; // 12 hours

export class ScorerAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ScorerAuthError";
  }
}

export type ScorerProfile = {
  id: number;
  name: string;
  mobile: string;
};

export type ScorerAuthContext = {
  scorerId: number;
  sessionId: string;
  profile: ScorerProfile;
};

function normalizeMobile(raw: string): string {
  const parsed = parseIndianMobile(raw.trim());
  if (!parsed.ok || !parsed.normalized) {
    throw new ScorerAuthError("Enter a valid Indian mobile number", "INVALID_MOBILE", 400);
  }
  return parsed.normalized;
}

/** Ensure exactly one bootstrap scorer when env is set (or defaults in non-production). */
export async function ensureBootstrapScorerAccount(): Promise<void> {
  const existing = await db.select({ id: scorerAccountsTable.id }).from(scorerAccountsTable).limit(1);
  if (existing.length > 0) return;

  const mobileRaw =
    process.env.SCORER_BOOTSTRAP_MOBILE?.trim() ||
    (process.env.BIDWAR_ENV === "production" ? "" : "9999999999");
  const pin =
    process.env.SCORER_BOOTSTRAP_PIN?.trim() ||
    (process.env.BIDWAR_ENV === "production" ? "" : "1234");
  const name = process.env.SCORER_BOOTSTRAP_NAME?.trim() || "Default Scorer";

  if (!mobileRaw || !pin || pin.length < 4) {
    logger.warn(
      "No scorer accounts and SCORER_BOOTSTRAP_MOBILE/PIN not set — scorer login unavailable until seeded",
    );
    return;
  }

  let mobile: string;
  try {
    mobile = normalizeMobile(mobileRaw);
  } catch {
    logger.warn({ mobileRaw }, "SCORER_BOOTSTRAP_MOBILE invalid — skip seed");
    return;
  }

  const pinHash = await hashScorerPin(pin);
  await db.insert(scorerAccountsTable).values({
    name,
    mobile,
    pinHash,
    isActive: true,
  });
  logger.info({ mobile, name }, "Bootstrap scorer account created");
}

export async function loginScorer(input: {
  mobile: string;
  pin: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}): Promise<{ token: string; scorer: ScorerProfile; expiresAt: string }> {
  const mobile = normalizeMobile(input.mobile);
  const pin = input.pin.trim();
  if (pin.length < 4) {
    throw new ScorerAuthError("PIN must be at least 4 characters", "INVALID_PIN", 400);
  }

  const [account] = await db
    .select()
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.mobile, mobile))
    .limit(1);

  if (!account || !account.isActive) {
    throw new ScorerAuthError("Invalid mobile or PIN", "AUTH_FAILED", 401);
  }

  const pinOk = await verifyScorerPin(pin, account.pinHash);
  if (!pinOk) {
    throw new ScorerAuthError("Invalid mobile or PIN", "AUTH_FAILED", 401);
  }

  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SCORER_SESSION_TTL_SEC * 1000);

  await db.insert(scorerSessionsTable).values({
    id: sessionId,
    scorerId: account.id,
    deviceName: input.deviceName ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    revokedAt: null,
  });

  await db
    .update(scorerAccountsTable)
    .set({ lastLoginAt: now })
    .where(eq(scorerAccountsTable.id, account.id));

  const token = signScorerJwt({
    purpose: "scorer",
    scorerId: account.id,
    sessionId,
  });

  await writeScorerAudit({
    actorType: "scorer",
    actorId: String(account.id),
    scorerId: account.id,
    sessionId,
    action: "login",
    payload: { mobile },
  });

  return {
    token,
    scorer: { id: account.id, name: account.name, mobile: account.mobile },
    expiresAt: expiresAt.toISOString(),
  };
}

export async function logoutScorer(sessionId: string, scorerId: number): Promise<void> {
  await db
    .update(scorerSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(scorerSessionsTable.id, sessionId), eq(scorerSessionsTable.scorerId, scorerId)));

  await writeScorerAudit({
    actorType: "scorer",
    actorId: String(scorerId),
    scorerId,
    sessionId,
    action: "logout",
  });
}

export async function resolveScorerAuthFromToken(token: string): Promise<ScorerAuthContext> {
  const claims = verifyScorerJwt(token);
  if (!claims) {
    throw new ScorerAuthError("Authentication required", "AUTH_REQUIRED", 401);
  }
  return resolveScorerAuthFromClaims(claims);
}

export async function resolveScorerAuthFromClaims(
  claims: ScorerAuthClaims,
): Promise<ScorerAuthContext> {
  const [session] = await db
    .select()
    .from(scorerSessionsTable)
    .where(eq(scorerSessionsTable.id, claims.sessionId))
    .limit(1);

  if (!session || session.scorerId !== claims.scorerId) {
    throw new ScorerAuthError("Session invalid", "SESSION_INVALID", 401);
  }
  if (session.revokedAt) {
    throw new ScorerAuthError("Session revoked", "SESSION_REVOKED", 401);
  }
  if (session.expiresAt.getTime() < Date.now()) {
    throw new ScorerAuthError("Session expired", "SESSION_EXPIRED", 401);
  }

  const [account] = await db
    .select()
    .from(scorerAccountsTable)
    .where(and(eq(scorerAccountsTable.id, claims.scorerId), eq(scorerAccountsTable.isActive, true)))
    .limit(1);

  if (!account) {
    throw new ScorerAuthError("Account inactive", "ACCOUNT_INACTIVE", 401);
  }

  await db
    .update(scorerSessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(scorerSessionsTable.id, claims.sessionId));

  return {
    scorerId: account.id,
    sessionId: session.id,
    profile: {
      id: account.id,
      name: account.name,
      mobile: account.mobile,
    },
  };
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m?.[1]?.trim() || null;
}
