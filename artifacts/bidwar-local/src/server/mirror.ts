import type { LocalDb } from "@workspace/db-local";
import { tournamentsTable, teamsTable, playersTable, auctionSessionsTable } from "@workspace/db-local";
import { eq } from "drizzle-orm";

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

/**
 * Fire-and-forget: mirrors the current local auction state to the cloud display endpoint.
 * Retries up to 3 times with exponential backoff. Silently swallows all errors —
 * mirroring is best-effort and must never disrupt the local auction flow.
 */
export function mirrorStateToCloud(db: LocalDb, localTournamentId: number): void {
  void (async () => {
    try {
      // Get tournament — needs cloudId + cloudBaseUrl + exportToken to mirror
      const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, localTournamentId));
      if (!tournament?.cloudId || !tournament?.cloudBaseUrl || !tournament?.exportToken) return;

      // Get session
      const [session] = await db.select().from(auctionSessionsTable).where(eq(auctionSessionsTable.tournamentId, localTournamentId));
      if (!session) return;

      // Resolve cloud IDs for current player and team
      let currentPlayerCloudId: number | null = null;
      if (session.currentPlayerId) {
        const [player] = await db.select({ cloudId: playersTable.cloudId }).from(playersTable).where(eq(playersTable.id, session.currentPlayerId));
        currentPlayerCloudId = player?.cloudId ?? null;
      }

      let currentBidTeamCloudId: number | null = null;
      if (session.currentBidTeamId) {
        const [team] = await db.select({ cloudId: teamsTable.cloudId }).from(teamsTable).where(eq(teamsTable.id, session.currentBidTeamId));
        currentBidTeamCloudId = team?.cloudId ?? null;
      }

      const payload = {
        status: session.status,
        currentPlayerCloudId,
        currentBidTeamCloudId,
        currentBid: session.currentBid ?? null,
        timerEndsAt: session.timerEndsAt ?? null,
        lastAction: session.lastAction ?? null,
        fortuneWheelActive: session.fortuneWheelActive ?? false,
        wheelSpinning: session.wheelSpinning ?? false,
        teamPurseViewActive: session.teamPurseViewActive ?? false,
        isBreak: session.isBreak ?? false,
        breakEndsAt: session.breakEndsAt ?? null,
        displayCountdown: session.displayCountdown ?? null,
        wheelItemsJson: session.wheelItemsJson ?? null,
        wheelWinner: session.wheelWinner ?? null,
      };

      const url = `${tournament.cloudBaseUrl}/api/tournaments/${tournament.cloudId}/auction/mirror`;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Export-Token": tournament.exportToken,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) return;
          // Non-2xx — log attempt number but don't throw
        } catch {
          // Network error — retry
        }
        if (attempt < 2) await sleep(attempt === 0 ? 500 : 1500);
      }
    } catch {
      // Top-level catch — mirror must never crash the caller
    }
  })();
}
