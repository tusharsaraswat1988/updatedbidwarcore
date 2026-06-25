import { Router } from "express";
import { z } from "zod";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  listCricketMasterTeams,
  listCricketMasterPlayers,
  listCricketSquadPlayers,
  syncCricketRosterFromAuction,
} from "../lib/master-sports/cricket-roster";

const router = Router({ mergeParams: true });

function tid(req: { params: Record<string, string> }): number | null {
  const n = parseInt(req.params.id, 10);
  return Number.isNaN(n) ? null : n;
}

/** GET master-linked auction teams with squad counts */
router.get("/master-teams", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const items = await listCricketMasterTeams(tournamentId);
  res.json(items);
});

/** GET players for cricket scorer (optional ?teamId= auction team filter) */
router.get("/master-players", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const teamIdRaw = req.query.teamId;
  const auctionTeamId =
    teamIdRaw != null ? parseInt(String(teamIdRaw), 10) : undefined;

  const items = await listCricketMasterPlayers(
    tournamentId,
    Number.isFinite(auctionTeamId) ? auctionTeamId : undefined,
  );
  res.json(items);
});

/** GET sold/retained squad for one auction team */
router.get("/squads/:auctionTeamId", async (req, res) => {
  const tournamentId = tid(req);
  const auctionTeamId = parseInt(req.params.auctionTeamId, 10);
  if (!tournamentId || Number.isNaN(auctionTeamId)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const items = await listCricketSquadPlayers(tournamentId, auctionTeamId);
  res.json(items);
});

/** POST sync auction teams + roster → master layer */
router.post("/sync-roster", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    tournamentId: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  const targetId = parsed.success && parsed.data.tournamentId
    ? parsed.data.tournamentId
    : tournamentId;

  const result = await syncCricketRosterFromAuction(targetId);
  res.json({ ...result, tournamentId: targetId });
});

export default router;
