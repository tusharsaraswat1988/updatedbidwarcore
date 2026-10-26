/**
 * Ground LED full-screen plates. Banner stays here. Every scoring plate is
 * the same component the OBS stream uses.
 */

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";
import { CricketBroadcastPlatesView } from "@/components/scoring/cricket-broadcast-plates-view";
import { useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import { tossLine } from "@/lib/cricket-broadcast-plates";
import type { CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  cricketBrandingQueryKey,
  getCricketBranding,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import type { CricketScorerPlayer, CricketScorerTeam } from "@/lib/scoring-squad";
import type { CricketMatchSummary, CricketScoreboardState } from "@workspace/scoring-core";

export type CricketLedMidOverlaysProps = {
  overlay: CricketObsMidOverlayKind;
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  tournamentId: number;
  tournamentName?: string;
  tournamentLogoUrl?: string | null;
  match?: ScoringMatchJson | null;
  state?: CricketScoreboardState | null;
  summary?: CricketMatchSummary | null;
  teams?: CricketScorerTeam[];
  players?: CricketScorerPlayer[];
  sponsors?: SponsorLogo[];
  onClose?: () => void;
};

export function CricketLedMidOverlays({
  overlay,
  overlayMatchId,
  overlaySponsorName,
  overlayStageOrGroup,
  tournamentId,
  tournamentName,
  match,
  state,
  teams = [],
  sponsors = [],
}: CricketLedMidOverlaysProps) {
  const { logoSrc, logoAlt } = useCricketBidWarTheme();
  const { data: tournamentData } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: overlay === "banner" && tournamentId > 0 },
  });
  const { data: brandingData } = useQuery<BadmintonBranding>({
    queryKey: cricketBrandingQueryKey(tournamentId),
    queryFn: () => getCricketBranding<BadmintonBranding>(tournamentId),
    enabled: overlay === "banner" && tournamentId > 0,
    staleTime: 10_000,
  });

  const resolvedBannerUrl =
    brandingData?.resolvedVenueBannerUrl ||
    brandingData?.venueBannerUrl ||
    tournamentData?.mainBannerUrl ||
    brandingData?.auctionMainBannerUrl ||
    null;
  const resolvedBannerFit =
    brandingData?.resolvedVenueBannerFit ||
    tournamentData?.mainBannerFit ||
    "cover";

  if (overlay === "none" || overlay === "neutral") return null;

  if (overlay === "banner") {
    return (
      <AnimatePresence>
        <motion.div
          key="led-banner-fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center overflow-hidden bg-black select-none"
        >
          {resolvedBannerUrl ? (
            <img
              src={resolvedBannerUrl}
              alt={tournamentName || "Tournament banner"}
              className="h-full w-full"
              style={{ objectFit: (resolvedBannerFit as "cover" | "contain") || "cover" }}
            />
          ) : (
            <h2 className="text-4xl font-black uppercase tracking-wide text-white">
              {tournamentName || "Tournament banner"}
            </h2>
          )}
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt || "BidWar"}
              className="absolute left-6 top-5 h-7 w-auto object-contain"
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    );
  }

  const tossWinner = state?.tossWinnerTeamId
    ? teams.find((team) => team.id === state.tossWinnerTeamId)
    : null;
  const liveTossText = tossLine(state, tossWinner?.name);
  const liveStatus = state?.matchStatus || match?.status || null;

  return (
    <CricketBroadcastPlatesView
      overlay={overlay}
      tournamentId={tournamentId}
      tournamentName={tournamentName}
      overlayMatchId={overlayMatchId}
      overlaySponsorName={overlaySponsorName}
      overlayStageOrGroup={overlayStageOrGroup}
      sponsors={sponsors}
      liveMatchId={match?.id ?? null}
      liveTossText={liveTossText}
      liveStatus={liveStatus}
      liveSequence={state?.lastSequence}
    />
  );
}
