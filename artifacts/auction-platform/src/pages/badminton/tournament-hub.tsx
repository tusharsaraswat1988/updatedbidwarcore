/**
 * Badminton operational workspace
 * Route: /tournament/:id/badminton
 *
 * Phase 5: Not an operator home. Tournament Mission Control owns home.
 * This surface is Court Operations / Scoring / Match Control entry only.
 *
 * Incomplete setup → checklist + next step (+ link to Mission Control)
 * Setup complete → operational workspace (live courts / operator panel entry)
 */

import { useRoute, Link, useLocation } from "wouter";
import {
  Users, MapPin, Trophy, Calendar, Radio, CheckCircle2, Target, Activity, Plus, ArrowRight, ListTree, ShieldCheck,
} from "lucide-react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { identityFromSideInfo } from "@/lib/team-player-identity";
import {
  completeBadmintonSetupWizard,
  useBadmintonSetup,
} from "@/hooks/use-badminton-setup";
import {
  HubPageShell,
  PageHeader,
  HubKpiCard,
  HubSectionHeader,
  HubMatchCard,
  BtnPrimary,
  BtnSecondary,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import {
  BadmintonSetupChecklist,
  BadmintonNextStepBanner,
} from "@/components/badminton/setup-checklist";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { sportsHomePath } from "@/lib/badminton-routes";

import { matchFormatChipLabel } from "@/lib/match-format-display";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function BadmintonTournamentHub() {
  const [, params] = useRoute("/tournament/:id/badminton");
  const tournamentId = parseInt(params?.id ?? "0");
  const [, setLocation] = useLocation();
  const missionControlHref = sportsHomePath(tournamentId);

  const {
    items,
    progress,
    ready,
    dashboard: data,
    scoringFormat,
    isLoading,
  } = useBadmintonSetup(tournamentId);

  if (isLoading) {
    return <HubSkeleton tournamentId={tournamentId} />;
  }

  const d = data ?? {};
  const liveCount = d.matchesLive ?? 0;
  const isScoringComplete = d.scoringPhase === "completed";
  const { complete: setupComplete, percent, remaining } = progress;
  const isLive = liveCount > 0;
  const formatLabel =
    scoringFormat?.configured && scoringFormat.format
      ? matchFormatChipLabel(scoringFormat.format, scoringFormat.presetId)
      : undefined;

  function openLiveOperations() {
    completeBadmintonSetupWizard(tournamentId);
    setLocation(`/tournament/${tournamentId}/badminton/control`);
  }

  if (!setupComplete) {
    const atReady = ready;
    return (
      <HubPageShell tournamentId={tournamentId}>
        <PageHeader
          tournamentId={tournamentId}
          eyebrow="Operations"
          title={atReady ? "Ready to Operate" : "Court Operations Setup"}
          subtitle={
            atReady
              ? "Badminton setup is complete — open the Operator Panel to run match day."
              : remaining === 1
                ? "One operational step left"
                : `${remaining} operational steps remaining (${percent}%)`
          }
          badge={atReady ? "Ready" : undefined}
        />

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {tournamentId ? (
            <div className={cn(hubPanelClass, "flex flex-col sm:flex-row sm:items-center gap-4")}>
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2.5 rounded-lg bg-primary/15 shrink-0">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-display font-bold text-foreground">
                    Tournament Dashboard
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set up competition, teams, fixtures, and schedule — then open Matches & Scoring when you are ready.
                  </p>
                </div>
              </div>
              <Link href={missionControlHref} className="w-full sm:w-auto shrink-0">
                <BtnSecondary className="w-full sm:w-auto">
                  <Activity className="w-4 h-4" />
                  Open Tournament Dashboard
                </BtnSecondary>
              </Link>
            </div>
          ) : null}
          {atReady ? (
            <>
              <div className={cn(hubPanelClass, "flex flex-col sm:flex-row sm:items-center gap-4")}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-display font-bold text-foreground">
                      Ready to operate
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use the Operator Panel for live courts, scorers, and match day.
                    </p>
                  </div>
                </div>
                <BtnPrimary className="w-full sm:w-auto shrink-0" onClick={openLiveOperations}>
                  <Target className="w-4 h-4" />
                  Open Operator Panel
                </BtnPrimary>
              </div>
              <BadmintonSetupChecklist
                items={items}
                tournamentId={tournamentId}
                forceShow
              />
            </>
          ) : (
            <>
              <BadmintonNextStepBanner items={items} tournamentId={tournamentId} />
              <BadmintonSetupChecklist items={items} tournamentId={tournamentId} />
            </>
          )}
        </div>
      </HubPageShell>
    );
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Operations"
        title="Badminton Operations"
        subtitle={
          isScoringComplete
            ? "All events finished — review Results and Tournament Summary"
            : isLive
              ? "Matches in progress — run courts and broadcast from the Operator Panel"
              : "Operational workspace — manage matches and court control from here"
        }
        badge={isScoringComplete ? "Completed" : isLive ? `${liveCount} Live` : "Ready"}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {formatLabel ? <ScoringFormatBadge label={formatLabel} /> : null}
            <Link href={`/tournament/${tournamentId}/badminton/matches`}>
              <BtnPrimary className="btn-compact">
                <Plus className="w-4 h-4" />
                Create Match
              </BtnPrimary>
            </Link>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        <div className={cn(
          hubPanelClass,
          "flex flex-col sm:flex-row sm:items-center gap-4",
          isScoringComplete && "border-emerald-500/30 bg-emerald-500/5",
        )}>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              "p-2.5 rounded-lg shrink-0",
              isScoringComplete ? "bg-emerald-500/15" : "bg-emerald-500/15",
            )}>
              <CheckCircle2 className={cn(
                "w-5 h-5",
                isScoringComplete ? "text-emerald-600 dark:text-emerald-400" : "text-emerald-600 dark:text-emerald-400",
              )} />
            </div>
            <div className="min-w-0">
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest",
                isScoringComplete ? "text-emerald-600 dark:text-emerald-400" : "text-emerald-600 dark:text-emerald-400",
              )}>
                {isScoringComplete
                  ? "Tournament completed"
                  : isLive
                    ? "Tournament live"
                    : "Tournament ready"}
              </p>
              <h2 className="text-base font-display font-bold text-foreground mt-0.5">
                {isScoringComplete
                  ? "Scoring is closed for this tournament"
                  : isLive
                    ? "Matches are in progress"
                    : "You're ready to score"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isScoringComplete
                  ? "Champions and match history remain on Results and Summary. Setup is read-only in the nav."
                  : isLive
                    ? "Use the Operator Panel to run courts without jumping between pages."
                    : "Open the Operator Panel for court control, or Matches to create the next match."}
              </p>
            </div>
          </div>
          {isScoringComplete ? (
            <Link href={`/tournament/${tournamentId}/badminton/summary`}>
              <BtnPrimary className="w-full sm:w-auto shrink-0">
                <Trophy className="w-4 h-4" />
                View Summary
              </BtnPrimary>
            </Link>
          ) : (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto shrink-0">
              <Link href={`/tournament/${tournamentId}/badminton/control`} className="flex-1 sm:flex-initial">
                <BtnPrimary className="w-full sm:w-auto">
                  <Target className="w-4 h-4" />
                  Operator Panel
                </BtnPrimary>
              </Link>
              <Link href={`/tournament/${tournamentId}/badminton/fixtures`} className="flex-1 sm:flex-initial">
                <BtnSecondary className="w-full sm:w-auto">
                  <ListTree className="w-4 h-4" />
                  Draws
                </BtnSecondary>
              </Link>
            </div>
          )}
        </div>

        {/* Operational Quick-Jump Cards */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground">
                Court Operations
              </p>
              <h3 className="text-base font-bold text-foreground">
                Badminton Operational Control Hub
              </h3>
            </div>
            <Link
              href={`/tournament/${tournamentId}/badminton/control`}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Open Multi-Court Control Center <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href={`/tournament/${tournamentId}/badminton/control`}
              className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Target className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Multi-Court Control</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Live court board, rally scores, and supervisor unlocks
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] font-semibold text-primary">
                Open Court Board →
              </div>
            </Link>

            <Link
              href={`/tournament/${tournamentId}/badminton/fixtures`}
              className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <ListTree className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Draws & Brackets</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Knockout trees, round-robin pools & seeding
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] font-semibold text-primary">
                View Draws →
              </div>
            </Link>

            <Link
              href={`/tournament/${tournamentId}/badminton/matches`}
              className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Matches & Scheduling</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Master match list, court assignments & start matches
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] font-semibold text-primary">
                Manage Matches →
              </div>
            </Link>

            <Link
              href={`/tournament/${tournamentId}/badminton/results`}
              className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Results & Champions</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Completed scores, podium standings & summaries
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/50 text-[11px] font-semibold text-primary">
                View Results →
              </div>
            </Link>
          </div>
        </section>

        {d.liveMatches?.length > 0 && (
          <section>
            <HubSectionHeader
              title="Live Matches"
              subtitle={`${d.liveMatches.length} match${d.liveMatches.length !== 1 ? "es" : ""} in progress`}
              badge="LIVE"
              badgeVariant="destructive"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
              {d.liveMatches.map((m: { id: number; detail: Record<string, unknown> | null; state: BadmintonMatchState | null }) => {
                const state = m.state as BadmintonMatchState | null;
                const detail = m.detail ?? {};
                return (
                  <HubMatchCard
                    key={m.id}
                    matchId={m.id}
                    tournamentId={tournamentId}
                    status="live"
                    leftLabel={state?.leftSide.shortLabel}
                    rightLabel={state?.rightSide.shortLabel}
                    leftIdentity={state ? identityFromSideInfo(state.leftSide) : undefined}
                    rightIdentity={state ? identityFromSideInfo(state.rightSide) : undefined}
                    leftScore={state?.leftScore}
                    rightScore={state?.rightScore}
                    currentGame={state?.currentGame}
                    gamesLeft={state?.gamesLeft}
                    gamesRight={state?.gamesRight}
                    servingSide={state?.servingSide}
                    courtNumber={detail.courtNumber ? String(detail.courtNumber) : undefined}
                    roundName={detail.roundName ? String(detail.roundName) : undefined}
                  />
                );
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <HubKpiCard label="Total Players" value={d.totalPlayers ?? 0} icon={Users} tint="blue" />
          <HubKpiCard label="Courts" value={d.totalCourts ?? 0} icon={MapPin} tint="muted" />
          <HubKpiCard label="Events" value={d.totalCategories ?? 0} icon={Trophy} tint="purple" />
          <HubKpiCard label="Scheduled" value={d.matchesScheduled ?? 0} icon={Calendar} tint="muted" />
          <HubKpiCard label="Live Now" value={liveCount} icon={Radio} tint="red" pulse={liveCount > 0} />
          <HubKpiCard label="Finished" value={d.matchesCompleted ?? 0} icon={CheckCircle2} tint="green" />
        </div>
      </div>
    </HubPageShell>
  );
}

function HubSkeleton({ tournamentId }: { tournamentId: number }) {
  return (
    <HubPageShell tournamentId={tournamentId}>
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </HubPageShell>
  );
}
