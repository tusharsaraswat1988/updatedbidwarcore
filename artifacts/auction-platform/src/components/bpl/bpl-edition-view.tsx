import { useMemo } from "react";
import { Link } from "wouter";
import {
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Play,
  Radio,
  Sparkles,
  Trophy,
  Tv,
  Users,
  Flame,
  Shield,
  ArrowRight,
  Info,
  Medal,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  BplEdition,
  BplEditionSponsor,
  BplPublicMatch,
  BplPublicTeam,
  BplPublicStanding,
  BplSponsorCategory,
} from "@/lib/bpl-api";

interface BplEditionViewProps {
  edition: BplEdition;
  allEditions?: BplEdition[];
  isSpecificEditionRoute?: boolean;
}

export function BplEditionView({
  edition,
  allEditions = [],
  isSpecificEditionRoute = false,
}: BplEditionViewProps) {
  const isLive = edition.status === "LIVE";
  const isUpcoming = edition.status === "UPCOMING";
  const isCompleted = edition.status === "COMPLETED";

  // Group sponsors by category hierarchy
  const sponsorsByCategory = useMemo(() => {
    const sponsors = edition.sponsors || [];
    const title = sponsors.filter((s) => s.category === "TITLE");
    const poweredBy = sponsors.filter((s) => s.category === "POWERED_BY");
    const associates = sponsors.filter(
      (s) => s.category === "ASSOCIATE" || s.category === "PARTNER",
    );
    const media = sponsors.filter((s) => s.category === "MEDIA_PARTNER");

    return { title, poweredBy, associates, media, total: sponsors.length };
  }, [edition.sponsors]);

  // Other editions for edition navigation
  const otherEditions = useMemo(() => {
    return allEditions.filter((e) => e.id !== edition.id);
  }, [allEditions, edition.id]);

  // Formatted date string
  const formattedDates = useMemo(() => {
    if (!edition.startDate) return "Dates TBA";
    if (edition.startDate === edition.endDate || !edition.endDate) {
      return edition.startDate;
    }
    return `${edition.startDate} – ${edition.endDate}`;
  }, [edition.startDate, edition.endDate]);

  const hasStreamUrl = Boolean(
    edition.liveStreamUrl && /^https?:\/\/.+/i.test(edition.liveStreamUrl),
  );
  const hasFanPageUrl = Boolean(
    edition.fanPageUrl && /^https?:\/\/.+/i.test(edition.fanPageUrl),
  );

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ─────────────────────────────────────────────────────────────────
          1. BPL HERO (P1.1, P1.2)
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-orange-500/20 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-6 sm:p-10 md:p-14 shadow-2xl">
        {/* Subtle decorative stadium glow & ambient gradients */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-600/15 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/10 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
          {/* Eyebrow & Status Indicator */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-orange-500/10 text-orange-400 border border-orange-500/25">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              BidWar Flagship Tournament Property
            </span>

            {/* Dynamic Status Badge */}
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                🔴 Live Now
              </span>
            ) : isUpcoming ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Upcoming Edition
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
                <Trophy className="w-3.5 h-3.5 text-blue-400" />
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wider uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                {edition.status}
              </span>
            )}
          </div>

          {/* Edition Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-md leading-tight">
            BidWar Premier League
          </h1>

          <div className="mt-3 inline-flex items-center gap-2 text-lg sm:text-2xl font-bold tracking-wide text-orange-400 font-mono">
            <span>Edition {String(edition.editionNumber).padStart(2, "0")}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 font-sans">{edition.year}</span>
          </div>

          {/* Date, Venue, City Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-300 font-medium">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
              <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
              <span>{formattedDates}</span>
            </span>

            {(edition.venue || edition.city) && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
                <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                <span>
                  {[edition.venue, edition.city].filter(Boolean).join(" · ")}
                </span>
              </span>
            )}

            {edition.linkedTournament?.sport && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 backdrop-blur-sm uppercase font-semibold text-xs tracking-wider text-slate-400">
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{edition.linkedTournament.sport}</span>
              </span>
            )}
          </div>

          {/* Description */}
          {edition.description && (
            <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
              {edition.description}
            </p>
          )}

          {/* Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {/* Watch Live Primary CTA */}
            {hasStreamUrl && !isCompleted && (
              <a
                href={edition.liveStreamUrl!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  className="gap-2 font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/25 px-6"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Watch Live Stream
                </Button>
              </a>
            )}

            {/* Fan / Details Page Secondary CTA */}
            {hasFanPageUrl && (
              <a
                href={edition.fanPageUrl!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 font-semibold border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
                >
                  <ExternalLink className="w-4 h-4 text-orange-400" />
                  BPL Fan Page
                </Button>
              </a>
            )}

            {/* Linked Tournament Destination CTA */}
            {edition.linkedTournament && (
              <Link href={`/tournaments/${edition.linkedTournament.id}`}>
                <Button
                  variant={!hasStreamUrl ? "default" : "secondary"}
                  size="lg"
                  className={cn(
                    "gap-2 font-semibold",
                    !hasStreamUrl && "bg-orange-600 hover:bg-orange-500 text-white",
                  )}
                >
                  <Trophy className="w-4 h-4" />
                  Tournament Details
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          2. LIVE / UPCOMING MATCH ACTIVITY (P1.4)
         ───────────────────────────────────────────────────────────────── */}
      {edition.liveMatch ? (
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                Live Match In Progress
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                {edition.liveMatch.roundName || edition.liveMatch.matchLabel || "Match Day Action"}
              </h2>
              {edition.liveMatch.venue && (
                <p className="text-xs text-slate-400 flex items-center justify-center md:justify-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {edition.liveMatch.venue}
                </p>
              )}
            </div>

            {/* Scoreboard Teams Matchup */}
            <div className="flex items-center gap-4 sm:gap-6 bg-slate-950/80 px-6 py-4 rounded-xl border border-slate-800">
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white shadow"
                  style={{
                    backgroundColor:
                      edition.liveMatch.homeTeam.color || "#ea580c",
                  }}
                >
                  {edition.liveMatch.homeTeam.shortCode || "T1"}
                </div>
                <span className="text-xs font-bold text-white mt-1 max-w-[90px] truncate text-center">
                  {edition.liveMatch.homeTeam.name}
                </span>
              </div>

              <div className="text-xs font-mono font-black text-slate-500 uppercase">
                VS
              </div>

              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white shadow"
                  style={{
                    backgroundColor:
                      edition.liveMatch.awayTeam.color || "#3b82f6",
                  }}
                >
                  {edition.liveMatch.awayTeam.shortCode || "T2"}
                </div>
                <span className="text-xs font-bold text-white mt-1 max-w-[90px] truncate text-center">
                  {edition.liveMatch.awayTeam.name}
                </span>
              </div>
            </div>

            {/* Action CTA */}
            <div>
              <Link href={edition.liveMatch.liveScoreRoute || `/score-display/${edition.linkedTournamentId}`}>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-lg shadow-emerald-600/25">
                  <Radio className="w-4 h-4 animate-pulse" />
                  Watch Live Score
                </Button>
              </Link>
            </div>
          </div>
        </section>
      ) : edition.nextMatch ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Next Scheduled Match
              </span>
              <h2 className="text-lg sm:text-xl font-black uppercase text-white">
                {edition.nextMatch.roundName || edition.nextMatch.matchLabel || "Upcoming Fixture"}
              </h2>
              {edition.nextMatch.scheduledAt && (
                <p className="text-xs text-slate-400 flex items-center justify-center md:justify-start gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {new Date(edition.nextMatch.scheduledAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 bg-slate-950/60 px-5 py-3 rounded-xl border border-slate-800">
              <span className="text-sm font-bold text-white">
                {edition.nextMatch.homeTeam.name}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">VS</span>
              <span className="text-sm font-bold text-white">
                {edition.nextMatch.awayTeam.name}
              </span>
            </div>

            {edition.linkedTournament && (
              <Link href={`/tournaments/${edition.linkedTournament.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5 border-slate-700 text-slate-300">
                  Tournament Schedule
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </section>
      ) : edition.recentMatch ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Recent Result
              </span>
              <h2 className="text-lg sm:text-xl font-black uppercase text-white">
                {edition.recentMatch.roundName || "Match Result"}
              </h2>
              {edition.recentMatch.resultSummary && (
                <p className="text-xs text-emerald-400 font-semibold">
                  {edition.recentMatch.resultSummary}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 bg-slate-950/60 px-5 py-3 rounded-xl border border-slate-800">
              <span className="text-sm font-bold text-white">
                {edition.recentMatch.homeTeam.name}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">VS</span>
              <span className="text-sm font-bold text-white">
                {edition.recentMatch.awayTeam.name}
              </span>
            </div>

            {edition.linkedTournament && (
              <Link href={`/tournaments/${edition.linkedTournament.id}`}>
                <Button variant="outline" size="sm" className="gap-1.5 border-slate-700 text-slate-300">
                  Full Scorecard
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </section>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────────
          3. TOURNAMENT SNAPSHOT (P1.3)
         ───────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-orange-400" />
          Tournament Snapshot
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-slate-900/60 border-slate-800/80">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Users className="w-5 h-5 text-orange-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {edition.tournamentSnapshot?.teamsCount ?? (edition.teams?.length || 0)}
              </div>
              <div className="text-xs font-medium text-slate-400 mt-0.5">
                Participating Teams
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800/80">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Calendar className="w-5 h-5 text-amber-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {edition.tournamentSnapshot?.matchesCount ?? 0}
              </div>
              <div className="text-xs font-medium text-slate-400 mt-0.5">
                Total Matches
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800/80">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Shield className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-base sm:text-lg font-black text-white uppercase truncate max-w-full">
                {edition.linkedTournament?.sport || "Multi-Sport"}
              </div>
              <div className="text-xs font-medium text-slate-400 mt-0.5">
                Competition Sport
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800/80">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Trophy className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="text-base sm:text-lg font-black text-white uppercase truncate max-w-full">
                {edition.linkedTournament?.status || edition.status}
              </div>
              <div className="text-xs font-medium text-slate-400 mt-0.5">
                Tournament Stage
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          4. PARTICIPATING TEAMS (P1.5)
         ───────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-400" />
            Participating Teams
          </h2>
          {edition.teams && edition.teams.length > 0 && (
            <span className="text-xs text-slate-500 font-mono">
              {edition.teams.length} Teams
            </span>
          )}
        </div>

        {edition.teams && edition.teams.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {edition.teams.map((team) => (
              <div
                key={team.id}
                className="group relative flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-colors"
              >
                {/* Team Color Strip & Badge */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow overflow-hidden"
                  style={{ backgroundColor: team.color || "#ea580c" }}
                >
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt={team.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{team.shortCode || team.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-orange-400 transition-colors">
                    {team.name}
                  </h3>
                  <p className="text-[11px] font-mono font-medium text-slate-400 uppercase">
                    {team.shortCode || "TEAM"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">
              Participating teams will appear once confirmed in the tournament engine.
            </p>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          5. POINTS TABLE / STANDINGS PREVIEW (P1.6)
         ───────────────────────────────────────────────────────────────── */}
      {edition.standings && edition.standings.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Medal className="w-4 h-4 text-orange-400" />
              Points Table Preview
            </h2>
            {edition.linkedTournament && (
              <Link href={`/tournaments/${edition.linkedTournament.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-orange-400 hover:text-orange-300 gap-1 p-0 h-auto font-bold"
                >
                  View Full Standings
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-left uppercase text-[11px] font-bold text-slate-400">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-center">P</th>
                  <th className="px-4 py-3 text-center">W</th>
                  <th className="px-4 py-3 text-center">L</th>
                  <th className="px-4 py-3 text-center">Pts</th>
                  <th className="px-4 py-3 text-right">NRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {edition.standings.slice(0, 6).map((row, idx) => (
                  <tr
                    key={row.teamId}
                    className={cn(
                      "hover:bg-slate-800/30 transition-colors",
                      idx === 0 && "bg-orange-500/5",
                    )}
                  >
                    <td className="px-4 py-2.5 text-slate-500 font-mono">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2.5 text-white font-bold">
                      <div className="flex items-center gap-2">
                        {row.color && (
                          <span
                            className="w-2 h-4 rounded-sm shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                        )}
                        <span>{row.teamName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-slate-300">
                      {row.played}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-emerald-400">
                      {row.won}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-rose-400">
                      {row.lost}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-black text-orange-400">
                      {row.points}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                      {typeof row.netRunRate === "number"
                        ? (row.netRunRate > 0 ? `+${row.netRunRate.toFixed(3)}` : row.netRunRate.toFixed(3))
                        : row.netRunRate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────────
          6. TOURNAMENT / EDITION INFORMATION (P1.7)
         ───────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Info className="w-4 h-4 text-orange-400" />
          About This Edition
        </h2>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-slate-500">
                Competition Dates
              </span>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
                {formattedDates}
              </p>
            </div>

            {(edition.venue || edition.city) && (
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-slate-500">
                  Location & Venue
                </span>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                  {[edition.venue, edition.city].filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            {edition.linkedTournament && (
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-slate-500">
                  Linked Tournament Engine
                </span>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-orange-400 shrink-0" />
                  {edition.linkedTournament.name}
                </p>
              </div>
            )}
          </div>

          {edition.description && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <span className="text-xs uppercase font-bold text-slate-500">
                Official Edition Overview
              </span>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {edition.description}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          7. SPONSORS SHOWCASE (P1.8, P1.9)
         ───────────────────────────────────────────────────────────────── */}
      {sponsorsByCategory.total > 0 && (
        <section className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Official Partners & Sponsors
            </h2>
            <p className="text-xs text-slate-500">
              Supporting BidWar Premier League Edition {String(edition.editionNumber).padStart(2, "0")}
            </p>
          </div>

          {/* Title Sponsor (Primary prestige, centered) */}
          {sponsorsByCategory.title.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400/90 bg-orange-500/10 px-3 py-0.5 rounded-full border border-orange-500/20">
                Title Sponsor
              </span>
              <div className="flex flex-wrap justify-center gap-4">
                {sponsorsByCategory.title.map((sp) => (
                  <SponsorLogoCard key={sp.id} sponsor={sp} size="large" />
                ))}
              </div>
            </div>
          )}

          {/* Powered By Sponsors */}
          {sponsorsByCategory.poweredBy.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Powered By
              </span>
              <div className="flex flex-wrap justify-center gap-4">
                {sponsorsByCategory.poweredBy.map((sp) => (
                  <SponsorLogoCard key={sp.id} sponsor={sp} size="medium" />
                ))}
              </div>
            </div>
          )}

          {/* Associates & Partners */}
          {sponsorsByCategory.associates.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Associate Partners
              </span>
              <div className="flex flex-wrap justify-center gap-3">
                {sponsorsByCategory.associates.map((sp) => (
                  <SponsorLogoCard key={sp.id} sponsor={sp} size="small" />
                ))}
              </div>
            </div>
          )}

          {/* Media Partners */}
          {sponsorsByCategory.media.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Media Partners
              </span>
              <div className="flex flex-wrap justify-center gap-3">
                {sponsorsByCategory.media.map((sp) => (
                  <SponsorLogoCard key={sp.id} sponsor={sp} size="small" />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          8. BPL EDITIONS NAVIGATION (P1.11)
         ───────────────────────────────────────────────────────────────── */}
      {otherEditions.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-orange-400" />
              All BidWar Premier League Editions
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allEditions.map((ed) => {
              const isCurrent = ed.id === edition.id;
              return (
                <Link
                  key={ed.id}
                  href={`/bpl/${ed.slug || ed.editionNumber}`}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                    isCurrent
                      ? "border-orange-500/50 bg-orange-500/10 text-white"
                      : "border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 text-slate-300",
                  )}
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">
                        {ed.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      {ed.year} · {ed.status}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SponsorLogoCard({
  sponsor,
  size,
}: {
  sponsor: BplEditionSponsor;
  size: "large" | "medium" | "small";
}) {
  const containerSize =
    size === "large"
      ? "h-20 sm:h-24 px-6 min-w-[180px]"
      : size === "medium"
        ? "h-16 px-5 min-w-[140px]"
        : "h-12 px-4 min-w-[110px]";

  const content = (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-colors shadow-sm",
        containerSize,
      )}
    >
      <img
        src={sponsor.logoUrl}
        alt={sponsor.name}
        className="max-h-full max-w-full object-contain p-2"
        loading="lazy"
      />
    </div>
  );

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={sponsor.name}
        className="block group"
      >
        {content}
      </a>
    );
  }

  return <div title={sponsor.name}>{content}</div>;
}
