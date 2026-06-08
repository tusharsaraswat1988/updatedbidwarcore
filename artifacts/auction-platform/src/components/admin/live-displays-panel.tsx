import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AdminTournamentDetail, AdminTournamentRow, fetchAdminTournamentDetail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LiveConnectionStatus } from "./live-connection-status";
import { tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { LiveTournamentPicker } from "./live-tournament-picker";
import { liveViewerPath } from "@/lib/tournament-navigation";

function DisplayEndpointRow({
  label,
  href,
  tournamentId,
}: {
  label: string;
  href: string;
  tournamentId: number;
}) {
  return (
    <div className="space-y-3 px-4 py-3 text-sm md:grid md:grid-cols-[1fr_140px_120px_100px] md:items-center md:gap-4 md:space-y-0">
      <span className="text-white">{label}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{href}</span>
      <LiveConnectionStatus tournamentId={tournamentId} />
      <Button variant="outline" size="sm" asChild>
        <a href={href} target="_blank" rel="noreferrer">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open
        </a>
      </Button>
    </div>
  );
}

export function LiveDisplaysPanel({
  tournaments,
  tournamentId,
  detail,
  pickerHref = (id) => tournamentLiveOpsPath(id, "displays"),
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

  const liveRows = tournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked);

  if (!tournamentId || !localDetail) {
    return (
      <div className="space-y-4">
        <LiveTournamentPicker tournaments={tournaments} selectedId={tournamentId} buildHref={pickerHref} onNavigate={onNavigate} showPicker={showPicker} />
        <div className="rounded-xl border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-black text-white">All live display endpoints</h2>
            <p className="text-xs text-muted-foreground">Quick links for every active auction room.</p>
          </div>
          <div className="divide-y divide-border">
            {liveRows.map((t) => (
              <div key={t.id} className="space-y-3 px-4 py-3 text-sm md:grid md:grid-cols-[1fr_180px_120px] md:items-center md:gap-4 md:space-y-0">
                <div>
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-muted-foreground">#{t.id} · {t.sport}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={liveViewerPath(t.id)} target="_blank" rel="noreferrer">Viewer</a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/tournament/${t.id}/obs`} target="_blank" rel="noreferrer">Broadcast</a>
                  </Button>
                </div>
                <LiveConnectionStatus tournamentId={t.id} />
              </div>
            ))}
            {!liveRows.length && (
              <div className="px-4 py-3 text-sm text-muted-foreground">No live auctions with display endpoints.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const t = localDetail.tournament;
  const base = `/tournament/${t.id}`;

  return (
    <div className="space-y-4">
      <LiveTournamentPicker tournaments={tournaments} selectedId={tournamentId} buildHref={pickerHref} onNavigate={onNavigate} showPicker={showPicker} />
      <div className="rounded-xl border border-border bg-card/70">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-black text-white">{t.name}</h2>
          <p className="text-xs text-muted-foreground">
            Live viewer and Broadcast Overlay endpoints · auction event channel status per endpoint group.
          </p>
        </div>
        <div className="hidden gap-4 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid md:grid-cols-[1fr_140px_120px_100px]">
          <span>Endpoint</span>
          <span>Path</span>
          <span>Events</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          <DisplayEndpointRow label="Live viewer" href={liveViewerPath(t.id)} tournamentId={t.id} />
          <DisplayEndpointRow label="Broadcast Overlay" href={`${base}/obs`} tournamentId={t.id} />
          <DisplayEndpointRow label="Break timer display" href={`${base}/break-timer`} tournamentId={t.id} />
        </div>
      </div>
    </div>
  );
}
