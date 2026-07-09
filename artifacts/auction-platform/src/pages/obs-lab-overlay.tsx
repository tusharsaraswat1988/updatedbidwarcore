import { useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  getGetAuctionStateQueryKey,
  useGetTournament,
  getGetTournamentQueryKey,
  useGetTeamPurses,
  getGetTeamPursesQueryKey,
  useListPlayers,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { getSponsorsByPriority, parseSponsorLogos } from "@/lib/sponsor-logo";
import { BROADCAST_OVERLAY_HEIGHT } from "@/lib/broadcast-overlay";
import {
  resolveBroadcastSettings,
  useObsBrowserSource,
} from "@/components/broadcast";
import { BroadcastLabLayout } from "@/components/broadcast/broadcast-lab-layout";
import { loadDisplayFonts } from "@/lib/load-display-fonts";

/**
 * OBS Lab Overlay — sandbox Browser Source for iterating on overlay design.
 * Same live auction feed as production `/obs`; UI lives under `obs-lab/`.
 * Route: `/tournament/:id/obs/lab` (1920×1080)
 */
export default function ObsLabOverlay() {
  const [, params] = useRoute("/tournament/:id/obs/lab");
  const tournamentId = parseInt(params?.id || "0");
  const isObsMode = useObsBrowserSource();

  useEffect(() => {
    loadDisplayFonts();
  }, []);

  const settings = useMemo(
    () => resolveBroadcastSettings(tournamentId),
    [tournamentId],
  );

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      rootBg: root?.style.background ?? "",
      rootMinH: root?.style.minHeight ?? "",
      htmlMinH: html.style.minHeight,
      bodyMinH: body.style.minHeight,
      bodyOverflow: body.style.overflow,
    };

    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.overflow = "hidden";
    html.style.minHeight = "0";
    body.style.minHeight = "0";
    if (root) {
      root.style.background = "transparent";
      root.style.minHeight = `${BROADCAST_OVERLAY_HEIGHT}px`;
    }

    return () => {
      html.style.background = prev.htmlBg;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
      html.style.minHeight = prev.htmlMinH;
      body.style.minHeight = prev.bodyMinH;
      if (root) {
        root.style.background = prev.rootBg;
        root.style.minHeight = prev.rootMinH;
      }
    };
  }, []);

  const { connectionStatus } = useAuctionSocket(tournamentId);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: sseAwareRefetchInterval(connectionStatus, 10000),
    },
  });

  const lastActivityAt =
    typeof state?.lastAuctionActivityAt === "string" ? state.lastAuctionActivityAt : null;
  const feed = useAuctionConnectionState(connectionStatus, tournamentId, lastActivityAt);
  const isStaleFeed = feed.state === "disconnected" || feed.state === "reconnecting";

  const embeddedPurses = state?.teamPurses;
  const { data: teamPursesFromQuery } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId && !embeddedPurses?.length,
      refetchInterval: sseAwareRefetchInterval(connectionStatus, 30000),
      staleTime: 15000,
    },
  });
  const teamPurses = embeddedPurses ?? teamPursesFromQuery;

  const { data: players } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: sseAwareRefetchInterval(connectionStatus, 15000),
      staleTime: 10000,
    },
  });

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { formatAmount } = useAuctionUnit(tournament);

  const sponsorLogos = useMemo(
    () => getSponsorsByPriority(parseSponsorLogos(tournament?.sponsorLogos)),
    [tournament?.sponsorLogos],
  );

  const auctionStartsAt = useMemo(() => {
    if (!tournament?.auctionDate) return null;
    const time = tournament.auctionTime ?? "00:00";
    return `${tournament.auctionDate}T${time}:00`;
  }, [tournament?.auctionDate, tournament?.auctionTime]);

  if (!tournamentId) return null;

  return (
    <BroadcastLabLayout
      tournamentId={tournamentId}
      tournamentName={tournament?.name ?? null}
      tournamentLogoUrl={tournament?.logoUrl ?? null}
      auctionStartsAt={auctionStartsAt}
      sponsorLogos={sponsorLogos}
      state={state}
      teamPurses={teamPurses}
      soldPlayers={players}
      settings={settings}
      isObsMode={isObsMode}
      formatAmount={formatAmount}
      feedState={feed.state}
      secondsSinceLastActivity={feed.secondsSinceLastActivity}
      isStaleFeed={isStaleFeed}
    />
  );
}
