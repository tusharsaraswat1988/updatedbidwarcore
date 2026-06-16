/**
 * Badminton OBS Overlay Page
 * Route: /badminton/:matchId/overlay?tid=YYY&type=compact&...
 */

import { useRoute, useSearch } from "wouter";
import { BadmintonOverlay } from "@/components/badminton/obs-overlays";
import { ScoreBoardSponsorTopRight } from "@/components/badminton/score-board-sponsor-panel";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonBranding, sponsorUrlsFromBranding } from "@/hooks/use-badminton-branding";
import type { BadmintonMatchState } from "@workspace/badminton-core";

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
  const urlSponsorLogos = sponsorParam ? sponsorParam.split(",").filter(Boolean) : [];

  const { data } = useBadmintonMatch(tournamentId, matchId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const tournamentName =
    searchParams.get("name") ?? branding?.displayName ?? undefined;
  const sponsorLogos =
    urlSponsorLogos.length > 0 ? urlSponsorLogos : sponsorUrlsFromBranding(branding);

  if (!data?.state) {
    return <div className="min-h-screen bg-transparent" />;
  }

  const state = data.state as BadmintonMatchState;
  const detail = data.detail as Record<string, unknown> | null;

  return (
    <div className="relative min-h-screen w-screen" style={{ background: "transparent" }}>
      <ScoreBoardSponsorTopRight sponsor={branding?.scoreBoardSponsor ?? null} />
      <div className="min-h-screen flex items-end justify-center pb-8">
        <BadmintonOverlay
          type={type}
          state={state}
          tournamentName={tournamentName}
          tournamentLogoUrl={branding?.logoUrl ?? undefined}
          courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
          matchLabel={detail?.matchLabel as string | undefined}
          roundName={detail?.roundName as string | undefined}
          sponsorLogos={sponsorLogos}
        />
      </div>
    </div>
  );
}
