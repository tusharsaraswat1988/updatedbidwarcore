import { Router, type IRouter } from "express";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  buildExecutionPhaseState,
  buildRuntimeIdentity,
  buildRuntimeValidation,
  listRuntimeHistory,
  listRuntimeMatches,
  loadActiveSnapshot,
  loadRuntimeContext,
  prepareRuntimeMatch,
  requestRuntimeReady,
} from "../lib/runtime-match-service";
import { loadMatchRow } from "../lib/match-service";

const router: IRouter = Router();

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

function actorFromReq(req: {
  jwtUser?: {
    email?: string | null;
    organizerAccountId?: number | null;
    isAdmin?: boolean;
  };
}): string | null {
  return (
    req.jwtUser?.email ||
    (req.jwtUser?.organizerAccountId != null
      ? `organizer:${req.jwtUser.organizerAccountId}`
      : req.jwtUser?.isAdmin
        ? "admin"
        : null)
  );
}

router.get("/tournaments/:tournamentId/runtime-matches", async (req, res) => {
  const tid = parseId(req.params.tournamentId);
  if (tid == null) return res.status(400).json({ error: "Invalid tournament id" });
  res.json({ runtimeMatches: await listRuntimeMatches(tid) });
});

router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/identity",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ identity: buildRuntimeIdentity(match) });
  },
);

router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/snapshot",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ snapshot: await loadActiveSnapshot(match) });
  },
);

/** Reserved /current alias — resolves to active frozen snapshot. */
router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/current/snapshot",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ snapshot: await loadActiveSnapshot(match) });
  },
);

router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/context",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ context: await loadRuntimeContext(match) });
  },
);

router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/current/context",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ context: await loadRuntimeContext(match) });
  },
);

router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/execution-phase",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ executionPhase: buildExecutionPhaseState(match) });
  },
);

router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/validation",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ validation: await buildRuntimeValidation(tid, match) });
  },
);

router.get(
  "/tournaments/:tournamentId/runtime-matches/:matchId/history",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    const match = await loadMatchRow(tid, matchId);
    if (!match) return res.status(404).json({ error: "Match not found" });
    res.json({ history: await listRuntimeHistory(matchId) });
  },
);

router.post(
  "/tournaments/:tournamentId/runtime-matches/:matchId/prepare",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    if (!(await requireTournamentOrganizer(req, res, tid))) return;

    const result = await prepareRuntimeMatch(tid, matchId, actorFromReq(req));
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        validation: result.validation,
      });
    }
    res.json({
      snapshot: result.snapshot,
      context: result.context,
      executionPhase: result.executionPhase,
      validation: result.validation,
      // EPIC-11 Phase 1 — Prepare binds execution contract identity (not Snapshot bodies).
      resolutionId: result.resolutionId,
      rulesHash: result.rulesHash,
      runtimeRulesVersion: result.runtimeRulesVersion,
      runtimeExecutionPolicy: result.runtimeExecutionPolicy,
    });
  },
);

router.post(
  "/tournaments/:tournamentId/runtime-matches/:matchId/ready",
  async (req, res) => {
    const tid = parseId(req.params.tournamentId);
    const matchId = parseId(req.params.matchId);
    if (tid == null || matchId == null) return res.status(400).json({ error: "Invalid id" });
    if (!(await requireTournamentOrganizer(req, res, tid))) return;

    const result = await requestRuntimeReady(tid, matchId, actorFromReq(req));
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        validation: result.validation,
      });
    }
    res.json({
      requestedLifecycle: result.requestedLifecycle,
      lifecycleStatus: result.lifecycleStatus,
      executionPhase: result.executionPhase,
      validation: result.validation,
    });
  },
);

export default router;
