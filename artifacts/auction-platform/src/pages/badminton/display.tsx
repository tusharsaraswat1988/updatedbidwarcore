/**
 * Badminton Venue Scoreboard Display
 * Route: /badminton/:matchId/display?tid=YYY
 *
 * When matchId is `live`, follows Primary Broadcast / sole LIVE match automatically.
 * Always shows LED chrome (top strip + sponsor chyron); center waits until a match is live.
 */

import { useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute, useSearch } from "wouter";
import { BroadcastDisplay } from "@/components/badminton/broadcast-display";
import {
  BadmintonLedChyron,
  BadmintonLedTopStrip,
} from "@/components/badminton/badminton-led-chrome";
import { badmintonLedSurfaceStyle } from "@/components/badminton/badminton-led-theme";
import { useBadmintonMatch, subscribeBadmintonDashboardStream } from "@/hooks/use-badminton-match";
import { useBadmintonLiveFollow } from "@/hooks/use-badminton-live-follow";
import { useBadmintonBranding, sponsorLogosFromBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonBroadcastAudio } from "@/hooks/use-badminton-broadcast-audio";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { DisplayStageViewport } from "@/components/display/display-stage-viewport";
import { AudioUnlockButton } from "@/components/display/audio-unlock-button";
import { StageFrame } from "@/components/display/v1/StageFrame";
import { StageThemeProvider } from "@/components/display/v1/StageThemeProvider";
import { DISPLAY_THEMES, type DisplayTheme } from "@/lib/display-theme";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { loadDisplayFonts } from "@/lib/load-display-fonts";
import {
  findUpNextMatch,
  isLiveFollowMatchId,
} from "@/lib/badminton-broadcast-console";
import {
  isMultiCourtVenueScene,
  isVenueMomentScene,
  shouldShowVenueLiveBoard,
} from "@/lib/badminton-broadcast-director";
import {
  MultiCourtScoreStrip,
  multiCourtRowsFromMatches,
} from "@/components/badminton/multi-court-score-strip";
import {
  VenueIntroScene,
  VenueLeaderboardsScene,
  VenueNextMatchScene,
  VenueRecentResultsScene,
  VenueSponsorScene,
  VenueWinnerScene,
} from "@/components/badminton/venue-moment-scenes";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { ScoreBoardSponsor } from "@/components/badminton/score-board-sponsor-panel";
import { useBadmintonLeaderboardBoards } from "@/hooks/use-badminton-leaderboard-boards";

function LedStandby({
  message,
  tournamentName,
  tournamentLogoUrl,
  sponsorLogos,
  scoreBoardSponsor,
}: {
  message: string;
  tournamentName: string;
  tournamentLogoUrl?: string;
  sponsorLogos: SponsorLogo[];
  scoreBoardSponsor?: ScoreBoardSponsor | null;
}) {
  return (
    <div
      className="badminton-led-surface absolute inset-0 overflow-hidden font-['Barlow_Condensed'] led-display-tv grid grid-rows-[auto_1fr_auto]"
      style={badmintonLedSurfaceStyle}
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <BadmintonLedTopStrip
        tournamentName={tournamentName}
        tournamentLogoUrl={tournamentLogoUrl}
        roundName={message}
        matchStatus="scheduled"
        isTimeout={false}
        leftLabel="Side A"
        rightLabel="Side B"
        scoreBoardSponsor={scoreBoardSponsor}
        sponsorLogos={sponsorLogos}
      />

      <div className="relative z-10 min-h-0 flex flex-col items-center justify-center gap-6 bg-[#070708] px-[4%]">
        {tournamentLogoUrl ? (
          <img
            src={tournamentLogoUrl}
            alt=""
            className="h-[12vh] max-h-28 w-auto max-w-[min(280px,40vw)] object-contain opacity-90"
          />
        ) : null}
        <div className="text-center space-y-3">
          <p className="font-['Bebas_Neue'] text-2xl md:text-4xl tracking-[0.18em] uppercase text-white/90">
            {tournamentName}
          </p>
          <div className="w-10 h-10 border-2 border-[var(--accent)]/25 border-t-[var(--accent)] rounded-full animate-spin mx-auto" />
          <p className="text-white/45 text-sm md:text-base font-mono uppercase tracking-[0.28em]">
            {message}
          </p>
        </div>
      </div>

      <BadmintonLedChyron sponsors={sponsorLogos} tournamentName={tournamentName} />
    </div>
  );
}

type BadmintonMatchDetailMeta = {
  courtNumber?: string;
  matchNumber?: string;
  roundName?: string;
  matchLabel?: string;
  matchType?: string;
};

