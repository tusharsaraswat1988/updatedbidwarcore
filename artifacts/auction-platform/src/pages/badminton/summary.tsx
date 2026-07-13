/**
 * Tournament Summary & Awards
 * Route: /tournament/:id/badminton/summary
 *
 * Official closing page — not Analytics, not Results.
 * Read-only aggregates from completed matches, champions, branding.
 */

import { useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  Award,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  MapPin,
  Printer,
  QrCode,
  Trophy,
  Users,
} from "lucide-react";
import { badmintonFetch } from "@/lib/badminton-api";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";
import { badmintonHubPath } from "@/lib/badminton-routes";
import {
  badmintonQrImageUrl,
  badmintonTournamentSummaryUrl,
} from "@/lib/badminton-broadcast-urls";
import {
  buildTournamentSummary,
  formatDuration,
  formatMatchDates,
  formatSummaryWhen,
  type CourtPerformance,
} from "@/lib/badminton-tournament-summary";
import type {
  ResultsCategory,
  ResultsCollection,
  ResultsFixture,
  ResultsMatch,
} from "@/lib/badminton-results";
import { SummaryChampionCard } from "@/components/badminton/summary-champion-card";
import {
  EmptyState,
  HubPageShell,
  HubKpiCard,
  PageHeader,
  hubCardClass,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { exportElementToPdf, printElementAsPdf } from "@/lib/export-element-pdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TournamentMeta = {
  name?: string;
  matchDates?: string | null;
  venue?: string | null;
  organizerName?: string | null;
  scoringPhase?: string | null;
};

type PlayerRow = {
  franchiseName?: string | null;
  teamName?: string | null;
};

