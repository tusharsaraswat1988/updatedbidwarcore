import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  buildFixtureAdvancement,
  buildFixtureValidation,
  listFixtureHistory,
  listFixtureIdentities,
  lockFixtureSetup,
  patchFixtureConfiguration,
  resolveFixture,
} from "../lib/fixture-service";

const router: IRouter = Router();

function parseTournamentId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  typeId: z.string().nullable().optional(),
  competitionFormat: z.string().nullable().optional(),
  numberOfRounds: z.number().int().nullable().optional(),
  legs: z.number().int().nullable().optional(),
  groups: z.number().int().nullable().optional(),
  qualificationRules: z.record(z.string(), z.unknown()).nullable().optional(),
  thirdPlaceMatch: z.boolean().optional(),
  placementRules: z.record(z.string(), z.unknown()).nullable().optional(),
  customSettings: z.record(z.string(), z.unknown()).nullable().optional(),
});

router.get("/tournaments/:tournamentId/fixtures", async (req, res) => {
  const tid = parseTournamentId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const identities = await listFixtureIdentities(tid);
  res.json({ identities });
});

router.get("/tournaments/:tournamentId/fixtures/:fixtureId/identity", async (req, res) => {
  const tid = parseTournamentId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const resolved = await resolveFixture(tid, req.params.fixtureId);
  if (!resolved) return res.status(404).json({ error: "Fixture not found" });
  res.json({ identity: resolved.identity });
});

router.get(
  "/tournaments/:tournamentId/fixtures/:fixtureId/configuration",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveFixture(tid, req.params.fixtureId);
    if (!resolved) return res.status(404).json({ error: "Fixture not found" });
    res.json({ configuration: resolved.configuration });
  },
);

router.patch(
  "/tournaments/:tournamentId/fixtures/:fixtureId/configuration",
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
    const result = await patchFixtureConfiguration(tid, req.params.fixtureId, parsed.data);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ configuration: result.configuration });
  },
);

router.get("/tournaments/:tournamentId/fixtures/:fixtureId/nodes", async (req, res) => {
  const tid = parseTournamentId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const resolved = await resolveFixture(tid, req.params.fixtureId);
  if (!resolved) return res.status(404).json({ error: "Fixture not found" });
  res.json({ nodes: resolved.nodes });
});

router.get(
  "/tournaments/:tournamentId/fixtures/:fixtureId/advancement",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const advancement = await buildFixtureAdvancement(tid, req.params.fixtureId);
    if (!advancement) return res.status(404).json({ error: "Fixture not found" });
    res.json({ advancement });
  },
);

router.get(
  "/tournaments/:tournamentId/fixtures/:fixtureId/validation",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const validation = await buildFixtureValidation(tid, req.params.fixtureId);
    if (!validation) return res.status(404).json({ error: "Fixture not found" });
    res.json({ validation });
  },
);

router.get("/tournaments/:tournamentId/fixtures/:fixtureId/history", async (req, res) => {
  const tid = parseTournamentId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const resolved = await resolveFixture(tid, req.params.fixtureId);
  if (!resolved) return res.status(404).json({ error: "Fixture not found" });
  res.json({ history: await listFixtureHistory(req.params.fixtureId) });
});

router.get(
  "/tournaments/:tournamentId/fixtures/:fixtureId/lifecycle",
  async (req, res) => {
    const tid = parseTournamentId(req.params.tournamentId);
    if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
    const resolved = await resolveFixture(tid, req.params.fixtureId);
    if (!resolved) return res.status(404).json({ error: "Fixture not found" });
    res.json({ lifecycle: resolved.lifecycle });
  },
);

router.post("/tournaments/:tournamentId/fixtures/:fixtureId/ready", async (req, res) => {
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

  const result = await lockFixtureSetup(tid, req.params.fixtureId, frozenBy);
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
});

export default router;
