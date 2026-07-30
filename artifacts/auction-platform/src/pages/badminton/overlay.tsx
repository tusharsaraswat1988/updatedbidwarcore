/**
 * Badminton OBS Overlay Page
 * Route: /badminton/:matchId/overlay?tid=YYY&type=compact&...
 *
 * When matchId is `live`, follows Primary Broadcast / sole LIVE match automatically.
 * Play-safe remaps, slim chrome, corner bug, match-point chyron, CEF throttle.
 */

import { useEffect, useMemo, type CSSProperties } from "react";
import { useRoute, useSearch } from "wouter";
import {
  BadmintonOverlay,
  ObsLeaderboardsOverlay,
  ObsPlayMoments,
  ObsRecentResultsOverlay,
  overlayPlacementClass,
} from "@/components/badminton/obs-overlays";
import {
  BadmintonLedChyron,
  BadmintonLedTopStrip,
} from "@/components/badminton/badminton-led-chrome";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonLiveFollow } from "@/hooks/use-badminton-live-follow";
import { useBadmintonBranding, sponsorLogosFromBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonLeaderboardBoards } from "@/hooks/use-badminton-leaderboard-boards";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  detectGamePointSide,
  detectMatchPointSide,
  type BadmintonMatchState,
} from "@workspace/badminton-core";
import { cn } from "@/lib/utils";
import { isLiveFollowMatchId } from "@/lib/badminton-broadcast-console";
import { BROADCAST_OVERLAY_HEIGHT } from "@/lib/broadcast-overlay";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_ON,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";
import {
  isMultiCourtOverlayScene,
  OBS_CHYRON_PX_PER_SEC,
  OBS_SPONSOR_CAROUSEL_ROTATE_MS,
  resolveOverlayGraphicType,
  resolvePlaySafeOverlayType,
  shouldUseObsPlayDensity,
} from "@/lib/badminton-broadcast-director";
import {
  MultiCourtScoreStrip,
  multiCourtRowsFromMatches,
} from "@/components/badminton/multi-court-score-strip";
import { useObsBrowserSource } from "@/components/broadcast/use-obs-browser-source";

const OBS_STAGE_STYLE = {
  "--accent": BIDWAR_BROADCAST_YELLOW,
  "--accent-strong": BIDWAR_BROADCAST_YELLOW,
  "--accent-glow": "rgba(255, 215, 0, 0.35)",
  "--accent-on": BIDWAR_BROADCAST_YELLOW_ON,
  "--stage-bg": BIDWAR_SCOREBOARD_SHELL,
  "--stage-surface": BIDWAR_SCOREBOARD_PANEL,
  "--stage-text": "#ffffff",
} as CSSProperties;

/** Force transparent document chrome so OBS / browser don't paint app dark bg. */
function useObsTransparentDocument() {
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
      htmlClass: html.className,
    };

    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.overflow = "hidden";
    html.style.minHeight = "0";
    body.style.minHeight = "0";
    html.classList.remove("dark");
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
      html.className = prev.htmlClass;
      if (root) {
        root.style.background = prev.rootBg;
        root.style.minHeight = prev.rootMinH;
      }
    };
  }, []);
}

function resolveChyronUrgency(
  state: BadmintonMatchState | null,
): "game" | "match" | null {
  if (!state || state.matchStatus !== "live") return null;
  if (state.activeTimeout || state.inInterval) return null;
  if (detectMatchPointSide(state)) return "match";
  if (detectGamePointSide(state)) return "game";
  return null;
}

