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
import { refreshBrandingIconCache } from "./lib/branding-asset-resolver.js";
import { startMemoryDiagnostics } from "./lib/memory-diagnostics.js";

const { port } = getRuntimeConfig();

/**
 * Bind PORT before schema/bootstrap work.
 * Render (and similar hosts) scan for an open port; if ensureCoreSchema or
 * Neon cold-start takes too long, the deploy fails with "no open ports"
 * even when the process is still healthy and working.
 */
function listen(): Promise<void> {
  return new Promise((resolve, reject) => {
    app.listen(port, "0.0.0.0", (err?: Error) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function start() {
  await listen();
  logger.info({ port }, "Server listening — running bootstrap");

  await ensureCoreSchema(pool);
  await brandingService.migrateLegacyBrandingAssets();
  await brandingService.refreshPlatformBrandingCache();
  await refreshBrandingIconCache();
  await seedCommunicationDefaults();
  await initRedisClients();
  await startAuctionEventSubscriber();

  logger.info({ port }, "Bootstrap complete");
  startConsentBlastScheduler();
  startCreativeRenderWorker();
  startCommunicationWorker();
  startMemoryDiagnostics();
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
