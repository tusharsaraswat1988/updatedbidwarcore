/**
 * Badminton SSE broadcast — local client Set + Redis pub/sub fan-out
 * (mirrors auction-events.ts cross-instance delivery).
 */

import type { Response } from "express";
import {
  getRedisCommandClient,
  getRedisSubscriberClient,
  isRedisEnabled,
  markRedisUnavailable,
  withTimeout,
} from "./redis";
import { markLatency } from "./badminton-latency-trace";
import { logger } from "./logger";

/** Hung Redis must not stall the scoring response path. */
const REDIS_PUBLISH_TIMEOUT_MS = 1_500;

type SseClient = {
  write: (frame: string) => boolean;
  destroy: () => void;
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

/**
 * Drop a slow/broken SSE client immediately.
 * Never retry writes to it — browser EventSource reconnects on its own.
 */
function dropSseClient(
  client: SseClient,
  reason: "backpressure" | "write_error",
): void {
  if (!clients.delete(client)) return;
  try {
    client.destroy();
  } catch {
    // Response may already be closed.
  }
  logger.warn(
    {
      matchId: client.matchId,
      tournamentId: client.tournamentId,
      reason,
      remainingClients: clients.size,
    },
    "Badminton SSE client dropped",
  );
}

export function createBadmintonSseClient(params: {
  res: Response;
  matchId: number;
  tournamentId: number;
}): SseClient {
  const { res } = params;
  return {
    matchId: params.matchId,
    tournamentId: params.tournamentId,
    write: (frame) => res.write(frame),
    destroy: () => {
      try {
        if (!res.writableEnded && !res.destroyed) {
          res.destroy();
        }
      } catch {
        // ignore
      }
    },
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
/** Slim live fields for tournament-scoped clients (no full state / no list refetch). */
function slimMatchStateChangedData(
  matchId: number,
  tournamentId: number,
  data: unknown,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: "match_state_changed",
    matchId,
    tournamentId,
  };
  if (!data || typeof data !== "object") return base;
  const s = data as Record<string, unknown>;
  if (typeof s.matchStatus === "string") {
    base.status = s.matchStatus;
    base.matchStatus = s.matchStatus;
  }
  if (typeof s.leftScore === "number") base.leftScore = s.leftScore;
  if (typeof s.rightScore === "number") base.rightScore = s.rightScore;
  if (typeof s.gamesLeft === "number") base.gamesLeft = s.gamesLeft;
  if (typeof s.gamesRight === "number") base.gamesRight = s.gamesRight;
  if (typeof s.currentGame === "number") base.currentGame = s.currentGame;
  if (typeof s.servingSide === "string") base.servingSide = s.servingSide;
  if (typeof s.totalRallies === "number") base.totalRallies = s.totalRallies;
  if (typeof s.lastSequence === "number") base.lastSequence = s.lastSequence;
  if (typeof s.inInterval === "boolean") base.inInterval = s.inInterval;
  if (typeof s.isPaused === "boolean") base.isPaused = s.isPaused;
  if (s.winnerSide !== undefined) base.winnerSide = s.winnerSide;
  if (s.resultReason !== undefined) base.resultReason = s.resultReason;
  if (Array.isArray(s.games)) base.games = s.games;
  return base;
}

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
      data: slimMatchStateChangedData(matchId, tournamentId, data),
    })}\n\n`;

    for (const client of clients) {
      if (client.tournamentId !== tournamentId) continue;
      try {
        let ok = true;
        if (client.matchId === matchId) {
          ok = client.write(matchFrame);
        } else if (client.matchId === 0) {
          // Tournament-scoped subscribers (no matchId query) — slim live patch only.
          ok = client.write(tournamentFrame);
        } else {
          continue;
        }
        // write() false = kernel/socket buffer full — drop before Node buffers unboundedly.
        if (!ok) dropSseClient(client, "backpressure");
      } catch {
        dropSseClient(client, "write_error");
      }
    }
    return;
  }

  const frame = `data: ${JSON.stringify({ type: "tournament_update", data: envelope.data })}\n\n`;
  for (const client of clients) {
    if (client.tournamentId !== tournamentId) continue;
    try {
      if (!client.write(frame)) dropSseClient(client, "backpressure");
    } catch {
      dropSseClient(client, "write_error");
    }
  }
}

async function publishOrWriteLocal(envelope: BadmintonEventEnvelope): Promise<void> {
  const redis = getRedisCommandClient();
  if (redis) {
    try {
      // PUBLISH returns subscriber count. If 0, this process has no active
      // psubscribe handler — fall through to local fan-out so Venue/OBS still update.
      // Stringify once; timeout so a stalled Redis never blocks the point path.
      const payload = JSON.stringify(envelope);
      const delivered = await withTimeout(
        redis.publish(BADMINTON_PUBSUB_CHANNEL(envelope.tournamentId), payload),
        REDIS_PUBLISH_TIMEOUT_MS,
        `badminton redis publish timed out after ${REDIS_PUBLISH_TIMEOUT_MS}ms`,
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
