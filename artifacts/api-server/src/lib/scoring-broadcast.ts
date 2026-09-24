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

export interface CricketBroadcastMessage {
  active: boolean;
  name: string;
  details: string;
}

export interface CricketObsDirectorPayload {
  type: "cricket_obs_director";
  overlay?: string;
  matchId?: number;
  sponsorName?: string;
  stageOrGroup?: string;
  flash?: string;
  detail?: string;
  messageType?: string;
  broadcastMessage?: CricketBroadcastMessage | null;
  timestamp: number;
}

const cricketObsStates = new Map<
  number,
  {
    overlay: string;
    matchId?: number;
    sponsorName?: string;
    stageOrGroup?: string;
    broadcastMessage?: CricketBroadcastMessage | null;
    lastUpdated: number;
  }
>();

export function getCricketObsDirectorState(tournamentId: number): {
  overlay: string;
  matchId?: number;
  sponsorName?: string;
  stageOrGroup?: string;
  broadcastMessage?: CricketBroadcastMessage | null;
} {
  const current = cricketObsStates.get(tournamentId);
  return {
    overlay: current?.overlay ?? "none",
    matchId: current?.matchId,
    sponsorName: current?.sponsorName,
    stageOrGroup: current?.stageOrGroup,
    broadcastMessage: current?.broadcastMessage ?? null,
  };
}

export function setCricketObsDirectorState(
  tournamentId: number,
  overlay?: string,
  matchId?: number,
  sponsorName?: string,
  stageOrGroup?: string,
  broadcastMessage?: CricketBroadcastMessage | null,
) {
  const current = cricketObsStates.get(tournamentId);
  cricketObsStates.set(tournamentId, {
    overlay: overlay !== undefined ? overlay : (current?.overlay ?? "none"),
    matchId: matchId !== undefined ? matchId : current?.matchId,
    sponsorName: sponsorName !== undefined ? sponsorName : current?.sponsorName,
    stageOrGroup: stageOrGroup !== undefined ? stageOrGroup : current?.stageOrGroup,
    broadcastMessage: broadcastMessage !== undefined ? broadcastMessage : (current?.broadcastMessage ?? null),
    lastUpdated: Date.now(),
  });
}

export function broadcastCricketObsDirector(
  tournamentId: number,
  command: {
    overlay?: string;
    matchId?: number;
    sponsorName?: string;
    stageOrGroup?: string;
    flash?: string;
    detail?: string;
    messageType?: string;
    broadcastMessage?: CricketBroadcastMessage | null;
  },
) {
  if (
    command.overlay !== undefined ||
    command.broadcastMessage !== undefined ||
    command.matchId !== undefined ||
    command.sponsorName !== undefined ||
    command.stageOrGroup !== undefined
  ) {
    setCricketObsDirectorState(
      tournamentId,
      command.overlay,
      command.matchId,
      command.sponsorName,
      command.stageOrGroup,
      command.broadcastMessage,
    );
  }
  const payload: CricketObsDirectorPayload = {
    type: "cricket_obs_director",
    overlay: command.overlay,
    matchId: command.matchId,
    sponsorName: command.sponsorName,
    stageOrGroup: command.stageOrGroup,
    flash: command.flash,
    detail: command.detail,
    messageType: command.messageType,
    broadcastMessage: command.broadcastMessage,
    timestamp: Date.now(),
  };
  broadcastScoringState(tournamentId, payload);
}
