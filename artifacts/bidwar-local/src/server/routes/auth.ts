import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import { tournamentsTable } from "@workspace/db-local";
import {
  grantOrganizerForTournament,
  revokeOrganizerForTournament,
  isOrganizerForTournament,
  safeCompare,
} from "../lib/local-auth.js";
import { getLocalJwtUser } from "../middleware/local-jwt-auth.js";

export function createAuthRouter(db: LocalDb) {
  const router = Router();

  // GET /api/auth/organizer/:tournamentId/me — same contract as cloud
  router.get("/auth/organizer/:tournamentId/me", async (req, res) => {
    const tid = parseInt(req.params.tournamentId, 10);
    if (isNaN(tid)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const isOrganizer = isOrganizerForTournament(getLocalJwtUser(req), tid);
    res.json({ isOrganizer });
  });

  // POST /api/auth/organizer/:tournamentId/login — tournament password (offline)
  router.post("/auth/organizer/:tournamentId/login", async (req, res) => {
    const tid = parseInt(req.params.tournamentId, 10);
    if (isNaN(tid)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const body = z.object({ password: z.string() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const [tournament] = await db
      .select({
        organizerPassword: tournamentsTable.organizerPassword,
        cloudId: tournamentsTable.cloudId,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid));

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    // Imported tournament with no password — allow session (venue operator after export)
    if (!tournament.organizerPassword) {
      if (!tournament.cloudId) {
        res.status(403).json({ error: "Organizer access is not yet configured for this tournament." });
        return;
      }
      grantOrganizerForTournament(res, getLocalJwtUser(req), tid);
      res.json({ success: true });
      return;
    }

    if (!safeCompare(body.data.password, tournament.organizerPassword)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }

    grantOrganizerForTournament(res, getLocalJwtUser(req), tid);
    res.json({ success: true });
  });

  // POST /api/auth/organizer/:tournamentId/logout
  router.post("/auth/organizer/:tournamentId/logout", (req, res) => {
    const tid = parseInt(req.params.tournamentId, 10);
    if (!isNaN(tid)) {
      revokeOrganizerForTournament(res, getLocalJwtUser(req), tid);
    }
    res.json({ success: true });
  });

  /**
   * POST /api/auth/organizer/:tournamentId/bootstrap
   * Grants a local organizer session for an imported tournament.
   * Used when the operator opens in the system browser (separate cookie jar from Electron import).
   */
  router.post("/auth/organizer/:tournamentId/bootstrap", async (req, res) => {
    const tid = parseInt(req.params.tournamentId, 10);
    if (isNaN(tid)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [tournament] = await db
      .select({ cloudId: tournamentsTable.cloudId })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid));

    if (!tournament?.cloudId) {
      res.status(403).json({ error: "Tournament not imported for local mode" });
      return;
    }

    grantOrganizerForTournament(res, getLocalJwtUser(req), tid);
    res.json({ success: true });
  });

  return router;
}
