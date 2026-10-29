import "./lib/bootstrap.js";
import "./lib/scoring-adapters/register.js";
import app from "./app";
import { logger } from "./lib/logger";
import { startConsentBlastScheduler } from "./lib/scheduler";
import { startCommunicationWorker } from "./lib/communication/worker.js";
import { seedCommunicationDefaults } from "./lib/communication/seed-templates.js";
import { getRuntimeConfig } from "./lib/runtime-env";
import { initRedisClients } from "./lib/redis";
import { startAuctionEventSubscriber } from "./lib/auction-events";
import { startBadmintonEventSubscriber } from "./lib/badminton-broadcast";
import { ensureCoreSchema, pool } from "@workspace/db";
import { brandingService } from "./lib/branding-service.js";
import { refreshBrandingIconCache } from "./lib/branding-asset-resolver.js";
import { startMemoryDiagnostics } from "./lib/memory-diagnostics.js";
import { cleanupOrphanScorerAccounts, ensureBootstrapScorerAccount } from "./lib/scorer-auth.js";
import { startScorerLockCleanupJob } from "./lib/scorer-match-locks.js";
import { validateWhatsAppProviderAtStartup } from "./lib/communication/providers/index.js";

const { port } = getRuntimeConfig();

async function start() {
  // Schema validate/heal must succeed before binding PORT.
  await ensureCoreSchema(pool);
  await ensureBootstrapScorerAccount();
  await cleanupOrphanScorerAccounts();
  await brandingService.migrateLegacyBrandingAssets();
  await brandingService.refreshPlatformBrandingCache();
  await refreshBrandingIconCache();
  await seedCommunicationDefaults();
  await initRedisClients();
  await startAuctionEventSubscriber();
  await startBadmintonEventSubscriber();

  // Validate active WhatsApp provider configuration at startup
  const waValidation = validateWhatsAppProviderAtStartup();
  if (!waValidation.valid) {
    logger.error(
      { provider: waValidation.provider, errors: waValidation.errors },
      "WhatsApp provider startup validation failed",
    );
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[bidwar] WhatsApp provider startup validation failed for provider '${waValidation.provider}':\n  - ` +
          waValidation.errors.join("\n  - "),
      );
      process.exit(1);
    }
  } else {
    logger.info(
      { provider: waValidation.provider },
      "WhatsApp provider startup validation passed",
    );
  }

  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startConsentBlastScheduler();
    startCommunicationWorker();
    startMemoryDiagnostics();
    startScorerLockCleanupJob();
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server — schema/bootstrap refused start");
  console.error(
    "[bidwar] Startup aborted before HTTP listen. Fix schema drift (see SCHEMA DRIFT REPORT above, if printed) or DB connectivity, then redeploy.",
  );
  process.exit(1);
});
