import app from "./app";
import { logger } from "./lib/logger";
import { startConsentBlastScheduler } from "./lib/scheduler";
import { checkRequiredEnv } from "./lib/env-check";

// Validate required env vars at startup — exits with a clear message if any
// critical variable is missing. Runs before the first request can be handled.
checkRequiredEnv();

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  startConsentBlastScheduler();
});
