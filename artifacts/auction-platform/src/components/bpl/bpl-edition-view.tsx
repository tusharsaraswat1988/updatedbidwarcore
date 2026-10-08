import { useMemo, useRef, useState } from "react";
import { formatNetRunRate, formatPointsPercentage } from "@workspace/scoring-core/cricket";
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
  BplMatchScore,
  BplPublicMatch,
  BplPublicTeam,
} from "@/lib/bpl-api";

const TOURNAMENT_STAGE_LABELS: Record<string, string> = {
  draft: "Draft",
  setup: "Setup",
  draw_ready: "Draw Ready",
  match_scheduling: "Match Scheduling",
  ready_to_start: "Ready To Start",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

function formatStage(status?: string | null): string {
  if (!status) return "Scheduled";
  const key = status.trim().toLowerCase();
  return TOURNAMENT_STAGE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEditionDates(start?: string | null, end?: string | null): string {
  if (!start) return "Dates TBA";
  const parse = (value: string) => {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const startDate = parse(start);
  const endDate = end ? parse(end) : null;
  if (!startDate) return start;
  const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric" });
  const monthYear = (date: Date) => date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  if (!endDate || startDate.getTime() === endDate.getTime()) {
    return startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${day(startDate)}–${day(endDate)} ${monthYear(startDate)}`;
  }
  const short = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${short(startDate)} – ${day(endDate)} ${monthYear(endDate)}`;
  }
  return `${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – ${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function publicRoundName(roundName?: string | null, matchLabel?: string | null): string {
  const raw = (roundName || matchLabel || "Match day").trim();
  const cleaned = raw
    .replace(/bidwar\s+premier\s+league/gi, "")
    .replace(/^[\s·•\-|–—]+/, "")
    .replace(/[\s·•\-|–—]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || "Match day";
}

function titleCaseSport(sport?: string | null): string {
  if (!sport) return "Multi-sport";
  return sport.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function teamDivision(name: string): "Junior" | "Senior" | null {
  if (/\bjunior\b/i.test(name)) return "Junior";
  if (/\bsenior\b/i.test(name)) return "Senior";
  return null;
}

function inningsForTeam(score: BplMatchScore | null | undefined, teamId: number) {
  return score?.innings.filter((innings) => innings.battingTeamId === teamId) ?? [];
}

function isBattingNow(score: BplMatchScore | null | undefined, teamId: number): boolean {
  const innings = score?.innings ?? [];
  if (innings.length === 0) return false;
  return innings[innings.length - 1]?.battingTeamId === teamId;
}

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
  const matchIsLive = Boolean(edition.liveMatch);
  const isLive = matchIsLive || edition.status === "LIVE";
  const isUpcoming = edition.status === "UPCOMING" && !matchIsLive;
  const isCompleted = edition.status === "COMPLETED" && !matchIsLive;

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

  const formattedDates = useMemo(
    () => formatEditionDates(edition.startDate, edition.endDate),
    [edition.startDate, edition.endDate],
  );

  const tournamentId = edition.linkedTournament?.id ?? edition.linkedTournamentId ?? null;

  const matchStats = useMemo(() => {
    const snap = edition.tournamentSnapshot;
    const matches = snap?.matchesCount ?? 0;
    const fixtures = snap?.fixturesCount ?? 0;
    const completed = snap?.completedMatchesCount ?? 0;
    const live = snap?.liveMatchesCount ?? (edition.liveMatch ? 1 : 0);
    const scheduled = snap?.scheduledMatchesCount ?? 0;
    const detail = [
      completed > 0 ? `${completed} played` : null,
      live > 0 ? `${live} live` : null,
      scheduled > 0 ? `${scheduled} upcoming` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      total: Math.max(fixtures, matches),
      label: fixtures > matches ? "Fixtures" : "Matches",
      detail: detail || "In this edition",
    };
  }, [edition.liveMatch, edition.tournamentSnapshot]);

  const teamGroups = useMemo(() => {
    const teams = edition.teams ?? [];
    const junior = teams.filter((team) => teamDivision(team.name) === "Junior");
    const senior = teams.filter((team) => teamDivision(team.name) === "Senior");
    if (junior.length === 0 || senior.length === 0) {
      return [{ label: null as string | null, teams }];
    }
    const rest = teams.filter((team) => teamDivision(team.name) == null);
    const groups = [
      { label: "Senior", teams: senior },
      { label: "Junior", teams: junior },
    ];
    if (rest.length > 0) groups.push({ label: "Teams", teams: rest });
    return groups;
  }, [edition.teams]);

  const hasStreamUrl = Boolean(
    edition.liveStreamUrl && /^https?:\/\/.+/i.test(edition.liveStreamUrl),
  );
  const hasFanPageUrl = Boolean(
    edition.fanPageUrl && /^https?:\/\/.+/i.test(edition.fanPageUrl),
  );

  return (
    <div className={cn("space-y-10 sm:space-y-14", edition.liveMatch && "pb-24 md:pb-0")}>
      <BplMatchActivity edition={edition} />
      {edition.liveMatch ? <LiveScoreDock match={edition.liveMatch} /> : null}

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
                {matchStats.total}
              </div>
              <div className="text-xs font-medium text-blue-200/80 mt-0.5">
                {matchStats.label}
              </div>
              <div className="text-[11px] text-emerald-300/90 mt-1">{matchStats.detail}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 border-blue-500/20 shadow-md backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Shield className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-base sm:text-lg font-black text-white">
                {titleCaseSport(edition.linkedTournament?.sport)}
              </div>
              <div className="text-xs font-medium text-blue-200/80 mt-0.5">
                Competition Sport
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 border-blue-500/20 shadow-md backdrop-blur-sm">
            <CardContent className="p-4 sm:p-5 flex flex-col items-center sm:items-start">
              <Trophy className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="text-base sm:text-lg font-black text-white">
                {edition.liveMatch ? "Live" : formatStage(edition.linkedTournament?.status || edition.status)}
              </div>
              <div className="text-xs font-medium text-blue-200/80 mt-0.5">
                Tournament Stage
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <BplStandings edition={edition} />

      <BplTeams edition={edition} tournamentId={tournamentId} groups={teamGroups} />

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

          {sponsorsByCategory.associates.length > 0 && (
            <div className="relative z-10">
              {sponsorsByCategory.associates.length <= 6 ? (
                <StaticSponsorRow
                  title="Associate Partners"
                  subtitle="Official League Partners & Supporters"
                  sponsors={sponsorsByCategory.associates}
                />
              ) : (
                <SponsorSlideshow
                  title="Associate Partners"
                  subtitle="Official League Partners & Supporters"
                  sponsors={sponsorsByCategory.associates}
                />
              )}
            </div>
          )}

          {sponsorsByCategory.media.length > 0 && (
            <div className="relative z-10">
              {sponsorsByCategory.media.length <= 6 ? (
                <StaticSponsorRow
                  title="Media Partners"
                  subtitle="Broadcast & Media Network"
                  sponsors={sponsorsByCategory.media}
                />
              ) : (
                <SponsorSlideshow
                  title="Media Partners"
                  subtitle="Broadcast & Media Network"
                  sponsors={sponsorsByCategory.media}
                />
              )}
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
                      {ed.year} · {formatStage(ed.status)}
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
function TeamMark({ team, size = "md" }: { team: BplPublicTeam; size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center font-black text-white shrink-0 shadow overflow-hidden",
        size === "sm" ? "w-8 h-8 text-[10px]" : "w-11 h-11 text-xs",
      )}
      style={{ backgroundColor: team.color || "#ea580c" }}
    >
      {team.logoUrl ? (
        <img src={team.logoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{team.shortCode || team.name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function ScoreFigures({ score, teamId }: { score?: BplMatchScore | null; teamId: number }) {
  const rows = inningsForTeam(score, teamId);
  if (rows.length === 0) {
    return <span className="text-xs font-semibold text-blue-200/70">Yet to bat</span>;
  }
  const latest = rows[rows.length - 1];
  return (
    <div className="text-right shrink-0">
      <div className="text-2xl sm:text-3xl font-black font-mono text-white leading-none tabular-nums">
        {latest.runs}/{latest.wickets}
      </div>
      <div className="text-[11px] font-mono text-blue-200/80 mt-1">{latest.overs} ov</div>
    </div>
  );
}

function TeamScoreRow({
  team,
  score,
  batting,
}: {
  team: BplPublicTeam;
  score?: BplMatchScore | null;
  batting: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        batting ? "border-emerald-400/40 bg-emerald-500/10" : "border-blue-500/20 bg-[#0a1835]/80",
      )}
    >
      <TeamMark team={team} />
      <div className="min-w-0 flex-1">
        <p className="text-sm sm:text-base font-bold text-white leading-snug line-clamp-2">{team.name}</p>
        <p className="text-[11px] font-mono text-blue-200/70">{team.shortCode}</p>
      </div>
      {batting && (
        <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider text-emerald-300">
          Batting
        </span>
      )}
      <ScoreFigures score={score} teamId={team.id} />
    </div>
  );
}

function BplMatchActivity({ edition }: { edition: BplEdition }) {
  if (edition.liveMatch) {
    const match = edition.liveMatch;
    const innings = match.score?.innings ?? [];
    const battingId = innings.length > 0 ? innings[innings.length - 1]?.battingTeamId : null;
    const target = match.score?.target;
    const showTarget = target != null && (match.score?.currentInnings ?? innings.length) > 1;
    return (
      <section
        aria-live="polite"
        className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-[#0d2248]/95 to-[#091836]/95 p-4 sm:p-6 shadow-xl lg:sticky lg:top-20 lg:z-30"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="space-y-2 lg:max-w-xs">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              Live Match In Progress
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {publicRoundName(match.roundName, match.matchLabel)}
            </h2>
            {match.venue && (
              <p className="text-xs text-blue-200/80 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {match.venue}
              </p>
            )}
            <p className="text-[11px] text-blue-200/60">Scores refresh automatically</p>
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            <TeamScoreRow team={match.homeTeam} score={match.score} batting={battingId === match.homeTeam.id} />
            <TeamScoreRow team={match.awayTeam} score={match.score} batting={battingId === match.awayTeam.id} />
            {showTarget && (
              <p className="text-xs font-bold text-amber-300 text-right pr-1">Target {target}</p>
            )}
          </div>

          <Link href={match.liveScoreRoute || `/tournament/${edition.linkedTournamentId}/score-display`}>
            <Button className="w-full lg:w-auto gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-lg shadow-emerald-600/25">
              <Radio className="w-4 h-4 animate-pulse" />
              Watch Live Score
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  if (edition.nextMatch) {
    return (
      <section className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-[#0d2249]/85 via-[#0a1a3b]/85 to-[#07142d]/85 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Next Scheduled Match
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              {publicRoundName(edition.nextMatch.roundName, edition.nextMatch.matchLabel)}
            </h2>
            {edition.nextMatch.scheduledAt && (
              <p className="text-xs text-blue-200/80 flex items-center justify-center md:justify-start gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {new Date(edition.nextMatch.scheduledAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 bg-[#08152e]/90 px-5 py-3 rounded-xl border border-blue-400/20 shadow-sm text-center">
            <span className="text-sm font-bold text-white max-w-[10rem] line-clamp-2">{edition.nextMatch.homeTeam.name}</span>
            <span className="text-xs font-mono font-bold text-amber-400/80">VS</span>
            <span className="text-sm font-bold text-white max-w-[10rem] line-clamp-2">{edition.nextMatch.awayTeam.name}</span>
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
    );
  }

  if (edition.recentMatch) {
    return (
      <section className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-[#0d2249]/85 via-[#0a1a3b]/85 to-[#07142d]/85 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
              Recent Result
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              {publicRoundName(edition.recentMatch.roundName, "Match Result")}
            </h2>
            {edition.recentMatch.resultSummary && (
              <p className="text-xs text-emerald-400 font-semibold">{edition.recentMatch.resultSummary}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 bg-[#08152e]/90 px-5 py-3 rounded-xl border border-blue-400/20 shadow-sm text-center">
            <span className="text-sm font-bold text-white max-w-[10rem] line-clamp-2">{edition.recentMatch.homeTeam.name}</span>
            <span className="text-xs font-mono font-bold text-blue-400">VS</span>
            <span className="text-sm font-bold text-white max-w-[10rem] line-clamp-2">{edition.recentMatch.awayTeam.name}</span>
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
    );
  }

  return null;
}

function LiveScoreDock({ match }: { match: BplPublicMatch }) {
  const home = inningsForTeam(match.score, match.homeTeam.id);
  const away = inningsForTeam(match.score, match.awayTeam.id);
  const homeScore = home.length > 0 ? `${home[home.length - 1].runs}/${home[home.length - 1].wickets}` : "–";
  const awayScore = away.length > 0 ? `${away[away.length - 1].runs}/${away[away.length - 1].wickets}` : "–";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-400/30 bg-[#06101f]/95 backdrop-blur-md px-3 py-2 md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <Link
        href={match.liveScoreRoute || `/score-display/${match.tournamentId ?? ""}`}
        className="flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Live</p>
          <p className="text-xs font-bold text-white truncate">
            {match.homeTeam.shortCode} {homeScore}
            <span className="text-blue-300 mx-1">vs</span>
            {match.awayTeam.shortCode} {awayScore}
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold text-emerald-300">Watch Live Score</span>
      </Link>
    </div>
  );
}

function BplStandings({ edition }: { edition: BplEdition }) {
  const hasRows = Boolean(edition.standings && edition.standings.length > 0);
  if (!hasRows && !edition.linkedTournament) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
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

      {edition.standings && edition.standings.length > 0 ? (
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
                <th className="px-4 py-3 text-right">Pts %</th>
                <th className="px-4 py-3 text-right">NRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-500/15 font-medium">
              {edition.standings.slice(0, 8).map((row, idx) => (
                <tr
                  key={`${row.drawId ?? "d"}-${row.teamId}`}
                  className={cn("hover:bg-blue-500/10 transition-colors", idx === 0 && "bg-amber-500/10")}
                >
                  <td className="px-4 py-2.5 text-blue-300 font-mono">{idx + 1}</td>
                  <td className="px-4 py-2.5 text-white font-bold">
                    <div className="flex items-center gap-2 min-w-[8rem]">
                      {row.color && (
                        <span className="w-2 h-4 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                      )}
                      <span className="line-clamp-2">{row.teamName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-slate-200">{row.played}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-emerald-400">{row.won}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-rose-400">{row.lost}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-black text-amber-400">{row.points}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-100">
                    {formatPointsPercentage(row.pointsPercentage)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-200">
                    {formatNetRunRate(row.netRunRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-blue-500/20 bg-[#0a1838]/40 p-6 text-center">
          <p className="text-sm text-slate-300">The points table updates when a match is completed.</p>
        </div>
      )}
    </section>
  );
}

function BplTeams({
  edition,
  tournamentId,
  groups,
}: {
  edition: BplEdition;
  tournamentId: number | null;
  groups: { label: string | null; teams: BplPublicTeam[] }[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-widest text-blue-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          Participating Teams
        </h2>
        {edition.teams && edition.teams.length > 0 && (
          <span className="text-xs text-amber-300 font-mono font-semibold">{edition.teams.length} Teams</span>
        )}
      </div>

      {edition.teams && edition.teams.length > 0 ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label ?? "all"} className="space-y-3">
              {group.label && (
                <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-300">{group.label}</h3>
              )}
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.teams.map((team) => {
                  const card = (
                    <>
                      <TeamMark team={team} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-amber-300 transition-colors">
                          {team.name}
                        </h3>
                        <p className="text-[11px] font-mono font-medium text-blue-200/70 uppercase">
                          {team.shortCode || "TEAM"}
                        </p>
                      </div>
                    </>
                  );
                  const className =
                    "group relative flex items-center gap-3 p-3.5 rounded-xl border border-blue-500/20 bg-gradient-to-b from-[#0e2249]/70 to-[#091733]/70 hover:bg-[#132854]/80 hover:border-amber-400/40 transition-all shadow-md";
                  if (!tournamentId) {
                    return (
                      <div key={team.id} className={className}>
                        {card}
                      </div>
                    );
                  }
                  return (
                    <Link key={team.id} href={`/tournament/${tournamentId}/cricket/team/${team.id}`} className={className}>
                      {card}
                    </Link>
                  );
                })}
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
  );
}

function StaticSponsorRow({
  sponsors,
  title,
  subtitle,
}: {
  sponsors: BplEditionSponsor[];
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-3.5">
      <div className="space-y-0.5 px-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-blue-200 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          {title}
        </h3>
        <p className="text-[11px] text-blue-200/70">{subtitle}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {sponsors.map((sponsor) => (
          <SponsorLogoCard key={sponsor.id} sponsor={sponsor} size="carousel" />
        ))}
      </div>
    </div>
  );
}

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
