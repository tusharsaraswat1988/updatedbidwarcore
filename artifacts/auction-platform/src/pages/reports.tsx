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
        {loadingSummary ? (
          <div className="org-stat-grid">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="org-stat-grid">
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Total Players</p>
                <p className="org-kpi-value">{summary?.totalPlayers || 0}</p>
              </div>
              <div className="org-kpi-icon bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div>
            </div>
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Sold</p>
                <p className="org-kpi-value text-green-500">{summary?.soldPlayers || 0}</p>
              </div>
              <div className="org-kpi-icon bg-green-500/10"><UserCheck className="w-5 h-5 text-green-500" /></div>
            </div>
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Total Spent</p>
                <p className="org-kpi-value text-primary">{formatShortIndianRupee(summary?.totalSpent, unit)}</p>
              </div>
              <div className="org-kpi-icon bg-primary/10"><Wallet className="w-5 h-5 text-primary" /></div>
            </div>
            <div className="org-kpi-card flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="org-kpi-label">Highest Bid</p>
                <p className="org-kpi-value text-purple-400">{formatShortIndianRupee(summary?.highestBid, unit)}</p>
              </div>
              <div className="org-kpi-icon bg-purple-500/10"><TrendingUp className="w-5 h-5 text-purple-400" /></div>
            </div>
          </div>
        )}

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
