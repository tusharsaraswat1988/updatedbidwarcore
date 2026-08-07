import { Link } from "wouter";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { cricketCardClass } from "@/components/scoring/cricket-page-chrome";
import { cricketFanMatchPath } from "@/lib/tournament-navigation";
import type { PublicMatch, PublicTeam } from "@/lib/public-tournament-types";
import { isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { scorelineFromSummary } from "@/lib/public-tournament-utils";

function statusLabel(status: string) {
  if (status === "live") return "LIVE";
  if (isTerminalCricketMatchStatus(status)) return "Completed";
  if (status === "scheduled") return "Upcoming";
  return status;
}

function statusClass(status: string) {
  if (status === "live") return "text-emerald-400";
  if (isTerminalCricketMatchStatus(status)) return "text-muted-foreground";
  return "text-sky-300";
}

export function PublicMatchCard({
  tournamentId,
  match,
  teamMap,
  liveScoreline,
  compact = false,
}: {
  tournamentId: number;
  match: PublicMatch;
  teamMap: Map<number, PublicTeam>;
  liveScoreline?: string | null;
  compact?: boolean;
}) {
  const home = teamMap.get(match.homeTeamId);
  const away = teamMap.get(match.awayTeamId);
  const isLive = match.status === "live";
  const scoreline =
    liveScoreline ||
    match.resultSummary ||
    scorelineFromSummary(match.summaryJson ?? undefined);

  const body = (
    <div
      className={cn(
        cricketCardClass,
        "block px-4 py-3 transition-colors",
        isLive
          ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
          : "hover:border-primary/30 hover:bg-card/80",
        compact && "py-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="font-medium text-foreground truncate">
            {home?.name ?? "Home"} <span className="text-muted-foreground font-normal">vs</span>{" "}
            {away?.name ?? "Away"}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("font-semibold uppercase tracking-wide", statusClass(match.status))}>
              {isLive ? (
                <span className="inline-flex items-center gap-1">
                  <CircleDot className="h-3 w-3 animate-pulse" />
                  {statusLabel(match.status)}
                </span>
              ) : (
                statusLabel(match.status)
              )}
            </span>
            {match.roundName ? <span>· {match.roundName}</span> : null}
            {match.venue ? <span>· {match.venue}</span> : null}
            {match.scheduledAt && !isLive ? (
              <span>· {new Date(match.scheduledAt).toLocaleString()}</span>
            ) : null}
          </div>
          {scoreline ? (
            <p
              className={cn(
                "text-sm mt-1",
                isLive ? "text-emerald-300 font-semibold tabular-nums" : "text-muted-foreground",
              )}
            >
              {scoreline}
            </p>
          ) : null}
        </div>
        {(home?.color || away?.color) && (
          <div className="flex items-center gap-1 shrink-0 pt-1">
            {home?.color ? (
              <span className="h-6 w-1.5 rounded-full" style={{ backgroundColor: home.color }} />
            ) : null}
            {away?.color ? (
              <span className="h-6 w-1.5 rounded-full" style={{ backgroundColor: away.color }} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Link href={cricketFanMatchPath(tournamentId, match.id)} className="block">
      {body}
    </Link>
  );
}
