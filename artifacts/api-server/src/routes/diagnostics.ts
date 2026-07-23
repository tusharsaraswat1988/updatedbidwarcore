import { Router } from "express";
import { getBootMetricsSnapshot, pool } from "@workspace/db";
import { requireMasterAdmin } from "../middleware/require-admin.js";
import { buildStartupDiagnosticsPayload } from "../lib/diagnostics/build-startup-payload.js";
import { collectRuntimeDiagnostics } from "../lib/diagnostics/collect-runtime-diagnostics.js";
import { getRuntimeConfig } from "../lib/runtime-env.js";

const router = Router();
const adminDiagnostics = Router();

/**
 * Platform-internal diagnostics — Super Admin only.
 *
 * Mounted at `/auth/admin/diagnostics` (not bare `/auth/admin`) so
 * `requireMasterAdmin` cannot intercept organizer routes under
 * `/auth/admin/communicate/*` and similar prefixes.
 */
adminDiagnostics.use(requireMasterAdmin);

adminDiagnostics.get("/startup", (_req, res) => {
  let databaseUrl: string | undefined;
  try {
    databaseUrl = getRuntimeConfig().databaseUrl;
  } catch {
    databaseUrl = process.env.DATABASE_URL;
  }

  const payload = buildStartupDiagnosticsPayload({
    snapshot: getBootMetricsSnapshot(),
    databaseUrl,
    runtime: collectRuntimeDiagnostics(pool),
    appDomain: process.env.APP_DOMAIN,
    appUrl: process.env.APP_URL,
    nodeEnv: process.env.NODE_ENV,
    bidwarEnv: process.env.BIDWAR_ENV,
  });

  res.status(200).json(payload);
});

router.use("/auth/admin/diagnostics", adminDiagnostics);

export default router;
