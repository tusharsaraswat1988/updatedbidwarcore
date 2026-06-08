/**
 * Badminton SSE broadcast — mirrors the existing scoring-broadcast.ts pattern.
 */

import type { Response } from "express";

type SseClient = {
  res: Response;
  matchId: number;
  tournamentId: number;
};

const clients = new Set<SseClient>();

export function addBadmintonSseClient(client: SseClient): void {
  clients.add(client);
  client.res.on("close", () => clients.delete(client));
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
  const json = JSON.stringify({ type: "match_state", data });
  for (const client of clients) {
    if (client.matchId === matchId || client.tournamentId === tournamentId) {
      try {
        client.res.write(`data: ${json}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }
}

export function broadcastTournamentUpdate(tournamentId: number, data: unknown): void {
  const json = JSON.stringify({ type: "tournament_update", data });
  for (const client of clients) {
    if (client.tournamentId === tournamentId) {
      try {
        client.res.write(`data: ${json}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }
}
