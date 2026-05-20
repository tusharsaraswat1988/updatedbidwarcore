import type { Response } from "express";

interface SseClient {
  tournamentId: number;
  res: Response;
}

const clients: Set<SseClient> = new Set();

export function addSseClient(tournamentId: number, res: Response): SseClient {
  const client: SseClient = { tournamentId, res };
  clients.add(client);
  return client;
}

export function removeSseClient(client: SseClient) {
  clients.delete(client);
}

export function broadcastToTournament(tournamentId: number, payload: object) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.tournamentId === tournamentId) {
      try {
        client.res.write(`data: ${data}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }
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
