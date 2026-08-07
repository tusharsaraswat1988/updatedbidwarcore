import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicMatchScorecard, getScoringLive } from "@/lib/scoring-api";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { ScorecardView } from "@/components/scoring/scorecard-view";
import { ShareButtons } from "@/components/scoring/share-buttons";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import { cricketMatchPublicPath, cricketFanMatchesPath } from "@/lib/tournament-navigation";
import type { PublicSchedulePayload } from "@/lib/public-tournament-types";
import { CircleDot } from "lucide-react";

export default function ScoringMatchPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket/match/:matchId");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");

  const { data: schedule } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
    refetchInterval: (q) => {
      const hasLive = (q.state.data?.matches ?? []).some((m) => m.status === "live");
      return hasLive ? 20000 : 60000;
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-scorecard", tournamentId, matchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, matchId),
    enabled: !!tournamentId && !!matchId,
    refetchInterval: (query) => {
      const status = query.state.data?.match?.status;
      return status === "live" ? 10000 : false;
    },
  });

  const isLive = data?.match?.status === "live";
  const liveMatchId =
    (schedule?.matches ?? []).find((m) => m.status === "live")?.id ?? (isLive ? matchId : null);

  const { data: liveDisplay } = useQuery({
    queryKey: ["scoring-live", tournamentId],
    queryFn: () => getScoringLive(tournamentId),
    enabled: !!tournamentId && isLive,
    refetchInterval: 8000,
  });

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${cricketMatchPublicPath(tournamentId, matchId)}`
      : "";

  if (isLoading) return <CricketFanLoading tournamentId={tournamentId} />;

  if (error || !data) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Scorecard not available." />;
  }

  const liveScoreline = (() => {
    if (!isLive || !liveDisplay?.state) return null;
    const state = liveDisplay.state as Record<string, unknown>;
    const runs = state.runs ?? state.totalRuns;
    const wickets = state.wickets ?? state.totalWickets;
    const overs = state.overs ?? state.oversBowled;
    if (runs == null) return null;
    const wk = wickets != null ? `/${wickets}` : "";
    const ov = overs != null ? ` (${overs})` : "";
    return `${runs}${wk}${ov}`;
  })();

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={cricketFanMatchesPath(tournamentId)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Matches
        </Link>
        {pageUrl ? (
          <ShareButtons
            url={pageUrl}
            shareText={`${data.match.homeTeam?.name ?? "Home"} vs ${data.match.awayTeam?.name ?? "Away"} — scorecard`}
            compact
          />
        ) : null}
      </div>

      {isLive ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          <CircleDot className="h-4 w-4 animate-pulse" />
          <span className="font-semibold uppercase tracking-wide">Live</span>
          {liveScoreline ? <span className="tabular-nums text-emerald-200">{liveScoreline}</span> : null}
        </div>
      ) : null}

      <ScorecardView data={data} tournamentId={tournamentId} />
    </CricketFanExperienceShell>
  );
}
