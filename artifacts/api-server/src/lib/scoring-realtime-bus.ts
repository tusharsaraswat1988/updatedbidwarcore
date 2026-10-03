import { randomUUID } from "node:crypto";
import { createPgClient, type Client } from "@workspace/db";
import { resolveDatabaseUrl } from "@workspace/db/database-url";
import { logger } from "./logger";

export type RealtimeMessage = {
  channel: "scoring" | "obs_director";
  tournamentId: number;
  instanceId: string;
  payload: Record<string, unknown>;
  sequence?: number;
  timestamp: number;
};

type RealtimeMessageHandler = (message: RealtimeMessage) => void;

const CHANNEL_NAME = "bidwar_scoring_realtime";
const localInstanceId = randomUUID();
const handlers = new Set<RealtimeMessageHandler>();

let pgListenerClient: Client | null = null;
let isConnecting = false;
let isConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getLocalInstanceId(): string {
  return localInstanceId;
}

export function subscribeRealtimeBus(handler: RealtimeMessageHandler): () => void {
  handlers.add(handler);
  ensureListenerConnected();
  return () => {
    handlers.delete(handler);
  };
}

function notifyLocalHandlers(msg: RealtimeMessage): void {
  for (const handler of handlers) {
    try {
      handler(msg);
    } catch (err) {
      logger.error({ err, tournamentId: msg.tournamentId }, "Error in realtime message handler");
    }
  }
}

/**
 * Connect dedicated PostgreSQL client to LISTEN on `bidwar_scoring_realtime`.
 * Auto-reconnects with backoff if disconnected.
 */
function ensureListenerConnected(): void {
  if (isConnected || isConnecting || pgListenerClient) return;

  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    logger.warn("DATABASE_URL not available — realtime bus operating in local in-memory mode");
    return;
  }

  isConnecting = true;
  const client = createPgClient(dbUrl);

  client.on("notification", (msg) => {
    if (msg.channel !== CHANNEL_NAME || !msg.payload) return;
    try {
      const parsed = JSON.parse(msg.payload) as RealtimeMessage;
      // If message came from another process, dispatch to local handlers!
      if (parsed.instanceId !== localInstanceId) {
        notifyLocalHandlers(parsed);
      }
    } catch (err) {
      logger.warn({ err, payload: msg.payload }, "Failed to parse realtime bus notification");
    }
  });

  client.on("error", (err) => {
    logger.warn({ err }, "Realtime PostgreSQL listener client error — scheduling reconnect");
    teardownListener();
    scheduleReconnect();
  });

  client.on("end", () => {
    logger.info("Realtime PostgreSQL listener connection ended");
    teardownListener();
    scheduleReconnect();
  });

  client
    .connect()
    .then(async () => {
      await client.query(`LISTEN ${CHANNEL_NAME}`);
      pgListenerClient = client;
      isConnected = true;
      isConnecting = false;
      logger.info({ localInstanceId, channel: CHANNEL_NAME }, "Realtime PostgreSQL LISTEN active across instances");
    })
    .catch((err) => {
      logger.warn({ err }, "Could not connect PostgreSQL realtime listener — falling back to local dispatch");
      teardownListener();
      scheduleReconnect();
    });
}

function teardownListener(): void {
  isConnected = false;
  isConnecting = false;
  if (pgListenerClient) {
    try {
      pgListenerClient.end().catch(() => {});
    } catch {
      // ignore
    }
    pgListenerClient = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ensureListenerConnected();
  }, 5000);
}

/**
 * Publish message to shared realtime transport (PostgreSQL NOTIFY + local dispatch).
 *
 * NON-BLOCKING & ASYNC:
 * Scorer mutations must NEVER wait for or fail on publication.
 */
export function publishRealtimeMessage(
  tournamentId: number,
  channel: "scoring" | "obs_director",
  payload: Record<string, unknown>,
  sequence?: number,
): void {
  const message: RealtimeMessage = {
    channel,
    tournamentId,
    instanceId: localInstanceId,
    payload,
    sequence,
    timestamp: Date.now(),
  };

  // 1. Dispatch locally immediately (zero latency for same instance)
  notifyLocalHandlers(message);

  // 2. Publish to PostgreSQL NOTIFY asynchronously for all other connected API instances
  void (async () => {
    try {
      const { pool } = await import("@workspace/db");
      const jsonStr = JSON.stringify(message);

      // Postgres NOTIFY payload limit is 8000 bytes.
      if (Buffer.byteLength(jsonStr, "utf8") < 7500) {
        await pool.query("SELECT pg_notify($1, $2)", [CHANNEL_NAME, jsonStr]);
      } else {
        // For oversized payloads, publish a compact notification so other instances know to load fresh state
        const compactMsg: RealtimeMessage = {
          channel,
          tournamentId,
          instanceId: localInstanceId,
          payload: {
            type: payload.type ?? "scoring_state",
            matchId: payload.matchId,
            isOversized: true,
          },
          sequence,
          timestamp: message.timestamp,
        };
        await pool.query("SELECT pg_notify($1, $2)", [CHANNEL_NAME, JSON.stringify(compactMsg)]);
      }
    } catch (err) {
      logger.warn({ err, tournamentId }, "Async PostgreSQL realtime publish failed (state is persisted in DB)");
    }
  })();
}
