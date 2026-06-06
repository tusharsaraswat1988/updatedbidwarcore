import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AdminTournamentDetail, AdminTournamentRow, fetchAdminTournamentDetail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LiveTournamentPicker } from "./live-tournament-picker";

export function LiveOwnerAppsPanel({
  tournaments,
  tournamentId,
  detail,
}: {
  tournaments: AdminTournamentRow[];
  tournamentId: number | null;
  detail: AdminTournamentDetail | null;
}) {
  const [localDetail, setLocalDetail] = useState(detail);

  useEffect(() => {
    setLocalDetail(detail);
  }, [detail]);

  useEffect(() => {
    if (!tournamentId) return;
    fetchAdminTournamentDetail(tournamentId).then((data) => {
      if (data) setLocalDetail(data);
    });
  }, [tournamentId]);

  const liveSummary = useMemo(
    () => tournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked),
    [tournaments],
  );

  if (!tournamentId || !localDetail) {
    return (
      <div className="space-y-4">
        <LiveTournamentPicker tournaments={tournaments} selectedId={tournamentId} basePath="/admin/live/owner-apps" />
        <div className="rounded-xl border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-black text-white">Live owner app coverage</h2>
            <p className="text-xs text-muted-foreground">Team owner panels for active auctions.</p>
          </div>
          <div className="divide-y divide-border">
            {liveSummary.map((t) => (
              <button
                key={t.id}
                className="block w-full space-y-2 px-4 py-3 text-left text-sm hover:bg-accent/40 md:grid md:grid-cols-[1fr_160px_120px] md:items-center md:gap-4 md:space-y-0"
                onClick={() => { window.location.href = `/admin/live/owner-apps/${t.id}`; }}
              >
                <div>
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.organizerName || "No organiser"}</div>
                </div>
                <span className="text-muted-foreground">Open team list</span>
                <span className="text-xs text-primary">View teams →</span>
              </button>
            ))}
            {!liveSummary.length && (
              <div className="px-4 py-3 text-sm text-muted-foreground">No live auctions with owner apps.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const t = localDetail.tournament;
  const lastBidByTeam = new Map<number, string>();
  for (const bid of localDetail.recentBids) {
    // recentBids don't include teamId — match by team name for display only
    const team = localDetail.teams.find((team) => team.name === bid.teamName);
    if (team && !lastBidByTeam.has(team.id)) {
      lastBidByTeam.set(team.id, new Date(bid.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
  }

  return (
    <div className="space-y-4">
      <LiveTournamentPicker tournaments={tournaments} selectedId={tournamentId} basePath="/admin/live/owner-apps" />
      <div className="rounded-xl border border-border bg-card/70">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-black text-white">{t.name}</h2>
          <p className="text-xs text-muted-foreground">
            {localDetail.teams.length} owner app endpoints · purse usage and recent activity.
          </p>
        </div>
        <div className="hidden gap-4 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid md:grid-cols-[1fr_140px_120px_120px_90px]">
          <span>Team / owner</span>
          <span>Purse used</span>
          <span>Last bid</span>
          <span>Owner app</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          {localDetail.teams.map((team) => (
            <div key={team.id} className="space-y-2 border-b border-border px-4 py-3 text-sm last:border-b-0 md:grid md:grid-cols-[1fr_140px_120px_120px_90px] md:items-center md:gap-4 md:space-y-0 md:border-b-0">
              <div>
                <div className="font-semibold text-white">{team.name}</div>
                <div className="text-xs text-muted-foreground">{team.ownerName || "No owner name"}</div>
              </div>
              <span className="text-muted-foreground">
                ₹{team.purseUsed.toLocaleString("en-IN")} / ₹{team.purse.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-muted-foreground">{lastBidByTeam.get(team.id) || "—"}</span>
              <span className="font-mono text-xs text-muted-foreground">/owner/{team.id}</span>
              <Button variant="outline" size="sm" asChild>
                <a href={`/tournament/${t.id}/owner/${team.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            </div>
          ))}
          {!localDetail.teams.length && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No teams configured for this tournament.</div>
          )}
        </div>
      </div>
    </div>
  );
}
