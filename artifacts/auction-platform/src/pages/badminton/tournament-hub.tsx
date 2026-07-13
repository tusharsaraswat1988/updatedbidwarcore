/**
 * Badminton Tournament Command Center
 * Route: /tournament/:id/badminton
 */

import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Users, MapPin, Trophy, Calendar, Radio, CheckCircle2, Target,
} from "lucide-react";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonScoringFormat } from "@/hooks/use-badminton-scoring-format";
import { badmintonFetch } from "@/lib/badminton-api";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  evaluateBadmintonSetup,
  setupProgress,
} from "@/lib/badminton-setup-workflow";
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

  const { data, isLoading } = useBadmintonDashboard(tournamentId);
  const { data: branding } = useBadmintonBranding(tournamentId);
  const { data: scoringFormat } = useBadmintonScoringFormat(tournamentId);

  const { data: fixtures = [] } = useQuery({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () =>
      badmintonFetch<
        Array<{ id: number; courtId?: number | null; scheduledAt?: string | null }>
      >(tournamentId, `/fixtures`),
    enabled: !!tournamentId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <HubSkeleton tournamentId={tournamentId} />;
  }

  const d = data ?? {};
  const liveCount = d.matchesLive ?? 0;
  const totalMatches =
    (d.matchesScheduled ?? 0) + liveCount + (d.matchesCompleted ?? 0);
  const totalScheduledFixtures = fixtures.filter(
    (f) => f.courtId != null && f.scheduledAt != null,
  ).length;

  const setupItems = evaluateBadmintonSetup({
    brandingComplete: Boolean(branding?.displayName?.trim()),
    totalPlayers: d.totalPlayers ?? 0,
    totalCategories: d.totalCategories ?? 0,
    scoringFormatConfigured: Boolean(scoringFormat?.configured),
    totalFixtures: fixtures.length,
    totalCourts: d.totalCourts ?? 0,
    totalScheduledFixtures,
    totalMatches,
  });

  const { complete: setupComplete, percent, remaining } = setupProgress(setupItems);
  const isLive = liveCount > 0;
  const formatLabel =
    scoringFormat?.configured && scoringFormat.format
      ? matchFormatChipLabel(scoringFormat.format, scoringFormat.presetId)
      : undefined;

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow={setupComplete ? "Tournament Ready" : "Setup in progress"}
        title="Tournament Command Center"
        subtitle={
          setupComplete
            ? "Setup complete — run matches, broadcast, and operations from the tabs above"
            : remaining === 1
              ? "One step left — finish setup to start scoring"
              : `Finish setup to start scoring — ${remaining} steps remaining (${percent}%)`
        }
        badge={isLive ? `${liveCount} Live` : setupComplete ? "Ready" : undefined}
        actions={formatLabel ? <ScoringFormatBadge label={formatLabel} /> : undefined}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {!setupComplete ? (
          <>
            <BadmintonNextStepBanner items={setupItems} tournamentId={tournamentId} />
            <BadmintonSetupChecklist items={setupItems} tournamentId={tournamentId} />
          </>
        ) : (
          <>
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
                    {isLive
                      ? "Matches are in progress"
                      : "You're ready to score"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isLive
                      ? "Use Control Center to run courts without jumping between Scheduling, Matches, and Scoring."
                      : "Open Control Center for live court operations, or Matches to create the next match."}
                  </p>
                </div>
              </div>
              <Link href={`/tournament/${tournamentId}/badminton/control`}>
                <BtnPrimary className="w-full sm:w-auto shrink-0">
                  <Target className="w-4 h-4" />
                  Open Control Center
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
              <HubKpiCard label="Categories" value={d.totalCategories ?? 0} icon={Trophy} tint="purple" />
              <HubKpiCard label="Scheduled" value={d.matchesScheduled ?? 0} icon={Calendar} tint="muted" />
              <HubKpiCard label="Live Now" value={liveCount} icon={Radio} tint="red" pulse={liveCount > 0} />
              <HubKpiCard label="Completed" value={d.matchesCompleted ?? 0} icon={CheckCircle2} tint="green" />
            </div>
          </>
        )}
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
