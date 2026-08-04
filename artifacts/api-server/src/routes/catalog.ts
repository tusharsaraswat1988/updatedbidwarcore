import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  CatalogRegistry,
  resolveResultOk,
  type ResolveContext,
  type ResolutionMode,
} from "@workspace/platform-core/catalog";

const router: IRouter = Router();

const listFilterSchema = z.object({
  sportId: z.string().min(1),
  variantId: z.string().min(1),
  competitionTypeId: z.string().min(1),
  includeDeprecated: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const resolveBodySchema = z.object({
  sportId: z.string().min(1),
  variantId: z.string().min(1),
  competitionTypeId: z.string().min(1),
  profileFamilyId: z.string().min(1),
  profileId: z.string().min(1),
  profileVersion: z.string().min(1),
  resolutionMode: z
    .enum(["PREVIEW", "CREATE", "MATCH_START", "VALIDATE", "MIGRATION"])
    .default("PREVIEW"),
});

/** Read-only Product Catalog APIs — never expose RuntimeAdapter DTOs. */

router.get("/catalog/rule-categories", (_req, res) => {
  res.json({ categories: CatalogRegistry.listRuleCategories() });
});

router.get("/catalog/rule-definitions", (req, res) => {
  const sportId = typeof req.query.sportId === "string" ? req.query.sportId : "";
  if (!sportId) {
    return res.status(400).json({ error: "sportId is required" });
  }
  const categoryId =
    typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  res.json({
    definitions: CatalogRegistry.getRuleDefinitions({ sportId, categoryId }),
  });
});

router.get("/catalog/rule-profiles", (req, res) => {
  const parsed = listFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const profiles = CatalogRegistry.listRuleProfiles(parsed.data);
  const families = CatalogRegistry.listRuleProfileFamilies(parsed.data);
  res.json({ profiles, families });
});

router.get("/catalog/rule-profiles/:id", (req, res) => {
  const version = typeof req.query.version === "string" ? req.query.version : undefined;
  const profile = CatalogRegistry.getRuleProfile(req.params.id, version);
  if (!profile) {
    return res.status(404).json({ error: "Rule profile not found" });
  }
  const versions = CatalogRegistry.listRuleProfileVersions(profile.familyId);
  res.json({ profile, versions });
});

router.post("/catalog/rule-profiles/validate", (req, res) => {
  const parsed = resolveBodySchema.safeParse({
    ...req.body,
    resolutionMode: "VALIDATE",
  });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const ctx: ResolveContext = {
    ...parsed.data,
    resolutionMode: "VALIDATE" satisfies ResolutionMode,
  };
  const result = CatalogRegistry.resolveRuleProfilePreview(ctx);
  res.json({
    ok: resolveResultOk(result),
    issues: result.validation,
    warnings: result.warnings,
    summary: result.summary,
  });
});

router.post("/catalog/rule-profiles/resolve", (req, res) => {
  const parsed = resolveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const ctx: ResolveContext = {
    ...parsed.data,
    resolutionMode: parsed.data.resolutionMode,
  };
  const result = CatalogRegistry.resolveRuleProfilePreview(ctx);
  // Permanent public contract: ResolveResult (not adapter DTOs).
  res.json(result);
});

export default router;
