import { Router, type Response } from "express";
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
