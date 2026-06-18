/**
 * Badminton Broadcast Display Page
 * Route: /badminton/:matchId/display?tid=YYY
 */

import { useMemo } from "react";
import { useRoute, useSearch } from "wouter";
import { BroadcastDisplay } from "@/components/badminton/broadcast-display";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonBranding, sponsorLogosFromBranding } from "@/hooks/use-badminton-branding";
import { FullscreenLayout } from "@/components/layout";
import { DisplayStageViewport } from "@/components/display/display-stage-viewport";
import { StageFrame } from "@/components/display/v1/StageFrame";
import { StageThemeProvider } from "@/components/display/v1/StageThemeProvider";
import { DevThemePicker } from "@/components/display/v1/DevThemePicker";
import { DISPLAY_THEMES, type DisplayTheme } from "@/lib/display-theme";
import type { BadmintonMatchState } from "@workspace/badminton-core";

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

export default function BadmintonDisplayPage() {
  const [, params] = useRoute("/badminton/:matchId/display");
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId ?? "0");
  const tournamentId = parseInt(searchParams.get("tid") ?? "0");
  const courtNumber = searchParams.get("court") ?? undefined;

  const { data, isLoading } = useBadmintonMatch(tournamentId, matchId);
  const { data: branding } = useBadmintonBranding(tournamentId);

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

  return (
    <FullscreenLayout>
      <DisplayStageViewport>
        <StageThemeProvider initialTheme={initialTheme}>
          <StageFrame>
            {isLoading ? (
              <LedStandby message="Connecting to match…" />
            ) : !data?.state ? (
              <LedStandby message="Match not available" />
            ) : (
              <BroadcastDisplay
                state={data.state as BadmintonMatchState}
                tournamentName={tournamentName}
                tournamentLogoUrl={branding?.logoUrl ?? undefined}
                courtNumber={courtNumber ?? (data.detail?.courtNumber as string | undefined)}
                matchNumber={data.detail?.matchNumber as string | undefined}
                roundName={data.detail?.roundName as string | undefined}
                matchLabel={data.detail?.matchLabel as string | undefined}
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
