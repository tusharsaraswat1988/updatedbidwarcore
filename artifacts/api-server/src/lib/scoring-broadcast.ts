import type { Response } from "express";
import type { SponsorMediaCue } from "@workspace/scoring-core";
import { publishRealtimeMessage, subscribeRealtimeBus, type RealtimeMessage } from "./scoring-realtime-bus";
import { logger } from "./logger";

export interface ScoringSseClient {
  id: string;
  tournamentId: number;
  lastSeenSequence?: number;
  write: (frame: string) => boolean;
  res: Response;
  isReady: boolean;
  buffer: Array<{ frame: string; sequence?: number }>;
  backpressureCount: number;
}

const clients: Set<ScoringSseClient> = new Set();
let clientIdCounter = 1;

// Subscribe local SSE broadcaster to the shared multi-instance Realtime Bus
subscribeRealtimeBus(async (msg: RealtimeMessage) => {
  if (msg.channel === "scoring") {
    let payload = msg.payload;
    // For oversized payloads received from another instance, load full state from DB
    if (payload.isOversized && payload.matchId) {
      try {
        const { getLiveScoringDisplay } = await import("./scoring-service");
        const display = await getLiveScoringDisplay(msg.tournamentId);
        payload = {
          type: "scoring_state",
          matchId: payload.matchId,
          match: display.match,
          state: display.state,
          summary: display.summary,
        };
      } catch (err) {
        logger.warn({ err, tournamentId: msg.tournamentId }, "Failed to fetch live display for oversized notification");
      }
    }
    deliverLocalScoringFrame(msg.tournamentId, payload, msg.sequence);
  } else if (msg.channel === "obs_director") {
    deliverLocalObsDirectorFrame(msg.tournamentId, msg.payload);
  }
});

function deliverLocalScoringFrame(tournamentId: number, payload: Record<string, unknown>, sequence?: number) {
  const seqHeader = sequence != null && Number.isFinite(sequence) ? `id: ${sequence}\n` : "";
  const eventHeader = "event: scoring_state\n";
  const frame = `${seqHeader}${eventHeader}data: ${JSON.stringify(payload)}\n\n`;

  const deadClients: ScoringSseClient[] = [];

  for (const client of clients) {
    if (client.tournamentId === tournamentId) {
      if (!client.isReady) {
        // Buffer incoming frames while client completes replay + initial snapshot
        client.buffer.push({ frame, sequence });
        continue;
      }

      try {
        const ok = client.write(frame);
        if (!ok) {
          // Socket failed or disconnected — prune to prevent server buffer bloat
          deadClients.push(client);
        } else if (sequence != null) {
          client.lastSeenSequence = sequence;
        }
      } catch {
        deadClients.push(client);
      }
    }
  }

  for (const dead of deadClients) {
    clients.delete(dead);
  }
}

function deliverLocalObsDirectorFrame(tournamentId: number, payload: Record<string, unknown>) {
  const frame = `event: obs_director\ndata: ${JSON.stringify(payload)}\n\n`;
  const deadClients: ScoringSseClient[] = [];

  for (const client of clients) {
    if (client.tournamentId === tournamentId) {
      try {
        const ok = client.write(frame);
        if (!ok) {
          deadClients.push(client);
        }
      } catch {
        deadClients.push(client);
      }
    }
  }

  for (const dead of deadClients) {
    clients.delete(dead);
  }
}

export function addScoringSseClient(
  tournamentId: number,
  res: Response,
  initialLastEventId?: number,
  options?: { bufferUntilFlush?: boolean },
): ScoringSseClient {
  const clientId = `client-${Date.now()}-${clientIdCounter++}`;
  const bufferUntilFlush = options?.bufferUntilFlush ?? false;
  const client: ScoringSseClient = {
    id: clientId,
    tournamentId,
    lastSeenSequence: initialLastEventId,
    isReady: !bufferUntilFlush,
    buffer: [],
    backpressureCount: 0,
    write: (frame) => {
      try {
        if (res.destroyed || res.writableEnded || res.writable === false) return false;
        return res.write(frame);
      } catch {
        return false;
      }
    },
    res,
  };
  clients.add(client);
  return client;
}

