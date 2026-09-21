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

export interface CricketObsDirectorPayload {
  type: "cricket_obs_director";
  overlay?: string;
  flash?: string;
  detail?: string;
  timestamp: number;
}

const cricketObsStates = new Map<number, { overlay: string; lastUpdated: number }>();

export function getCricketObsDirectorState(tournamentId: number): { overlay: string } {
  return { overlay: cricketObsStates.get(tournamentId)?.overlay ?? "none" };
}

export function setCricketObsDirectorState(tournamentId: number, overlay: string) {
  cricketObsStates.set(tournamentId, { overlay, lastUpdated: Date.now() });
}

export function broadcastCricketObsDirector(
  tournamentId: number,
  command: { overlay?: string; flash?: string; detail?: string },
) {
  if (command.overlay !== undefined) {
    setCricketObsDirectorState(tournamentId, command.overlay);
  }
  const payload: CricketObsDirectorPayload = {
    type: "cricket_obs_director",
    overlay: command.overlay,
    flash: command.flash,
    detail: command.detail,
    timestamp: Date.now(),
  };
  broadcastScoringState(tournamentId, payload);
}
