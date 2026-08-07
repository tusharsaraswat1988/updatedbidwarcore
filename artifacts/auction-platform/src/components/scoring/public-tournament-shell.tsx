import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CricketPublicShell,
} from "@/components/scoring/cricket-page-chrome";
import {
  cricketFanHomePath,
  cricketFanMatchesPath,
  cricketFanStandingsPath,
  cricketFanTeamsPath,
  cricketFanPlayersPath,
  cricketFanStatisticsPath,
  cricketFanSponsorsPath,
  cricketFanMatchPath,
} from "@/lib/tournament-navigation";

const NAV_ITEMS = [
  { key: "home", label: "Tournament", path: cricketFanHomePath },
  { key: "matches", label: "Matches", path: cricketFanMatchesPath },
  { key: "standings", label: "Standings", path: cricketFanStandingsPath },
  { key: "teams", label: "Teams", path: cricketFanTeamsPath },
  { key: "players", label: "Players", path: cricketFanPlayersPath },
  { key: "statistics", label: "Statistics", path: cricketFanStatisticsPath },
  { key: "sponsors", label: "Sponsors", path: cricketFanSponsorsPath },
] as const;

function navActive(location: string, tournamentId: number, key: (typeof NAV_ITEMS)[number]["key"]) {
  const home = cricketFanHomePath(tournamentId);
  if (key === "home") {
    return location === home || location === `${home}/`;
  }
  const prefix = NAV_ITEMS.find((n) => n.key === key)!.path(tournamentId);
  return location === prefix || location.startsWith(`${prefix}/`);
}

export function CricketFanNav({
  tournamentId,
  liveMatchId,
}: {
  tournamentId: number;
  liveMatchId?: number | null;
}) {
  const [location] = useLocation();

  return (
    <nav
      className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-0 sm:px-0 mb-6"
      aria-label="Tournament navigation"
    >
      <div className="rounded-xl border border-border/80 bg-card/85 backdrop-blur-md shadow-sm">
        {liveMatchId ? (
          <Link
            href={cricketFanMatchPath(tournamentId, liveMatchId)}
            className="flex items-center gap-2 border-b border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/15 transition-colors"
          >
            <CircleDot className="h-3.5 w-3.5 animate-pulse" />
            Live match in progress — watch now
          </Link>
        ) : null}
        <div
          className="flex items-center gap-1 overflow-x-auto px-2 py-2 scrollbar-none"
          role="tablist"
        >
          {NAV_ITEMS.map((item) => {
            const active = navActive(location, tournamentId, item.key);
            return (
              <Link
                key={item.key}
                href={item.path(tournamentId)}
                role="tab"
                aria-selected={active}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border",
                  active
                    ? "bg-primary/15 text-primary border-primary/35"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function CricketFanExperienceShell({
  tournamentId,
  liveMatchId,
  children,
  maxWidth = "max-w-5xl",
}: {
  tournamentId: number;
  liveMatchId?: number | null;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <CricketPublicShell maxWidth={maxWidth} className="public-tournament-experience">
      <CricketFanNav tournamentId={tournamentId} liveMatchId={liveMatchId} />
      {children}
    </CricketPublicShell>
  );
}

export function CricketFanLoading({ tournamentId }: { tournamentId: number }) {
  return (
    <CricketFanExperienceShell tournamentId={tournamentId}>
      <div className="space-y-4">
        <div className="h-10 w-56 rounded-md bg-muted animate-pulse" />
        <div className="h-40 w-full rounded-xl bg-muted animate-pulse" />
        <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
        <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
      </div>
    </CricketFanExperienceShell>
  );
}

export function CricketFanEmpty({
  tournamentId,
  message,
}: {
  tournamentId: number;
  message: string;
}) {
  return (
    <CricketFanExperienceShell tournamentId={tournamentId}>
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-muted-foreground text-center">
        <p>{message}</p>
      </div>
    </CricketFanExperienceShell>
  );
}
