import { Router, type IRouter } from "express";
import { z } from "zod";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import { buildCompetitionStatus } from "@workspace/platform-core/competition";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  buildCompetitionAggregate,
  buildWorkingConfiguration,
  loadLatestPlan,
  loadParticipants,
  loadTournamentCompetitionRow,
  lockCompetitionSetup,
  patchCompetitionConfiguration,
} from "../lib/competition-service";
import {
  validateCompetitionConfiguration,
  validateCricketKeyRuleOverrides,
} from "@workspace/platform-core/competition";

const router: IRouter = Router();

const patchSchema = z.object({
  competitionTypeId: z.string().min(1).nullable().optional(),
  variantId: z.string().min(1).nullable().optional(),
  ruleProfileId: z.string().min(1).nullable().optional(),
  ruleProfileVersion: z.string().min(1).nullable().optional(),
  presentationProfileId: z.string().min(1).nullable().optional(),
  presentationProfileVersion: z.string().min(1).nullable().optional(),
  registrationModeId: z.string().min(1).nullable().optional(),
  teamFormationStrategyId: z.string().min(1).nullable().optional(),
  squadRules: z.record(z.string(), z.unknown()).nullable().optional(),
  ruleOverrides: z
    .object({
      values: z.record(z.string(), z.union([z.number(), z.boolean(), z.string(), z.null()])),
    })
    .nullable()
    .optional(),
  participantConstraints: z.record(z.string(), z.unknown()).nullable().optional(),
  businessStageId: z.string().min(1).nullable().optional(),
});

function parseTid(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

/** GET /tournaments/:id/competition — aggregate root */
router.get("/tournaments/:id/competition", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const aggregate = await buildCompetitionAggregate(tid);
  if (!aggregate) return res.status(404).json({ error: "Tournament not found" });
  res.json({
    plan: aggregate.plan,
    configuration: aggregate.configuration,
    validation: aggregate.validation,
    summary: aggregate.summary,
  });
});

router.get("/tournaments/:id/competition/configuration", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const tournament = await loadTournamentCompetitionRow(tid);
  if (!tournament) return res.status(404).json({ error: "Tournament not found" });
  const plan = await loadLatestPlan(tid);
  res.json({ configuration: buildWorkingConfiguration(tournament, plan) });
});

router.get("/tournaments/:id/competition/plan", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const tournament = await loadTournamentCompetitionRow(tid);
  if (!tournament) return res.status(404).json({ error: "Tournament not found" });
  const plan = await loadLatestPlan(tid);
  if (!plan) return res.status(404).json({ error: "Competition Plan not locked yet" });
  res.json({ plan });
});

router.get("/tournaments/:id/competition/participants", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const tournament = await loadTournamentCompetitionRow(tid);
  if (!tournament) return res.status(404).json({ error: "Tournament not found" });
  const participants = await loadParticipants(tournament);
  res.json({ participants });
});

router.get("/tournaments/:id/competition/validation", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const tournament = await loadTournamentCompetitionRow(tid);
  if (!tournament) return res.status(404).json({ error: "Tournament not found" });
  const plan = await loadLatestPlan(tid);
  const configuration = buildWorkingConfiguration(tournament, plan);
  const validation = validateCompetitionConfiguration(configuration);
  const status = buildCompetitionStatus(configuration, validation);
  res.json({ validation, status });
});

router.get("/tournaments/:id/competition/history", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const tournament = await loadTournamentCompetitionRow(tid);
  if (!tournament) return res.status(404).json({ error: "Tournament not found" });
  const plan = await loadLatestPlan(tid);
  res.json({ history: plan ? [plan] : [] });
});

router.patch("/tournaments/:id/competition/configuration", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  if (parsed.data.competitionTypeId) {
    if (!CatalogRegistry.getCompetitionType(parsed.data.competitionTypeId)) {
      return res.status(400).json({ error: "Unknown competitionTypeId" });
    }
  }
  if (parsed.data.variantId) {
    if (!CatalogRegistry.getVariant(parsed.data.variantId)) {
      return res.status(400).json({ error: "Unknown variantId" });
    }
  }
  if (parsed.data.registrationModeId) {
    if (!CatalogRegistry.getRegistrationMode(parsed.data.registrationModeId)) {
      return res.status(400).json({ error: "Unknown registrationModeId" });
    }
  }
  if (parsed.data.teamFormationStrategyId) {
    if (!CatalogRegistry.getTeamFormationStrategy(parsed.data.teamFormationStrategyId)) {
      return res.status(400).json({ error: "Unknown teamFormationStrategyId" });
    }
  }
  if (parsed.data.ruleOverrides !== undefined) {
    const overrides = validateCricketKeyRuleOverrides(parsed.data.ruleOverrides);
    if (!overrides.ok) return res.status(400).json({ error: overrides.error });
    const result = await patchCompetitionConfiguration(tid, {
      ...parsed.data,
      ruleOverrides: overrides.document,
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    const validation = validateCompetitionConfiguration(result.configuration);
    return res.json({
      configuration: result.configuration,
      validation,
      status: buildCompetitionStatus(result.configuration, validation),
    });
  }

  const result = await patchCompetitionConfiguration(tid, parsed.data);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const validation = validateCompetitionConfiguration(result.configuration);
  res.json({
    configuration: result.configuration,
    validation,
    status: buildCompetitionStatus(result.configuration, validation),
  });
});

/** Lock Competition Setup — organizer approval required; never auto-freeze. */
router.post("/tournaments/:id/competition/ready", async (req, res) => {
  const tid = parseTid(req.params.id);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const frozenBy =
    req.jwtUser?.email ||
    (req.jwtUser?.organizerAccountId != null
      ? `organizer:${req.jwtUser.organizerAccountId}`
      : req.jwtUser?.isAdmin
        ? "admin"
        : null);

  const result = await lockCompetitionSetup(tid, frozenBy);
  if (!result.ok) {
    return res.status(result.status).json({
      error: result.error,
      validation: result.validation,
    });
  }

  const aggregate = await buildCompetitionAggregate(tid);
  res.json({
    competitionStatus: aggregate?.summary.status ?? null,
    validation: result.validation,
    planVersion: result.plan.version,
    plan: result.plan,
    tournamentTransitionResult: result.tournamentTransitionResult,
  });
});

export default router;
