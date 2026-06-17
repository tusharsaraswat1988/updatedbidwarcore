/**
 * Badminton Tournament Command Center
 * Route: /tournament/:id/badminton
 */

import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Users, MapPin, Trophy, Calendar, Radio, CheckCircle2,
  Palette, ClipboardList, Target, BarChart3, GitBranch, Shield,
} from "lucide-react";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { badmintonFetch } from "@/lib/badminton-api";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  evaluateBadmintonSetup,
} from "@/lib/badminton-setup-workflow";
import { badmintonBroadcastPath } from "@/lib/badminton-broadcast-urls";
import {
  HubPageShell,
  PageHeader,
  HubKpiCard,
  HubSectionHeader,
  HubQuickAction,
  HubMatchCard,
} from "@/components/badminton/page-chrome";
import {
  BadmintonSetupChecklist,
  BadmintonNextStepBanner,
} from "@/components/badminton/setup-checklist";
import { Skeleton } from "@/components/ui/skeleton";

export default function BadmintonTournamentHub() {
  const [, params] = useRoute("/tournament/:id/badminton");
  const tournamentId = parseInt(params?.id ?? "0");

  const { data, isLoading } = useBadmintonDashboard(tournamentId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const { data: fixtures = [] } = useQuery({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch<Array<{ id: number }>>(tournamentId, `/fixtures`),
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

  const setupItems = evaluateBadmintonSetup({
    brandingComplete: Boolean(branding?.displayName?.trim()),
    totalPlayers: d.totalPlayers ?? 0,
    totalCategories: d.totalCategories ?? 0,
    totalFixtures: fixtures.length,
    totalCourts: d.totalCourts ?? 0,
    totalMatches,
    matchesCompleted: d.matchesCompleted ?? 0,
  });

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Tournament Operations"
        title="Tournament Command Center"
        subtitle="Follow the setup checklist, then run matches and broadcast"
        badge={liveCount > 0 ? `${liveCount} Live` : undefined}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        <BadmintonNextStepBanner items={setupItems} tournamentId={tournamentId} />
        <BadmintonSetupChecklist items={setupItems} tournamentId={tournamentId} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <HubKpiCard label="Total Players" value={d.totalPlayers ?? 0} icon={Users} tint="blue" />
          <HubKpiCard label="Courts" value={d.totalCourts ?? 0} icon={MapPin} tint="muted" />
          <HubKpiCard label="Categories" value={d.totalCategories ?? 0} icon={Trophy} tint="purple" />
          <HubKpiCard label="Scheduled" value={d.matchesScheduled ?? 0} icon={Calendar} tint="muted" />
          <HubKpiCard label="Live Now" value={liveCount} icon={Radio} tint="red" pulse={liveCount > 0} />
          <HubKpiCard label="Completed" value={d.matchesCompleted ?? 0} icon={CheckCircle2} tint="green" />
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

        <section>
          <HubSectionHeader
            title="Setup workflow"
            subtitle="Work through these in order — same sequence as the checklist above"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <HubQuickAction
              icon={Palette}
              title="Branding"
              desc="Logo, colors, sponsors"
              href={`/tournament/${tournamentId}/badminton/branding`}
            />
            <HubQuickAction
              icon={Users}
              title="Players"
              desc="Register your roster"
              href={`/tournament/${tournamentId}/badminton/players`}
            />
            <HubQuickAction
              icon={Trophy}
              title="Categories"
              desc="Create event divisions"
              href={`/tournament/${tournamentId}/badminton/categories`}
            />
            <HubQuickAction
              icon={GitBranch}
              title="Draws"
              desc="Generate knockout fixtures"
              href={`/tournament/${tournamentId}/badminton/categories`}
            />
            <HubQuickAction
              icon={MapPin}
              title="Courts"
              desc="Assign playing venues"
              href={`/tournament/${tournamentId}/badminton/courts`}
            />
            <HubQuickAction
              icon={Target}
              title="Matches"
              desc="Schedule, umpire & director links"
              href={`/tournament/${tournamentId}/badminton/matches`}
            />
            <HubQuickAction
              icon={Shield}
              title="Match Control"
              desc="Director admin — pause, retirement"
              href={`/tournament/${tournamentId}/badminton/matches`}
            />
            <HubQuickAction
              icon={Radio}
              title="Broadcast"
              desc="Displays, OBS, scorer links"
              href={badmintonBroadcastPath(tournamentId)}
            />
            <HubQuickAction
              icon={BarChart3}
              title="Analytics"
              desc="Tournament statistics"
              href={`/tournament/${tournamentId}/badminton/analytics`}
            />
          </div>
        </section>
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
