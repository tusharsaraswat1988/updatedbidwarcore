import { Request, Response, NextFunction } from "express";
import { db, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveFanPageCapabilities } from "@workspace/platform-core";

/**
 * Fan Scoring Guard
 * Validates tournament existence, public visibility, and scoring capability
 * before allowing access to public scoring read-only endpoints.
 */
export async function fanScoringGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawId = req.params.tournamentId;
  const idStr = Array.isArray(rawId) ? rawId[0] : rawId;
  const tournamentId = parseInt(idStr || "", 10);
  if (isNaN(tournamentId)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const capabilities = await resolveFanPageCapabilities(tournament);
  
  // Strict visibility check
  if (!capabilities.isPubliclyVisible || /\[test\]|\[dev\]|\[demo\]/i.test(tournament.name)) {
    res.status(403).json({ error: "Tournament not publicly accessible" });
    return;
  }

  // Explicit scoring capability check
  if (!tournament.scoringEnabled) {
    res.status(403).json({ error: "Scoring module not enabled for this tournament" });
    return;
  }

  // Inject validated tournament into request for downstream use
  (req as any).tournament = tournament;
  next();
}
