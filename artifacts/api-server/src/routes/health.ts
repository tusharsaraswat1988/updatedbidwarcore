import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { resolveBuildInfo } from "../lib/diagnostics/resolve-build-info.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  const build = resolveBuildInfo();
  res.json({
    ...data,
    // Public deploy marker so staging/prod can confirm Render is on the expected SHA.
    commitSha: build.commitShaShort ?? build.commitSha ?? null,
    buildTimestamp: build.buildTimestamp,
    bidwarEnv: process.env.BIDWAR_ENV?.trim() || null,
  });
});

export default router;
