/**
 * BidWar Master Workbook (BMW) — generic API namespace.
 * All tournament data exchange flows through these endpoints.
 */

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { bulkImportJobsTable, tournamentsTable, workbookVersionsTable } from "@workspace/db";
import { requireMasterAdmin } from "../middleware/require-admin";
import { auditLog } from "../lib/audit-service";
import {
  WORKBOOK_IMPORT_MODES,
  BMW_SHEETS,
  buildTargetFieldCatalog,
  suggestMappingProfile,
  type WorkbookImportMode,
} from "@workspace/api-base/tournament-workbook";
import {
  exportTournamentWorkbook,
  parseWorkbookBuffer,
  parseWorkbookFromGoogleUrl,
  parseWorkbookFromZipBuffer,
  validateTournamentWorkbook,
  commitTournamentWorkbook,
  listWorkbookHistory,
  listWorkbookVersions,
  getWorkbookHealth,
  buildValidationReportCsv,
  buildWorkbookExportFilename,
  getPhotoImportSummary,
  getPhotoJobProgress,
  listPhotoJobItems,
  retryFailedPhotos,
  DEFAULT_PHOTO_IMPORT_MODE,
  type PhotoImportMode,
} from "../lib/bulk-import/workbook-service";
import {
  rollbackBulkImportJob,
  getImportJobDetail,
} from "../lib/bulk-import/rollback-service";
import {
  listMappingProfiles,
  getMappingProfile,
  saveMappingProfile,
  updateMappingProfile,
  deleteMappingProfile,
  recordMappingProfileUse,
} from "../lib/bulk-import/mapping-profile-service";
import { createDiskMulter, readUploadedFile, removeUploadedFile } from "../lib/multer-disk-storage";

const router = Router({ mergeParams: true });

const fileUpload = createDiskMulter({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      || file.mimetype === "application/zip"
      || file.mimetype === "application/x-zip-compressed"
      || file.originalname.endsWith(".xlsx")
      || file.originalname.endsWith(".zip");
    cb(null, ok);
  },
});

async function parseUploadedWorkbook(file: Express.Multer.File) {
  const buffer = await readUploadedFile(file);
  if (file.originalname.endsWith(".zip") || file.mimetype.includes("zip")) {
    return parseWorkbookFromZipBuffer(buffer);
  }
  return parseWorkbookBuffer(buffer);
}

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

function parseImportMode(raw: unknown): WorkbookImportMode {
  const mode = String(raw ?? "merge_data") as WorkbookImportMode;
  return WORKBOOK_IMPORT_MODES.includes(mode) ? mode : "merge_data";
}

const PHOTO_IMPORT_MODES: PhotoImportMode[] = ["replace_all", "skip_existing", "replace_empty_only"];

function parsePhotoImportMode(raw: unknown): PhotoImportMode {
  const mode = String(raw ?? DEFAULT_PHOTO_IMPORT_MODE) as PhotoImportMode;
  return PHOTO_IMPORT_MODES.includes(mode) ? mode : DEFAULT_PHOTO_IMPORT_MODE;
}

function tournamentId(req: Request): number {
  return Number(req.params.id ?? req.params.tournamentId);
}

async function assertTournamentExists(tournamentId: number): Promise<boolean> {
  const [t] = await db
    .select({ id: tournamentsTable.id })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  return !!t;
}

/** GET /tournaments/:id/workbook/export */
router.get("/export", requireMasterAdmin, async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  if (!Number.isFinite(tid) || !(await assertTournamentExists(tid))) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  try {
    const buffer = await exportTournamentWorkbook(tid);
    const [t] = await db
      .select({ name: tournamentsTable.name, auctionCode: tournamentsTable.auctionCode })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid))
      .limit(1);
    const fileName = buildWorkbookExportFilename(t?.name, t?.auctionCode);
    auditLog(req, {
      category: "admin",
      action: "bmw.exported",
      summary: `Exported BidWar Master Workbook for tournament ${tid}`,
      tournamentId: tid,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Export failed" });
  }
});

