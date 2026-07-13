/**
 * Badminton Broadcast Display Page
 * Route: /badminton/:matchId/display?tid=YYY
 *
 * When matchId is `live`, follows Primary Broadcast / sole LIVE match automatically.
 */

import { useEffect, useMemo } from "react";
import { useRoute, useSearch } from "wouter";
import { BroadcastDisplay } from "@/components/badminton/broadcast-display";
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

function LedStandby({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] font-['Barlow_Condensed']">
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-[2.5%]">
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            BIDWAR
          </span>
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            LIVE
          </span>
        </div>
      </div>
      <div className="relative z-10 text-center">
        <div className="w-12 h-12 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-6" />
        <p className="text-white/40 text-sm font-mono uppercase tracking-[0.3em]">{message}</p>
      </div>
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
  const liveFollow = useBadmintonLiveFollow(followMode ? tournamentId : 0);
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

  const standbyMessage = followMode
    ? liveFollow.primaryMatchId
      ? "Connecting to live match…"
      : "Waiting for live match…"
    : isLoading
      ? "Connecting to match…"
      : "Match not available";

  return (
    <FullscreenLayout>
      <DisplayStageViewport>
        <StageThemeProvider initialTheme={initialTheme}>
          <StageFrame>
            {isLoading || !data?.state ? (
              <LedStandby message={standbyMessage} />
            ) : (
              <BroadcastDisplay
                state={data.state as BadmintonMatchState}
                tournamentName={tournamentName}
                tournamentLogoUrl={branding?.logoUrl ?? undefined}
                courtNumber={courtNumber ?? matchDetail?.courtNumber}
                matchNumber={matchDetail?.matchNumber}
                roundName={matchDetail?.roundName}
                matchLabel={matchDetail?.matchLabel}
                sponsorLogos={sponsorLogosFromBranding(branding)}
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
