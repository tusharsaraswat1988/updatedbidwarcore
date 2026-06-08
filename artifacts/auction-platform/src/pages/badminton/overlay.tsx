/**
 * Badminton OBS Overlay Page
 * Route: /badminton/:matchId/overlay?tid=YYY&type=compact&...
 *
 * Transparent background — add as Browser Source in OBS.
 * Updates in real-time via SSE (no refresh needed).
 *
 * Query params:
 *   tid=<tournamentId>          Required
 *   type=compact|full|intro|winner|sponsor  (default: compact)
 *   name=<tournamentName>       Optional
 *   court=<courtNumber>         Optional
 *   sponsors=<url1,url2,...>    Optional comma-separated sponsor logo URLs
 */

import { useRoute, useSearch } from "wouter";
import { BadmintonOverlay } from "@/components/badminton/obs-overlays";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
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
  const tournamentName = searchParams.get("name") ?? undefined;
  const courtNumber = searchParams.get("court") ?? undefined;
  const sponsorParam = searchParams.get("sponsors") ?? "";
  const sponsorLogos = sponsorParam ? sponsorParam.split(",").filter(Boolean) : [];

  const { data } = useBadmintonMatch(tournamentId, matchId);

  if (!data?.state) {
    return (
      // Transparent placeholder — OBS will show nothing when disconnected
      <div className="min-h-screen bg-transparent" />
    );
  }

  const state = data.state as BadmintonMatchState;
  const detail = data.detail as Record<string, unknown> | null;

  return (
    // No background — OBS browser source will be transparent
    <div
      className="min-h-screen flex items-end justify-center pb-8"
      style={{ background: "transparent" }}
    >
      <BadmintonOverlay
        type={type}
        state={state}
        tournamentName={tournamentName}
        courtNumber={courtNumber ?? (detail?.courtNumber as string | undefined)}
        matchLabel={detail?.matchLabel as string | undefined}
        roundName={detail?.roundName as string | undefined}
        sponsorLogos={sponsorLogos}
      />
    </div>
  );
}
