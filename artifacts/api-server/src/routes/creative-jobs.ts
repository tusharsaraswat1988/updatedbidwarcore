import { Router, type Response } from "express";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { z } from "zod";
import { isBuzzStudioEnabled } from "@workspace/api-base/tournament-features";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  createCreativeJob,
  getCreativeJob,
  listCreativeJobs,
  updateCreativeJobStatus,
  CREATIVE_JOB_STATUSES,
} from "../lib/creative-jobs-service";
import {
  isLocalCreativeResultUrl,
  resolveLocalCreativePngPath,
} from "../lib/creative-render-storage.js";

const router = Router();

async function requireBuzzStudio(tournamentId: number, res: Response): Promise<boolean> {
  const [tournament] = await db
    .select({ featuresJson: tournamentsTable.featuresJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return false;
  }

  if (!isBuzzStudioEnabled(tournament.featuresJson as Record<string, unknown> | null)) {
    res.status(403).json({ error: "Buzz Studio is not enabled for this tournament" });
    return false;
  }

  return true;
}

function resolveUserId(req: import("express").Request): number | null {
  const accountId = req.jwtUser?.organizerAccountId;
  return typeof accountId === "number" ? accountId : null;
}

function creativeDownloadFilename(templateId: string, aspectRatio: string, jobId: string): string {
  const safeTemplate = templateId.replace(/[^a-z0-9_-]/gi, "-");
  const ratio = aspectRatio.replace(":", "x");
  return `bidwar-${safeTemplate}-${ratio}-${jobId.slice(0, 8)}.png`;
}

function cloudinaryAttachmentUrl(secureUrl: string): string {
  if (!secureUrl.includes("res.cloudinary.com") || !secureUrl.includes("/upload/")) {
    return secureUrl;
  }
  if (secureUrl.includes("/upload/fl_attachment")) return secureUrl;
  return secureUrl.replace("/upload/", "/upload/fl_attachment/");
}

// GET /tournaments/:tournamentId/creative-jobs
router.get("/tournaments/:tournamentId/creative-jobs", async (req, res) => {
  const tid = parseInt(req.params.tournamentId, 10);
  if (Number.isNaN(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  if (!(await requireBuzzStudio(tid, res))) return;

  const templateId = typeof req.query.templateId === "string" ? req.query.templateId : undefined;
  const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const limit = Number.isNaN(limitParam) ? 50 : Math.min(limitParam, 100);

  const jobs = await listCreativeJobs(tid, { limit, templateId });
  res.json({ jobs });
});

// GET /tournaments/:tournamentId/creative-jobs/:jobId
router.get("/tournaments/:tournamentId/creative-jobs/:jobId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId, 10);
  if (Number.isNaN(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  if (!(await requireBuzzStudio(tid, res))) return;

  const job = await getCreativeJob(tid, req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Creative job not found" });
    return;
  }
  res.json({ job });
});

// GET /tournaments/:tournamentId/creative-jobs/:jobId/file
router.get("/tournaments/:tournamentId/creative-jobs/:jobId/file", async (req, res) => {
  const tid = parseInt(req.params.tournamentId, 10);
  if (Number.isNaN(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  if (!(await requireBuzzStudio(tid, res))) return;

  const job = await getCreativeJob(tid, req.params.jobId);
  if (!job || job.status !== "completed" || !job.resultUrl) {
    res.status(404).json({ error: "Creative file not available" });
    return;
  }

  const asDownload = req.query.download === "1" || req.query.download === "true";
  const filename = creativeDownloadFilename(job.templateId, job.aspectRatio, job.id);

  if (job.resultUrl.startsWith("https://")) {
    const target = asDownload ? cloudinaryAttachmentUrl(job.resultUrl) : job.resultUrl;
    res.redirect(302, target);
    return;
  }

  if (isLocalCreativeResultUrl(job.resultUrl)) {
    const filePath = resolveLocalCreativePngPath(job.resultUrl);
    if (!filePath) {
      res.status(404).json({ error: "Creative file not found" });
      return;
    }
    try {
      await access(filePath, fsConstants.R_OK);
    } catch {
      res.status(404).json({ error: "Creative file not found on disk" });
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `${asDownload ? "attachment" : "inline"}; filename="${filename}"`,
    );
    res.sendFile(filePath);
    return;
  }

  res.status(404).json({ error: "Unsupported creative storage URL" });
});

const createJobSchema = z.object({
  templateId: z.string().min(1),
  contract: z.record(z.string(), z.unknown()),
  aspectRatio: z.string().min(1),
});

// POST /tournaments/:tournamentId/creative-jobs
router.post("/tournaments/:tournamentId/creative-jobs", async (req, res) => {
  const tid = parseInt(req.params.tournamentId, 10);
  if (Number.isNaN(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  if (!(await requireBuzzStudio(tid, res))) return;

  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const job = await createCreativeJob({
    tournamentId: tid,
    templateId: parsed.data.templateId,
    contract: parsed.data.contract,
    aspectRatio: parsed.data.aspectRatio,
    userId: resolveUserId(req),
  });

  res.status(201).json({ job });
});

const updateStatusSchema = z.object({
  status: z.enum(CREATIVE_JOB_STATUSES),
  errorMessage: z.string().nullable().optional(),
  resultUrl: z.string().nullable().optional(),
});

// PATCH /tournaments/:tournamentId/creative-jobs/:jobId/status
router.patch("/tournaments/:tournamentId/creative-jobs/:jobId/status", async (req, res) => {
  const tid = parseInt(req.params.tournamentId, 10);
  if (Number.isNaN(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  if (!(await requireBuzzStudio(tid, res))) return;

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const job = await updateCreativeJobStatus(tid, req.params.jobId, parsed.data);
  if (!job) {
    res.status(404).json({ error: "Creative job not found" });
    return;
  }
  res.json({ job });
});

export default router;
