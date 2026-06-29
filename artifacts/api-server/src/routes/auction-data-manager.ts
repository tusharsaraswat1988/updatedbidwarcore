import { Router, type Request, type Response } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { bulkImportJobsTable, tournamentsTable } from "@workspace/db";
import { requireMasterAdmin } from "../middleware/require-admin.ts";
import { auditLog } from "../lib/audit-service.ts";
import {
  exportAuctionDataExcel,
  parseExcelBuffer,
  validateAuctionImport,
  commitAuctionImport,
  listImportHistory,
  buildErrorReportCsv,
} from "../lib/bulk-import/auction-data-service.ts";
import {
  rollbackBulkImportJob,
  getImportJobDetail,
} from "../lib/bulk-import/rollback-service.ts";

const router = Router({ mergeParams: true });

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      || file.originalname.endsWith(".xlsx");
    cb(null, ok);
  },
});

function clientMeta(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : req.socket?.remoteAddress ?? null;
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  return { ipAddress: ip, userAgent };
}

function performedBy(req: Request): string {
  return req.jwtUser?.adminLevel === "master" ? "master_admin" : "data_entry_admin";
}

async function assertTournamentExists(tournamentId: number): Promise<boolean> {
  const [t] = await db
    .select({ id: tournamentsTable.id })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  return !!t;
}

/** GET /tournaments/:id/auction-data/export */
router.get(
  "/export",
  requireMasterAdmin,
  async (req: Request, res: Response) => {
    const tournamentId = Number(req.params.id);
    if (!Number.isFinite(tournamentId)) {
      res.status(400).json({ error: "Invalid tournament ID" });
      return;
    }
    if (!(await assertTournamentExists(tournamentId))) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    try {
      const buffer = await exportAuctionDataExcel(tournamentId);
      const fileName = `auction-data-t${tournamentId}-${Date.now()}.xlsx`;
      auditLog(req, {
        category: "admin",
        action: "auction_data.exported",
        summary: `Exported auction data for tournament ${tournamentId}`,
        tournamentId,
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Export failed" });
    }
  },
);

/** POST /tournaments/:id/auction-data/import/preview */
router.post(
  "/import/preview",
  requireMasterAdmin,
  excelUpload.single("file"),
  async (req: Request, res: Response) => {
    const tournamentId = Number(req.params.id);
    if (!Number.isFinite(tournamentId)) {
      res.status(400).json({ error: "Invalid tournament ID" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Excel file required" });
      return;
    }

    try {
      const rows = await parseExcelBuffer(req.file.buffer);
      const preview = await validateAuctionImport(tournamentId, rows);

      const [job] = await db
        .insert(bulkImportJobsTable)
        .values({
          tournamentId,
          moduleType: "auction_data",
          uploadedBy: performedBy(req),
          fileName: req.file.originalname,
          ...clientMeta(req),
          status: preview.valid ? "validated" : "failed",
          totalRows: rows.length,
          failedRows: preview.summary.errors,
          skippedRows: preview.summary.rowsSkipped,
          previewJson: { summary: preview.summary, rawRows: rows },
          errorReportJson: preview.issues,
        })
        .returning();

      res.json({
        jobId: job!.id,
        preview,
        fileName: req.file.originalname,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Preview failed" });
    }
  },
);

/** POST /tournaments/:id/auction-data/import/confirm */
router.post(
  "/import/confirm",
  requireMasterAdmin,
  async (req: Request, res: Response) => {
    const tournamentId = Number(req.params.id);
    const { jobId } = req.body as { jobId?: number };

    if (!Number.isFinite(tournamentId) || !jobId) {
      res.status(400).json({ error: "tournamentId and jobId required" });
      return;
    }

    const [job] = await db
      .select()
      .from(bulkImportJobsTable)
      .where(eq(bulkImportJobsTable.id, jobId))
      .limit(1);

    if (!job || job.tournamentId !== tournamentId) {
      res.status(404).json({ error: "Import job not found" });
      return;
    }
    if (job.status !== "validated") {
      res.status(400).json({ error: "Import job is not in validated state" });
      return;
    }

    try {
      const previewData = job.previewJson as { rawRows?: Record<string, unknown>[] } | null;
      const rawRows = previewData?.rawRows;
      if (!rawRows?.length) {
        res.status(400).json({ error: "No staged rows found for this import job" });
        return;
      }

      const preview = await validateAuctionImport(tournamentId, rawRows);
      if (!preview.valid) {
        await db
          .update(bulkImportJobsTable)
          .set({ status: "failed", errorReportJson: preview.issues })
          .where(eq(bulkImportJobsTable.id, jobId));
        res.status(422).json({ error: "Validation failed on confirm", preview });
        return;
      }

      const meta = clientMeta(req);
      const result = await commitAuctionImport(tournamentId, preview.rows, {
        performedBy: performedBy(req),
        fileName: job.fileName ?? undefined,
        ...meta,
        preview,
        existingJobId: jobId,
      });

      auditLog(req, {
        category: "admin",
        action: "auction_data.imported",
        summary: `Imported auction data: ${result.updatedRows} rows updated for tournament ${tournamentId}`,
        tournamentId,
        metadata: { jobId: result.jobId, updatedRows: result.updatedRows },
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Import failed" });
    }
  },
);

/** GET /tournaments/:id/auction-data/import/history */
router.get(
  "/import/history",
  requireMasterAdmin,
  async (req: Request, res: Response) => {
    const tournamentId = Number(req.params.id);
    if (!Number.isFinite(tournamentId)) {
      res.status(400).json({ error: "Invalid tournament ID" });
      return;
    }

    const jobs = await listImportHistory(tournamentId);
    res.json({ jobs: jobs.sort((a, b) => {
      const ta = a.uploadedAt?.getTime() ?? 0;
      const tb = b.uploadedAt?.getTime() ?? 0;
      return tb - ta;
    }) });
  },
);

/** GET /tournaments/:id/auction-data/import/jobs/:jobId */
router.get(
  "/import/jobs/:jobId",
  requireMasterAdmin,
  async (req: Request, res: Response) => {
    const jobId = Number(req.params.jobId);
    const detail = await getImportJobDetail(jobId);
    if (!detail) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(detail);
  },
);

/** POST /tournaments/:id/auction-data/import/jobs/:jobId/rollback */
router.post(
  "/import/jobs/:jobId/rollback",
  requireMasterAdmin,
  async (req: Request, res: Response) => {
    const jobId = Number(req.params.jobId);
    const tournamentId = Number(req.params.id);

    try {
      const result = await rollbackBulkImportJob(jobId, performedBy(req), clientMeta(req));
      auditLog(req, {
        category: "admin",
        action: "auction_data.rolled_back",
        summary: `Rolled back import job ${jobId} for tournament ${tournamentId}`,
        tournamentId,
        metadata: result,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Rollback failed" });
    }
  },
);

/** POST /tournaments/:id/auction-data/import/error-report */
router.post(
  "/import/error-report",
  requireMasterAdmin,
  (req: Request, res: Response) => {
    const { issues } = req.body as { issues?: unknown };
    if (!Array.isArray(issues)) {
      res.status(400).json({ error: "issues array required" });
      return;
    }
    const csv = buildErrorReportCsv(issues as Parameters<typeof buildErrorReportCsv>[0]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="import-errors.csv"');
    res.send(csv);
  },
);

export default router;
