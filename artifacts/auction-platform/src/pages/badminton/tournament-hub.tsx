/**
 * Badminton Tournament Command Center / Setup landing
 * Route: /tournament/:id/badminton
 *
 * Incomplete setup → checklist + next step
 * Setup complete → Tournament Command Center
 */

import { useRoute, Link, useLocation } from "wouter";
import {
  Users, MapPin, Trophy, Calendar, Radio, CheckCircle2, Target,
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
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import {
  BadmintonSetupChecklist,
  BadmintonNextStepBanner,
} from "@/components/badminton/setup-checklist";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { matchFormatChipLabel } from "@/lib/match-format-display";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function BadmintonTournamentHub() {
  const [, params] = useRoute("/tournament/:id/badminton");
  const tournamentId = parseInt(params?.id ?? "0");
  const [, setLocation] = useLocation();

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
          eyebrow="Setup"
          title={atReady ? "Tournament Ready" : "Tournament Setup"}
          subtitle={
            atReady
              ? "Setup is complete — open the Operator Panel to run the tournament."
              : remaining === 1
                ? "One step left to finish setup"
                : `${remaining} steps remaining (${percent}%)`
          }
          badge={atReady ? "Ready" : undefined}
        />

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {atReady ? (
            <>
              <div className={cn(hubPanelClass, "flex flex-col sm:flex-row sm:items-center gap-4")}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-lg bg-green-500/15 shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
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
        eyebrow="Dashboard"
        title="Tournament Dashboard"
        subtitle={
          isLive
            ? "Matches in progress — run courts and broadcast from the Operator Panel"
            : "Setup complete — manage matches and operations from the sidebar"
        }
        badge={isLive ? `${liveCount} Live` : "Ready"}
        actions={formatLabel ? <ScoringFormatBadge label={formatLabel} /> : undefined}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        <div className={cn(hubPanelClass, "flex flex-col sm:flex-row sm:items-center gap-4")}>
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2.5 rounded-lg bg-green-500/15 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-green-400">
                {isLive ? "Tournament live" : "Tournament ready"}
              </p>
              <h2 className="text-base font-display font-bold text-foreground mt-0.5">
                {isLive ? "Matches are in progress" : "You're ready to score"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isLive
                  ? "Use the Operator Panel to run courts without jumping between pages."
                  : "Open the Operator Panel for court control, or Matches to create the next match."}
              </p>
            </div>
          </div>
          <Link href={`/tournament/${tournamentId}/badminton/control`}>
            <BtnPrimary className="w-full sm:w-auto shrink-0">
              <Target className="w-4 h-4" />
              Open Operator Panel
            </BtnPrimary>
          </Link>
        </div>

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
                    leftIdentity={state ? identityFromSideInfo(state.leftSide, { preferShort: true }) : undefined}
                    rightIdentity={state ? identityFromSideInfo(state.rightSide, { preferShort: true }) : undefined}
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
          <HubKpiCard label="Completed" value={d.matchesCompleted ?? 0} icon={CheckCircle2} tint="green" />
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
