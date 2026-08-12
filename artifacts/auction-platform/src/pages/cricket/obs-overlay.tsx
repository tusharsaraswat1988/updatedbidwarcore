/**
 * Cricket OBS scorebug — Sports-owned Browser Source.
 * Routes:
 *   /tournament/:id/cricket/obs/live
 *   /tournament/:id/cricket/obs/:matchId
 */

import { useRoute } from "wouter";
import { TournamentCodeGate } from "@/components/tournament-code-gate";
import { CricketObsStage } from "@/components/scoring/cricket-obs/cricket-obs-stage";
import { useCricketObsLive } from "@/hooks/use-cricket-obs-live";
import { parseCricketObsMatchParam } from "@/lib/cricket-obs-view-model";
import { BROADCAST_OVERLAY_HEIGHT, BROADCAST_OVERLAY_WIDTH } from "@/lib/broadcast-overlay";
import { useObsTransparentDocument } from "@/components/scoring/cricket-obs/use-obs-transparent-document";

function CricketObsInner({
  tournamentId,
  pinnedMatchId,
}: {
  tournamentId: number;
  pinnedMatchId: number | null;
}) {
  const { vm, scoringActive, isLoading } = useCricketObsLive(tournamentId, pinnedMatchId);

  if (!scoringActive) {
    return (
      <div
        className="flex items-center justify-center text-white/70"
        style={{ width: BROADCAST_OVERLAY_WIDTH, height: BROADCAST_OVERLAY_HEIGHT }}
      >
        <p className="rounded-lg bg-black/60 px-4 py-3 text-sm font-semibold uppercase tracking-widest">
          Cricket OBS is not available for this tournament
        </p>
      </div>
    );
  }

  if (isLoading && vm.phase === "no_live") {
    return (
      <div
        className="flex items-end p-14"
        style={{ width: BROADCAST_OVERLAY_WIDTH, height: BROADCAST_OVERLAY_HEIGHT }}
      >
        <p className="rounded-lg bg-black/55 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
          Loading…
        </p>
      </div>
    );
  }

  return <CricketObsStage vm={vm} />;
}

export default function CricketObsOverlayPage() {
  useObsTransparentDocument();
  const [, params] = useRoute("/tournament/:id/cricket/obs/:matchId");
  const tournamentId = parseInt(params?.id || "0", 10);
  const parsed = parseCricketObsMatchParam(params?.matchId);
  const pinnedMatchId = parsed.mode === "match" ? parsed.matchId : null;

  if (!tournamentId || parsed.mode === "invalid") {
    return (
      <div
        className="flex items-center justify-center text-white/70"
        style={{ width: BROADCAST_OVERLAY_WIDTH, height: BROADCAST_OVERLAY_HEIGHT }}
      >
        <p className="rounded-lg bg-black/60 px-4 py-3 text-sm font-semibold">
          Cricket OBS link is not valid
        </p>
      </div>
    );
  }

  return (
    <TournamentCodeGate tournamentId={tournamentId}>
      <CricketObsInner tournamentId={tournamentId} pinnedMatchId={pinnedMatchId} />
    </TournamentCodeGate>
  );
}
