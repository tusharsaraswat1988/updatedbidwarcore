import { useMemo } from "react";
import { useCricketObsLive } from "@/hooks/use-cricket-obs-live";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import type { CricketAuthoritativeBroadcastEvent } from "@workspace/scoring-core";
import { cricketVmToObsV2StageData } from "./obs-v2-live-adapter";
import type { ObsV2StageData } from "./types";

export interface UseObsV2LiveResult {
  /** Normalized broadcast data model ready for ObsV2Stage */
  data: ObsV2StageData;
  /** Whether tournament/feed is currently loading initial state */
  isLoading: boolean;
  /** Whether cricket scoring is active for this tournament */
  scoringActive: boolean;
  /** SSE connection hint ("connected" | "reconnecting" | "disconnected") */
  connectionStatus: string;
  /** Raw underlying CricketObsViewModel reference for specialized needs */
  rawVm: CricketObsViewModel;
  /** Authoritative broadcast event pushed from server */
  broadcastEvent: CricketAuthoritativeBroadcastEvent | null;
}

/**
 * useObsV2Live — Connects Cricket OBS V2 to the Authoritative Live Cricket Pipeline
 *
 * Pipeline:
 * Existing Cricket Scoring
 *           ↓
 * Existing Scoring SSE (/api/tournaments/:id/scoring/events)
 *           ↓
 * useScoringSocket
 *           ↓
 * useCricketObsLive
 *           ↓
 * cricketVmToObsV2StageData
 *           ↓
 * ObsV2StageData
 *
 * Single subscription per tournament, memoized, automatic reconnect.
 */
export function useObsV2Live(
  tournamentId: number,
  pinnedMatchId: number | null = null,
): UseObsV2LiveResult {
  const { vm, scoringActive, isLoading } = useCricketObsLive(
    tournamentId,
    pinnedMatchId,
  );

  const stageData = useMemo(() => {
    return cricketVmToObsV2StageData(vm, isLoading);
  }, [vm, isLoading]);

  const broadcastEvent = vm.broadcastEvent ?? null;

  if (process.env.NODE_ENV !== "production") {
    if (broadcastEvent) {
      console.log(`[OBS V2] received event ${broadcastEvent.type} seq=${broadcastEvent.sequence}`);
    }
  }

  return {
    data: stageData,
    isLoading,
    scoringActive,
    connectionStatus: vm.connectionHint === "reconnecting" ? "reconnecting" : "connected",
    rawVm: vm,
    broadcastEvent,
  };
}
