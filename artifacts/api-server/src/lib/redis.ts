import Redis from "ioredis";
import { getRuntimeConfig } from "./runtime-env";
import { logger } from "./logger";

let commandClient: Redis | null = null;
let subscriberClient: Redis | null = null;
let initAttempted = false;
let redisUnavailable = false;
let warnedFallback = false;

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
    redisUnavailable = true;
    if (!warnedFallback) {
      warnedFallback = true;
      logger.warn({ err, label }, "Redis unavailable — falling back to in-memory locks and SSE on this instance");
    } else {
      logger.warn({ err, label }, "Redis client error");
    }
  });

  client.on("ready", () => {
    redisUnavailable = false;
    logger.info({ label }, "Redis ready");
  });

  return client;
}

/** True when REDIS_URL is configured and clients are available. */
export function isRedisEnabled(): boolean {
  return !!getRuntimeConfig().redisUrl;
}

/** Shared Redis client for commands (lock, buffer, publish). */
export function getRedisCommandClient(): Redis | null {
  if (!isRedisEnabled() || redisUnavailable) return null;
  if (!commandClient) {
    commandClient = createClient("command");
  }
  return commandClient;
}

/** Dedicated subscriber client (Redis requires separate connection for SUBSCRIBE). */
export function getRedisSubscriberClient(): Redis | null {
  if (!isRedisEnabled() || redisUnavailable) return null;
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
  const command = getRedisCommandClient();
  const subscriber = getRedisSubscriberClient();
  try {
    await Promise.all([command?.ping(), subscriber?.ping()]);
    logger.info("Redis configured for distributed locks and SSE pub/sub");
  } catch (err) {
    redisUnavailable = true;
    warnedFallback = true;
    logger.warn({ err }, "Redis startup check failed — falling back to in-memory locks and SSE on this instance");
  }
}

export function markRedisUnavailable(err: unknown, context: string): void {
  redisUnavailable = true;
  if (!warnedFallback) {
    warnedFallback = true;
  }
  logger.warn({ err, context }, "Redis operation failed — falling back to in-memory locks and SSE on this instance");
}
