import { Router } from "express";
import {
  listCricketMasterTeams,
  listCricketMasterPlayers,
  listCricketSquadPlayers,
} from "../lib/master-sports/cricket-roster";

const router = Router({ mergeParams: true });

function tid(req: { params: Record<string, string> }): number | null {
  const n = parseInt(req.params.id, 10);
  return Number.isNaN(n) ? null : n;
}

function parseAuctionTeamFilter(req: { query: Record<string, unknown> }): number | undefined {
  const teamIdRaw = req.query.teamId;
  const auctionTeamId = teamIdRaw != null ? parseInt(String(teamIdRaw), 10) : undefined;
  return Number.isFinite(auctionTeamId) ? auctionTeamId : undefined;
}

async function listRosterItems(req: {
  params: Record<string, string>;
  query: Record<string, unknown>;
}, res: {
  status: (code: number) => { json: (body: unknown) => void };
  json: (body: unknown) => void;
}): Promise<void> {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const items = await listCricketMasterPlayers(tournamentId, parseAuctionTeamFilter(req));
  res.json(items);
}

/** GET Player Registry franchise teams with squad counts */
router.get("/master-teams", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const items = await listCricketMasterTeams(tournamentId);
  res.json(items);
});

/** GET players for cricket scorer (optional ?teamId= opaque franchise team filter) */
router.get("/master-players", async (req, res) => {
  await listRosterItems(req, res);
});

/** GET unified tournament roster for scorer adapters (alias of /master-players). */
router.get("/roster", async (req, res) => {
  await listRosterItems(req, res);
});

/** GET active Player Registry squad for one franchise team */
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

/** POST sync auction teams + roster → master layer — moved to Auction module. */
router.post("/sync-roster", async (_req, res) => {
  res.status(410).json({
    error: "Auction roster sync belongs to the Auction module. Cricket reads Player Registry only.",
    code: "AUCTION_SYNC_REMOVED",
  });
});

export default router;
