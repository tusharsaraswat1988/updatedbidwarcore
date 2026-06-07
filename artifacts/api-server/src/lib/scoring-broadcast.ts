import type { Response } from "express";

interface ScoringSseClient {
  tournamentId: number;
  res: Response;
}

const clients: Set<ScoringSseClient> = new Set();

export function addScoringSseClient(tournamentId: number, res: Response): ScoringSseClient {
  const client: ScoringSseClient = { tournamentId, res };
  clients.add(client);
  return client;
}

export function removeScoringSseClient(client: ScoringSseClient) {
  clients.delete(client);
}

export function broadcastScoringState(tournamentId: number, payload: object) {
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

export function getScoringSseClientCount(tournamentId: number): number {
  let count = 0;
  for (const client of clients) {
    if (client.tournamentId === tournamentId) count++;
  }
  return count;
}
