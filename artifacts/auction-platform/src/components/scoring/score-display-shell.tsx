import { useMemo } from "react";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import { getActiveInnings, oversText, requiredRate, runRate } from "@/lib/scoring-ball";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { CricketPublicBrandMark, useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import { getCricketMasterTeams } from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function ConnectionBadge({ status }: { status: "connected" | "reconnecting" | "disconnected" }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-400 text-xs font-semibold uppercase">
        <Wifi className="w-4 h-4" /> Live
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-400 text-xs font-semibold uppercase">
        <WifiOff className="w-4 h-4" /> Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-primary text-xs font-semibold uppercase">
      <RefreshCw className="w-4 h-4 animate-spin" /> Syncing
    </span>
  );
}

export function ScoreDisplayShell({ tournamentId }: { tournamentId: number }) {
  const { shellStyle } = useCricketBidWarTheme();
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { connectionStatus } = useScoringSocket(tournamentId, scoringActive);
  const { data: live } = useScoringLive(tournamentId, scoringActive, connectionStatus);
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: !!tournamentId,
  });
  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );

  const match = live?.match;
  const state = live?.state;
  const summary = live?.summary;
  const innings = state ? getActiveInnings(state) : null;

  const home = teams.find((t) => t.id === match?.homeTeamId);
  const away = teams.find((t) => t.id === match?.awayTeamId);
  const battingTeam = teams.find((t) => t.id === innings?.battingTeamId);
  const bowlingTeam = teams.find((t) => t.id === innings?.bowlingTeamId);

  const rr = innings ? runRate(innings.runs, innings.over, innings.ball) : null;
  const rrr =
    state && innings && state.target
      ? requiredRate(state.target, innings.runs, state.oversLimit, innings.over, innings.ball)
      : null;

  const isComplete = state?.matchStatus === "completed" || state?.matchStatus === "abandoned";
  const isIdle = !match || !state || state.matchStatus === "scheduled";

  const scoreLines = useMemo(() => {
    if (!state || !summary) return [];
    return summary.innings.map((inn) => {
      const bat = teams.find((t) => t.id === inn.battingTeamId);
      return {
        key: inn.innings,
        label: bat?.shortCode ?? `T${inn.battingTeamId}`,
        score: `${inn.runs}/${inn.wickets}`,
        overs: inn.overs,
        isCurrent: inn.innings === state.currentInnings && !isComplete,
      };
    });
  }, [state, summary, teams, isComplete]);

  return (
    <FullscreenLayout>
      <div
        className="min-h-screen bg-background text-foreground flex flex-col relative dark"
        style={shellStyle}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/25 via-background to-background pointer-events-none" />
        <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="min-w-0 flex items-center gap-4">
            <CricketPublicBrandMark variant="scorer-header" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold">Live Score</p>
              <h1 className="text-xl font-display font-bold truncate">{tournament?.name}</h1>
            </div>
          </div>
          <ConnectionBadge status={connectionStatus} />
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
          {isIdle ? (
            <div className="text-center space-y-3">
              <p className="text-4xl font-display font-black text-muted-foreground/40">—</p>
              <p className="text-lg text-muted-foreground">Waiting for match to start</p>
              <p className="text-sm text-muted-foreground/80">Open the scorer on your phone to begin</p>
            </div>
          ) : isComplete && summary ? (
            <div className="w-full max-w-2xl space-y-6">
              <p className="text-center text-sm uppercase tracking-widest text-primary font-bold">
                Match Complete
              </p>
              <MatchSummaryCard summary={summary} teams={teams} />
            </div>
          ) : (
            <div className="w-full max-w-4xl space-y-8">
              <div className="text-center space-y-2">
                <p className="text-sm uppercase tracking-widest text-muted-foreground">
                  {home?.shortCode} vs {away?.shortCode}
                  {state?.target ? ` · Target ${state.target}` : ""}
                </p>
                <p className="text-7xl sm:text-8xl font-display font-black tabular-nums tracking-tight text-primary">
                  {innings?.runs ?? 0}
                  <span className="text-muted-foreground">/</span>
                  {innings?.wickets ?? 0}
                </p>
                <p className="text-2xl font-mono text-muted-foreground">
                  ({innings ? oversText(innings.over, innings.ball) : "0.0"})
                  {rr ? ` · RR ${rr}` : ""}
                  {rrr ? ` · RRR ${rrr}` : ""}
                </p>
                <p className="text-base text-muted-foreground">
                  {battingTeam?.name} bat · {bowlingTeam?.name} bowl
                </p>
              </div>

              {scoreLines.length > 1 ? (
                <div className="flex justify-center gap-4 flex-wrap">
                  {scoreLines.map((line) => (
                    <div
                      key={line.key}
                      className={cn(
                        "rounded-xl px-5 py-3 text-center border",
                        line.isCurrent
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-card",
                      )}
                    >
                      <p className="text-xs uppercase text-muted-foreground">{line.label}</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {line.score}
                        <span className="text-sm text-muted-foreground ml-1">({line.overs})</span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {state && state.thisOver.length > 0 ? (
                <div className="flex justify-center flex-wrap gap-2">
                  {state.thisOver.map((b, i) => (
                    <span
                      key={`${b.over}-${b.ball}-${i}`}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-card text-lg font-bold border border-border"
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </main>

        <footer className="relative z-10 px-6 py-3 border-t border-border flex justify-center">
          <CricketPublicBrandMark variant="footer" />
        </footer>
      </div>
    </FullscreenLayout>
  );
}
