/**
 * Badminton SSE broadcast — mirrors the existing scoring-broadcast.ts pattern.
 */

import type { Response } from "express";

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

export function broadcastBadmintonMatchUpdate(
  matchId: number,
  tournamentId: number,
  data: unknown,
): void {
  const frame = `data: ${JSON.stringify({ type: "match_state", data })}\n\n`;
  for (const client of clients) {
    if (client.matchId === matchId || client.tournamentId === tournamentId) {
      try {
        client.write(frame);
      } catch {
        clients.delete(client);
      }
    }
  }
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
