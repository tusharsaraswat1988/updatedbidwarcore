/**
 * Badminton OBS Overlay Page
 * Route: /badminton/:matchId/overlay?tid=YYY&type=compact&...
 */

import { useMemo, type CSSProperties } from "react";
import { useRoute, useSearch } from "wouter";
import { BadmintonOverlay, overlayPlacementClass } from "@/components/badminton/obs-overlays";
import { BadmintonLedChyron } from "@/components/badminton/badminton-led-chrome";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonBranding, sponsorLogosFromBranding } from "@/hooks/use-badminton-branding";
import { DISPLAY_THEMES } from "@/lib/display-theme";
import { displayThemeToPickerState, resolveStageTheme } from "@/lib/led-stage-theme";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

export default function BadmintonOverlayPage() {
  const [, params] = useRoute("/badminton/:matchId/overlay");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");
  const type = (searchParams.get("type") ?? "compact") as
    | "compact"
    | "full"
    | "intro"
    | "winner"
    | "sponsor";
  const courtNumber = searchParams.get("court") ?? undefined;
  const sponsorParam = searchParams.get("sponsors") ?? "";
  const { data } = useBadmintonMatch(tournamentId, matchId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const tournamentName =
    searchParams.get("name") ?? branding?.displayName ?? undefined;
  const urlSponsorLogos: SponsorLogo[] = sponsorParam
    ? sponsorParam.split(",").filter(Boolean).map((url) => ({ url, name: "", type: "" }))
    : [];
  const sponsorLogos =
    urlSponsorLogos.length > 0 ? urlSponsorLogos : sponsorLogosFromBranding(branding);

  /** OBS has no theme picker — always BidWar stadium gold. */
  const stageStyle = useMemo((): CSSProperties => {
    const { themeId, customAccent } = displayThemeToPickerState(DISPLAY_THEMES["stadium-gold"]);
    return resolveStageTheme(themeId, customAccent).vars as CSSProperties;
  }, []);

  if (!data?.state) {
    return <div className="min-h-screen bg-transparent" />;
  }

  const state = data.state as BadmintonMatchState;
  const detail = data.detail as Record<string, unknown> | null;
  const matchLabel = detail?.matchLabel as string | undefined;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden led-display-tv"
      style={{ ...stageStyle, background: "transparent" }}
    >
      {type === "full" ? (
        <div className="absolute top-[4vh] left-[4vw] right-[4vw] z-20 flex items-center justify-between gap-6 pointer-events-none">
          <div className="flex items-center gap-3 min-w-0 max-w-[min(420px,42vw)]">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt=""
                className="h-10 w-auto max-w-[72px] object-contain shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/10 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.28em] text-white/45 leading-none">
                Tournament
              </p>
              <p className="text-sm font-bold text-white uppercase tracking-wide truncate leading-tight mt-0.5">
                {tournamentName ?? "Badminton Tournament"}
              </p>
            </div>
          </div>
          <BadmintonPublicBrandMark
            variant="overlay"
            className="pointer-events-auto shrink-0 self-center"
          />
        </div>
      ) : null}

      {type === "full" ? (
        <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col gap-2 pointer-events-none">
          <div className="px-[3vw]">
            <BadmintonOverlay
              type="full"
              state={state}
              courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
              matchLabel={matchLabel}
              roundName={detail?.roundName as string | undefined}
            />
          </div>
          <BadmintonLedChyron
            sponsors={sponsorLogos}
            tournamentName={tournamentName ?? "Badminton Tournament"}
            accentMode="bidwar"
          />
        </div>
      ) : (
        <div className={cn("absolute z-10", overlayPlacementClass(type))}>
          <BadmintonOverlay
            type={type}
            state={state}
            tournamentName={tournamentName}
            tournamentLogoUrl={branding?.logoUrl ?? undefined}
            courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
            matchLabel={matchLabel}
            roundName={detail?.roundName as string | undefined}
            sponsorLogos={sponsorLogos}
            showPlatformCredit={type === "compact"}
          />
        </div>
      )}
    </div>
  );
}
