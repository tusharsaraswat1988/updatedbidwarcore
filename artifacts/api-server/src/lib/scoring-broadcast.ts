import type { Response } from "express";

interface ScoringSseClient {
  tournamentId: number;
  write: (frame: string) => boolean;
}

const clients: Set<ScoringSseClient> = new Set();

export function addScoringSseClient(tournamentId: number, res: Response): ScoringSseClient {
  const client: ScoringSseClient = { tournamentId, write: (frame) => res.write(frame) };
  clients.add(client);
  return client;
}

export function removeScoringSseClient(client: ScoringSseClient) {
  clients.delete(client);
}

export function broadcastScoringState(tournamentId: number, payload: object) {
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
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

export function getScoringSseClientCount(tournamentId: number): number {
  let count = 0;
  for (const client of clients) {
    if (client.tournamentId === tournamentId) count++;
  }
  return count;
}

export function getScoringTotalSseClientCount(): number {
  return clients.size;
}
