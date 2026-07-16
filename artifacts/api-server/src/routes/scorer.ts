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
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
  }

  try {
    const result = await loginScorer({
      mobile: parsed.data.mobile,
      pin: parsed.data.pin,
      deviceName: parsed.data.deviceName ?? null,
      ipAddress: clientIp(req),
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    });
    res.json({
      token: result.token,
      scorer: result.scorer,
      expiresAt: result.expiresAt,
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
    res.json({ scorer: auth.profile, sessionId: auth.sessionId });
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
  });
  const meta = metaSchema.safeParse(req.body ?? {});

  try {
    const auth = await requireScorer(req);
    const result = await acquireMatchLock({
      matchId,
      scorerId: auth.scorerId,
      sessionId: auth.sessionId,
      tournamentId: meta.success ? meta.data.tournamentId ?? null : null,
      sport: meta.success ? meta.data.sport ?? null : null,
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
        lockedAt: result.lock.lockedAt,
        lastHeartbeatAt: result.lock.lastHeartbeatAt,
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

export default router;
