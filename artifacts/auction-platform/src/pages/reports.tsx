import { useRoute, useSearch } from "wouter";
import {
  useGetTournamentSummary,
  useGetTournament,
  getGetTournamentSummaryQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { Users, Wallet, TrendingUp, BarChart3, UserCheck, FileText } from "lucide-react";
import { formatShortIndianRupee, normalizeAuctionUnit } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportCenter } from "@/components/reports/report-center";
import { TEAM_PLANNING_SHEET_ID } from "@/pages/team-reports";
import { KpiCard } from "@/components/ui/kpi-card";

export default function Reports() {
  const [, params] = useRoute("/tournament/:id/reports");
  const search = useSearch();
  const tournamentId = parseInt(params?.id || "0");
  const openPlanningSheet = new URLSearchParams(search).get("doc") === "planning";

  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const unit = normalizeAuctionUnit(tournament?.auctionUnit);

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="org-page-content">
        <OrganizerSectionHeader
          tournament={tournament}
          title={<span className="flex items-center gap-2"><BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-primary" /> Reports & Document Center</span>}
          description="Tournament intelligence, squad worksheets, visual posters, and official exports."
        />

        {/* Summary Stats */}
        <div className="org-stat-grid">
          <KpiCard
            label="Total Players"
            value={summary?.totalPlayers || 0}
            icon={<Users className="w-5 h-5 text-blue-600" />}
            iconBg="bg-blue-500/10 border-blue-500/30"
            loading={loadingSummary}
          />
          <KpiCard
            label="Sold"
            value={summary?.soldPlayers || 0}
            valueClassName="text-emerald-700"
            icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
            iconBg="bg-emerald-500/10 border-emerald-500/30"
            loading={loadingSummary}
          />
          <KpiCard
            label="Total Spent"
            value={formatShortIndianRupee(summary?.totalSpent, unit)}
            icon={<Wallet className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-500/10 border-amber-500/30"
            loading={loadingSummary}
          />
          <KpiCard
            label="Highest Bid"
            value={formatShortIndianRupee(summary?.highestBid, unit)}
            valueClassName="text-purple-700"
            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
            iconBg="bg-purple-500/10 border-purple-500/30"
            loading={loadingSummary}
          />
        </div>

        {/* ─── Integrated Reports & Posters Center ─────────────────────────── */}
        <div className="space-y-4">
          <ReportCenter
            tournamentId={tournamentId}
            hideTournamentSelector={true}
            initialReport={openPlanningSheet ? TEAM_PLANNING_SHEET_ID : null}
          />
        </div>
      </div>
    </AppLayout>
  );
}
