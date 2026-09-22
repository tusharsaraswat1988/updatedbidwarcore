/**
 * Stadium Ground LED Mid-Screen Overlays — Dedicated high-contrast presentation renderer
 * for stadium LED screens, scoreboards, and projectors (/tournament/:id/score-display).
 *
 * Responds to canonical broadcast state:
 * - none: returns null (renders regular live cricket scoreboard arena)
 * - sponsors: Full Sponsor Showcase Wall
 * - standings: Points Table & Standings
 * - fixtures: Upcoming Matches & Tournament Schedule
 * - scorecard: Full Match Scorecard (Innings Batting & Bowling figures)
 * - summary: Post-Match Summary & Top Performers
 * - intro: Match Intro / VS Presentation
 */

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  getScoringStandings,
  listScoringMatches,
  getPublicMatchScorecard,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import type { CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import type { CricketScorerPlayer, CricketScorerTeam } from "@/lib/scoring-squad";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type {
  CricketMatchSummary,
  CricketScoreboardState,
} from "@workspace/scoring-core";
import { getActiveInnings, oversText } from "@/lib/scoring-ball";
import {
  Trophy,
  Award,
  Calendar,
  BarChart3,
  FileText,
  Sparkles,
  Swords,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CricketLedMidOverlaysProps = {
  overlay: CricketObsMidOverlayKind;
  tournamentId: number;
  tournamentName?: string;
  tournamentLogoUrl?: string | null;
  match?: ScoringMatchJson | null;
  state?: CricketScoreboardState | null;
  summary?: CricketMatchSummary | null;
  teams?: CricketScorerTeam[];
  players?: CricketScorerPlayer[];
  sponsors?: SponsorLogo[];
  onClose?: () => void;
};

export function CricketLedMidOverlays({
  overlay,
  tournamentId,
  tournamentName,
  tournamentLogoUrl,
  match,
  state,
  summary,
  teams = [],
  players = [],
  sponsors = [],
  onClose,
}: CricketLedMidOverlaysProps) {
  // Standings data query
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: overlay === "standings" && tournamentId > 0,
    staleTime: 30_000,
  });

  // Matches/Fixtures data query
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: (overlay === "fixtures" || overlay === "intro") && tournamentId > 0,
    staleTime: 30_000,
  });

  // Scorecard data query
  const { data: fullScorecard } = useQuery({
    queryKey: ["scoring-scorecard", tournamentId, match?.id],
    queryFn: () => getPublicMatchScorecard(tournamentId, match!.id),
    enabled: overlay === "scorecard" && !!tournamentId && !!match?.id,
    staleTime: 5000,
  });

  if (overlay === "none") return null;

  const homeTeam = teams.find((t) => t.id === match?.homeTeamId);
  const awayTeam = teams.find((t) => t.id === match?.awayTeamId);
  const innings = state ? getActiveInnings(state) : null;
  const battingTeam = teams.find((t) => t.id === innings?.battingTeamId) || homeTeam;
  const bowlingTeam = teams.find((t) => t.id === innings?.bowlingTeamId) || awayTeam;
  const strikerPlayer = players.find((p) => p.id === state?.strikerId);
  const nonStrikerPlayer = players.find((p) => p.id === state?.nonStrikerId);
  const bowlerPlayer = players.find((p) => p.id === state?.bowlerId);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 md:p-12 pointer-events-auto select-none bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="relative flex h-[88vh] w-[92vw] max-w-[1700px] flex-col overflow-hidden rounded-3xl border-2 border-amber-500/30 bg-[#07090e]/95 shadow-[0_30px_90px_rgba(0,0,0,0.95)]"
          style={{
            fontFamily: "'Barlow Condensed', 'Space Grotesk', system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Top LED Header Bar */}
          <div className="flex h-16 sm:h-20 items-center justify-between px-6 sm:px-10 border-b border-border/80 bg-gradient-to-r from-card/90 via-card/70 to-card/90 backdrop-blur-md">
            <div className="flex items-center gap-4 min-w-0">
              {tournamentLogoUrl ? (
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-card border border-border p-1 flex items-center justify-center overflow-hidden shrink-0 shadow">
                  <img src={tournamentLogoUrl} alt="" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-black tracking-widest text-amber-400 uppercase">
                    BIDWAR STADIUM LED
                  </span>
                  <span className="text-white/30 text-xs">/</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-black uppercase tracking-wider text-primary">
                    {overlay.toUpperCase()}
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-black tracking-wide text-white uppercase truncate">
                  {tournamentName || "LIVE CRICKET TOURNAMENT"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-widest animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                LIVE SCREEN MODE
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black text-white/80 hover:bg-white/20 hover:text-white transition"
                >
                  ✕ RESUME SCOREBOARD
                </button>
              )}
            </div>
          </div>

          {/* LED Main Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col justify-center">
            {/* 1. SPONSOR SHOWCASE (LED Optimized) */}
            {overlay === "sponsors" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-widest mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Official Tournament Partners &amp; Sponsors
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-wider text-white uppercase">
                    OUR VALUED PARTNERS
                  </h2>
                </div>

                {sponsors && sponsors.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 my-auto">
                    {sponsors.map((sp, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-gradient-to-b from-card/90 via-card/70 to-card/50 p-6 shadow-2xl backdrop-blur-md transition hover:scale-[1.02]"
                      >
                        <span className="rounded-full bg-amber-400/20 px-3 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-300 mb-4 border border-amber-400/30">
                          {sp.priorityType || sp.type || (sp.isTitleSponsor ? "Title Sponsor" : sp.isCoSponsor ? "Co Sponsor" : "Official Partner")}
                        </span>
                        {sp.url ? (
                          <div className="h-24 w-full flex items-center justify-center p-2 rounded-xl bg-black/40 border border-white/10">
                            <img
                              src={sp.url}
                              alt={sp.name || "Sponsor"}
                              className="max-h-full max-w-full object-contain filter drop-shadow"
                            />
                          </div>
                        ) : (
                          <div className="h-20 w-20 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                            <Award className="w-10 h-10 text-primary" />
                          </div>
                        )}
                        <h3 className="mt-4 text-base sm:text-lg font-black uppercase tracking-wider text-white text-center">
                          {sp.name || "Tournament Partner"}
                        </h3>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="my-auto flex flex-col items-center justify-center text-center p-12 rounded-3xl bg-card/40 border border-border/60">
                    <Award className="w-20 h-20 text-amber-400/80 mb-4 animate-bounce" />
                    <h3 className="text-3xl font-black text-amber-400 uppercase tracking-wide">
                      BIDWAR ARENA BROADCAST
                    </h3>
                    <p className="text-base text-muted-foreground mt-2 max-w-lg">
                      Official Tournament Live Stadium Presentation Powered by BidWar Sports Platform
                    </p>
                  </div>
                )}

                <div className="text-center pt-4 border-t border-border/50 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Stadium Ground Scoreboard Broadcast
                </div>
              </div>
            )}

            {/* 2. POINTS TABLE / STANDINGS (LED Optimized) */}
            {overlay === "standings" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-black uppercase tracking-widest mb-2">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" />
                    Official Tournament Standings
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-wider text-white uppercase">
                    POINTS TABLE &amp; RANKINGS
                  </h2>
                </div>

                <div className="flex-1 overflow-x-auto rounded-2xl border-2 border-border/80 bg-card/85 shadow-2xl backdrop-blur-md">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/60 text-xs sm:text-sm font-black tracking-widest text-muted-foreground uppercase">
                        <th className="py-4 px-6 text-center">POS</th>
                        <th className="py-4 px-6">TEAM</th>
                        <th className="py-4 px-5 text-center">PLAYED</th>
                        <th className="py-4 px-5 text-center text-emerald-400">WON</th>
                        <th className="py-4 px-5 text-center text-red-400">LOST</th>
                        <th className="py-4 px-5 text-center text-cyan-300">NRR</th>
                        <th className="py-4 px-8 text-right text-amber-400 font-extrabold">POINTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-base sm:text-lg font-bold">
                      {standings && standings.length > 0 ? (
                        standings.map((row, idx) => (
                          <tr
                            key={row.teamId}
                            className={cn(
                              "transition hover:bg-white/5",
                              idx < 4 ? "bg-amber-500/10 font-black" : "",
                            )}
                          >
                            <td className="py-4 px-6 text-center">
                              <span
                                className={cn(
                                  "inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black shadow-md",
                                  idx < 4
                                    ? "bg-amber-400 text-black border border-yellow-200"
                                    : "bg-muted text-muted-foreground border border-border",
                                )}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                {row.teamLogoUrl ? (
                                  <img
                                    src={row.teamLogoUrl}
                                    alt=""
                                    className="h-9 w-9 object-contain shrink-0"
                                  />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-black text-primary uppercase">
                                      {row.shortCode || "TM"}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span className="font-black text-white text-lg sm:text-xl uppercase">
                                    {row.teamName}
                                  </span>
                                  <span className="ml-2 text-xs text-muted-foreground uppercase font-bold">
                                    ({row.shortCode})
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5 text-center tabular-nums text-white/90 font-mono">
                              {row.played}
                            </td>
                            <td className="py-4 px-5 text-center tabular-nums text-emerald-400 font-mono">
                              {row.won}
                            </td>
                            <td className="py-4 px-5 text-center tabular-nums text-red-400 font-mono">
                              {row.lost}
                            </td>
                            <td className="py-4 px-5 text-center tabular-nums font-mono font-black text-cyan-300">
                              {row.netRunRate != null
                                ? row.netRunRate > 0
                                  ? `+${row.netRunRate.toFixed(3)}`
                                  : row.netRunRate.toFixed(3)
                                : "0.000"}
                            </td>
                            <td className="py-4 px-8 text-right font-mono font-black text-2xl sm:text-3xl tabular-nums text-amber-400">
                              {row.points}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-muted-foreground text-lg">
                            No tournament standings currently calculated.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. UPCOMING MATCHES / FIXTURES (LED Optimized) */}
            {overlay === "fixtures" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-widest mb-2">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    Tournament Fixture Schedule
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-wider text-white uppercase">
                    UPCOMING MATCHES
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                  {matches && matches.filter((m) => m.status !== "completed").length > 0 ? (
                    matches
                      .filter((m) => m.status !== "completed")
                      .slice(0, 4)
                      .map((m) => (
                        <div
                          key={m.id}
                          className="flex flex-col items-center rounded-3xl border-2 border-border/80 bg-gradient-to-b from-card/95 via-card/80 to-card/60 p-6 shadow-2xl backdrop-blur-md"
                        >
                          <div className="flex w-full items-center justify-between text-xs sm:text-sm font-black text-amber-400 uppercase tracking-widest pb-3 border-b border-border/60">
                            <span>{m.roundName || `MATCH #${m.id}`}</span>
                            <span className="text-muted-foreground">{m.venue || "MAIN GROUND"}</span>
                          </div>

                          <div className="flex w-full items-center justify-around py-6">
                            {/* Home Team */}
                            <div className="flex flex-col items-center gap-2 max-w-[140px] text-center">
                              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-amber-400/60 bg-black/60 shadow-lg">
                                <span className="text-xl font-black text-amber-400">
                                  {m.homeTeam?.shortCode || "H"}
                                </span>
                              </div>
                              <span className="text-base font-black text-white uppercase truncate w-full">
                                {m.homeTeam?.name || "Home Team"}
                              </span>
                            </div>

                            <span className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-amber-400 drop-shadow">
                              VS
                            </span>

                            {/* Away Team */}
                            <div className="flex flex-col items-center gap-2 max-w-[140px] text-center">
                              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-cyan-400/60 bg-black/60 shadow-lg">
                                <span className="text-xl font-black text-cyan-400">
                                  {m.awayTeam?.shortCode || "A"}
                                </span>
                              </div>
                              <span className="text-base font-black text-white uppercase truncate w-full">
                                {m.awayTeam?.name || "Away Team"}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-full bg-primary/20 border border-primary/40 px-5 py-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-primary">
                            {m.scheduledAt
                              ? new Date(m.scheduledAt).toLocaleString([], {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "SCHEDULED"}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="col-span-2 text-center py-16 text-muted-foreground text-lg">
                      No upcoming fixtures scheduled.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. FULL SCORECARD (LED Optimized) */}
            {overlay === "scorecard" && (
              <div className="flex h-full flex-col max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between border-b-2 border-border pb-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-400 bg-black/80 shadow">
                      <span className="text-2xl font-black text-amber-400">
                        {battingTeam?.shortCode || "BAT"}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                          MATCH INNINGS SCORECARD
                        </span>
                        <span className="text-white/40">/</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase">
                          {tournamentName}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-black tracking-wide text-white uppercase">
                        {battingTeam?.name || "BATTING INNINGS"}
                      </h2>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-4xl sm:text-6xl font-black font-mono tabular-nums text-white">
                      {innings?.runs ?? 0}
                      <span className="text-primary mx-1">/</span>
                      {innings?.wickets ?? 0}
                    </div>
                    <p className="text-sm sm:text-base font-bold text-amber-400 uppercase tracking-wider font-mono">
                      {innings ? oversText(innings.over, innings.ball) : "0.0"} OVERS
                    </p>
                  </div>
                </div>

                {/* Scorecard Table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                  {/* Active Batter Figures */}
                  <div className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-xl backdrop-blur-md">
                    <span className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5 mb-3">
                      🏏 Key Batsmen Figures
                    </span>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-border/60">
                        <div>
                          <p className="text-lg font-black text-white uppercase">
                            {strikerPlayer?.name || "Striker Batter"} *
                          </p>
                          <span className="text-xs text-emerald-400 font-bold uppercase">(On Strike)</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-2xl font-black text-amber-400">
                            {fullScorecard?.innings1?.batting?.find((b) => b.playerId === state?.strikerId)?.runs ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({fullScorecard?.innings1?.batting?.find((b) => b.playerId === state?.strikerId)?.ballsFaced ?? 0}b)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-border/60">
                        <div>
                          <p className="text-base font-bold text-white/90 uppercase">
                            {nonStrikerPlayer?.name || "Non-Striker"}
                          </p>
                          <span className="text-xs text-muted-foreground font-bold uppercase">(Non-Striker)</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-xl font-bold text-white">
                            {fullScorecard?.innings1?.batting?.find((b) => b.playerId === state?.nonStrikerId)?.runs ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({fullScorecard?.innings1?.batting?.find((b) => b.playerId === state?.nonStrikerId)?.ballsFaced ?? 0}b)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Bowler Figures */}
                  <div className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-xl backdrop-blur-md">
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-3">
                      🎯 Current Bowling Attack
                    </span>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-border/60">
                        <div>
                          <p className="text-lg font-black text-white uppercase">
                            {bowlerPlayer?.name || "Active Bowler"} *
                          </p>
                          <span className="text-xs text-amber-300 font-bold uppercase">
                            {bowlerPlayer?.role || "Pace / Spin"}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-2xl font-black text-amber-400">
                            {fullScorecard?.innings1?.bowling?.find((b) => b.playerId === state?.bowlerId)?.wickets ?? 0}
                            <span className="text-white/60 text-lg">/</span>
                            {fullScorecard?.innings1?.bowling?.find((b) => b.playerId === state?.bowlerId)?.runsConceded ?? 0}
                          </span>
                          <p className="text-xs text-cyan-300">
                            Econ: {fullScorecard?.innings1?.bowling?.find((b) => b.playerId === state?.bowlerId)?.economy?.toFixed(2) ?? "—"}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-black/20 border border-border/40 flex items-center justify-between text-xs font-black uppercase text-muted-foreground">
                        <span>Bowling Team: {bowlingTeam?.name}</span>
                        <span>Overs Limit: {state?.oversLimit ?? 20} Ov</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scorecard Bottom Summary Strip */}
                <div className="mt-4 flex items-center justify-between rounded-2xl border-2 border-primary/40 bg-primary/10 px-8 py-3.5 text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  <div>
                    <span className="text-primary">TARGET: </span>
                    <span className="font-mono text-xl">{state?.target ?? "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-primary">TOTAL SCORE: </span>
                    <span className="font-mono text-2xl text-amber-400">
                      {innings?.runs ?? 0}/{innings?.wickets ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MATCH SUMMARY (LED Optimized) */}
            {overlay === "summary" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest mb-1">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    OFFICIAL MATCH SUMMARY
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-wider text-white uppercase">
                    MATCH RESULT &amp; HIGHLIGHTS
                  </h2>
                </div>

                {/* 2 Inning Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                  {/* Home Team Card */}
                  <div className="rounded-3xl border-2 border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                      <h3 className="text-2xl font-black text-white uppercase">
                        {homeTeam?.name || "HOME TEAM"}
                      </h3>
                      <span className="text-3xl font-black font-mono text-amber-400">
                        {summary?.homeTeam?.score || `${innings?.runs ?? 0}/${innings?.wickets ?? 0}`}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm font-bold">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground uppercase">Top Batter:</span>
                        <span className="text-white font-black">
                          {strikerPlayer?.name || "Striker"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground uppercase">Overs:</span>
                        <span className="text-white font-mono">
                          {summary?.homeTeam?.overs || (innings ? oversText(innings.over, innings.ball) : "20.0")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Away Team Card */}
                  <div className="rounded-3xl border-2 border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                      <h3 className="text-2xl font-black text-white uppercase">
                        {awayTeam?.name || "AWAY TEAM"}
                      </h3>
                      <span className="text-3xl font-black font-mono text-cyan-300">
                        {summary?.awayTeam?.score || (state?.target ? `${state.target - 1}` : "—")}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm font-bold">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground uppercase">Top Bowler:</span>
                        <span className="text-white font-black">
                          {bowlerPlayer?.name || "Bowler"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground uppercase">Overs:</span>
                        <span className="text-white font-mono">
                          {summary?.awayTeam?.overs || `${state?.oversLimit ?? 20}.0`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Champion Result Banner */}
                <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-amber-600/30 p-5 text-center shadow-xl">
                  <p className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-amber-300">
                    {state?.resultText || match?.resultSummary || summary?.resultText || "MATCH IN PROGRESS"}
                  </p>
                </div>
              </div>
            )}

            {/* 6. MATCH INTRO / VS (LED Optimized) */}
            {overlay === "intro" && (
              <div className="flex h-full flex-col justify-between max-w-6xl mx-auto w-full py-4">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs sm:text-sm font-black uppercase tracking-widest mb-1">
                    <Swords className="w-4 h-4 text-primary" />
                    MATCH CLASH &amp; PRESENTATION
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-wider text-white uppercase">
                    {homeTeam?.name || "TEAM 1"} <span className="text-amber-400 italic">VS</span> {awayTeam?.name || "TEAM 2"}
                  </h2>
                </div>

                {/* Big 3D Badges */}
                <div className="flex items-center justify-center gap-12 sm:gap-24 my-auto">
                  {/* Home Team Badge */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-3xl border-4 border-amber-400 bg-gradient-to-b from-card to-black shadow-[0_0_50px_rgba(251,191,36,0.35)]">
                      {homeTeam?.logoUrl ? (
                        <img src={homeTeam.logoUrl} alt="" className="h-28 w-28 object-contain" />
                      ) : (
                        <span className="text-5xl font-black text-amber-400">
                          {homeTeam?.shortCode || "H"}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-white uppercase text-center max-w-[200px]">
                      {homeTeam?.name || "Home Team"}
                    </span>
                  </div>

                  <span className="text-6xl sm:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-amber-400 drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
                    VS
                  </span>

                  {/* Away Team Badge */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-3xl border-4 border-cyan-400 bg-gradient-to-b from-card to-black shadow-[0_0_50px_rgba(34,211,238,0.35)]">
                      {awayTeam?.logoUrl ? (
                        <img src={awayTeam.logoUrl} alt="" className="h-28 w-28 object-contain" />
                      ) : (
                        <span className="text-5xl font-black text-cyan-400">
                          {awayTeam?.shortCode || "A"}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-white uppercase text-center max-w-[200px]">
                      {awayTeam?.name || "Away Team"}
                    </span>
                  </div>
                </div>

                {/* Match Venue / Round Strip */}
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/70 py-4 px-8 text-center shadow-xl">
                  <p className="text-sm sm:text-base font-black uppercase tracking-widest text-emerald-300">
                    LIVE FROM {match?.venue || "MAIN CRICKET GROUND"} · {match?.roundName || "LEAGUE MATCH"}
                  </p>
                  {state?.tossText && (
                    <p className="mt-1 text-base sm:text-lg font-bold text-white tracking-wider">
                      🪙 {state.tossText}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
