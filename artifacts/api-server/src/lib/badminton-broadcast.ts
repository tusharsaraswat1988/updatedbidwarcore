/**
 * Badminton SSE broadcast — mirrors the existing scoring-broadcast.ts pattern.
 */

import type { Response } from "express";
import { markLatency } from "./badminton-latency-trace";

type SseClient = {
  write: (frame: string) => boolean;
  matchId: number;
  tournamentId: number;
};

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
 * Push a match_state frame only to clients subscribed to this match.
 *
 * Tournament-wide listeners (matchId === 0) receive a lightweight
 * `tournament_update` so dashboards/Mission Control can invalidate lists —
 * they must never apply cross-match score snapshots (Sprint 1 / C1).
 */
export function broadcastBadmintonMatchUpdate(
  matchId: number,
  tournamentId: number,
  data: unknown,
): void {
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
  markLatency("t4_sse_emitted");
}

export function broadcastTournamentUpdate(tournamentId: number, data: unknown): void {
  const frame = `data: ${JSON.stringify({ type: "tournament_update", data })}\n\n`;
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
