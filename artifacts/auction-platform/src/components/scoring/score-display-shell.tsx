import { useMemo } from "react";
import {
  useGetTournament,
  useListTeams,
  getGetTournamentQueryKey,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { FullscreenLayout } from "@/components/layout";
import { useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import { getActiveInnings, oversText, requiredRate, runRate } from "@/lib/scoring-ball";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

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
    <span className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-semibold uppercase">
      <RefreshCw className="w-4 h-4 animate-spin" /> Syncing
    </span>
  );
}

export function ScoreDisplayShell({ tournamentId }: { tournamentId: number }) {
  const { connectionStatus } = useScoringSocket(tournamentId);
  const { data: live } = useScoringLive(tournamentId);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const match = live?.match;
  const state = live?.state;
  const summary = live?.summary;
  const innings = state ? getActiveInnings(state) : null;

  const home = teams?.find((t) => t.id === match?.homeTeamId);
  const away = teams?.find((t) => t.id === match?.awayTeamId);
  const battingTeam = teams?.find((t) => t.id === innings?.battingTeamId);
  const bowlingTeam = teams?.find((t) => t.id === innings?.bowlingTeamId);

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
      const bat = teams?.find((t) => t.id === inn.battingTeamId);
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
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Live Score</p>
            <h1 className="text-xl font-display font-bold truncate">{tournament?.name}</h1>
          </div>
          <ConnectionBadge status={connectionStatus} />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
          {isIdle ? (
            <div className="text-center space-y-3">
              <p className="text-4xl font-display font-black text-white/30">—</p>
              <p className="text-lg text-white/60">Waiting for match to start</p>
              <p className="text-sm text-white/40">Open the scorer on your phone to begin</p>
            </div>
          ) : isComplete && summary ? (
            <div className="w-full max-w-2xl space-y-6">
              <p className="text-center text-sm uppercase tracking-widest text-amber-300/80">
                Match Complete
              </p>
              <MatchSummaryCard summary={summary} teams={teams ?? []} />
            </div>
          ) : (
            <div className="w-full max-w-4xl space-y-8">
              <div className="text-center space-y-2">
                <p className="text-sm uppercase tracking-widest text-white/50">
                  {home?.shortCode} vs {away?.shortCode}
                  {state?.target ? ` · Target ${state.target}` : ""}
                </p>
                <p className="text-7xl sm:text-8xl font-display font-black tabular-nums tracking-tight">
                  {innings?.runs ?? 0}
                  <span className="text-white/50">/</span>
                  {innings?.wickets ?? 0}
                </p>
                <p className="text-2xl font-mono text-white/70">
                  ({innings ? oversText(innings.over, innings.ball) : "0.0"})
                  {rr ? ` · RR ${rr}` : ""}
                  {rrr ? ` · RRR ${rrr}` : ""}
                </p>
                <p className="text-base text-white/60">
                  {battingTeam?.name} bat · {bowlingTeam?.name} bowl
                </p>
              </div>

              {scoreLines.length > 1 ? (
                <div className="flex justify-center gap-4 flex-wrap">
                  {scoreLines.map((line) => (
                    <div
                      key={line.key}
                      className={`rounded-xl px-5 py-3 text-center border ${
                        line.isCurrent
                          ? "border-primary/50 bg-primary/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <p className="text-xs uppercase text-white/50">{line.label}</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {line.score}
                        <span className="text-sm text-white/50 ml-1">({line.overs})</span>
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
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-bold border border-white/20"
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </main>

        <footer className="px-6 py-3 border-t border-white/10 text-center text-xs text-white/30">
          BidWar Cricket Scorer
        </footer>
      </div>
    </FullscreenLayout>
  );
}
