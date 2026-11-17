import React from "react";
import { Link, useLocation } from "wouter";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { TournamentShell } from "../fan/tournament-shell";
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
  streamUrl,
}: {
  tournamentId: number;
  liveMatchId?: number | null;
  streamUrl?: string | null;
}) {
  const [location] = useLocation();

  return (
    <nav
      className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-0 sm:px-0 mb-6"
      aria-label="Tournament navigation"
    >
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))/85] backdrop-blur-md shadow-sm">
        {liveMatchId ? (
          <div className="flex items-center justify-between border-b border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Link
              href={cricketFanMatchPath(tournamentId, liveMatchId)}
              className="flex items-center gap-2 hover:underline transition-colors"
            >
              <CircleDot className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
              Live match in progress — watch now
            </Link>

            {streamUrl ? (
              <button
                type="button"
                onClick={() => window.open(streamUrl, "_blank", "noopener,noreferrer")}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-500 px-3 py-1 text-[11px] font-bold text-white transition-colors shadow-sm"
              >
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                Watch Stream
              </button>
            ) : null}
          </div>
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
  tournament,
  liveMatchId,
  streamUrl,
  hideNav = false,
  children,
}: {
  tournament: any;
  liveMatchId?: number | null;
  streamUrl?: string | null;
  hideNav?: boolean;
  children: React.ReactNode;
}) {
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  return (
    <TournamentShell
      tournament={tournament}
      soundEnabled={soundEnabled}
      onToggleSound={() => setSoundEnabled(!soundEnabled)}
      moduleNav={!hideNav && <CricketFanNav tournamentId={tournament.id} liveMatchId={liveMatchId} streamUrl={streamUrl} />}
    >
      {children}
    </TournamentShell>
  );
}

export function CricketFanLoading({ tournamentId }: { tournamentId: number }) {
  return <div className="p-10 text-center">Loading Arena...</div>;
}

export function CricketFanEmpty({ message }: { message: string }) {
  return <div className="p-10 text-center text-muted-foreground">{message}</div>;
}
