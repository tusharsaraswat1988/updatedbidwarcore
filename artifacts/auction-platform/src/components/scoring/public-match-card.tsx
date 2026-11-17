import { Link } from "wouter";
import { CircleDot, Video, ExternalLink } from "lucide-react";
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
  if (status === "live") return "text-[hsl(var(--live))]";
  if (isTerminalCricketMatchStatus(status)) return "text-[hsl(var(--completed))]";
  return "text-[hsl(var(--upcoming))]";
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
          ? "border-[hsl(var(--live))/40] bg-[hsl(var(--live))/15] hover:bg-[hsl(var(--live))/20] shadow-sm"
          : "hover:border-[hsl(var(--primary))/30] hover:bg-[hsl(var(--card))]/80",
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

          {match.streamUrl && !isTerminalCricketMatchStatus(match.status) && match.status !== "completed" ? (
            <div className="pt-2 flex items-center">
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[hsl(var(--destructive))/15] hover:bg-[hsl(var(--destructive))/25] text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))/30] transition-colors shadow-sm"
              >
                {isLive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--destructive))] animate-pulse motion-reduce:animate-none" />
                ) : (
                  <Video className="w-3 h-3 text-[hsl(var(--destructive))]" />
                )}
                <span>Watch Match Stream</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>
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
