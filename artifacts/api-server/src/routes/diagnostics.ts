import { Router } from "express";
import { getBootMetricsSnapshot } from "@workspace/db";
import { requireMasterAdmin } from "../middleware/require-admin.js";
import { buildStartupDiagnosticsPayload } from "../lib/diagnostics/build-startup-payload.js";
import { getRuntimeConfig } from "../lib/runtime-env.js";

const router = Router();
const adminDiagnostics = Router();
adminDiagnostics.use(requireMasterAdmin);

adminDiagnostics.get("/diagnostics/startup", (_req, res) => {
  let databaseUrl: string | undefined;
  try {
    databaseUrl = getRuntimeConfig().databaseUrl;
  } catch {
    databaseUrl = process.env.DATABASE_URL;
  }

  const payload = buildStartupDiagnosticsPayload({
    snapshot: getBootMetricsSnapshot(),
    databaseUrl,
    appDomain: process.env.APP_DOMAIN,
    appUrl: process.env.APP_URL,
    nodeEnv: process.env.NODE_ENV,
    bidwarEnv: process.env.BIDWAR_ENV,
  });

  res.status(200).json(payload);
});

router.use("/auth/admin", adminDiagnostics);

export default router;
