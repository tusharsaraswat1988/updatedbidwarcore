import "./lib/bootstrap.js";
import "./lib/scoring-adapters/register.js";
import app from "./app";
import { logger } from "./lib/logger";
import { startConsentBlastScheduler } from "./lib/scheduler";
import { startCreativeRenderWorker } from "./lib/creative-render-worker";
import { startCommunicationWorker } from "./lib/communication/worker.js";
import { seedCommunicationDefaults } from "./lib/communication/seed-templates.js";
import { getRuntimeConfig } from "./lib/runtime-env";
import { initRedisClients } from "./lib/redis";
import { startAuctionEventSubscriber } from "./lib/auction-events";
import { ensureCoreSchema, pool } from "@workspace/db";
import { brandingService } from "./lib/branding-service.js";
import { startMemoryDiagnostics } from "./lib/memory-diagnostics.js";

const { port } = getRuntimeConfig();

async function start() {
  await ensureCoreSchema(pool);
  await brandingService.migrateLegacyBrandingAssets();
  await brandingService.refreshPlatformBrandingCache();
  await seedCommunicationDefaults();
  await initRedisClients();
  await startAuctionEventSubscriber();

  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startConsentBlastScheduler();
    startCreativeRenderWorker();
    startCommunicationWorker();
    startMemoryDiagnostics();
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
