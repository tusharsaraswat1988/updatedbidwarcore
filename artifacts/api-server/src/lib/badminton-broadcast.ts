/**
 * Badminton SSE broadcast — local client Set + Redis pub/sub fan-out
 * (mirrors auction-events.ts cross-instance delivery).
 */

import type { Response } from "express";
import { getRedisCommandClient, getRedisSubscriberClient, isRedisEnabled, markRedisUnavailable } from "./redis";
import { markLatency } from "./badminton-latency-trace";
import { logger } from "./logger";

type SseClient = {
  write: (frame: string) => boolean;
  matchId: number;
  tournamentId: number;
};

/** Outbound badminton SSE / pub-sub envelope. */
export type BadmintonEventEnvelope = {
  type: "match_state" | "tournament_update";
  matchId: number;
  tournamentId: number;
  data: unknown;
};

export const BADMINTON_PUBSUB_CHANNEL = (tid: number) => `badminton:event:${tid}`;

const clients = new Set<SseClient>();

export function createBadmintonSseClient(params: { res: Response; matchId: number; tournamentId: number }): SseClient {
  return {
    matchId: params.matchId,
    tournamentId: params.tournamentId,
    write: (frame) => params.res.write(frame),
  };
}

export function addBadmintonSseClient(client: SseClient): void {
  clients.add(client);
}

export function removeBadmintonSseClient(client: SseClient): void {
  clients.delete(client);
}

export function getBadmintonSseClientCount(matchId?: number): number {
  if (matchId === undefined) return clients.size;
  let count = 0;
  for (const c of clients) {
    if (c.matchId === matchId) count++;
  }
  return count;
}

/**
 * Fan out an envelope to this process's SSE clients.
 *
 * Sprint 1 isolation: match_state only to clients with the same matchId;
 * tournament-scoped listeners (matchId === 0) get tournament_update only.
 */
export function writeBadmintonEventToLocalClients(envelope: BadmintonEventEnvelope): void {
  const { tournamentId } = envelope;

  if (envelope.type === "match_state") {
    const { matchId, data } = envelope;
    const matchFrame = `data: ${JSON.stringify({
      type: "match_state",
      matchId,
      tournamentId,
      data,
    })}\n\n`;
    const tournamentFrame = `data: ${JSON.stringify({
      type: "tournament_update",
      data: { type: "match_state_changed", matchId, tournamentId },
    })}\n\n`;

    for (const client of clients) {
      if (client.tournamentId !== tournamentId) continue;
      try {
        if (client.matchId === matchId) {
          client.write(matchFrame);
        } else if (client.matchId === 0) {
          // Tournament-scoped subscribers (no matchId query) — invalidate only.
          client.write(tournamentFrame);
        }
      } catch {
        clients.delete(client);
      }
    }
    return;
  }

  const frame = `data: ${JSON.stringify({ type: "tournament_update", data: envelope.data })}\n\n`;
  for (const client of clients) {
    if (client.tournamentId === tournamentId) {
      try {
        client.write(frame);
      } catch {
        clients.delete(client);
      }
    }
  }
}

async function publishOrWriteLocal(envelope: BadmintonEventEnvelope): Promise<void> {
  const redis = getRedisCommandClient();
  if (redis) {
    try {
      // PUBLISH returns subscriber count. If 0, this process has no active
      // psubscribe handler — fall through to local fan-out so Venue/OBS still update.
      const delivered = await redis.publish(
        BADMINTON_PUBSUB_CHANNEL(envelope.tournamentId),
        JSON.stringify(envelope),
      );
      if (typeof delivered === "number" && delivered > 0) return;
    } catch (err) {
      markRedisUnavailable(err, "publishBadmintonEvent");
    }
  }
  writeBadmintonEventToLocalClients(envelope);
}

/**
 * Push a match_state frame only to clients subscribed to this match.
 *
 * Tournament-wide listeners (matchId === 0) receive a lightweight
 * `tournament_update` so dashboards/Mission Control can invalidate lists —
 * they must never apply cross-match score snapshots (Sprint 1 / C1).
 */
export async function broadcastBadmintonMatchUpdate(
  matchId: number,
  tournamentId: number,
  data: unknown,
): Promise<void> {
  await publishOrWriteLocal({
    type: "match_state",
    matchId,
    tournamentId,
    data,
  });
  markLatency("t4_sse_emitted");
}

export async function broadcastTournamentUpdate(tournamentId: number, data: unknown): Promise<void> {
  await publishOrWriteLocal({
    type: "tournament_update",
    matchId: 0,
    tournamentId,
    data,
  });
}

/** Subscribe to cross-instance badminton events and fan out to local SSE clients. */
export async function startBadmintonEventSubscriber(): Promise<void> {
  if (!isRedisEnabled()) return;

  const subscriber = getRedisSubscriberClient();
  if (!subscriber) return;

  try {
    await subscriber.psubscribe("badminton:event:*");
  } catch (err) {
    markRedisUnavailable(err, "badminton-event-psubscribe");
    return;
  }

  subscriber.on("pmessage", (_pattern, channel, message) => {
    if (typeof channel !== "string" || !channel.startsWith("badminton:event:")) return;
    try {
      const event = JSON.parse(message) as BadmintonEventEnvelope;
      if (!event?.type || typeof event.tournamentId !== "number") return;
      writeBadmintonEventToLocalClients(event);
    } catch (err) {
      logger.warn({ err }, "Failed to process pub/sub badminton event");
    }
  });

  logger.info("Badminton event Redis subscriber started");
}
