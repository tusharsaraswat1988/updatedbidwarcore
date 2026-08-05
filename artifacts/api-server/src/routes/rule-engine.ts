import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  RuleEngine,
  RULE_ENGINE_INPUT_VERSION,
  type RuleEngineInput,
  type RuleResolutionMode,
} from "@workspace/platform-core/rule-engine";

const router: IRouter = Router();

const frozenRefSchema = z.object({
  id: z.union([z.string(), z.number()]),
  version: z.union([z.string(), z.number()]).nullable(),
});

const contextSchema = z.object({
  sportId: z.string().min(1),
  variantId: z.string().min(1),
  competitionTypeId: z.string().min(1),
  ruleProfile: frozenRefSchema,
  profileFamilyId: z.string().optional(),
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
  inputVersion: z.string().default(RULE_ENGINE_INPUT_VERSION),
  snapshot: snapshotSchema.default(null),
  context: contextSchema,
  compile: z.boolean().optional(),
  overrideDocuments: z
    .record(z.string(), z.object({ values: z.record(z.string(), z.unknown()) }))
    .optional(),
});

/**
 * Platform APIs — Rule Engine.
 * Idempotent (excluding durationMs). Not Organizer-only.
 */

router.post("/rule-engine/resolve", (req, res) => {
  const parsed = resolveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const input = parsed.data as unknown as RuleEngineInput;
  const result = RuleEngine.resolve(input);
  res.json(result);
});

router.post("/rule-engine/validate", (req, res) => {
  const parsed = resolveBodySchema.safeParse({
    ...req.body,
    context: {
      ...(req.body?.context ?? {}),
      resolutionMode: "VALIDATE" satisfies RuleResolutionMode,
    },
  });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const input = parsed.data as unknown as RuleEngineInput;
  const result = RuleEngine.validate(input);
  res.json(result);
});

export default router;
