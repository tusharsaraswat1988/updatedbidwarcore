/**
 * Badminton Tournament Analytics
 * Route: /tournament/:id/badminton/analytics
 */

import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";
import { PageHeader } from "@/components/badminton/page-chrome";

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
  const hubHref = `/tournament/${tournamentId}/badminton`;

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
    <div className="min-h-screen bg-[#060c1a] text-white">
      <PageHeader
        title="Analytics"
        subtitle="Tournament overview and progress"
        backHref={hubHref}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/4 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Overview KPIs */}
            <section>
              <SectionTitle title="Overview" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <StatCard label="Players" value={dashboard?.totalPlayers ?? 0} icon="👤" color="blue" />
                <StatCard label="Courts" value={dashboard?.totalCourts ?? 0} icon="🏟" color="cyan" />
                <StatCard label="Categories" value={dashboard?.totalCategories ?? 0} icon="🏆" color="purple" />
                <StatCard label="Completion Rate" value={`${completionRate}%`} icon="📈" color="green" />
              </div>
            </section>

            {/* Match breakdown */}
            <section>
              <SectionTitle title="Match Status" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <StatCard label="Total Matches" value={totalMatches} icon="📋" color="gray" />
                <StatCard label="Scheduled" value={scheduled} icon="📅" color="gray" />
                <StatCard label="Live Now" value={live} icon="🔴" color="red" pulse={live > 0} />
                <StatCard label="Completed" value={completed} icon="✅" color="green" />
              </div>

              {totalMatches > 0 && (
                <div className="mt-4 rounded-2xl bg-[#0d1529] border border-white/8 p-5">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Progress</p>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0070f3] to-[#4fc3f7] rounded-full transition-all"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <p className="text-white/30 text-xs mt-2">
                    {completed} of {totalMatches} matches completed
                  </p>
                </div>
              )}
            </section>

            {/* Category enrollment */}
            {categoryStats.length > 0 && (
              <section>
                <SectionTitle title="Category Enrollment" />
                <div className="mt-4 space-y-2">
                  {categoryStats.map(({ category, total, accepted }) => {
                    const max = Math.max(...categoryStats.map((s) => s.accepted), 1);
                    const pct = Math.round((accepted / max) * 100);
                    return (
                      <div
                        key={category.id}
                        className="rounded-xl bg-[#0d1529] border border-white/8 p-4"
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <div>
                            <p className="text-white font-semibold text-sm">{category.name}</p>
                            <p className="text-white/30 text-xs capitalize">
                              {category.matchType.replace("_", " ")} · {category.phase.replace("_", " ")}
                            </p>
                          </div>
                          <span className="text-white font-black text-lg">{accepted}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-purple-500/70 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {total !== accepted && (
                          <p className="text-white/25 text-xs mt-1">{total - accepted} pending/withdrawn</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Court usage */}
            {courtUsage.size > 0 && (
              <section>
                <SectionTitle title="Matches by Court" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {[...courtUsage.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([court, count]) => (
                      <div
                        key={court}
                        className="rounded-xl bg-[#0d1529] border border-white/8 p-4 text-center"
                      >
                        <p className="text-white/40 text-xs uppercase tracking-wider">{court}</p>
                        <p className="text-2xl font-black text-white mt-1">{count}</p>
                        <p className="text-white/30 text-xs">matches</p>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Quick links */}
            <section>
              <SectionTitle title="Manage" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <ManageLink href={`/tournament/${tournamentId}/badminton/players`} label="Players" icon="👤" />
                <ManageLink href={`/tournament/${tournamentId}/badminton/courts`} label="Courts" icon="🏟" />
                <ManageLink href={`/tournament/${tournamentId}/badminton/categories`} label="Categories" icon="🏆" />
                <ManageLink href={`/tournament/${tournamentId}/badminton/matches`} label="Matches" icon="📋" />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">{title}</h2>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  pulse,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: "blue" | "cyan" | "purple" | "green" | "red" | "gray" | "amber";
  pulse?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: "from-[#0070f3]/20 to-transparent border-[#0070f3]/20",
    cyan: "from-[#4fc3f7]/20 to-transparent border-[#4fc3f7]/20",
    purple: "from-purple-500/20 to-transparent border-purple-500/20",
    green: "from-green-500/20 to-transparent border-green-500/20",
    red: "from-red-500/20 to-transparent border-red-500/20",
    gray: "from-white/5 to-transparent border-white/8",
    amber: "from-amber-500/20 to-transparent border-amber-500/20",
  };

  return (
    <div className={cn(
      "rounded-2xl bg-gradient-to-b border p-4",
      colors[color],
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        {pulse && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function ManageLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href}>
      <div className="rounded-xl bg-[#0d1529] border border-white/8 p-4 hover:bg-white/5 transition-colors cursor-pointer text-center">
        <span className="text-2xl">{icon}</span>
        <p className="text-white font-semibold text-sm mt-2">{label}</p>
      </div>
    </Link>
  );
}
