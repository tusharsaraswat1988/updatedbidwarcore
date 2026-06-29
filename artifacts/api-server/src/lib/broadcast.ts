import type { Response } from "express";
import type { AuctionEventEnvelope } from "./auction-events";
import { formatSseFrame } from "./auction-events";

interface SseClient {
  tournamentId: number;
  write: (frame: string) => boolean;
}

const clients: Set<SseClient> = new Set();

export function addSseClient(tournamentId: number, res: Response): SseClient {
  const client: SseClient = { tournamentId, write: (frame) => res.write(frame) };
  clients.add(client);
  return client;
}

export function removeSseClient(client: SseClient) {
  clients.delete(client);
}

/** Write a versioned SSE frame to all local clients for a tournament. */
export function writeSseToLocalClients(
  tournamentId: number,
  version: number,
  payload: AuctionEventEnvelope | Record<string, unknown>,
) {
  const frame = formatSseFrame(version, payload as AuctionEventEnvelope);
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

/** Legacy helper for non-versioned messages (cheer, settings). Uses version 0. */
export function broadcastToTournament(tournamentId: number, payload: object) {
  writeSseToLocalClients(tournamentId, 0, payload as AuctionEventEnvelope);
}

export function getSseClientCount(tournamentId: number): number {
  let count = 0;
  for (const client of clients) {
    if (client.tournamentId === tournamentId) count++;
  }
  return count;
}

export function getTotalSseClientCount(): number {
  return clients.size;
}
