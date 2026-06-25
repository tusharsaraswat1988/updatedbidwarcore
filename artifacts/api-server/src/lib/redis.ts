import Redis from "ioredis";
import { getRuntimeConfig } from "./runtime-env";
import { logger } from "./logger";

let commandClient: Redis | null = null;
let subscriberClient: Redis | null = null;
let initAttempted = false;

function createClient(label: string): Redis {
  const { redisUrl } = getRuntimeConfig();
  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured");
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on("error", (err) => {
    logger.warn({ err, label }, "Redis client error");
  });

  client.on("connect", () => {
    logger.info({ label }, "Redis connected");
  });

  return client;
}

/** True when REDIS_URL is configured and clients are available. */
export function isRedisEnabled(): boolean {
  return !!getRuntimeConfig().redisUrl;
}

/** Shared Redis client for commands (lock, buffer, publish). */
export function getRedisCommandClient(): Redis | null {
  if (!isRedisEnabled()) return null;
  if (!commandClient) {
    commandClient = createClient("command");
  }
  return commandClient;
}

/** Dedicated subscriber client (Redis requires separate connection for SUBSCRIBE). */
export function getRedisSubscriberClient(): Redis | null {
  if (!isRedisEnabled()) return null;
  if (!subscriberClient) {
    subscriberClient = createClient("subscriber");
  }
  return subscriberClient;
}

/** Connect subscriber on startup; safe to call when Redis is disabled. */
export async function initRedisClients(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;
  if (!isRedisEnabled()) {
    logger.info("Redis not configured — using in-memory fallbacks for locks and SSE");
    return;
  }
  getRedisCommandClient();
  getRedisSubscriberClient();
}
