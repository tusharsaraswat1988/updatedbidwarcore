import { Router } from "express";
import webPush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable, tournamentsTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { pushSubscribeLimiter } from "../lib/rate-limiters";

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

// ── Public: expose VAPID public key to PWA frontend ─────────────────────────
router.get("/vapid-public-key", (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    res.status(503).json({ error: "Push notifications not configured" });
    return;
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// ── Unauthenticated: store push subscription for an owner ────────────────────
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth:   z.string(),
  }),
});

router.post("/tournaments/:tournamentId/push-subscribe", pushSubscribeLimiter, async (req, res) => {
  const tournamentId = parseInt(String(req.params.tournamentId));
  if (isNaN(tournamentId)) { res.status(400).json({ error: "Invalid tournament ID" }); return; }

  const teamIdRaw = Array.isArray(req.query.teamId) ? req.query.teamId[0] : req.query.teamId;
  const teamId = parseInt(String(teamIdRaw ?? ""));
  if (isNaN(teamId))       { res.status(400).json({ error: "teamId query param required" }); return; }

  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success)     { res.status(400).json({ error: "Invalid subscription object" }); return; }

  // Validate that the tournament and team actually exist before writing anything
  const [tournament] = await db.select({ id: tournamentsTable.id })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const [team] = await db.select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const { endpoint, keys } = parsed.data;

  // Upsert by endpoint — one device, one subscription row
  await db
    .insert(pushSubscriptionsTable)
    .values({ tournamentId, teamId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set:    { tournamentId, teamId, p256dh: keys.p256dh, auth: keys.auth },
    });

  res.json({ ok: true });
});

// ── Internal helper used by auction.ts ──────────────────────────────────────
export async function sendPushToTournament(
  tournamentId: number,
  payload: { title: string; body: string },
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const domain = process.env.APP_DOMAIN?.trim() ?? "";
  const baseUrl = domain ? `https://${domain}` : "";

  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.tournamentId, tournamentId));

    await Promise.allSettled(
      subs.map(async (sub) => {
        const url        = `${baseUrl}/owner-app/tournament/${tournamentId}/owner/${sub.teamId}`;
        const payloadStr = JSON.stringify({ ...payload, url });
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr,
          );
        } catch (err: unknown) {
          // 410 Gone or 404 = subscription expired; delete it
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
