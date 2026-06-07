import { useEffect, useState } from "react";
import { ExternalLink, MonitorDown } from "lucide-react";
import { AdminTournamentDetail, AdminTournamentRow, fetchAdminTournamentDetail } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveConnectionStatus } from "./live-connection-status";
import { tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { LiveTournamentPicker } from "./live-tournament-picker";

export function LiveOperatorSessionsPanel({
  tournaments,
  tournamentId,
  detail,
  pickerHref = (id) => tournamentLiveOpsPath(id, "sessions"),
  onNavigate,
  showPicker = true,
}: {
  tournaments: AdminTournamentRow[];
  tournamentId: number | null;
  detail: AdminTournamentDetail | null;
  pickerHref?: (tournamentId: number) => string;
  onNavigate?: (href: string) => void;
  showPicker?: boolean;
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

  const sessionRows = tournaments.filter((t) => t.licenseStatus === "active" || t.licenseStatus === "trial");

  if (!tournamentId || !localDetail) {
    return (
      <div className="space-y-4">
        <LiveTournamentPicker tournaments={tournaments} selectedId={tournamentId} buildHref={pickerHref} onNavigate={onNavigate} showPicker={showPicker} />
        <div className="rounded-xl border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-black text-white">Operator sessions</h2>
            <p className="text-xs text-muted-foreground">Cloud and local-mode operator readiness.</p>
          </div>
          <div className="divide-y divide-border">
            {sessionRows.slice(0, 12).map((t) => (
              <button
                key={t.id}
                className="block w-full space-y-2 px-4 py-3 text-left text-sm hover:bg-accent/40 md:grid md:grid-cols-[1fr_140px_140px_120px] md:items-center md:gap-4 md:space-y-0"
                onClick={() => {
                  const href = pickerHref(t.id);
                  if (onNavigate) onNavigate(href);
                  else window.location.href = href;
                }}
              >
                <div>
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-muted-foreground">#{t.id}</div>
                </div>
                <Badge className="w-fit capitalize">{t.licenseStatus}</Badge>
                <span className="text-muted-foreground">{t.adminLocked ? "Locked" : "Unlocked"}</span>
                <span className="text-xs text-primary">Inspect →</span>
              </button>
            ))}
            {!sessionRows.length && (
              <div className="px-4 py-3 text-sm text-muted-foreground">No operator sessions to track.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const t = localDetail.tournament;

  return (
    <div className="space-y-4">
      <LiveTournamentPicker tournaments={tournaments} selectedId={tournamentId} buildHref={pickerHref} onNavigate={onNavigate} showPicker={showPicker} />
      <div className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="capitalize">{t.licenseStatus}</Badge>
          {t.adminLocked ? (
            <Badge className="bg-red-500/15 text-red-400">Locked</Badge>
          ) : (
            <Badge className="bg-green-500/15 text-green-400">Unlocked</Badge>
          )}
          {t.localModeEnabled && (
            <Badge className="bg-amber-500/15 text-amber-300">
              <MonitorDown className="mr-1 h-3 w-3" />
              Local mode
            </Badge>
          )}
          <LiveConnectionStatus tournamentId={t.id} />
        </div>
        <h2 className="mt-2 font-display text-xl font-black text-white">{t.name}</h2>
        <p className="text-sm text-muted-foreground">
          Operator panel and local-mode endpoints for auction control.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/70">
        <div className="hidden gap-4 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid md:grid-cols-[1fr_180px_120px_100px]">
          <span>Session</span>
          <span>Mode</span>
          <span>Events</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          <div className="space-y-3 px-4 py-3 text-sm md:grid md:grid-cols-[1fr_180px_120px_100px] md:items-center md:gap-4 md:space-y-0">
            <div>
              <div className="text-white">Auction operator panel</div>
              <div className="font-mono text-xs text-muted-foreground">/tournament/{t.id}/auction</div>
            </div>
            <span className="text-muted-foreground">{t.localModeEnabled ? "Local-capable" : "Cloud"}</span>
            <LiveConnectionStatus tournamentId={t.id} />
            <Button variant="outline" size="sm" asChild>
              <a href={`/tournament/${t.id}/auction`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open
              </a>
            </Button>
          </div>
          {t.localModeEnabled && (
            <div className="space-y-3 px-4 py-3 text-sm md:grid md:grid-cols-[1fr_180px_120px_100px] md:items-center md:gap-4 md:space-y-0">
              <div>
                <div className="text-white">Local mode console</div>
                <div className="font-mono text-xs text-muted-foreground">/tournament/{t.id}/local-mode</div>
              </div>
              <span className="text-amber-300">Local mode ON</span>
              <span className="text-xs text-muted-foreground">N/A</span>
              <Button variant="outline" size="sm" asChild>
                <a href={`/tournament/${t.id}/local-mode`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Teams</div>
          <div className="mt-2 text-2xl font-black text-white">{localDetail.teams.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Players sold</div>
          <div className="mt-2 text-2xl font-black text-white">{localDetail.playerCounts.sold}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Resets</div>
          <div className="mt-2 text-2xl font-black text-white">{t.resetCount ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
