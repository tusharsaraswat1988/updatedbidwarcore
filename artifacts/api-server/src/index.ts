import "./lib/bootstrap.js";
import app from "./app";
import { logger } from "./lib/logger";
import { startConsentBlastScheduler } from "./lib/scheduler";
import { getRuntimeConfig } from "./lib/runtime-env";

const { port } = getRuntimeConfig();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  startConsentBlastScheduler();
});
