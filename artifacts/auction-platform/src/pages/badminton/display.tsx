/**
 * Badminton Broadcast Display Page
 * Route: /badminton/:matchId/display?tid=YYY
 *
 * Stadium screen / projector display. Full screen.
 * Designed for LED walls, dual monitors, and broadcast capture.
 */

import { useRoute, useSearch } from "wouter";
import { BroadcastDisplay } from "@/components/badminton/broadcast-display";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { FullscreenLayout } from "@/components/layout";
import type { BadmintonMatchState } from "@workspace/badminton-core";

export default function BadmintonDisplayPage() {
  const [, params] = useRoute("/badminton/:matchId/display");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");
  const tournamentName = searchParams.get("name") ?? "Badminton Tournament";
  const courtNumber = searchParams.get("court") ?? undefined;

  const { data, isLoading } = useBadmintonMatch(tournamentId, matchId);

  if (isLoading) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen bg-[#050a17] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#4fc3f7]/20 border-t-[#4fc3f7] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/30 text-sm">Connecting to match…</p>
          </div>
        </div>
      </FullscreenLayout>
    );
  }

  if (!data?.state) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen bg-[#050a17] flex items-center justify-center">
          <p className="text-white/20 text-lg">Match not available</p>
        </div>
      </FullscreenLayout>
    );
  }

  const state = data.state as BadmintonMatchState;
  const detail = data.detail as Record<string, unknown> | null;

  return (
    <FullscreenLayout>
      <div className="w-screen h-screen overflow-hidden">
        <BroadcastDisplay
          state={state}
          tournamentName={tournamentName}
          courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
          matchNumber={detail?.matchNumber as string | undefined}
          roundName={detail?.roundName as string | undefined}
        />
      </div>
    </FullscreenLayout>
  );
}
