/**
 * Public APIs for standalone player registration.
 * Mounted at /api/standalone-registration/*
 *
 * Isolation: does not touch BidWar players / register/:code / auction flows.
 */
import { Router } from "express";
import { z } from "zod";
import {
  createRegistrationBodySchema,
  resolveServerPaymentAmount,
} from "@workspace/standalone-registration";
import { standaloneRegistrationLimiter } from "../lib/rate-limiters";
import { logger } from "../lib/logger";
import {
  createStandaloneRegistration,
  ensureSampleTournament,
  getStandaloneRegistrationByPublicId,
  getStandaloneTournamentBySlug,
  serializePublicRegistration,
} from "../lib/standalone-registration/service";

const router = Router();

const slugParam = z.string().trim().min(1).max(64);

/**
 * GET /api/standalone-registration/config/:slug
 * Public tournament + form configuration.
 */
router.get("/standalone-registration/config/:slug", async (req, res) => {
  const slugResult = slugParam.safeParse(req.params.slug);
  if (!slugResult.success) {
    res.status(400).json({ error: "Invalid tournament slug." });
    return;
  }

  // Optional auto-seed for local/dev sample slug only — never creates BidWar tournaments.
  if (
    process.env.SR_AUTO_SEED_SAMPLE === "true" &&
    slugResult.data.toLowerCase() === (process.env.SR_SAMPLE_SLUG || "bpl").toLowerCase()
  ) {
    try {
      await ensureSampleTournament(slugResult.data.toLowerCase());
    } catch (err) {
      logger.warn({ err }, "standalone-registration: sample seed skipped");
    }
  }

  const config = await getStandaloneTournamentBySlug(slugResult.data);
  if (!config) {
    res.status(404).json({ error: "Tournament registration not found." });
    return;
  }

  res.json({ config });
});

/**
 * GET /api/standalone-registration/config/:slug/fee
 * Demonstrates server-controlled fee resolution (rejects wrong client amounts).
 */
router.get("/standalone-registration/config/:slug/fee", async (req, res) => {
  const config = await getStandaloneTournamentBySlug(String(req.params.slug || ""));
  if (!config) {
    res.status(404).json({ error: "Tournament registration not found." });
    return;
  }

  const clientAmount =
    req.query.amount !== undefined ? Number(req.query.amount) : undefined;
  const resolved = resolveServerPaymentAmount(
    { registrationFee: config.registrationFee, currency: config.currency },
    clientAmount,
  );

  if (!resolved.ok) {
    res.status(400).json({ error: resolved.error });
    return;
  }

  res.json({
    amount: resolved.amount,
    currency: resolved.currency,
    source: resolved.source,
  });
});

/**
 * POST /api/standalone-registration/register
 * Create a standalone registration (server-side ID + age).
 */
router.post(
  "/standalone-registration/register",
  standaloneRegistrationLimiter,
  async (req, res) => {
    const parsed = createRegistrationBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      return;
    }

    const slug =
      (typeof req.body?.slug === "string" && req.body.slug) ||
      (typeof req.query.slug === "string" && req.query.slug) ||
      "";

    if (!slug.trim()) {
      res.status(400).json({ error: "Tournament slug is required." });
      return;
    }

    try {
      const result = await createStandaloneRegistration({
        slug,
        payload: parsed.data,
        ipAddress: req.ip,
      });

      if (!result.ok) {
        res.status(result.status).json({
          error: result.error,
          issues: result.issues,
          existingRegistrationId: result.existingRegistrationId,
        });
        return;
      }

      res.status(201).json({
        registrationId: result.registration.registrationId,
        status: result.registration.status,
        calculatedAge: result.registration.calculatedAge,
        registrationFee: result.registrationFee,
        currency: result.currency,
        playerName: result.registration.playerName,
        paymentRequired: result.registrationFee > 0,
      });
    } catch (err) {
      logger.error({ err }, "standalone-registration: register endpoint failed");
      res.status(500).json({ error: "Unable to create registration." });
    }
  },
);

/**
 * GET /api/standalone-registration/:registrationId
 * Fetch registration summary by public registration ID.
 */
router.get("/standalone-registration/:registrationId", async (req, res) => {
  const registrationId = String(req.params.registrationId || "").trim();
  if (!registrationId || registrationId === "config" || registrationId === "register") {
    res.status(400).json({ error: "Invalid registration ID." });
    return;
  }

  const found = await getStandaloneRegistrationByPublicId(registrationId);
  if (!found) {
    res.status(404).json({ error: "Registration not found." });
    return;
  }

  res.json({
    registration: serializePublicRegistration(found.registration, found.tournament),
  });
});

/**
 * Payment stubs — implemented in Phase 3.
 * Kept here so clients discover a stable contract without enabling gateway processing.
 */
router.post("/standalone-registration/payment/create", (_req, res) => {
  res.status(501).json({
    error: "Payment create is not implemented yet (Phase 3).",
    code: "SR_PAYMENT_NOT_IMPLEMENTED",
  });
});

router.post("/standalone-registration/payment/verify", (_req, res) => {
  res.status(501).json({
    error: "Payment verify is not implemented yet (Phase 3).",
    code: "SR_PAYMENT_NOT_IMPLEMENTED",
  });
});

router.post("/standalone-registration/payment/webhook", (_req, res) => {
  res.status(501).json({
    error: "Payment webhook is not implemented yet (Phase 3).",
    code: "SR_PAYMENT_NOT_IMPLEMENTED",
  });
});

router.post("/standalone-registration/payment/retry", (_req, res) => {
  res.status(501).json({
    error: "Payment retry is not implemented yet (Phase 3).",
    code: "SR_PAYMENT_NOT_IMPLEMENTED",
  });
});

export default router;
