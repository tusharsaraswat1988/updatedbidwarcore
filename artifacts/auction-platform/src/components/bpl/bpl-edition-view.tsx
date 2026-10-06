import { useMemo, useRef, useState } from "react";
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
  Users,
  Shield,
  Medal,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  BplEdition,
  BplEditionSponsor,
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
    <div className="space-y-10 sm:space-y-14">
      {/* ─────────────────────────────────────────────────────────────────
          1. BPL HERO (P1.1, P1.2) - Championship Stadium Navy Theme
         ───────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-500/25 bg-gradient-to-br from-[#0e224e]/95 via-[#0a1838]/95 to-[#06122c]/98 p-6 sm:p-10 md:p-14 shadow-2xl shadow-blue-950/80 backdrop-blur-md">
        {/* Subtle decorative stadium glow & ambient gradients */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-500/15 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-600/20 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
          {/* Official BidWar Platform Logo */}
          <div className="mb-4 flex items-center justify-center">
            <img
              src="/assets/branding/bidwar-reverse-logo-official.png"
              alt="BidWar"
              className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-[0_4px_20px_rgba(245,158,11,0.3)]"
            />
          </div>

          {/* Eyebrow & Status Indicator */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              BidWar Flagship Tournament Property
            </span>

            {/* Dynamic Status Badge */}
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                🔴 Live Now
              </span>
            ) : isUpcoming ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/35 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Upcoming Edition
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-500/35 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-blue-400" />
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium tracking-wider uppercase bg-blue-950/70 text-blue-200 border border-blue-400/20">
                {edition.status}
              </span>
            )}
          </div>

          {/* Edition Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-md leading-tight">
            BidWar Premier League
          </h1>

          <div className="mt-3 inline-flex items-center gap-2 text-lg sm:text-2xl font-bold tracking-wide text-amber-400 font-mono">
            <span>Edition {String(edition.editionNumber).padStart(2, "0")}</span>
            <span className="text-blue-400/60">·</span>
            <span className="text-blue-100 font-sans">{edition.year}</span>
          </div>

          {/* Date, Venue, City Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-blue-100 font-medium">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0f2452]/80 border border-blue-400/25 backdrop-blur-sm shadow-sm">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{formattedDates}</span>
            </span>

            {(edition.venue || edition.city) && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0f2452]/80 border border-blue-400/25 backdrop-blur-sm shadow-sm">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {[edition.venue, edition.city].filter(Boolean).join(" · ")}
                </span>
              </span>
            )}

            {edition.linkedTournament?.sport && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0f2452]/80 border border-blue-400/25 backdrop-blur-sm uppercase font-semibold text-xs tracking-wider text-amber-300 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{edition.linkedTournament.sport}</span>
              </span>
            )}
          </div>

          {/* Description */}
          {edition.description && (
            <p className="mt-5 text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed font-normal">
              {edition.description}
            </p>
          )}

          {/* Call to Actions (Issue 1 Resolved: Working Links, No Broken 404s) */}
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
                  className="gap-2 font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-600/30 px-6"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Watch Live Stream
                </Button>
              </a>
            )}

            {/* Fan / Live Arena Secondary CTA */}
            {hasFanPageUrl && (
              <a
                href={edition.fanPageUrl!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 font-semibold border-blue-400/30 bg-[#0f224a]/80 hover:bg-[#15316c] text-white shadow-sm"
                >
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  BPL Fan Page
                </Button>
              </a>
            )}

            {/* Tournament Details CTA -> Links directly to the Public Fan/Details View */}
            {edition.linkedTournament && (
              <Link href={`/tournament/${edition.linkedTournament.id}/fan`}>
                <Button
                  variant={!hasStreamUrl ? "default" : "secondary"}
                  size="lg"
                  className={cn(
                    "gap-2 font-semibold",
                    !hasStreamUrl
                      ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-600/30 px-6"
                      : "border border-blue-400/30 bg-[#0f224a]/80 hover:bg-[#15316c] text-white shadow-sm",
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
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#0d2248]/90 to-[#091836]/90 p-6 sm:p-8 shadow-xl">
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
                <p className="text-xs text-blue-200/80 flex items-center justify-center md:justify-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {edition.liveMatch.venue}
                </p>
              )}
            </div>

            {/* Scoreboard Teams Matchup */}
            <div className="flex items-center gap-4 sm:gap-6 bg-[#0a1835]/90 px-6 py-4 rounded-xl border border-blue-500/25 shadow-md">
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

              <div className="text-xs font-mono font-black text-blue-400 uppercase">
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
              <Link href={edition.liveMatch.liveScoreRoute || `/tournament/${edition.linkedTournamentId}/score-display`}>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-lg shadow-emerald-600/25">
                  <Radio className="w-4 h-4 animate-pulse" />
                  Watch Live Score
                </Button>
              </Link>
            </div>
          </div>
        </section>
      ) : edition.nextMatch ? (
        <section className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-[#0d2249]/85 via-[#0a1a3b]/85 to-[#07142d]/85 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Next Scheduled Match
              </span>
              <h2 className="text-lg sm:text-xl font-black uppercase text-white">
                {edition.nextMatch.roundName || edition.nextMatch.matchLabel || "Upcoming Fixture"}
              </h2>
              {edition.nextMatch.scheduledAt && (
                <p className="text-xs text-blue-200/80 flex items-center justify-center md:justify-start gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {new Date(edition.nextMatch.scheduledAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 bg-[#08152e]/90 px-5 py-3 rounded-xl border border-blue-400/20 shadow-sm">
              <span className="text-sm font-bold text-white">
                {edition.nextMatch.homeTeam.name}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400/80">VS</span>
              <span className="text-sm font-bold text-white">
                {edition.nextMatch.awayTeam.name}
              </span>
            </div>

            {edition.linkedTournament && (
              <Link href={`/tournament/${edition.linkedTournament.id}/cricket/matches`}>
                <Button variant="outline" size="sm" className="gap-1.5 border-blue-400/30 bg-[#0f2452]/60 hover:bg-[#16336e] text-blue-100 shadow-sm">
                  Tournament Schedule
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </section>
      ) : edition.recentMatch ? (
        <section className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-[#0d2249]/85 via-[#0a1a3b]/85 to-[#07142d]/85 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
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

            <div className="flex items-center gap-4 bg-[#08152e]/90 px-5 py-3 rounded-xl border border-blue-400/20 shadow-sm">
              <span className="text-sm font-bold text-white">
                {edition.recentMatch.homeTeam.name}
              </span>
              <span className="text-xs font-mono font-bold text-blue-400">VS</span>
              <span className="text-sm font-bold text-white">
                {edition.recentMatch.awayTeam.name}
              </span>
            </div>

            {edition.linkedTournament && (
              <Link href={`/tournament/${edition.linkedTournament.id}/cricket/matches`}>
                <Button variant="outline" size="sm" className="gap-1.5 border-blue-400/30 bg-[#0f2452]/60 hover:bg-[#16336e] text-blue-100 shadow-sm">
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
        <h2 className="text-xs font-black uppercase tracking-widest text-blue-200 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          Tournament Snapshot
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 border-blue-500/20 shadow-md backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Users className="w-5 h-5 text-amber-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {edition.tournamentSnapshot?.teamsCount ?? (edition.teams?.length || 0)}
              </div>
              <div className="text-xs font-medium text-blue-200/80 mt-0.5">
                Participating Teams
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 border-blue-500/20 shadow-md backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Calendar className="w-5 h-5 text-amber-400 mb-2" />
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {edition.tournamentSnapshot?.matchesCount ?? 0}
              </div>
              <div className="text-xs font-medium text-blue-200/80 mt-0.5">
                Total Matches
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 border-blue-500/20 shadow-md backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Shield className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-base sm:text-lg font-black text-white uppercase truncate max-w-full">
                {edition.linkedTournament?.sport || "Multi-Sport"}
              </div>
              <div className="text-xs font-medium text-blue-200/80 mt-0.5">
                Competition Sport
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 border-blue-500/20 shadow-md backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Trophy className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="text-base sm:text-lg font-black text-white uppercase truncate max-w-full">
                {edition.linkedTournament?.status || edition.status}
              </div>
              <div className="text-xs font-medium text-blue-200/80 mt-0.5">
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
          <h2 className="text-xs font-black uppercase tracking-widest text-blue-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            Participating Teams
          </h2>
          {edition.teams && edition.teams.length > 0 && (
            <span className="text-xs text-amber-300 font-mono font-semibold">
              {edition.teams.length} Teams
            </span>
          )}
        </div>

        {edition.teams && edition.teams.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {edition.teams.map((team) => (
              <div
                key={team.id}
                className="group relative flex items-center gap-3 p-3.5 rounded-xl border border-blue-500/20 bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 hover:bg-[#132854]/80 hover:border-amber-400/40 transition-all shadow-md"
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
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                    {team.name}
                  </h3>
                  <p className="text-[11px] font-mono font-medium text-blue-200/70 uppercase">
                    {team.shortCode || "TEAM"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-blue-500/20 bg-[#0a1838]/40 p-8 text-center">
            <Users className="w-8 h-8 text-blue-400/50 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-medium">
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
            <h2 className="text-xs font-black uppercase tracking-widest text-blue-200 flex items-center gap-2">
              <Medal className="w-4 h-4 text-amber-400" />
              Points Table Preview
            </h2>
            {edition.linkedTournament && (
              <Link href={`/tournament/${edition.linkedTournament.id}/cricket/standings`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-amber-400 hover:text-amber-300 gap-1 p-0 h-auto font-bold"
                >
                  View Full Standings
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-blue-500/20 bg-[#0b1a3a]/70 shadow-lg backdrop-blur-sm">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-blue-500/25 bg-[#0f2450]/80 text-left uppercase text-[11px] font-bold text-blue-200">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-center">P</th>
                  <th className="px-4 py-3 text-center">W</th>
                  <th className="px-4 py-3 text-center">L</th>
                  <th className="px-4 py-3 text-center">Pts</th>
                  <th className="px-4 py-3 text-right">NRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/15 font-medium">
                {edition.standings.slice(0, 6).map((row, idx) => (
                  <tr
                    key={row.teamId}
                    className={cn(
                      "hover:bg-blue-500/10 transition-colors",
                      idx === 0 && "bg-amber-500/10",
                    )}
                  >
                    <td className="px-4 py-2.5 text-blue-300 font-mono">
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
                    <td className="px-4 py-2.5 text-center font-mono text-slate-200">
                      {row.played}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-emerald-400">
                      {row.won}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-rose-400">
                      {row.lost}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-black text-amber-400">
                      {row.points}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-blue-200">
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
          6. SPONSORS SHOWCASE & INTERACTIVE SLIDESHOW (Issue 2 & Issue 4)
         ───────────────────────────────────────────────────────────────── */}
      {sponsorsByCategory.total > 0 && (
        <section className="relative rounded-3xl border border-blue-500/25 bg-gradient-to-br from-[#0c1f44]/80 via-[#081738]/85 to-[#05112a]/90 p-6 sm:p-10 shadow-2xl backdrop-blur-md space-y-8 overflow-hidden">
          {/* Subtle background glow */}
          <div
            className="absolute top-0 right-1/4 w-80 h-80 bg-amber-500/10 blur-[100px] pointer-events-none"
            aria-hidden="true"
          />

          <div className="text-center space-y-1.5 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Official Partners & Sponsors
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
              Proud Tournament Partners
            </h2>
            <p className="text-xs text-blue-200/80">
              Supporting BidWar Premier League Edition {String(edition.editionNumber).padStart(2, "0")}
            </p>
          </div>

          {/* Title Sponsor Spotlight (Prestigious top billing) */}
          {sponsorsByCategory.title.length > 0 && (
            <div className="flex flex-col items-center gap-3 relative z-10">
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-300 bg-amber-500/15 px-4 py-1 rounded-full border border-amber-500/30 shadow-sm">
                👑 Title Sponsor
              </span>
              <div className="flex flex-wrap justify-center gap-4">
                {sponsorsByCategory.title.map((sp) => (
                  <SponsorLogoCard key={sp.id} sponsor={sp} size="large" />
                ))}
              </div>
            </div>
          )}

          {/* Powered By Sponsors Spotlight */}
          {sponsorsByCategory.poweredBy.length > 0 && (
            <div className="flex flex-col items-center gap-3 relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 bg-blue-500/20 px-3.5 py-0.5 rounded-full border border-blue-400/30">
                Powered By
              </span>
              <div className="flex flex-wrap justify-center gap-4">
                {sponsorsByCategory.poweredBy.map((sp) => (
                  <SponsorLogoCard key={sp.id} sponsor={sp} size="medium" />
                ))}
              </div>
            </div>
          )}

          {/* Associate Partners Slideshow Marquee */}
          {sponsorsByCategory.associates.length > 0 && (
            <div className="relative z-10">
              <SponsorSlideshow
                title="Associate Partners"
                subtitle="Official League Partners & Supporters"
                sponsors={sponsorsByCategory.associates}
              />
            </div>
          )}

          {/* Media Partners Slideshow Marquee */}
          {sponsorsByCategory.media.length > 0 && (
            <div className="relative z-10">
              <SponsorSlideshow
                title="Media Partners"
                subtitle="Broadcast & Media Network"
                sponsors={sponsorsByCategory.media}
              />
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          8. BPL EDITIONS NAVIGATION (P1.11)
         ───────────────────────────────────────────────────────────────── */}
      {otherEditions.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-blue-500/20">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-blue-200 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
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
                    "flex items-center justify-between p-4 rounded-xl border transition-all shadow-sm",
                    isCurrent
                      ? "border-amber-500/50 bg-amber-500/15 text-white shadow-lg"
                      : "border-blue-500/20 bg-[#0c1f44]/60 hover:bg-[#122855] hover:border-blue-400/40 text-slate-200",
                  )}
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">
                        {ed.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-200/70 font-mono">
                      {ed.year} · {ed.status}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-300 shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Interactive Auto-Scrolling Slideshow Carousel for Sponsors
 * Continuous marquee with pause-on-hover, arrow controls, and clean elevated cards.
 */
function SponsorSlideshow({
  sponsors,
  title,
  subtitle,
}: {
  sponsors: BplEditionSponsor[];
  title?: string;
  subtitle?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const handleScroll = (dir: -1 | 1) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: 320 * dir, behavior: "smooth" });
  };

  if (!sponsors || sponsors.length === 0) return null;

  // Duplicate items for continuous seamless marquee loop
  const repeated = useMemo(() => {
    if (sponsors.length === 0) return [];
    if (sponsors.length >= 8) return [...sponsors, ...sponsors];
    if (sponsors.length >= 4) return [...sponsors, ...sponsors, ...sponsors];
    return [...sponsors, ...sponsors, ...sponsors, ...sponsors];
  }, [sponsors]);

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between px-1">
        <div className="space-y-0.5">
          {title && (
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-200 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {title}
            </h3>
          )}
          {subtitle && <p className="text-[11px] text-blue-200/70">{subtitle}</p>}
        </div>

        {/* Scroll navigation controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleScroll(-1)}
            aria-label="Previous sponsors"
            className="w-8 h-8 rounded-lg border border-blue-400/25 bg-[#0f2452]/70 hover:bg-[#16336e] hover:border-amber-400/40 text-blue-100 hover:text-white flex items-center justify-center transition shadow-sm active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll(1)}
            aria-label="Next sponsors"
            className="w-8 h-8 rounded-lg border border-blue-400/25 bg-[#0f2452]/70 hover:bg-[#16336e] hover:border-amber-400/40 text-blue-100 hover:text-white flex items-center justify-center transition shadow-sm active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Marquee Slideshow Container with edge fades */}
      <div
        className="group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-[#081738]/60 p-4 sm:p-5 backdrop-blur-sm"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Soft edge fade masks */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-[#081738] to-transparent z-10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-[#081738] to-transparent z-10"
          aria-hidden="true"
        />

        <div
          ref={scrollRef}
          className="overflow-x-auto no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div
            className={cn(
              "flex gap-4 items-center shrink-0 animate-marquee group-hover:[animation-play-state:paused]",
              isPaused && "[animation-play-state:paused]",
            )}
            style={{ width: "max-content" }}
          >
            {repeated.map((sp, idx) => (
              <SponsorLogoCard
                key={`${sp.id}-${idx}`}
                sponsor={sp}
                size="carousel"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sponsor Logo Card with clean elevated white badge
 * Eliminates harsh black voids and ensures crisp logo visibility.
 */
function SponsorLogoCard({
  sponsor,
  size,
}: {
  sponsor: BplEditionSponsor;
  size: "large" | "medium" | "small" | "carousel";
}) {
  const containerClasses =
    size === "large"
      ? "h-24 sm:h-28 px-6 min-w-[220px] max-w-[280px]"
      : size === "medium"
        ? "h-20 px-5 min-w-[180px] max-w-[230px]"
        : size === "carousel"
          ? "h-16 sm:h-20 px-4 min-w-[160px] sm:min-w-[190px] max-w-[220px]"
          : "h-14 px-4 min-w-[130px]";

  const content = (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl bg-white hover:bg-white border border-slate-200/60 shadow-md hover:shadow-xl hover:shadow-blue-500/15 transition-all duration-300",
        containerClasses,
      )}
    >
      <img
        src={sponsor.logoUrl}
        alt={sponsor.name}
        className="max-h-full max-w-full object-contain p-2.5 transition-transform duration-300 hover:scale-105"
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
        className="block group shrink-0"
      >
        {content}
      </a>
    );
  }

  return (
    <div title={sponsor.name} className="shrink-0">
      {content}
    </div>
  );
}
