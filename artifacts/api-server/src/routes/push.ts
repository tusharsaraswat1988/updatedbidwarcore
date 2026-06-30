import { Router } from "express";
import webPush from "web-push";
import { db } from "@workspace/db";
import {
  pushSubscriptionsTable,
  ownerSessionsTable,
  tournamentsTable,
  teamsTable,
} from "@workspace/db";
import { eq, and, isNotNull, gt } from "drizzle-orm";
import { z } from "zod";
import { pushSubscribeLimiter } from "../lib/rate-limiters";
import { getPublicOrigin } from "../lib/runtime-env";
import {
  cleanupStalePushData,
  requireVerifiedOwnerSession,
  revokeOwnerSession,
  assertTeamInTournament,
} from "../lib/owner-session";

const router = Router();

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    "mailto:admin@bidwar.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

router.get("/vapid-public-key", (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth:   z.string(),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

function parseTeamIdQuery(req: { query: Record<string, unknown> }): number | null {
  const teamIdRaw = Array.isArray(req.query.teamId) ? req.query.teamId[0] : req.query.teamId;
  const teamId = parseInt(String(teamIdRaw ?? ""));
  return isNaN(teamId) ? null : teamId;
}

router.post("/tournaments/:tournamentId/push-subscribe", pushSubscribeLimiter, async (req, res) => {
  const tournamentId = parseInt(String(req.params.tournamentId));
  if (isNaN(tournamentId)) { res.status(400).json({ error: "Invalid tournament ID" }); return; }

  const teamId = parseTeamIdQuery(req);
  if (teamId === null) { res.status(400).json({ error: "teamId query param required" }); return; }

  const auth = await requireVerifiedOwnerSession(req, tournamentId, teamId);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid subscription object" }); return; }

  const [tournament] = await db.select({ id: tournamentsTable.id })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  if (!(await assertTeamInTournament(tournamentId, teamId))) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const now = new Date();
  const { endpoint, keys } = parsed.data;
  const { sessionId } = auth.session;

  await db
    .insert(pushSubscriptionsTable)
    .values({
      tournamentId,
      teamId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      verifiedAt: now,
      ownerSessionId: sessionId,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        tournamentId,
        teamId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        verifiedAt: now,
        ownerSessionId: sessionId,
        lastSeenAt: now,
      },
    });

  res.json({ ok: true, sessionId });
});

router.post("/tournaments/:tournamentId/push-unsubscribe", pushSubscribeLimiter, async (req, res) => {
  const tournamentId = parseInt(String(req.params.tournamentId));
  if (isNaN(tournamentId)) { res.status(400).json({ error: "Invalid tournament ID" }); return; }

  const teamId = parseTeamIdQuery(req);
  if (teamId === null) { res.status(400).json({ error: "teamId query param required" }); return; }

  const auth = await requireVerifiedOwnerSession(req, tournamentId, teamId);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid subscription object" }); return; }

  await db
    .delete(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint),
      eq(pushSubscriptionsTable.tournamentId, tournamentId),
      eq(pushSubscriptionsTable.teamId, teamId),
    ));

  res.json({ ok: true });
});

router.post("/tournaments/:tournamentId/teams/:teamId/owner-session/revoke", async (req, res) => {
  const tournamentId = parseInt(String(req.params.tournamentId));
  const teamId = parseInt(String(req.params.teamId));
  if (isNaN(tournamentId) || isNaN(teamId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const revoked = await revokeOwnerSession(req, res, tournamentId, teamId);
  if (!revoked) {
    res.status(401).json({ error: "Owner session required" });
    return;
  }

  res.json({ ok: true });
});

export async function sendPushToTournament(
  tournamentId: number,
  payload: { title: string; body: string },
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  await cleanupStalePushData();

  const baseUrl = getPublicOrigin();
  const now = new Date();

  try {
    const subs = await db
      .select({
        endpoint: pushSubscriptionsTable.endpoint,
        p256dh: pushSubscriptionsTable.p256dh,
        auth: pushSubscriptionsTable.auth,
        teamId: pushSubscriptionsTable.teamId,
      })
      .from(pushSubscriptionsTable)
      .innerJoin(
        ownerSessionsTable,
        eq(pushSubscriptionsTable.ownerSessionId, ownerSessionsTable.id),
      )
      .where(and(
        eq(pushSubscriptionsTable.tournamentId, tournamentId),
        isNotNull(pushSubscriptionsTable.verifiedAt),
        isNotNull(pushSubscriptionsTable.ownerSessionId),
        gt(ownerSessionsTable.expiresAt, now),
      ));

    await Promise.allSettled(
      subs.map(async (sub) => {
        const url        = `${baseUrl}/owner-app/join?tournamentId=${tournamentId}&teamId=${sub.teamId}`;
        const payloadStr = JSON.stringify({ ...payload, url });
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr,
          );
          await db
            .update(pushSubscriptionsTable)
            .set({ lastSeenAt: new Date() })
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await db
              .delete(pushSubscriptionsTable)
              .where(and(
                eq(pushSubscriptionsTable.endpoint, sub.endpoint),
                eq(pushSubscriptionsTable.tournamentId, tournamentId),
              ));
          }
        }
      }),
    );
  } catch {
    // Don't let push failures disrupt auction flow
  }
}

export default router;