export default function BadmintonSummaryPage() {
  const [, params] = useRoute("/tournament/:id/badminton/summary");
  const tournamentId = parseInt(params?.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: branding } = useBadmintonBranding(tournamentId);
  const { data: dashboard } = useBadmintonDashboard(tournamentId);

  const { data: tournament } = useQuery<TournamentMeta>({
    queryKey: ["tournament-meta", tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tournament");
      return res.json();
    },
    enabled: !!tournamentId,
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery<ResultsMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
  });

  const { data: fixtures = [] } = useQuery<ResultsFixture[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures`),
    enabled: !!tournamentId,
  });

  const { data: collections = [] } = useQuery<ResultsCollection[]>({
    queryKey: ["badminton-fixture-collections", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixture-collections`),
    enabled: !!tournamentId,
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<ResultsCategory[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  const { data: players = [] } = useQuery<PlayerRow[]>({
    queryKey: ["badminton-players", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/players`),
    enabled: !!tournamentId,
  });

  const summary = useMemo(
    () =>
      buildTournamentSummary({
        categories,
        matches,
        fixtures,
        collections,
        courtsCount: dashboard?.totalCourts ?? 0,
        playersCount: dashboard?.totalPlayers ?? players.length,
        players,
      }),
    [categories, matches, fixtures, collections, dashboard, players],
  );

  const tournamentName =
    branding?.displayName?.trim() || tournament?.name?.trim() || "Tournament";
  const venue = branding?.venue?.trim() || tournament?.venue?.trim() || "—";
  const organizer =
    branding?.organizerName?.trim() || tournament?.organizerName?.trim() || "—";
  const dates = formatMatchDates(tournament?.matchDates);
  const statusLabel = summary.isTournamentComplete
    ? "Completed"
    : matches.some((m) => m.status === "live")
      ? "Live"
      : "In Progress";

  const summaryUrl = badmintonTournamentSummaryUrl(tournamentId);
  const isLoading = matchesLoading || catsLoading;

  async function handleDownloadPdf() {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await exportElementToPdf(
        printRef.current,
        `${tournamentName.replace(/\s+/g, "-").toLowerCase()}-summary.pdf`,
      );
      toast({ title: "PDF downloaded", description: "Tournament summary saved." });
    } catch (e) {
      toast({
        title: "PDF export failed",
        description: e instanceof Error ? e.message : "Try Print Summary instead.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  async function handlePrint() {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await printElementAsPdf(printRef.current);
    } catch (e) {
      toast({
        title: "Print failed",
        description: e instanceof Error ? e.message : "Could not open print dialog.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  function copySummaryLink() {
    void navigator.clipboard.writeText(summaryUrl).then(() => {
      toast({ title: "Link copied", description: "Summary link is on your clipboard." });
    });
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Closing · Tournament Summary"
        title="Tournament Summary & Awards"
        subtitle="Official closing record — champions, courts, timeline, and awards from completed play."
      />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : matches.length === 0 && categories.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tournament data yet"
            desc="Create categories and complete matches, then return here for the official closing summary."
            action={{
              label: "Go to Command Center",
              onClick: () => navigate(badmintonHubPath(tournamentId)),
            }}
          />
        ) : (
          <>
            <div ref={printRef} className="space-y-8 summary-print-root">
              {/* Completion banner */}
              <section
                className={cn(
                  hubCardClass,
                  "relative overflow-hidden p-6 sm:p-8 border-amber-500/40",
                  "bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.22),_transparent_55%),linear-gradient(160deg,#0a0c12_0%,#12161f_55%,#0a0c12_100%)]",
                )}
              >
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[repeating-linear-gradient(-12deg,transparent,transparent_12px,rgba(255,255,255,0.4)_12px,rgba(255,255,255,0.4)_13px)]" />
                <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                  {branding?.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt=""
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain bg-white/5 border border-white/10 p-2 shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Trophy className="h-8 w-8 text-amber-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-amber-200/80 text-[10px] font-bold uppercase tracking-[0.28em]">
                      Tournament Summary
                    </p>
                    <h2 className="text-white font-display font-bold text-3xl sm:text-4xl mt-1 leading-tight">
                      {tournamentName}
                    </h2>
                    <p className="text-white/50 text-sm mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {venue}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {dates}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {organizer}
                      </span>
                    </p>
                  </div>
                  <div
                    className={cn(
                      "shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider",
                      summary.isTournamentComplete
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                        : "border-amber-500/40 bg-amber-500/15 text-amber-100",
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {statusLabel}
                  </div>
                </div>
              </section>

              {/* Section 1 — Overview stats */}
              <section className="space-y-4">
                <SectionHeading eyebrow="Section 1" title="Tournament Overview" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <HubKpiCard label="Players" value={summary.stats.players} icon={Users} tint="blue" />
                  <HubKpiCard label="Teams" value={summary.stats.teams} icon={Award} tint="purple" />
                  <HubKpiCard label="Events" value={summary.stats.events} icon={Trophy} tint="amber" />
                  <HubKpiCard label="Courts" value={summary.stats.courts} icon={MapPin} tint="muted" />
                  <HubKpiCard
                    label="Fixtures"
                    value={summary.stats.fixtures}
                    icon={Calendar}
                    tint="muted"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatTile label="Matches" value={String(summary.stats.matches)} />
                  <StatTile
                    label="Completed"
                    value={String(summary.stats.completedMatches)}
                    accent
                  />
                  <StatTile label="Walkovers" value={String(summary.stats.walkovers)} />
                  <StatTile label="Retirements" value={String(summary.stats.retirements)} />
                </div>
              </section>

              {/* Section 2 — Champions */}
              <section className="space-y-4">
                <SectionHeading
                  eyebrow="Section 2"
                  title="Champions"
                  subtitle="One champion card per completed event. Expand for winner, runner-up, and score."
                />
                {summary.champions.length === 0 ? (
                  <div className={cn(hubPanelClass, "p-6 text-sm text-muted-foreground")}>
                    Champions appear when each event finishes. Complete finals to fill this section.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {summary.champions.map((c) => (
                      <SummaryChampionCard key={c.categoryId} champion={c} />
                    ))}
                  </div>
                )}
              </section>

              {/* Section 3 — Court performance */}
              <section className="space-y-4">
                <SectionHeading
                  eyebrow="Section 3"
                  title="Court Performance"
                  subtitle="Derived from completed match start and end times."
                />
                {summary.courts.length === 0 ? (
                  <div className={cn(hubPanelClass, "p-6 text-sm text-muted-foreground")}>
                    Court stats appear after matches are completed.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summary.courts.map((court) => (
                      <CourtPerformanceCard key={court.courtKey} court={court} />
                    ))}
                  </div>
                )}
              </section>

              {/* Section 4 — Timeline */}
              <section className="space-y-4">
                <SectionHeading
                  eyebrow="Section 4"
                  title="Tournament Timeline"
                  subtitle="Key moments in chronological order."
                />
                {summary.timeline.length === 0 ? (
                  <div className={cn(hubPanelClass, "p-6 text-sm text-muted-foreground")}>
                    Timeline fills as matches complete.
                  </div>
                ) : (
                  <ol className={cn(hubPanelClass, "p-5 space-y-0")}>
                    {summary.timeline.map((ev, idx) => (
                      <li key={ev.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {idx < summary.timeline.length - 1 ? (
                          <span className="absolute left-[11px] top-6 bottom-0 w-px bg-white/10" />
                        ) : null}
                        <span className="relative z-10 mt-1 h-6 w-6 rounded-full border border-amber-500/40 bg-amber-500/20 flex items-center justify-center shrink-0">
                          <span className="h-2 w-2 rounded-full bg-amber-300" />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                            {ev.atLabel}
                          </p>
                          <p className="text-foreground font-semibold mt-0.5">{ev.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{ev.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* Section 5 — Awards */}
              <section className="space-y-4">
                <SectionHeading
                  eyebrow="Section 5"
                  title="Tournament Awards"
                  subtitle="Generated from completed matches only — no separate statistics engine."
                />
                {summary.awards.length === 0 ? (
                  <div className={cn(hubPanelClass, "p-6 text-sm text-muted-foreground")}>
                    Awards unlock once completed matches include timing data.
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {summary.awards.map((award) => (
                      <div
                        key={award.id}
                        className={cn(
                          hubCardClass,
                          "p-4 border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent",
                        )}
                      >
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-200/70">
                          {award.title}
                        </p>
                        <p className="text-foreground font-bold text-lg mt-2 leading-snug">
                          {award.value}
                        </p>
                        {award.detail ? (
                          <p className="text-xs text-muted-foreground mt-1">{award.detail}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Section 6 — Share */}
            <section className="space-y-4">
              <SectionHeading eyebrow="Section 6" title="Share" />
              <div className={cn(hubPanelClass, "p-5 flex flex-wrap gap-2")}>
                <ActionBtn
                  icon={Download}
                  label={exporting ? "Working…" : "Download PDF"}
                  onClick={() => void handleDownloadPdf()}
                  disabled={exporting}
                  primary
                />
                <ActionBtn icon={Copy} label="Copy Summary Link" onClick={copySummaryLink} />
                <ActionBtn icon={QrCode} label="Show QR" onClick={() => setQrOpen(true)} />
                <ActionBtn
                  icon={Printer}
                  label="Print Summary"
                  onClick={() => void handlePrint()}
                  disabled={exporting}
                />
              </div>
            </section>

            {/* Section 7 — Archive */}
            <section
              className={cn(
                hubCardClass,
                "p-6 sm:p-8 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent",
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center shrink-0">
                  <Archive className="h-7 w-7 text-emerald-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                    {summary.isTournamentComplete
                      ? "Tournament Completed Successfully"
                      : "Tournament Archive"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {summary.isTournamentComplete
                      ? "This tournament is now archived. Scoring history and champions remain available on Results and this Summary."
                      : "When every event is finished, this page becomes the official archived closing record."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(badmintonHubPath(tournamentId))}
                  className="h-11 px-5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-100 text-sm font-semibold shrink-0 transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm bg-zinc-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Tournament Summary</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={badmintonQrImageUrl(summaryUrl, 280)}
              alt="Tournament Summary QR code"
              className="rounded-lg bg-white p-2 w-[280px] h-[280px]"
            />
            <p className="text-[10px] text-muted-foreground font-mono break-all text-center px-2">
              {summaryUrl}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </HubPageShell>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-amber-200/60 text-[10px] font-bold uppercase tracking-[0.22em]">
        {eyebrow}
      </p>
      <h2 className="text-foreground font-display font-bold text-xl sm:text-2xl">{title}</h2>
      {subtitle ? <p className="text-muted-foreground text-sm">{subtitle}</p> : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        hubCardClass,
        "p-3",
        accent && "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50",
        primary
          ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-100"
          : "bg-white/5 hover:bg-white/10 border border-white/10 text-foreground/90",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function CourtPerformanceCard({ court }: { court: CourtPerformance }) {
  return (
    <div className={cn(hubCardClass, "p-4 space-y-3")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-foreground font-bold">{court.courtLabel}</h3>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {court.matchesPlayed} matches
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <MiniStat label="Total Court Time" value={formatDuration(court.totalCourtTimeMs)} />
        <MiniStat label="Average Match" value={formatDuration(court.averageMatchTimeMs)} />
        <MiniStat
          label="Longest"
          value={
            court.longest
              ? formatDuration(court.longest.durationMs)
              : "—"
          }
        />
        <MiniStat
          label="Shortest"
          value={
            court.shortest
              ? formatDuration(court.shortest.durationMs)
              : "—"
          }
        />
      </div>
      {court.timeline.length > 0 ? (
        <div className="pt-1 border-t border-white/5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Timeline
          </p>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
            {court.timeline.map((t) => (
              <li
                key={t.matchId}
                className="flex items-start justify-between gap-2 text-xs text-muted-foreground"
              >
                <span className="min-w-0 truncate text-foreground/80">{t.label}</span>
                <span className="shrink-0 font-mono">
                  {formatDuration(t.durationMs)}
                  {t.endedAt ? ` · ${formatSummaryWhen(t.endedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}
