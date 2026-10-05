import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  buildSchedulingValidation,
  listSchedulingHistory,
  listSchedulingIdentities,
  lockSchedulingSetup,
  patchSchedulingConfiguration,
  resolveScheduling,
} from "../lib/scheduling-service";

import { db, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireScoringModule } from "../middleware/require-module";

const router: IRouter = Router();

function parseTournamentId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

router.use("/tournaments/:tournamentId", async (req, res, next) => {
  const tid = parseTournamentId(req.params.tournamentId);
  if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      auctionEnabled: tournamentsTable.auctionEnabled,
      scoringEnabled: tournamentsTable.scoringEnabled,
      sport: tournamentsTable.sport,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid))
    .limit(1);

  if (!requireScoringModule(res, tournament)) return;
  next();
});

const patchSchema = z.object({
  strategyId: z.string().nullable().optional(),
  workingDays: z.array(z.string()).nullable().optional(),
  operatingHours: z
    .object({
      start: z.string().nullable().optional(),
      end: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  bufferMinutes: z.number().int().nullable().optional(),
  parallelLimit: z.number().int().nullable().optional(),
  resourcePreferences: z.record(z.string(), z.unknown()).nullable().optional(),
  breakRules: z.record(z.string(), z.unknown()).nullable().optional(),
  venueRules: z.record(z.string(), z.unknown()).nullable().optional(),
  customSettings: z.record(z.string(), z.unknown()).nullable().optional(),
});

router.get("/tournaments/:tournamentId/scheduling", async (req, res) => {
  const tid = parseTournamentId(req.params.tournamentId);
  if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
  const identities = await listSchedulingIdentities(tid);
  res.json({ identities });
});

/** GET /tournaments/:id/scheduling/aggregate — Fast bulk loader for tournament scheduling */
router.get("/tournaments/:tournamentId/scheduling/aggregate", async (req, res) => {
  const tid = parseTournamentId(req.params.tournamentId);
  if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
  const identities = await listSchedulingIdentities(tid);
  const rows = await Promise.all(
    identities.map(async (identity) => {
      const resolved = await resolveScheduling(tid, identity.id);
      if (!resolved) return null;
      const validation = await buildSchedulingValidation(tid, identity.id);
      return {
        identity: resolved.identity,
        configuration: resolved.configuration,
        lifecycle: resolved.lifecycle,
        validation,
        slots: resolved.slots,
        assignmentCount: resolved.assignments.length,
      };
    }),
  );
  res.json({ rows: rows.filter(Boolean) });
});

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/identity",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return void res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ identity: resolved.identity });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/configuration",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return void res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ configuration: resolved.configuration });
  },
);

router.patch(
  "/tournaments/:tournamentId/scheduling/:schedulingId/configuration",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    if (!(await requireTournamentOrganizer(req, res, tid))) return;

    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid configuration patch", details: parsed.error.flatten() });
    }
    const result = await patchSchedulingConfiguration(
      tid,
      req.params.schedulingId,
      parsed.data,
    );
    if (!result.ok) return void res.status(result.status).json({ error: result.error });
    res.json({ configuration: result.configuration });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/slots",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return void res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ slots: resolved.slots });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/resources",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return void res.status(404).json({ error: "Scheduling plan not found" });
    res.json({
      assignments: resolved.assignments,
      resources: resolved.resources,
    });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/validation",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    const validation = await buildSchedulingValidation(tid, req.params.schedulingId);
    if (!validation) return void res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ validation });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/history",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return void res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ history: await listSchedulingHistory(req.params.schedulingId) });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/lifecycle",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return void res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ lifecycle: resolved.lifecycle });
  },
);

router.post(
  "/tournaments/:tournamentId/scheduling/:schedulingId/ready",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return void res.status(400).json({ error: "Invalid tournament id" });
    if (!(await requireTournamentOrganizer(req, res, tid))) return;

    const frozenBy =
      req.jwtUser?.email ||
      (req.jwtUser?.organizerAccountId != null
        ? `organizer:${req.jwtUser.organizerAccountId}`
        : req.jwtUser?.isAdmin
          ? "admin"
          : null);

    const result = await lockSchedulingSetup(tid, req.params.schedulingId, frozenBy);
    if (!result.ok) {
      return void res.status(result.status).json({
        error: result.error,
        validation: result.validation,
      });
    }
    res.json({
      history: result.history,
      validation: result.validation,
      configuration: result.configuration,
      lifecycle: result.lifecycle,
    });
  },
);

export default router;

