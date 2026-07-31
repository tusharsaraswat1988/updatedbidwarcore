/**

 * Badminton Tournament Analytics

 * Route: /tournament/:id/badminton/analytics

 */



import { useRoute } from "wouter";

import { useQuery } from "@tanstack/react-query";

import {

  Users, MapPin, Trophy, TrendingUp, ClipboardList, Calendar, Radio, CheckCircle2, ListTree,

} from "lucide-react";

import { badmintonFetch, fetchBadmintonMatches } from "@/lib/badminton-api";
import { isTerminalScoringMatchStatus } from "@workspace/badminton-core";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";

import {

  HubPageShell,

  HubKpiCard,

  HubSectionHeader,

  HubQuickAction,

  EmptyState,

  hubPanelClass,

  hubCardClass,

} from "@/components/badminton/page-chrome";
import {
  BadmintonIaPageChrome,
} from "@/components/badminton/ia-workflow-chrome";

import { Skeleton } from "@/components/ui/skeleton";

import { Progress } from "@/components/ui/progress";

import { cn } from "@/lib/utils";



interface BadmintonCategory {

  id: number;

  name: string;

  phase: string;

  matchType: string;

}



interface MatchRow {

  id: number;

  status: string;

  detail: Record<string, unknown> | null;

}



interface RegistrationRow {

  registration: { id: number; status: string };

}

interface TournamentAnalytics {
  longestRally: number | null;
  longestRallyMatchId: number | null;
  fastestMatchMinutes: number | null;
  totalRallies: number | null;
  matchesCompleted: number | null;
  analyticsJson: Record<string, unknown> | null;
}



