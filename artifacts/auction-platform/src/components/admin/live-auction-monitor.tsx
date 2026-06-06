import { useEffect, useState } from "react";
import {
  useGetAuctionState,
  getGetAuctionStateQueryKey,
  useListBids,
  getListBidsQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { AdminTournamentDetail, AdminTournamentRow, fetchAdminTournamentDetail } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveConnectionStatus } from "./live-connection-status";
import { LiveTournamentPicker } from "./live-tournament-picker";
import { ServerCountdown } from "@/components/server-countdown";

export function LiveAuctionMonitor({
  detail,
  liveTournaments,
  allTournaments,
  tournamentId,
  navigate,
}: {
  detail: AdminTournamentDetail | null;
  liveTournaments: AdminTournamentRow[];
  allTournaments: AdminTournamentRow[];
  tournamentId: number | null;
  navigate: (path: string) => void;
}) {
  const [localDetail, setLocalDetail] = useState(detail);

  useEffect(() => {
    setLocalDetail(detail);
  }, [detail]);

  useEffect(() => {
    if (!tournamentId) return;
    const timer = window.setInterval(() => {
      fetchAdminTournamentDetail(tournamentId).then((data) => {
        if (data) setLocalDetail(data);
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [tournamentId]);

  if (!tournamentId || !localDetail) {
    return (
      <div className="space-y-4">
        <LiveTournamentPicker
          tournaments={allTournaments}
          selectedId={tournamentId}
          basePath="/admin/live/monitor"
        />
        <div className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Choose a live auction to open the monitor.
          {liveTournaments.length === 1 && (
            <>
              {" "}
              <button
                className="text-primary"
                onClick={() => navigate(`/admin/live/monitor/${liveTournaments[0].id}`)}
              >
                Open {liveTournaments[0].name}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <MonitorWorkspace
      detail={localDetail}
      allTournaments={allTournaments}
      navigate={navigate}
    />
  );
}

function MonitorWorkspace({
  detail,
  allTournaments,
  navigate,
}: {
  detail: AdminTournamentDetail;
  allTournaments: AdminTournamentRow[];
  navigate: (path: string) => void;
}) {
  const t = detail.tournament;
  const tournamentId = t.id;

  const { connectionStatus } = useAuctionSocket(tournamentId);
  const { data: auctionState } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 0,
    },
  });
  const { data: bids } = useListBids(tournamentId, {
    query: {
      queryKey: getListBidsQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 0,
    },
  });

  const feedBids = (bids ?? detail.recentBids).slice(0, 16);
  const currentPlayer = auctionState?.currentPlayer;
  const status = auctionState?.status ?? t.status;

  return (
    <div className="space-y-4">
      <LiveTournamentPicker
        tournaments={allTournaments}
        selectedId={tournamentId}
        basePath="/admin/live/monitor"
      />

      <div className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-green-500/15 text-green-400">Live workspace</Badge>
              <Badge className="capitalize">{status}</Badge>
              {t.adminLocked && <Badge className="bg-red-500/15 text-red-400">Locked</Badge>}
              {t.localModeEnabled && <Badge className="bg-amber-500/15 text-amber-300">Local mode</Badge>}
              <LiveConnectionStatus tournamentId={tournamentId} />
            </div>
            <h2 className="mt-2 font-display text-xl font-black text-white">{t.name}</h2>
            <p className="text-sm text-muted-foreground">
              {t.sport} · ID #{t.id} · {t.organizerName || "No organiser linked"}
            </p>
            {connectionStatus === "disconnected" && (
              <p className="mt-1 text-xs text-amber-300">Event stream offline — bid feed may be stale.</p>
            )}
          </div>
          <Button variant="destructive" onClick={() => navigate(`/admin/live/emergency/${t.id}`)}>
            Emergency Controls
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <h3 className="font-display font-black text-white">Current lot</h3>
            {currentPlayer ? (
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Player</div>
                  <div className="font-semibold text-white">{currentPlayer.name}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Current bid</div>
                  <div className="font-semibold text-primary">
                    {auctionState?.currentBid != null
                      ? `₹${auctionState.currentBid.toLocaleString("en-IN")}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Leading team</div>
                  <div className="text-white">{auctionState?.currentBidTeamName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Timer</div>
                  <div className="text-white">
                    {auctionState?.timerEndsAt ? (
                      <ServerCountdown
                        timerEndsAt={auctionState.timerEndsAt}
                        timerType={auctionState.timerType}
                        variant="operator"
                        fallback="—"
                      />
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No player on the block.</p>
            )}
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>Sold {auctionState?.soldPlayersCount ?? detail.playerCounts.sold}</span>
              <span>Unsold {auctionState?.unsoldPlayersCount ?? detail.playerCounts.unsold}</span>
              <span>Remaining {auctionState?.remainingPlayersCount ?? detail.playerCounts.available}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/70">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-display font-black text-white">Bid Feed</h3>
              <p className="text-xs text-muted-foreground">Live bid events via auction event stream.</p>
            </div>
            <div className="divide-y divide-border">
              {feedBids.map((bid) => (
                <div key={bid.id} className="grid grid-cols-[64px_1fr] gap-2 px-4 py-2 text-sm sm:grid-cols-[80px_1fr_140px_110px] sm:gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(bid.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate text-white">{bid.playerName || "Auction event"}</span>
                  <span className="hidden truncate text-muted-foreground sm:block">{bid.teamName || "No team"}</span>
                  <span className="col-span-2 text-right font-semibold text-primary sm:col-span-1">
                    ₹{bid.amount.toLocaleString("en-IN")}
                    <span className="ml-2 text-xs font-normal text-muted-foreground sm:hidden">
                      {bid.teamName || "No team"}
                    </span>
                  </span>
                </div>
              ))}
              {!feedBids.length && (
                <div className="px-4 py-3 text-sm text-muted-foreground">No bid events yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/70">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-display font-black text-white">Connections</h3>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                <span className="text-white">Event channel</span>
                <LiveConnectionStatus tournamentId={tournamentId} />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                <span className="text-white">Live viewer</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/tournament/${t.id}/liveviewer`} target="_blank" rel="noreferrer">Open</a>
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                <span className="text-white">OBS overlay</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/tournament/${t.id}/obs`} target="_blank" rel="noreferrer">Open</a>
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-muted-foreground">
                <span>Owner apps</span>
                <span>{detail.teams.length} teams</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-muted-foreground">
                <span>Operator session</span>
                <span>{t.localModeEnabled ? "Local enabled" : "Cloud"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/70 p-4">
            <h3 className="font-display font-black text-white">Quick Actions</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" asChild>
                <a href={`/tournament/${t.id}/liveviewer`} target="_blank" rel="noreferrer">Open Viewer</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/tournament/${t.id}/obs`} target="_blank" rel="noreferrer">Open OBS</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/tournament/${t.id}/auction`} target="_blank" rel="noreferrer">Operator Panel</a>
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin/settings/reports")}>Sold Report</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
