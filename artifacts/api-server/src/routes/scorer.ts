/**
 * Global scorer auth + sport-agnostic match lock APIs.
 * Mount at /api/scorer
 */

import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import {
  extractBearerToken,
  loginScorer,
  logoutScorer,
  resolveScorerAuthFromToken,
  assertScorerMayAccessTournament,
  assertScorerCanScore,
  ScorerAuthError,
  type ScorerAuthContext,
} from "../lib/scorer-auth";
import {
  acquireMatchLock,
  assertSessionOwnsMatchLock,
  forceUnlockMatch,
  heartbeatMatchLock,
  releaseMatchLock,
  ScorerLockError,
} from "../lib/scorer-match-locks";
import { logger } from "../lib/logger";
import { db, scoringMatchesTable, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  assertSportModule,
  assertScoringModule,
  ModuleAuthorizationError,
} from "../middleware/require-module";
import { InvalidTournamentModuleStateError } from "@workspace/platform-core";

import { CURRENT_CONSENT_NOTICE_VERSION } from "@workspace/api-base";
import { recordConsentGranted, recordConsentWithdrawal } from "../lib/communication/consent-service";

const router: IRouter = Router();

function clientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0]?.trim() || null;
  return req.socket.remoteAddress || null;
}

async function requireScorer(req: Request): Promise<ScorerAuthContext> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new ScorerAuthError("Authentication required", "AUTH_REQUIRED", 401);
  }
  return resolveScorerAuthFromToken(token);
}

function sendAuthError(res: import("express").Response, e: unknown): boolean {
  if (e instanceof ModuleAuthorizationError) {
    res.status(e.status).json({ error: e.message, code: e.code });
    return true;
  }
  if (e instanceof InvalidTournamentModuleStateError) {
    res.status(400).json({
      error: "A tournament must have at least one enabled product module (auction or scoring).",
      code: "INVALID_MODULE_STATE",
    });
    return true;
  }
  if (e instanceof ScorerAuthError) {
    res.status(e.status).json({ error: e.message, code: e.code });
    return true;
  }
  return false;
}

function sendLockError(res: import("express").Response, e: unknown): boolean {
  if (e instanceof ScorerLockError) {
    res.status(e.status).json({
      error: e.message,
      code: e.code,
      message: e.message,
    });
    return true;
  }
  return false;
}