export default function BadmintonOverlayPage() {
  useObsTransparentDocument();
  const isObsCef = useObsBrowserSource();

  const [, params] = useRoute("/badminton/:matchId/overlay");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const followMode = isLiveFollowMatchId(params?.matchId);
  const matchId = followMode ? 0 : parseInt(params?.matchId ?? "0", 10);
  const tournamentId = parseInt(searchParams.get("tid") ?? "0", 10);
  const courtNumber = searchParams.get("court") ?? undefined;
  const sponsorParam = searchParams.get("sponsors") ?? "";

  const fixedMatch = useBadmintonMatch(tournamentId, followMode ? 0 : matchId);
  const liveFollow = useBadmintonLiveFollow(tournamentId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const requestedType = resolveOverlayGraphicType(
    branding?.overlayScene,
    searchParams.get("type"),
  );
  const multiCourtMode = isMultiCourtOverlayScene(branding?.overlayScene);
  const leaderboardsEnabled = requestedType === "leaderboards" || branding?.overlayScene === "leaderboards";
  const leaderboards = useBadmintonLeaderboardBoards(tournamentId, leaderboardsEnabled);

  const data = followMode ? liveFollow.matchQuery.data : fixedMatch.data;
  const isLoading = followMode
    ? liveFollow.matchesLoading ||
      (!!liveFollow.primaryMatchId && liveFollow.matchQuery.isLoading)
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

  const tournamentName =
    searchParams.get("name") ?? branding?.displayName ?? "Badminton Tournament";
  const urlSponsorLogos: SponsorLogo[] = sponsorParam
    ? sponsorParam.split(",").filter(Boolean).map((url) => ({ url, name: "", type: "" }))
    : [];
  const sponsorLogos =
    urlSponsorLogos.length > 0 ? urlSponsorLogos : sponsorLogosFromBranding(branding);

  const stageStyle = OBS_STAGE_STYLE;

  const state = (data?.state ?? null) as BadmintonMatchState | null;
  const detail = (data?.detail ?? null) as Record<string, unknown> | null;
  const matchLabel = detail?.matchLabel as string | undefined;
  const hasLiveGraphics = !!state && !loadError;

  const type = multiCourtMode
    ? requestedType
    : resolvePlaySafeOverlayType(requestedType, state);

  const playDensity = shouldUseObsPlayDensity(type, state, multiCourtMode);
  const chromeDensity = playDensity ? "slim" : "full";
  const chyronUrgency = resolveChyronUrgency(state);

  const multiRows = useMemo(() => {
    if (!multiCourtMode) return [];
    return multiCourtRowsFromMatches(liveFollow.liveMatches);
  }, [multiCourtMode, liveFollow.liveMatches]);

  const waitingLabel = !tournamentId
    ? "Missing tournament"
    : loadError
      ? "Connection lost"
      : isLoading
      ? "Loading…"
      : multiCourtMode
        ? multiRows.length > 0
          ? `${multiRows.length} court${multiRows.length > 1 ? "s" : ""} live`
          : "Waiting for live courts"
        : "Waiting for live match";

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ ...stageStyle, background: "transparent" }}
    >
      {loadError ? (
        <div className="absolute top-[max(3.5rem,8vh)] right-3 z-40 pointer-events-auto max-w-[220px]">
          <div className="rounded-lg border border-red-400/40 bg-black/75 px-3 py-2 shadow-lg backdrop-blur-sm">
            <p className="text-red-100 text-[11px] font-semibold leading-snug">{waitingLabel}</p>
            <button
              type="button"
              onClick={retryLoad}
              className="mt-1.5 min-h-8 px-3 rounded-md bg-white/10 border border-white/20 text-white text-[11px] font-bold hover:bg-white/15"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <div className="absolute top-0 left-0 right-0 z-30">
        {hasLiveGraphics && type === "full" && !multiCourtMode && !playDensity ? (
          <div className="flex items-center justify-between gap-6 px-[4vw] pt-[2vh] pointer-events-none">
            <div className="flex items-center gap-3 min-w-0 max-w-[min(420px,42vw)]">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt=""
                  className="h-10 w-auto max-w-[72px] object-contain shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-black/70 border border-white/15 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-mono uppercase tracking-[0.28em] text-white/70 leading-none drop-shadow">
                  Tournament
                </p>
                <p className="text-sm font-bold text-white uppercase tracking-wide truncate leading-tight mt-0.5 drop-shadow">
                  {tournamentName}
                </p>
              </div>
            </div>
            <BadmintonPublicBrandMark
              variant="overlay"
              className="pointer-events-auto shrink-0 self-center"
            />
          </div>
        ) : (
          <BadmintonLedTopStrip
            tournamentName={tournamentName}
            tournamentLogoUrl={branding?.logoUrl ?? undefined}
            courtNumber={
              courtNumber ??
              (detail?.courtNumber as string | undefined) ??
              undefined
            }
            matchNumber={detail?.matchNumber as string | undefined}
            roundName={
              type === "results"
                ? "Match results"
                : type === "leaderboards"
                  ? "Leaderboards"
                : hasLiveGraphics && !multiCourtMode
                ? (detail?.roundName as string | undefined)
                : waitingLabel
            }
            matchStatus={
              type === "results" || type === "leaderboards"
                ? "completed"
                : hasLiveGraphics && !multiCourtMode
                  ? state.matchStatus
                  : "scheduled"
            }
            isTimeout={!!state?.activeTimeout && !multiCourtMode}
            timeoutSide={state?.activeTimeout?.side}
            leftLabel={state?.leftSide?.shortLabel ?? state?.leftSide?.label ?? "Side A"}
            rightLabel={state?.rightSide?.shortLabel ?? state?.rightSide?.label ?? "Side B"}
            scoreBoardSponsor={branding?.scoreBoardSponsor}
            density={chromeDensity}
          />
        )}
      </div>

      {multiCourtMode ? (
        multiRows.length > 0 ? (
          <div
            className={cn(
              "absolute z-20 left-1/2 -translate-x-1/2 pointer-events-none",
              playDensity ? "bottom-[8vh]" : "bottom-[11vh]",
            )}
          >
            <MultiCourtScoreStrip rows={multiRows} variant="overlay" />
          </div>
        ) : null
      ) : type === "results" ? (
        <div
          className={cn(
            "absolute z-20 pointer-events-none",
            overlayPlacementClass("results", true, playDensity),
          )}
        >
          <ObsRecentResultsOverlay matches={liveFollow.matches} />
        </div>
      ) : type === "leaderboards" ? (
        <div
          className={cn(
            "absolute z-20 pointer-events-none",
            overlayPlacementClass("leaderboards", true, playDensity),
          )}
        >
          <ObsLeaderboardsOverlay
            pages={leaderboards.pages}
            loading={leaderboards.loading}
          />
        </div>
      ) : hasLiveGraphics ? (
        type === "full" ? (
          <div
            className={cn(
              "absolute left-0 right-0 z-20 px-[3vw] pointer-events-none",
              playDensity ? "bottom-[7vh]" : "bottom-[8vh]",
            )}
          >
            <BadmintonOverlay
              type="full"
              state={state}
              courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
              matchLabel={matchLabel}
              roundName={detail?.roundName as string | undefined}
            />
          </div>
        ) : (
          <div
            className={cn(
              "absolute z-20",
              overlayPlacementClass(type, true, playDensity),
            )}
          >
            <BadmintonOverlay
              type={type}
              state={state}
              tournamentName={tournamentName}
              tournamentLogoUrl={branding?.logoUrl ?? undefined}
              courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
              matchLabel={matchLabel}
              roundName={detail?.roundName as string | undefined}
              sponsorLogos={sponsorLogos}
              showPlatformCredit={false}
              sponsorRotateMs={isObsCef ? OBS_SPONSOR_CAROUSEL_ROTATE_MS : undefined}
            />
          </div>
        )
      ) : null}

      {hasLiveGraphics &&
      !multiCourtMode &&
      type !== "intro" &&
      type !== "winner" &&
      type !== "results" &&
      type !== "leaderboards" ? (
        <ObsPlayMoments state={state} />
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BadmintonLedChyron
          sponsors={sponsorLogos}
          tournamentName={tournamentName}
          accentMode="bidwar"
          density={chromeDensity}
          urgencyKind={chyronUrgency}
          tickerPxPerSec={isObsCef ? OBS_CHYRON_PX_PER_SEC : undefined}
        />
      </div>
    </div>
  );
}
