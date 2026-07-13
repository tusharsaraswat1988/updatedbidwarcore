import type { Request, Response } from "express";
import { Router, type IRouter } from "express";
import { getSchemaHealthReport, pool } from "@workspace/db";
import { requireAdmin } from "../middleware/require-admin";

const router: IRouter = Router();

/**
 * GET /api/admin/schema-health
 * Admin-only drift report (read-only — never mutates).
 */
router.get("/admin/schema-health", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const report = await getSchemaHealthReport(pool);
    const status = report.critical ? 503 : 200;
    res.status(status).json(report);
  } catch (err) {
    res.status(500).json({
      error: "Failed to build schema health report",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