router.post("/login", async (req, res) => {
  const schema = z.object({
    mobile: z.string().min(10).max(20),
    pin: z.string().min(4).max(32),
    deviceName: z.string().max(120).optional(),
    tournamentId: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
  }

  try {
    const result = await loginScorer({
      mobile: parsed.data.mobile,
      pin: parsed.data.pin,
      tournamentId: parsed.data.tournamentId ?? null,
      deviceName: parsed.data.deviceName ?? null,
      ipAddress: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    res.json({
      token: result.token,
      scorer: result.scorer,
      canScore: result.canScore,
      expiresAt: result.expiresAt,
      tournaments: result.tournaments,
    });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    logger.error({ err: e }, "scorer login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const auth = await requireScorer(req);
    await logoutScorer(auth.sessionId, auth.scorerId);
    res.json({ ok: true });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    res.status(500).json({ error: "Logout failed" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const auth = await requireScorer(req);
    res.json({
      scorer: auth.profile,
      sessionId: auth.sessionId,
      canScore: auth.canScore,
    });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/matches/:matchId/lock", async (req, res) => {
  const matchId = Number.parseInt(String(req.params.matchId), 10);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return void res.status(400).json({ error: "bad match id" });
  }

  const metaSchema = z.object({
    tournamentId: z.number().int().positive().optional(),
    sport: z.string().max(40).optional(),
    forceTakeover: z.boolean().optional(),
  });
  const meta = metaSchema.safeParse(req.body ?? {});

  try {
    const auth = await requireScorer(req);
    assertScorerCanScore(auth);
    const tournamentId =
      meta.success && meta.data.tournamentId ? meta.data.tournamentId : null;

    // Resolve tournament from match when body omits it (Sprint 1 / C3).
    let resolvedTournamentId = tournamentId;
    let matchSportSlug: string | null = null;
    if (!resolvedTournamentId) {
      const [match] = await db
        .select({
          tournamentId: scoringMatchesTable.tournamentId,
          sportSlug: scoringMatchesTable.sportSlug,
        })
        .from(scoringMatchesTable)
        .where(eq(scoringMatchesTable.id, matchId))
        .limit(1);
      resolvedTournamentId = match?.tournamentId ?? null;
      matchSportSlug = match?.sportSlug ?? null;
    }

    if (resolvedTournamentId) {
      const [tournament] = await db
        .select({
          id: tournamentsTable.id,
          auctionEnabled: tournamentsTable.auctionEnabled,
          scoringEnabled: tournamentsTable.scoringEnabled,
          sport: tournamentsTable.sport,
        })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, resolvedTournamentId))
        .limit(1);

      const expectedSport = meta.success && meta.data.sport ? meta.data.sport : (matchSportSlug || tournament?.sport);
      if (expectedSport) {
        assertSportModule(tournament, expectedSport);
      } else {
        assertScoringModule(tournament);
      }

      await assertScorerMayAccessTournament(auth.scorerId, resolvedTournamentId);
    }

    const result = await acquireMatchLock({
      matchId,
      scorerId: auth.scorerId,
      sessionId: auth.sessionId,
      tournamentId: resolvedTournamentId,
      sport: meta.success ? meta.data.sport ?? null : null,
      forceTakeover: meta.success ? meta.data.forceTakeover : undefined,
    });

    if (!result.ok) {
      return void res.status(409).json({
        code: "MATCH_LOCKED",
        message: "This match is currently being scored by another active session.",
        error: "This match is currently being scored by another active session.",
      });
    }

    res.json({
      ok: true,
      reacquired: result.reacquired,
      lock: {
        matchId: result.lock.matchId,
        scorerId: result.lock.scorerId,
        sessionId: result.lock.sessionId,
        leaseId: result.lock.leaseId,
        leaseVersion: result.lock.leaseVersion,
        lockedAt: result.lock.lockedAt,
        lastHeartbeatAt: result.lock.lastHeartbeatAt,
        expiresAt: result.lock.expiresAt,
      },
    });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    if (sendLockError(res, e)) return;
    logger.error({ err: e }, "scorer lock acquire failed");
    res.status(500).json({ error: "Lock failed" });
  }
});

router.post("/matches/:matchId/heartbeat", async (req, res) => {
  const matchId = Number.parseInt(String(req.params.matchId), 10);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return void res.status(400).json({ error: "bad match id" });
  }

  try {
    const auth = await requireScorer(req);
    await heartbeatMatchLock({ matchId, sessionId: auth.sessionId });
    res.json({ ok: true });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    if (sendLockError(res, e)) return;
    res.status(500).json({ error: "Heartbeat failed" });
  }
});

router.delete("/matches/:matchId/lock", async (req, res) => {
  const matchId = Number.parseInt(String(req.params.matchId), 10);
  if (!Number.isFinite(matchId) || matchId <= 0) {
    return void res.status(400).json({ error: "bad match id" });
  }

  const tournamentId = req.query.tournamentId
    ? Number.parseInt(String(req.query.tournamentId), 10)
    : null;
  const sport = typeof req.query.sport === "string" ? req.query.sport : null;

  try {
    const auth = await requireScorer(req);
    await releaseMatchLock({
      matchId,
      sessionId: auth.sessionId,
      scorerId: auth.scorerId,
      tournamentId: Number.isFinite(tournamentId) ? tournamentId : null,
      sport,
    });
    res.json({ ok: true });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    if (sendLockError(res, e)) return;
    res.status(500).json({ error: "Unlock failed" });
  }
});

/** Internal helper export for badminton route force-unlock re-export pattern. */
export { forceUnlockMatch, assertSessionOwnsMatchLock };


// ─── Scorer Self-Service WhatsApp Consent ─────────────────────────────────────

router.get("/wa-consent/status", async (req, res) => {
  try {
    const auth = await requireScorer(req);
    res.json({
      whatsappConsent: auth.profile.whatsappConsent === true,
      whatsappConsentAt: auth.profile.whatsappConsentAt ?? null,
      noticeVersion: CURRENT_CONSENT_NOTICE_VERSION,
    });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    res.status(500).json({ error: "Failed to get consent status" });
  }
});

router.post("/wa-consent/opt-in", async (req, res) => {
  try {
    const auth = await requireScorer(req);
    await recordConsentGranted({
      recipientType: "scorer",
      recipientId: auth.scorerId,
      mobile: auth.profile.mobile,
      noticeVersion: CURRENT_CONSENT_NOTICE_VERSION,
      consentScope: "tournament_operational",
      source: "scorer_portal",
      ip: clientIp(req),
    });
    res.json({ success: true, whatsappConsent: true });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    res.status(500).json({ error: "Failed to opt in" });
  }
});

router.post("/wa-consent/withdraw", async (req, res) => {
  try {
    const auth = await requireScorer(req);
    await recordConsentWithdrawal({
      mobile: auth.profile.mobile,
      recipientType: "scorer",
      recipientId: auth.scorerId,
      reason: "SCORER_SELF_WITHDRAWAL",
      source: "scorer_portal",
      ip: clientIp(req),
    });
    res.json({ success: true, whatsappConsent: false });
  } catch (e) {
    if (sendAuthError(res, e)) return;
    res.status(500).json({ error: "Failed to withdraw consent" });
  }
});

export default router;
