import "./lib/bootstrap.js";
import app from "./app";
import { logger } from "./lib/logger";
import { startConsentBlastScheduler } from "./lib/scheduler";
import { getRuntimeConfig } from "./lib/runtime-env";
import { initRedisClients } from "./lib/redis";
import { startAuctionEventSubscriber } from "./lib/auction-events";
import { ensureCoreSchema, pool } from "@workspace/db";

const { port } = getRuntimeConfig();

async function start() {
  await ensureCoreSchema(pool);
  await initRedisClients();
  await startAuctionEventSubscriber();

  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startConsentBlastScheduler();
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
