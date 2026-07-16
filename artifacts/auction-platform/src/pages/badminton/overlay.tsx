/**
 * Badminton OBS Overlay Page
 * Route: /badminton/:matchId/overlay?tid=YYY&type=compact&...
 *
 * When matchId is `live`, follows Primary Broadcast / sole LIVE match automatically.
 * Always shows auction-style top header + sponsor chyron; center stays transparent for OBS.
 */

import { useEffect, useMemo, type CSSProperties } from "react";
import { useRoute, useSearch } from "wouter";
import { BadmintonOverlay, overlayPlacementClass } from "@/components/badminton/obs-overlays";
import {
  BadmintonLedChyron,
  BadmintonLedTopStrip,
} from "@/components/badminton/badminton-led-chrome";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonLiveFollow } from "@/hooks/use-badminton-live-follow";
import { useBadmintonBranding, sponsorLogosFromBranding } from "@/hooks/use-badminton-branding";
import { DISPLAY_THEMES } from "@/lib/display-theme";
import { displayThemeToPickerState, resolveStageTheme } from "@/lib/led-stage-theme";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";
import { isLiveFollowMatchId } from "@/lib/badminton-broadcast-console";
import { BROADCAST_OVERLAY_HEIGHT } from "@/lib/broadcast-overlay";
import {
  isMultiCourtOverlayScene,
  resolveOverlayGraphicType,
} from "@/lib/badminton-broadcast-director";
import {
  MultiCourtScoreStrip,
  multiCourtRowsFromMatches,
} from "@/components/badminton/multi-court-score-strip";

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

export default function BadmintonOverlayPage() {
  useObsTransparentDocument();

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

  const type = resolveOverlayGraphicType(branding?.overlayScene, searchParams.get("type"));
  const multiCourtMode = isMultiCourtOverlayScene(branding?.overlayScene);

  const data = followMode ? liveFollow.matchQuery.data : fixedMatch.data;
  const isLoading = followMode
    ? liveFollow.matchesLoading ||
      (!!liveFollow.primaryMatchId && liveFollow.matchQuery.isLoading)
    : fixedMatch.isLoading;

  const tournamentName =
    searchParams.get("name") ?? branding?.displayName ?? "Badminton Tournament";
  const urlSponsorLogos: SponsorLogo[] = sponsorParam
    ? sponsorParam.split(",").filter(Boolean).map((url) => ({ url, name: "", type: "" }))
    : [];
  const sponsorLogos =
    urlSponsorLogos.length > 0 ? urlSponsorLogos : sponsorLogosFromBranding(branding);

  const stageStyle = useMemo((): CSSProperties => {
    const { themeId, customAccent } = displayThemeToPickerState(DISPLAY_THEMES["stadium-gold"]);
    return resolveStageTheme(themeId, customAccent).vars as CSSProperties;
  }, []);

  const state = (data?.state ?? null) as BadmintonMatchState | null;
  const detail = (data?.detail ?? null) as Record<string, unknown> | null;
  const matchLabel = detail?.matchLabel as string | undefined;
  const hasLiveGraphics = !!state;

  const multiRows = useMemo(() => {
    if (!multiCourtMode) return [];
    return multiCourtRowsFromMatches(liveFollow.liveMatches);
  }, [multiCourtMode, liveFollow.liveMatches]);

  const waitingLabel = !tournamentId
    ? "Missing tournament"
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
      {/* Top chrome — always visible (auction OBS style) */}
      <div className="absolute top-0 left-0 right-0 z-30">
        {hasLiveGraphics && type === "full" && !multiCourtMode ? (
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
              (hasLiveGraphics ? undefined : undefined)
            }
            matchNumber={detail?.matchNumber as string | undefined}
            roundName={
              hasLiveGraphics && !multiCourtMode
                ? (detail?.roundName as string | undefined)
                : waitingLabel
            }
            matchStatus={hasLiveGraphics && !multiCourtMode ? state.matchStatus : "scheduled"}
            isTimeout={!!state?.activeTimeout && !multiCourtMode}
            timeoutSide={state?.activeTimeout?.side}
            leftLabel={state?.leftSide?.shortLabel ?? state?.leftSide?.label ?? "Side A"}
            rightLabel={state?.rightSide?.shortLabel ?? state?.rightSide?.label ?? "Side B"}
          />
        )}
      </div>

      {/* Center — transparent; multi-court strip or primary match graphics */}
      {multiCourtMode ? (
        multiRows.length > 0 ? (
          <div className="absolute z-20 bottom-[11vh] left-1/2 -translate-x-1/2 pointer-events-none">
            <MultiCourtScoreStrip rows={multiRows} variant="overlay" />
          </div>
        ) : null
      ) : hasLiveGraphics ? (
        type === "full" ? (
          <div className="absolute bottom-[8vh] left-0 right-0 z-20 px-[3vw] pointer-events-none">
            <BadmintonOverlay
              type="full"
              state={state}
              courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
              matchLabel={matchLabel}
              roundName={detail?.roundName as string | undefined}
            />
          </div>
        ) : (
          <div className={cn("absolute z-20", overlayPlacementClass(type, true))}>
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
            />
          </div>
        )
      ) : null}

      {/* Bottom sponsor ticker — always on */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BadmintonLedChyron
          sponsors={sponsorLogos}
          tournamentName={tournamentName}
          accentMode="bidwar"
        />
      </div>
    </div>
  );
}