/**
 * Flushes buffered frames strictly newer than snapshotSeq and activates live streaming.
 * Guarantees zero event gaps, zero duplicate frames, and strict sequence ordering.
 */
export function flushAndActivateScoringSseClient(
  client: ScoringSseClient,
  snapshotSeq: number,
): void {
  client.isReady = true;
  const buffered = client.buffer;
  client.buffer = [];

  for (const item of buffered) {
    // Only deliver frames with sequence strictly greater than the initial snapshot
    if (item.sequence === undefined || item.sequence > snapshotSeq) {
      try {
        const ok = client.write(item.frame);
        if (ok && item.sequence != null) {
          client.lastSeenSequence = item.sequence;
        }
      } catch {
        clients.delete(client);
        break;
      }
    }
  }
}

export function removeScoringSseClient(client: ScoringSseClient) {
  clients.delete(client);
}

/**
 * Broadcasts scoring state to ALL connected viewers across all API server instances.
 *
 * NON-BLOCKING:
 * 1. Broadcasts to shared bus (PostgreSQL LISTEN/NOTIFY + local).
 * 2. Scorer never waits for viewer responses or network latency.
 */
export function broadcastScoringState(
  tournamentId: number,
  payload: Record<string, unknown> & { state?: unknown },
  sequence?: number,
) {
  let effectiveSeq = sequence;
  if (effectiveSeq == null && payload.state && typeof payload.state === "object") {
    const s = payload.state as { lastSequence?: number };
    if (typeof s.lastSequence === "number") {
      effectiveSeq = s.lastSequence;
    }
  }

  // Publish to shared cross-instance bus
  publishRealtimeMessage(tournamentId, "scoring", payload, effectiveSeq);
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
  sponsorMedia?: SponsorMediaCue | null;
  /** One-shot screen credentials. Not stored in the director snapshot. */
  sponsorDisplayTokens?: { obs?: string; led?: string };
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
    sponsorMedia?: SponsorMediaCue | null;
    lastUpdated: number;
  }
>();

export function getCricketObsDirectorState(tournamentId: number): {
  overlay: string;
  matchId?: number;
  sponsorName?: string;
  stageOrGroup?: string;
  broadcastMessage?: CricketBroadcastMessage | null;
  sponsorMedia?: SponsorMediaCue | null;
} {
  const current = cricketObsStates.get(tournamentId);
  return {
    overlay: current?.overlay ?? "none",
    matchId: current?.matchId,
    sponsorName: current?.sponsorName,
    stageOrGroup: current?.stageOrGroup,
    broadcastMessage: current?.broadcastMessage ?? null,
    sponsorMedia: current?.sponsorMedia ?? null,
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
    sponsorMedia: current?.sponsorMedia ?? null,
    lastUpdated: Date.now(),
  });
}

export function setSponsorMediaCue(tournamentId: number, cue: SponsorMediaCue | null) {
  const current = cricketObsStates.get(tournamentId);
  cricketObsStates.set(tournamentId, {
    overlay: current?.overlay ?? "none",
    matchId: current?.matchId,
    sponsorName: current?.sponsorName,
    stageOrGroup: current?.stageOrGroup,
    broadcastMessage: current?.broadcastMessage ?? null,
    sponsorMedia: cue,
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
    sponsorMedia?: SponsorMediaCue | null;
    sponsorDisplayTokens?: { obs?: string; led?: string };
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
  if (command.sponsorMedia !== undefined) {
    setSponsorMediaCue(tournamentId, command.sponsorMedia);
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
    sponsorMedia: command.sponsorMedia,
    sponsorDisplayTokens: command.sponsorDisplayTokens,
    timestamp: Date.now(),
  };

  // Publish to shared cross-instance bus
  publishRealtimeMessage(tournamentId, "obs_director", payload as unknown as Record<string, unknown>);
}
