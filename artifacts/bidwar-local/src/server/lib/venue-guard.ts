import type { LocalDb } from "@workspace/db-local";
import { tournamentsTable } from "@workspace/db-local";
import { eq } from "drizzle-orm";

type TournamentCloudLink = {
  cloudId: number | null;
  cloudBaseUrl: string | null;
  exportToken: string | null;
};

export async function fetchCloudVenueGuard(
  tournament: TournamentCloudLink,
): Promise<{ blockLocalStart: boolean; reason: string | null } | null> {
  if (!tournament.cloudId || !tournament.cloudBaseUrl || !tournament.exportToken) return null;
  try {
    const res = await fetch(
      `${tournament.cloudBaseUrl}/api/tournaments/${tournament.cloudId}/venue-auction-guard`,
      {
        headers: { "X-Export-Token": tournament.exportToken },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      blockLocalStart?: boolean;
      blockLocalStartReason?: string | null;
    };
    return {
      blockLocalStart: !!data.blockLocalStart,
      reason: data.blockLocalStartReason ?? null,
    };
  } catch {
    return null;
  }
}

export function releaseVenueAuctionOnCloud(db: LocalDb, localTournamentId: number): void {
  void (async () => {
    try {
      const [tournament] = await db
        .select({
          cloudId: tournamentsTable.cloudId,
          cloudBaseUrl: tournamentsTable.cloudBaseUrl,
          exportToken: tournamentsTable.exportToken,
        })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, localTournamentId));
      if (!tournament?.cloudId || !tournament.cloudBaseUrl || !tournament.exportToken) return;

      await fetch(
        `${tournament.cloudBaseUrl}/api/tournaments/${tournament.cloudId}/venue-auction-release`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Export-Token": tournament.exportToken,
          },
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      // Best-effort — local conclude must not fail if cloud is unreachable
    }
  })();
}
