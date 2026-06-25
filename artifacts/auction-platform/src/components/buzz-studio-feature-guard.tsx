import type { ReactNode } from "react";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { isBuzzStudioEnabled } from "@workspace/api-base/tournament-features";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { setupAreaPath } from "@/lib/tournament-navigation";

/**
 * Gates Buzz Studio / Media Center routes behind per-tournament feature flag.
 * Do not rely on sidebar hiding alone — direct URL access must be blocked.
 */
export function BuzzStudioFeatureGuard({
  tournamentId,
  children,
}: {
  tournamentId: number;
  children: ReactNode;
}) {
  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: tournamentId > 0,
    },
  });

  if (isLoading) {
    return (
      <div
        className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm"
        aria-busy="true"
        aria-label="Loading Media Center access"
      />
    );
  }

  if (!isBuzzStudioEnabled(tournament?.features)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-xl font-display font-black text-white">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          BidWar Media Center is not enabled for this tournament.
          Contact your BidWar administrator to enable Buzz Studio.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={setupAreaPath(tournamentId)}>Back to Tournament</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