function DisplayStage({
  tournamentId,
  matchId,
  courtNumber,
  followMode,
}: {
  tournamentId: number;
  matchId: number;
  courtNumber?: string;
  followMode: boolean;
}) {
  const qc = useQueryClient();
  const fixedMatch = useBadmintonMatch(tournamentId, followMode ? 0 : matchId);
  const liveFollow = useBadmintonLiveFollow(tournamentId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  // Fixed-match displays still need branding SSE for venue music On/Pause.
  useEffect(() => {
    if (!tournamentId || followMode) return;
    return subscribeBadmintonDashboardStream(tournamentId, () => {
      void qc.invalidateQueries({ queryKey: ["badminton-branding", tournamentId] });
    });
  }, [tournamentId, followMode, qc]);

  const data = followMode ? liveFollow.matchQuery.data : fixedMatch.data;
  const isLoading = followMode
    ? liveFollow.matchesLoading || (!!liveFollow.primaryMatchId && liveFollow.matchQuery.isLoading)
    : fixedMatch.isLoading;
  const loadError = followMode
    ? liveFollow.matchesError || liveFollow.matchQuery.isError
    : fixedMatch.isError;
  const retryLoad = () => {
    if (followMode) {
      void liveFollow.refetchMatches();
      void liveFollow.matchQuery.refetch();
      return;
    }
    void fixedMatch.refetch();
  };
  const matchDetail = data?.detail as BadmintonMatchDetailMeta | null | undefined;

  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const tournamentName =
    searchParams.get("name") ?? branding?.displayName ?? "Badminton Tournament";
  const sponsorLogos = sponsorLogosFromBranding(branding);
  const tournamentLogoUrl = branding?.logoUrl ?? undefined;
  const venueScene = branding?.venueScene ?? "auto";
  const multiCourtMode = isMultiCourtVenueScene(venueScene);
  const leaderboardsEnabled = venueScene === "leaderboards";
  const leaderboards = useBadmintonLeaderboardBoards(tournamentId, leaderboardsEnabled);
  const multiRows = useMemo(
    () => (multiCourtMode ? multiCourtRowsFromMatches(liveFollow.liveMatches) : []),
    [multiCourtMode, liveFollow.liveMatches],
  );
  const upNextMatch = useMemo(
    () => findUpNextMatch(liveFollow.matches, liveFollow.primaryMatchId),
    [liveFollow.matches, liveFollow.primaryMatchId],
  );
  const matchState = (data?.state ?? null) as BadmintonMatchState | null;
  const followedMatchId = followMode
    ? (liveFollow.primaryMatchId ?? null)
    : matchId || null;
  const matchStateReady = followMode
    ? !liveFollow.matchesLoading && !liveFollow.matchQuery.isLoading
    : !fixedMatch.isLoading;
  const { isUnlocked, unlock } = useBadmintonBroadcastAudio({
    tournamentId,
    matchKey: followedMatchId,
    matchState,
    venueMusicPlaying: branding?.venueMusicPlaying === true,
    resolvedVenueMusicUrl: branding?.resolvedVenueMusicUrl ?? null,
    venueMusicVolume: branding?.venueMusicVolume ?? 80,
    matchStateReady,
  });
  const chrome = {
    tournamentName,
    tournamentLogoUrl,
    sponsorLogos,
    scoreBoardSponsor: branding?.scoreBoardSponsor ?? null,
  };

  const initialTheme = useMemo((): DisplayTheme => {
    const accent =
      branding?.accentColor?.trim() || branding?.primaryColor?.trim();
    if (!accent) return DISPLAY_THEMES["stadium-gold"];

    const knownPreset = Object.values(DISPLAY_THEMES).find(
      (t) => t.accentColor.toLowerCase() === accent.toLowerCase(),
    );
    if (knownPreset) return knownPreset;

    return {
      ...DISPLAY_THEMES.default,
      accentColor: accent,
      dot: accent,
      stagePreset: "custom",
    };
  }, [branding?.accentColor, branding?.primaryColor]);

  const standbyMessage = !tournamentId
    ? "Missing tournament"
    : loadError
      ? "Could not load match — tap Retry"
      : venueScene === "standby" && !!matchState
      ? "Standby — director hold"
      : isVenueMomentScene(venueScene) &&
          !matchState &&
          venueScene !== "sponsor" &&
          venueScene !== "next" &&
          venueScene !== "results" &&
          venueScene !== "leaderboards"
        ? "Waiting for match…"
      : multiCourtMode
        ? multiRows.length > 0
          ? `${multiRows.length} court${multiRows.length > 1 ? "s" : ""} live`
          : "Waiting for live courts…"
        : followMode
          ? liveFollow.primaryMatchId
            ? "Connecting to live match…"
            : "Waiting for live match…"
          : isLoading
            ? "Connecting to match…"
            : "Match not available";

  const showLiveBoard = shouldShowVenueLiveBoard(venueScene, !!matchState);
  const showMultiBoard = multiCourtMode && multiRows.length > 0;
  const resolvedCourt = courtNumber ?? matchDetail?.courtNumber;

  let stageContent: ReactNode;
  if (loadError) {
    stageContent = (
      <div
        className="badminton-led-surface absolute inset-0 overflow-hidden font-['Barlow_Condensed'] led-display-tv flex flex-col items-center justify-center gap-6 bg-[#070708] px-[4%]"
        style={badmintonLedSurfaceStyle}
      >
        <p className="font-['Bebas_Neue'] text-2xl md:text-4xl tracking-[0.18em] uppercase text-white/90 text-center">
          {tournamentName}
        </p>
        <p className="text-white/55 text-sm md:text-base font-mono uppercase tracking-[0.2em] text-center">
          Connection lost
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className="min-h-12 px-6 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-bold"
        >
          Retry
        </button>
      </div>
    );
  } else if (venueScene === "sponsor") {
    stageContent = <VenueSponsorScene chrome={chrome} />;
  } else if (venueScene === "results") {
    stageContent = (
      <VenueRecentResultsScene matches={liveFollow.matches} chrome={chrome} />
    );
  } else if (venueScene === "leaderboards") {
    stageContent = (
      <VenueLeaderboardsScene
        pages={leaderboards.pages}
        loading={leaderboards.loading}
        chrome={chrome}
      />
    );
  } else if (venueScene === "next") {
    stageContent = <VenueNextMatchScene match={upNextMatch} chrome={chrome} />;
  } else if (venueScene === "intro" && matchState) {
    stageContent = (
      <VenueIntroScene
        state={matchState}
        chrome={chrome}
        courtNumber={resolvedCourt}
        matchLabel={matchDetail?.matchLabel}
        roundName={matchDetail?.roundName}
      />
    );
  } else if (venueScene === "winner" && matchState) {
    stageContent = (
      <VenueWinnerScene
        state={matchState}
        chrome={chrome}
        courtNumber={resolvedCourt}
      />
    );
  } else if (showMultiBoard) {
    stageContent = (
      <div
        className="badminton-led-surface absolute inset-0 overflow-hidden font-['Barlow_Condensed'] led-display-tv grid grid-rows-[auto_1fr_auto]"
        style={badmintonLedSurfaceStyle}
      >
        <BadmintonLedTopStrip
          tournamentName={tournamentName}
          tournamentLogoUrl={tournamentLogoUrl}
          roundName={standbyMessage}
          matchStatus="live"
          isTimeout={false}
          leftLabel="Side A"
          rightLabel="Side B"
          scoreBoardSponsor={branding?.scoreBoardSponsor ?? null}
          sponsorLogos={sponsorLogos}
        />
        <div className="relative z-10 min-h-0 flex items-center justify-center bg-[#070708] px-[3%]">
          <MultiCourtScoreStrip rows={multiRows} variant="venue" />
        </div>
        <BadmintonLedChyron sponsors={sponsorLogos} tournamentName={tournamentName} />
      </div>
    );
  } else if (showLiveBoard && matchState) {
    stageContent = (
      <BroadcastDisplay
        state={matchState}
        tournamentName={tournamentName}
        tournamentLogoUrl={tournamentLogoUrl}
        courtNumber={resolvedCourt}
        matchNumber={matchDetail?.matchNumber}
        roundName={matchDetail?.roundName}
        matchLabel={matchDetail?.matchLabel}
        sponsorLogos={sponsorLogos}
        scoreBoardSponsor={branding?.scoreBoardSponsor ?? null}
      />
    );
  } else {
    stageContent = (
      <LedStandby
        message={standbyMessage}
        tournamentName={tournamentName}
        tournamentLogoUrl={tournamentLogoUrl}
        sponsorLogos={sponsorLogos}
        scoreBoardSponsor={branding?.scoreBoardSponsor ?? null}
      />
    );
  }

  return (
    <FullscreenLayout className="lovable-theme">
      <DisplayStageViewport>
        <StageThemeProvider initialTheme={initialTheme}>
          <StageFrame>{stageContent}</StageFrame>
        </StageThemeProvider>
      </DisplayStageViewport>
      <AudioUnlockButton visible={!isUnlocked} onUnlock={unlock} />
    </FullscreenLayout>
  );
}

export default function BadmintonDisplayPage() {
  const [, params] = useRoute("/badminton/:matchId/display");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const followMode = isLiveFollowMatchId(params?.matchId);
  const matchId = followMode ? 0 : parseInt(params?.matchId ?? "0", 10);
  const tournamentId = parseInt(searchParams.get("tid") ?? "0", 10);
  const courtNumber = searchParams.get("court") ?? undefined;

  useEffect(() => {
    loadDisplayFonts();
  }, []);

  return (
    <DisplayStage
      tournamentId={tournamentId}
      matchId={matchId}
      courtNumber={courtNumber}
      followMode={followMode}
    />
  );
}