export default function BadmintonAnalyticsPage() {

  const [, params] = useRoute("/tournament/:id/badminton/analytics");

  const tournamentId = parseInt(params?.id ?? "0");



  const { data: dashboard, isLoading: dashLoading } = useBadmintonDashboard(tournamentId);



  const { data: categories = [] } = useQuery<BadmintonCategory[]>({

    queryKey: ["badminton-categories", tournamentId],

    queryFn: () => badmintonFetch(tournamentId, `/categories`),

    enabled: !!tournamentId,

  });



  const { data: matches = [] } = useQuery<MatchRow[]>({

    queryKey: ["badminton-matches", tournamentId],

    queryFn: () => fetchBadmintonMatches(tournamentId),

    enabled: !!tournamentId,

  });

  const { data: tournamentAnalytics } = useQuery<TournamentAnalytics | null>({

    queryKey: ["badminton-analytics", tournamentId],

    queryFn: () => badmintonFetch(tournamentId, `/analytics`),

    enabled: !!tournamentId,

  });



  const { data: categoryStats = [] } = useQuery({

    queryKey: ["badminton-analytics-categories", tournamentId, categories.map((c) => c.id).sort((a,b)=>a-b).join(",")],

    queryFn: async () => {

      const stats = await Promise.all(

        categories.map(async (cat) => {

          const regs = await badmintonFetch<RegistrationRow[]>(

            tournamentId,

            `/categories/${cat.id}/registrations`,

          );

          const accepted = regs.filter((r) => r.registration.status === "accepted").length;

          return { category: cat, total: regs.length, accepted };

        }),

      );

      return stats;

    },

    enabled: !!tournamentId && categories.length > 0,

  });



  const totalMatches = matches.length;

  const finished = matches.filter((m) => isTerminalScoringMatchStatus(m.status)).length;

  const completed = dashboard?.matchesCompleted ?? finished;

  const live = matches.filter((m) => m.status === "live" || m.status === "paused").length;

  const scheduled = matches.filter((m) => m.status === "scheduled").length;

  const completionRate = totalMatches > 0 ? Math.round((finished / totalMatches) * 100) : 0;

  const breakdown = dashboard?.matchesCompletedBreakdown ?? null;

  const otherFinished =
    breakdown != null
      ? (breakdown.walkover ?? 0) +
        (breakdown.retired ?? 0) +
        (breakdown.disqualified ?? 0) +
        (breakdown.abandoned ?? 0)
      : matches.filter(
          (m) =>
            m.status !== "completed" && isTerminalScoringMatchStatus(m.status),
        ).length;



  const courtUsage = new Map<string, number>();

  for (const m of matches) {

    const court = (m.detail?.courtNumber as string) || (m.detail?.courtId ? `Court ${m.detail.courtId}` : "Unassigned");

    courtUsage.set(court, (courtUsage.get(court) ?? 0) + 1);

  }



  const isLoading = dashLoading;



  return (

    <HubPageShell tournamentId={tournamentId}>

      <BadmintonIaPageChrome
        tournamentId={tournamentId}
        stepId="results"
        titleOverride="Insights"
        purposeOverride="Understand participation, court load, and match progress."
        taskOverride="Review analytics for planning and post-event reports."
      >

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">

        {isLoading ? (

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {Array.from({ length: 8 }).map((_, i) => (

              <Skeleton key={i} className="h-24 rounded-xl" />

            ))}

          </div>

        ) : (dashboard?.totalPlayers ?? 0) === 0 && matches.length === 0 ? (

          <EmptyState

            icon={Trophy}

            title="No tournament activity yet"

            desc="Analytics fill in as you add players, categories, and completed matches."

            action={{

              label: "Go to Dashboard",

              href: `/tournament/${tournamentId}/badminton`,

            }}

          />

        ) : (

          <>

            <section>

              <HubSectionHeader title="Overview" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">

                <HubKpiCard label="Players" value={dashboard?.totalPlayers ?? 0} icon={Users} tint="blue" />

                <HubKpiCard label="Courts" value={dashboard?.totalCourts ?? 0} icon={MapPin} tint="muted" />

                <HubKpiCard label="Categories" value={dashboard?.totalCategories ?? 0} icon={Trophy} tint="purple" />

                <HubKpiCard label="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} tint="green" />

              </div>

            </section>



            <section>

              <HubSectionHeader title="Match Status" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">

                <HubKpiCard label="Total Matches" value={totalMatches} icon={ClipboardList} tint="muted" />

                <HubKpiCard label="Scheduled" value={scheduled} icon={Calendar} tint="muted" />

                <HubKpiCard label="Live Now" value={live} icon={Radio} tint="red" pulse={live > 0} />

                <HubKpiCard label="Finished" value={completed} icon={CheckCircle2} tint="green" />

              </div>



              {otherFinished > 0 ? (

                <p className="text-muted-foreground text-xs mt-3 font-mono">

                  Includes {otherFinished} walkover / retired / DQ / abandoned

                </p>

              ) : null}



              {totalMatches > 0 && (

                <div className={cn(hubPanelClass, "mt-4")}>

                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Progress</p>

                  <Progress value={completionRate} className="h-2" />

                  <p className="text-muted-foreground text-xs mt-2 font-mono">

                    {finished} of {totalMatches} matches finished

                  </p>

                </div>

              )}

            </section>



            {tournamentAnalytics &&
            (tournamentAnalytics.totalRallies != null ||
              tournamentAnalytics.longestRally != null ||
              tournamentAnalytics.fastestMatchMinutes != null) ? (

              <section>

                <HubSectionHeader title="Tournament Stats" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">

                  {tournamentAnalytics.totalRallies != null ? (

                    <HubKpiCard

                      label="Total Rallies"

                      value={tournamentAnalytics.totalRallies}

                      icon={TrendingUp}

                      tint="blue"

                    />

                  ) : null}

                  {tournamentAnalytics.longestRally != null ? (

                    <HubKpiCard

                      label="Longest Rally"

                      value={tournamentAnalytics.longestRally}

                      icon={Radio}

                      tint="purple"

                    />

                  ) : null}

                  {tournamentAnalytics.fastestMatchMinutes != null ? (

                    <HubKpiCard

                      label="Fastest Match"

                      value={`${Math.round(tournamentAnalytics.fastestMatchMinutes)} min`}

                      icon={Calendar}

                      tint="green"

                    />

                  ) : null}

                </div>

              </section>

            ) : null}



            {categoryStats.length > 0 && (

              <section>

                <HubSectionHeader title="Category Enrollment" />

                <div className="mt-4 space-y-2">

                  {categoryStats.map(({ category, total, accepted }) => {

                    const max = Math.max(...categoryStats.map((s) => s.accepted), 1);

                    const pct = Math.round((accepted / max) * 100);

                    return (

                      <div key={category.id} className={cn(hubCardClass, "p-4")}>

                        <div className="flex items-center justify-between gap-4 mb-2">

                          <div>

                            <p className="text-foreground font-semibold text-sm">{category.name}</p>

                            <p className="text-muted-foreground text-xs capitalize font-mono">

                              {category.matchType.replace("_", " ")} · {category.phase.replace("_", " ")}

                            </p>

                          </div>

                          <span className="text-foreground font-display font-bold text-lg">{accepted}</span>

                        </div>

                        <Progress value={pct} className="h-1.5" />

                        {total !== accepted && (

                          <p className="text-muted-foreground text-xs mt-1">{total - accepted} pending/withdrawn</p>

                        )}

                      </div>

                    );

                  })}

                </div>

              </section>

            )}



            {courtUsage.size > 0 && (

              <section>

                <HubSectionHeader title="Matches by Court" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">

                  {[...courtUsage.entries()]

                    .sort((a, b) => b[1] - a[1])

                    .map(([court, count]) => (

                      <div key={court} className={cn(hubCardClass, "p-4 text-center")}>

                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-mono">{court}</p>

                        <p className="text-2xl font-display font-bold text-foreground mt-1">{count}</p>

                        <p className="text-muted-foreground text-xs">matches</p>

                      </div>

                    ))}

                </div>

              </section>

            )}



            <section>

              <HubSectionHeader title="Manage" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">

                <HubQuickAction icon={Users} title="Participants" desc="Players & officials" href={`/tournament/${tournamentId}/badminton/players`} />

                <HubQuickAction icon={MapPin} title="Tournament Setup" desc="Identity, courts, rules" href={`/tournament/${tournamentId}/badminton/branding`} />

                <HubQuickAction icon={Trophy} title="Events" desc="Event definitions" href={`/tournament/${tournamentId}/badminton/fixtures?section=events`} />
                <HubQuickAction icon={ListTree} title="Tournament Structure" desc="Events & draw" href={`/tournament/${tournamentId}/badminton/fixtures`} />
                <HubQuickAction icon={Calendar} title="Schedule" desc="Courts & times" href={`/tournament/${tournamentId}/badminton/schedule`} />

                <HubQuickAction icon={Radio} title="Live Control" desc="Run match day" href={`/tournament/${tournamentId}/badminton/control`} />
                <HubQuickAction icon={ClipboardList} title="Results" desc="Standings & summary" href={`/tournament/${tournamentId}/badminton/results`} />

              </div>

            </section>

          </>

        )}

      </div>

      </BadmintonIaPageChrome>

    </HubPageShell>

  );

}


