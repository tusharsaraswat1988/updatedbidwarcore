/**
 * Badminton Venue Scoreboard Display
 * Route: /badminton/:matchId/display?tid=YYY
 *
 * When matchId is `live`, follows Primary Broadcast / sole LIVE match automatically.
 * Always shows LED chrome (top strip + sponsor chyron); center waits until a match is live.
 */

import { useEffect, useMemo } from "react";
import { useRoute, useSearch } from "wouter";
import { BroadcastDisplay } from "@/components/badminton/broadcast-display";
import {
  BadmintonLedChyron,
  BadmintonLedTopStrip,
} from "@/components/badminton/badminton-led-chrome";
import { badmintonLedSurfaceStyle } from "@/components/badminton/badminton-led-theme";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonLiveFollow } from "@/hooks/use-badminton-live-follow";
import { useBadmintonBranding, sponsorLogosFromBranding } from "@/hooks/use-badminton-branding";
import { FullscreenLayout } from "@/components/layout";
import { DisplayStageViewport } from "@/components/display/display-stage-viewport";
import { StageFrame } from "@/components/display/v1/StageFrame";
import { StageThemeProvider } from "@/components/display/v1/StageThemeProvider";
import { DevThemePicker } from "@/components/display/v1/DevThemePicker";
import { DISPLAY_THEMES, type DisplayTheme } from "@/lib/display-theme";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { loadDisplayFonts } from "@/lib/load-display-fonts";
import { isLiveFollowMatchId } from "@/lib/badminton-broadcast-console";
import {
  isMultiCourtVenueScene,
  shouldShowVenueLiveBoard,
} from "@/lib/badminton-broadcast-director";
import {
  MultiCourtScoreStrip,
  multiCourtRowsFromMatches,
} from "@/components/badminton/multi-court-score-strip";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { ScoreBoardSponsor } from "@/components/badminton/score-board-sponsor-panel";

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
  const fixedMatch = useBadmintonMatch(tournamentId, followMode ? 0 : matchId);
  const liveFollow = useBadmintonLiveFollow(tournamentId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const data = followMode ? liveFollow.matchQuery.data : fixedMatch.data;
  const isLoading = followMode
    ? liveFollow.matchesLoading || (!!liveFollow.primaryMatchId && liveFollow.matchQuery.isLoading)
    : fixedMatch.isLoading;
  const matchDetail = data?.detail as BadmintonMatchDetailMeta | null | undefined;

  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const tournamentName =
    searchParams.get("name") ?? branding?.displayName ?? "Badminton Tournament";
  const sponsorLogos = sponsorLogosFromBranding(branding);
  const tournamentLogoUrl = branding?.logoUrl ?? undefined;
  const multiCourtMode = isMultiCourtVenueScene(branding?.venueScene);
  const multiRows = useMemo(
    () => (multiCourtMode ? multiCourtRowsFromMatches(liveFollow.liveMatches) : []),
    [multiCourtMode, liveFollow.liveMatches],
  );

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
    : branding?.venueScene === "standby" && !!data?.state
      ? "Standby — director hold"
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

  const showLiveBoard = shouldShowVenueLiveBoard(branding?.venueScene, !!data?.state);
  const showMultiBoard = multiCourtMode && multiRows.length > 0;


  return (
    <FullscreenLayout>
      <DisplayStageViewport>
        <StageThemeProvider initialTheme={initialTheme}>
          <StageFrame>
            {showMultiBoard ? (
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
                />
                <div className="relative z-10 min-h-0 flex items-center justify-center bg-[#070708] px-[3%]">
                  <MultiCourtScoreStrip rows={multiRows} variant="venue" />
                </div>
                <BadmintonLedChyron sponsors={sponsorLogos} tournamentName={tournamentName} />
              </div>
            ) : showLiveBoard ? (
              <BroadcastDisplay
                state={data.state as BadmintonMatchState}
                tournamentName={tournamentName}
                tournamentLogoUrl={tournamentLogoUrl}
                courtNumber={courtNumber ?? matchDetail?.courtNumber}
                matchNumber={matchDetail?.matchNumber}
                roundName={matchDetail?.roundName}
                matchLabel={matchDetail?.matchLabel}
                sponsorLogos={sponsorLogos}
                scoreBoardSponsor={branding?.scoreBoardSponsor ?? null}
              />
            ) : (
              <LedStandby
                message={standbyMessage}
                tournamentName={tournamentName}
                tournamentLogoUrl={tournamentLogoUrl}
                sponsorLogos={sponsorLogos}
                scoreBoardSponsor={branding?.scoreBoardSponsor ?? null}
              />
            )}
            <DevThemePicker anchor="stage" />
          </StageFrame>
        </StageThemeProvider>
      </DisplayStageViewport>
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
