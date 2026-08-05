import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  CapabilityCompiler,
  PresentationEngine,
  PRESENTATION_ENGINE_INPUT_VERSION,
  type PresentationEngineInput,
  type PresentationResolutionMode,
  type ResolvedPresentationContract,
} from "@workspace/platform-core/presentation-engine";

const router: IRouter = Router();

const frozenRefSchema = z.object({
  id: z.union([z.string(), z.number()]),
  version: z.union([z.string(), z.number()]).nullable(),
});

const contextSchema = z.object({
  sportId: z.string().min(1),
  variantId: z.string().min(1),
  competitionTypeId: z.string().min(1),
  matchTypeId: z.string().optional(),
  presentationProfile: frozenRefSchema,
  ruleProfile: frozenRefSchema.optional(),
  tournamentOverrideRef: frozenRefSchema.optional(),
  competitionOverrideRef: frozenRefSchema.optional(),
  matchOverrideRef: frozenRefSchema.optional(),
  resolutionMode: z.enum([
    "PREVIEW",
    "VALIDATE",
    "CREATE",
    "PREPARE",
    "MATCH_START",
    "MIGRATION",
  ]),
});

const snapshotSchema = z
  .object({
    matchId: z.string(),
    tournamentId: z.number(),
    snapshotVersion: z.number(),
    snapshotSchemaVersion: z.string(),
    createdAt: z.string(),
    createdBy: z.string().nullable(),
    references: z.object({
      ruleProfile: frozenRefSchema.nullable(),
      presentationProfile: frozenRefSchema.nullable(),
      competition: frozenRefSchema.nullable(),
      fixture: frozenRefSchema.nullable(),
      fixtureNode: frozenRefSchema.nullable(),
      matchBlueprint: frozenRefSchema.nullable(),
      schedulingPlan: frozenRefSchema.nullable(),
      scheduleSlot: frozenRefSchema.nullable(),
      resourceAssignments: z.array(frozenRefSchema),
      sides: z.array(frozenRefSchema),
      officials: z.array(frozenRefSchema),
      matchConfiguration: frozenRefSchema.nullable(),
    }),
  })
  .nullable();

const resolveBodySchema = z.object({
  inputVersion: z.string().default(PRESENTATION_ENGINE_INPUT_VERSION),
  snapshot: snapshotSchema.default(null),
  context: contextSchema,
  compilationMode: z.enum(["NONE", "AUTO", "REQUIRED"]).optional(),
  overrideDocuments: z
    .record(z.string(), z.object({ values: z.record(z.string(), z.unknown()) }))
    .optional(),
});

const adaptBodySchema = z.object({
  contract: z.record(z.string(), z.unknown()),
  capabilityProfileId: z.string().min(1),
  capabilityProfileVersion: z.string().nullable().optional(),
});

/**
 * Platform APIs — Presentation Engine.
 * Idempotent (excluding durationMs). Never invoke renderers.
 */

router.post("/presentation-engine/resolve", (req, res) => {
  const parsed = resolveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const input = parsed.data as unknown as PresentationEngineInput;
  const result = PresentationEngine.resolve(input);
  res.json(result);
});

router.post("/presentation-engine/validate", (req, res) => {
  const parsed = resolveBodySchema.safeParse({
    ...req.body,
    context: {
      ...(req.body?.context ?? {}),
      resolutionMode: "VALIDATE" satisfies PresentationResolutionMode,
    },
  });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const input = parsed.data as unknown as PresentationEngineInput;
  const result = PresentationEngine.validate(input);
  res.json(result);
});

router.post("/presentation-engine/adapt", (req, res) => {
  const parsed = adaptBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const contract = parsed.data.contract as unknown as ResolvedPresentationContract;
  const result = CapabilityCompiler.adapt(
    contract,
    parsed.data.capabilityProfileId,
    parsed.data.capabilityProfileVersion,
  );
  res.json(result);
});

export default router;
