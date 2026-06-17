/**

 * Badminton Tournament Analytics

 * Route: /tournament/:id/badminton/analytics

 */



import { useRoute } from "wouter";

import { useQuery } from "@tanstack/react-query";

import {

  Users, MapPin, Trophy, TrendingUp, ClipboardList, Calendar, Radio, CheckCircle2,

} from "lucide-react";

import { badmintonFetch } from "@/lib/badminton-api";

import { useBadmintonDashboard } from "@/hooks/use-badminton-match";

import {

  PageHeader,

  HubPageShell,

  HubKpiCard,

  HubSectionHeader,

  HubQuickAction,

  hubPanelClass,

  hubCardClass,

} from "@/components/badminton/page-chrome";

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

    queryFn: () => badmintonFetch(tournamentId, `/matches`),

    enabled: !!tournamentId,

  });



  const { data: categoryStats = [] } = useQuery({

    queryKey: ["badminton-analytics-categories", tournamentId, categories.map((c) => c.id)],

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

  const completed = matches.filter((m) => m.status === "completed").length;

  const live = matches.filter((m) => m.status === "live").length;

  const scheduled = matches.filter((m) => m.status === "scheduled").length;

  const completionRate = totalMatches > 0 ? Math.round((completed / totalMatches) * 100) : 0;



  const courtUsage = new Map<string, number>();

  for (const m of matches) {

    const court = (m.detail?.courtNumber as string) || (m.detail?.courtId ? `Court ${m.detail.courtId}` : "Unassigned");

    courtUsage.set(court, (courtUsage.get(court) ?? 0) + 1);

  }



  const isLoading = dashLoading;



  return (

    <HubPageShell tournamentId={tournamentId}>

      <PageHeader

        title="Analytics"

        subtitle="Tournament overview and progress"

      />



      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">

        {isLoading ? (

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {Array.from({ length: 8 }).map((_, i) => (

              <Skeleton key={i} className="h-24 rounded-xl" />

            ))}

          </div>

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

                <HubKpiCard label="Completed" value={completed} icon={CheckCircle2} tint="green" />

              </div>



              {totalMatches > 0 && (

                <div className={cn(hubPanelClass, "mt-4")}>

                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Progress</p>

                  <Progress value={completionRate} className="h-2" />

                  <p className="text-muted-foreground text-xs mt-2 font-mono">

                    {completed} of {totalMatches} matches completed

                  </p>

                </div>

              )}

            </section>



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

                <HubQuickAction icon={Users} title="Players" desc="Manage roster" href={`/tournament/${tournamentId}/badminton/players`} />

                <HubQuickAction icon={MapPin} title="Courts" desc="Court setup" href={`/tournament/${tournamentId}/badminton/courts`} />

                <HubQuickAction icon={Trophy} title="Categories" desc="Draw & fixtures" href={`/tournament/${tournamentId}/badminton/categories`} />

                <HubQuickAction icon={ClipboardList} title="Matches" desc="Schedule & live" href={`/tournament/${tournamentId}/badminton/matches`} />

              </div>

            </section>

          </>

        )}

      </div>

    </HubPageShell>

  );

}


