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

const router: IRouter = Router();

function parseTournamentId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

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
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const identities = await listSchedulingIdentities(tid);
  res.json({ identities });
});

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/identity",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ identity: resolved.identity });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/configuration",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ configuration: resolved.configuration });
  },
);

router.patch(
  "/tournaments/:tournamentId/scheduling/:schedulingId/configuration",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
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
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ configuration: result.configuration });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/slots",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ slots: resolved.slots });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/resources",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return res.status(404).json({ error: "Scheduling plan not found" });
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
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const validation = await buildSchedulingValidation(tid, req.params.schedulingId);
    if (!validation) return res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ validation });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/history",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ history: await listSchedulingHistory(req.params.schedulingId) });
  },
);

router.get(
  "/tournaments/:tournamentId/scheduling/:schedulingId/lifecycle",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveScheduling(tid, req.params.schedulingId);
    if (!resolved) return res.status(404).json({ error: "Scheduling plan not found" });
    res.json({ lifecycle: resolved.lifecycle });
  },
);

router.post(
  "/tournaments/:tournamentId/scheduling/:schedulingId/ready",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
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
      return res.status(result.status).json({
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
