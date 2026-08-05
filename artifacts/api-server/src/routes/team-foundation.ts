import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  buildTeamConfiguration,
  buildTeamIdentity,
  buildTeamValidation,
  listTeamHistory,
  listTeamRows,
  loadLatestTeamHistory,
  loadTeamMembers,
  loadTeamRow,
  lockTeamSetup,
  patchTeamConfiguration,
} from "../lib/team-service";

const router: IRouter = Router();

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().nullable().optional(),
  shortName: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  visibility: z.string().nullable().optional(),
  typeId: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  theme: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** GET /tournaments/:id/teams/identities — product Team Identity list */
router.get("/tournaments/:tournamentId/teams/identities", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  const teams = await listTeamRows(tid);
  res.json({ identities: teams.map(buildTeamIdentity) });
});

router.get("/tournaments/:tournamentId/teams/:teamId/identity", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tid == null || teamId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const team = await loadTeamRow(tid, teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json({ identity: buildTeamIdentity(team) });
});

router.get("/tournaments/:tournamentId/teams/:teamId/configuration", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tid == null || teamId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const team = await loadTeamRow(tid, teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const history = await loadLatestTeamHistory(teamId);
  res.json({ configuration: buildTeamConfiguration(team, history?.version ?? null) });
});

router.patch("/tournaments/:tournamentId/teams/:teamId/configuration", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tid == null || teamId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid configuration patch", details: parsed.error.flatten() });
  }
  const result = await patchTeamConfiguration(tid, teamId, parsed.data);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ configuration: result.configuration });
});

router.get("/tournaments/:tournamentId/teams/:teamId/members", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tid == null || teamId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const team = await loadTeamRow(tid, teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const members = await loadTeamMembers(tid, team);
  res.json({ members });
});

router.get("/tournaments/:tournamentId/teams/:teamId/validation", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tid == null || teamId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const team = await loadTeamRow(tid, teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const validation = await buildTeamValidation(tid, team);
  res.json({ validation });
});

router.get("/tournaments/:tournamentId/teams/:teamId/history", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tid == null || teamId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const team = await loadTeamRow(tid, teamId);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const history = await listTeamHistory(teamId);
  res.json({ history });
});

/** POST .../ready — Lock Team Setup */
router.post("/tournaments/:tournamentId/teams/:teamId/ready", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  const teamId = parseId(req.params.teamId);
  if (tid == null || teamId == null) {
    return res.status(400).json({ error: "Invalid id" });
  }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const frozenBy =
    req.jwtUser?.email ||
    (req.jwtUser?.organizerAccountId != null
      ? `organizer:${req.jwtUser.organizerAccountId}`
      : req.jwtUser?.isAdmin
        ? "admin"
        : null);

  const result = await lockTeamSetup(tid, teamId, frozenBy);
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
  });
});

export default router;