/** POST /tournaments/:id/workbook/import/preview — Excel, ZIP, or Google Sheet URL */
router.post("/import/preview", requireMasterAdmin, fileUpload.single("file"), async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  const mode = parseImportMode(req.body?.mode ?? req.query?.mode);
  const googleSheetUrl = String(req.body?.googleSheetUrl ?? "").trim();
  const mappingProfileId = req.body?.mappingProfileId ? Number(req.body.mappingProfileId) : null;

  if (!Number.isFinite(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  try {
    let workbook;
    let sourceType = "excel";
    let fileName = req.file?.originalname ?? "workbook.xlsx";

    if (googleSheetUrl) {
      workbook = await parseWorkbookFromGoogleUrl(googleSheetUrl);
      sourceType = "google_sheets";
      fileName = googleSheetUrl;
    } else if (req.file) {
      if (req.file.originalname.endsWith(".zip") || req.file.mimetype.includes("zip")) {
        sourceType = "zip_package";
        fileName = req.file.originalname;
      }
      workbook = await parseUploadedWorkbook(req.file);
    } else {
      res.status(400).json({ error: "Excel file, ZIP package, or googleSheetUrl required" });
      return;
    }

    const preview = await validateTournamentWorkbook(tid, workbook, mode);

    const [job] = await db.insert(bulkImportJobsTable).values({
      tournamentId: tid,
      moduleType: "bidwar_master_workbook",
      importMode: mode,
      sourceType,
      googleSheetUrl: googleSheetUrl || null,
      uploadedBy: performedBy(req),
      fileName,
      ...clientMeta(req),
      status: preview.valid ? "validated" : "failed",
      totalRows: preview.summary.rowsTotal,
      failedRows: preview.summary.errors,
      skippedRows: preview.summary.skips,
      previewJson: { summary: preview.summary, health: preview.health, diffs: preview.diffs, photoValidation: preview.photoValidation, workbook },
      errorReportJson: preview.issues,
    }).returning();

    if (mappingProfileId) await recordMappingProfileUse(mappingProfileId);

    res.json({
      jobId: job!.id,
      preview,
      photoValidation: preview.photoValidation,
      photoQualityResults: preview.photoQualityResults,
      fileName,
      sourceType,
      health: preview.health,
      diffs: preview.diffs,
      aiSuggestions: preview.aiSuggestions,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Preview failed" });
  } finally {
    await removeUploadedFile(req.file);
  }
});

/** POST /tournaments/:id/workbook/import/confirm */
router.post("/import/confirm", requireMasterAdmin, async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  const { jobId, versionNotes, photoImportMode: rawPhotoMode } = req.body as {
    jobId?: number;
    versionNotes?: string;
    photoImportMode?: string;
  };

  if (!Number.isFinite(tid) || !jobId) {
    res.status(400).json({ error: "tournamentId and jobId required" });
    return;
  }

  const [job] = await db.select().from(bulkImportJobsTable).where(eq(bulkImportJobsTable.id, jobId)).limit(1);
  if (!job || job.tournamentId !== tid) {
    res.status(404).json({ error: "Import job not found" });
    return;
  }
  if (job.status !== "validated") {
    res.status(400).json({ error: "Import job is not in validated state" });
    return;
  }

  try {
    const previewData = job.previewJson as { workbook?: import("@workspace/api-base/tournament-workbook").ParsedWorkbook } | null;
    const workbook = previewData?.workbook;
    if (!workbook) {
      res.status(400).json({ error: "No staged workbook found" });
      return;
    }

    const mode = parseImportMode(job.importMode);
    const validation = await validateTournamentWorkbook(tid, workbook, mode);
    if (!validation.valid) {
      await db.update(bulkImportJobsTable).set({ status: "failed", errorReportJson: validation.issues }).where(eq(bulkImportJobsTable.id, jobId));
      res.status(422).json({ error: "Validation failed on confirm", preview: validation });
      return;
    }

    const result = await commitTournamentWorkbook(tid, workbook, validation, {
      performedBy: performedBy(req),
      fileName: job.fileName ?? undefined,
      importMode: mode,
      existingJobId: jobId,
      sourceType: job.sourceType ?? "excel",
      googleSheetUrl: job.googleSheetUrl ?? undefined,
      versionNotes,
      photoImportMode: parsePhotoImportMode(rawPhotoMode),
      ...clientMeta(req),
    });

    auditLog(req, {
      category: "admin",
      action: "bmw.imported",
      summary: `BMW import: ${result.updatedRows} changes for tournament ${tid}`,
      tournamentId: tid,
      metadata: result,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

/** POST /tournaments/:id/workbook/validate */
router.post("/validate", requireMasterAdmin, fileUpload.single("file"), async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  const mode = parseImportMode(req.body?.mode ?? "dry_run");
  if (!Number.isFinite(tid) || !req.file) {
    res.status(400).json({ error: "tournamentId and file required" });
    return;
  }
  try {
    const workbook = await parseUploadedWorkbook(req.file);
    const validation = await validateTournamentWorkbook(tid, workbook, mode);
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Validation failed" });
  } finally {
    await removeUploadedFile(req.file);
  }
});

/** POST /tournaments/:id/workbook/health */
router.post("/health", requireMasterAdmin, fileUpload.single("file"), async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  if (!Number.isFinite(tid) || !req.file) {
    res.status(400).json({ error: "tournamentId and file required" });
    return;
  }
  try {
    const workbook = await parseUploadedWorkbook(req.file);
    const health = await getWorkbookHealth(tid, workbook, "dry_run");
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Health check failed" });
  } finally {
    await removeUploadedFile(req.file);
  }
});

/** POST /tournaments/:id/workbook/google-sheet */
router.post("/google-sheet", requireMasterAdmin, async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  const { url, mode: rawMode } = req.body as { url?: string; mode?: string };
  if (!Number.isFinite(tid) || !url) {
    res.status(400).json({ error: "tournamentId and url required" });
    return;
  }
  try {
    const workbook = await parseWorkbookFromGoogleUrl(url);
    const mode = parseImportMode(rawMode ?? "dry_run");
    const preview = await validateTournamentWorkbook(tid, workbook, mode);
    res.json({ preview, health: preview.health, diffs: preview.diffs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Google Sheet read failed" });
  }
});

router.get("/import/history", requireMasterAdmin, async (req: Request, res: Response) => {
  const jobs = await listWorkbookHistory(tournamentId(req));
  res.json({ jobs });
});

router.get("/history", requireMasterAdmin, async (req: Request, res: Response) => {
  const jobs = await listWorkbookHistory(tournamentId(req));
  res.json({ jobs });
});

router.get("/versions", requireMasterAdmin, async (req: Request, res: Response) => {
  const versions = await listWorkbookVersions(tournamentId(req));
  res.json({ versions });
});

router.get("/version/:versionId", requireMasterAdmin, async (req: Request, res: Response) => {
  const versionId = Number(req.params.versionId);
  const [version] = await db.select().from(workbookVersionsTable).where(eq(workbookVersionsTable.id, versionId)).limit(1);
  if (!version) { res.status(404).json({ error: "Version not found" }); return; }
  res.json({ version });
});

router.get("/import/jobs/:jobId", requireMasterAdmin, async (req: Request, res: Response) => {
  const detail = await getImportJobDetail(Number(req.params.jobId));
  if (!detail) { res.status(404).json({ error: "Job not found" }); return; }
  const photoProgress = await getPhotoJobProgress(detail.job.id);
  const photoSummary = await getPhotoImportSummary(detail.job.id);
  res.json({ ...detail, photoProgress, photoSummary });
});

/** GET /tournaments/:id/workbook/import/jobs/:jobId/photos */
router.get("/import/jobs/:jobId/photos", requireMasterAdmin, async (req: Request, res: Response) => {
  const jobId = Number(req.params.jobId);
  const progress = await getPhotoJobProgress(jobId);
  const summary = await getPhotoImportSummary(jobId);
  const items = await listPhotoJobItems(jobId);
  res.json({ progress, summary, items });
});

/** POST /tournaments/:id/workbook/import/jobs/:jobId/photos/retry */
router.post("/import/jobs/:jobId/photos/retry", requireMasterAdmin, async (req: Request, res: Response) => {
  const jobId = Number(req.params.jobId);
  const tid = tournamentId(req);
  try {
    const result = await retryFailedPhotos(jobId, {
      performedBy: performedBy(req),
      ...clientMeta(req),
    });
    auditLog(req, {
      category: "admin",
      action: "bmw.photos_retried",
      summary: `Retried ${result.requeued} failed photos for job ${jobId}`,
      tournamentId: tid,
      metadata: result,
    });
    const progress = await getPhotoJobProgress(jobId);
    res.json({ ...result, progress });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Photo retry failed" });
  }
});

router.post("/import/jobs/:jobId/rollback", requireMasterAdmin, async (req: Request, res: Response) => {
  const jobId = Number(req.params.jobId);
  const tid = tournamentId(req);
  try {
    const result = await rollbackBulkImportJob(jobId, performedBy(req), clientMeta(req));
    auditLog(req, {
      category: "admin",
      action: "bmw.rolled_back",
      summary: `Rolled back BMW import job ${jobId}`,
      tournamentId: tid,
      metadata: result,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Rollback failed" });
  }
});

router.post("/rollback", requireMasterAdmin, async (req: Request, res: Response) => {
  const { jobId } = req.body as { jobId?: number };
  if (!jobId) { res.status(400).json({ error: "jobId required" }); return; }
  try {
    const result = await rollbackBulkImportJob(jobId, performedBy(req), clientMeta(req));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Rollback failed" });
  }
});

router.post("/import/validation-report", requireMasterAdmin, (req: Request, res: Response) => {
  const { issues } = req.body as { issues?: unknown };
  if (!Array.isArray(issues)) { res.status(400).json({ error: "issues array required" }); return; }
  const csv = buildValidationReportCsv(issues as Parameters<typeof buildValidationReportCsv>[0]);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="bmw-validation-report.csv"');
  res.send(csv);
});

/** Mapping profiles CRUD */
router.get("/mappings", requireMasterAdmin, async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  const profiles = await listMappingProfiles({ tournamentId: Number.isFinite(tid) ? tid : undefined });
  res.json({ profiles });
});

router.post("/mappings", requireMasterAdmin, async (req: Request, res: Response) => {
  const tid = tournamentId(req);
  const body = req.body as { name?: string; fields?: unknown; sourceLabel?: string; sport?: string };
  if (!body.name || !Array.isArray(body.fields)) {
    res.status(400).json({ error: "name and fields required" });
    return;
  }
  const profile = await saveMappingProfile({
    name: body.name,
    tournamentId: Number.isFinite(tid) ? tid : null,
    fields: body.fields,
    sourceLabel: body.sourceLabel,
    sport: body.sport,
    createdBy: performedBy(req),
  });
  res.json({ profile });
});

router.get("/mappings/:profileId", requireMasterAdmin, async (req: Request, res: Response) => {
  const profile = await getMappingProfile(Number(req.params.profileId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json({ profile });
});

router.put("/mappings/:profileId", requireMasterAdmin, async (req: Request, res: Response) => {
  const profile = await updateMappingProfile(Number(req.params.profileId), req.body);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json({ profile });
});

router.delete("/mappings/:profileId", requireMasterAdmin, async (req: Request, res: Response) => {
  const ok = await deleteMappingProfile(Number(req.params.profileId));
  res.json({ deleted: ok });
});

router.post("/mappings/suggest", requireMasterAdmin, async (req: Request, res: Response) => {
  const { headers } = req.body as { headers?: string[] };
  if (!Array.isArray(headers)) { res.status(400).json({ error: "headers array required" }); return; }
  const catalog = buildTargetFieldCatalog(BMW_SHEETS);
  const suggestions = suggestMappingProfile(headers, catalog);
  res.json({ suggestions });
});

export default router;
