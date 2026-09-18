import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  MonitorDown,
  Tv,
  Users,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { AdminTournamentDetail, AdminTournamentRow, fetchAdminTournamentDetail } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveConnectionStatus } from "./live-connection-status";
import { tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { LiveTournamentPicker } from "./live-tournament-picker";
import { liveViewerPath, sideDisplayPath } from "@/lib/tournament-navigation";
import { BroadcastControlPanel } from "@/components/broadcast/broadcast-control-panel";

type HubSubSection = "displays" | "owner-apps" | "operator";

function DisplayEndpointRow({
  label,
  description,
  href,
  tournamentId,
}: {
  label: string;
  description?: string;
  href: string;
  tournamentId: number;
}) {
  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 last:border-b-0 hover:bg-white/[0.02] transition-colors rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">{label}</span>
          {description && <span className="text-xs text-muted-foreground hidden md:inline">· {description}</span>}
        </div>
        <div className="font-mono text-xs text-muted-foreground/80 truncate mt-0.5">{href}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <LiveConnectionStatus tournamentId={tournamentId} />
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
          <a href={href} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </a>
        </Button>
      </div>
    </div>
  );
}

export function LiveConnectedEndpointsPanel({
  tournaments,
  tournamentId,
  detail,
  initialSection = "displays",
  pickerHref = (id) => tournamentLiveOpsPath(id, "endpoints"),
  onNavigate,
  showPicker = true,
}: {
  tournaments: AdminTournamentRow[];
  tournamentId: number | null;
  detail: AdminTournamentDetail | null;
  initialSection?: HubSubSection;
  pickerHref?: (tournamentId: number) => string;
  onNavigate?: (href: string) => void;
  showPicker?: boolean;
}) {
  const [localDetail, setLocalDetail] = useState(detail);
  const [subTab, setSubTab] = useState<HubSubSection>(initialSection);
  const [showObsSettings, setShowObsSettings] = useState(false);

  useEffect(() => {
    setLocalDetail(detail);
  }, [detail]);

  useEffect(() => {
    if (!tournamentId) return;
    fetchAdminTournamentDetail(tournamentId).then((data) => {
      if (data) setLocalDetail(data);
    });
  }, [tournamentId]);

  const lastBidByTeam = useMemo(() => {
    const map = new Map<number, string>();
    if (!localDetail) return map;
    for (const bid of localDetail.recentBids) {
      const team = localDetail.teams.find((t) => t.name === bid.teamName);
      if (team && !map.has(team.id)) {
        map.set(team.id, new Date(bid.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    }
    return map;
  }, [localDetail]);

  if (!tournamentId || !localDetail) {
    return (
      <div className="space-y-4">
        <LiveTournamentPicker
          tournaments={tournaments}
          selectedId={tournamentId}
          buildHref={pickerHref}
          onNavigate={onNavigate}
          showPicker={showPicker}
        />
        <div className="rounded-xl border border-border bg-card/70 p-6 text-center text-sm text-muted-foreground">
          Select a tournament to inspect connected displays, owner apps, and operator sessions.
        </div>
      </div>
    );
  }

  const t = localDetail.tournament;
  const base = `/tournament/${t.id}`;

  return (
    <div className="space-y-4">
      <LiveTournamentPicker
        tournaments={tournaments}
        selectedId={tournamentId}
        buildHref={pickerHref}
        onNavigate={onNavigate}
        showPicker={showPicker}
      />

      <div className="rounded-xl border border-border bg-card/70 p-4">
        {/* Header & Sub-tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-black text-white">{t.name}</h2>
              <Badge variant="outline" className="text-xs">{t.sport}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unified Hub for live displays, team owner portals, and operator rooms.
            </p>
          </div>

          <div className="flex rounded-lg border border-border bg-muted/20 p-1">
            <button
              onClick={() => setSubTab("displays")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                subTab === "displays"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Tv className="h-3.5 w-3.5" />
              Displays & OBS (5)
            </button>
            <button
              onClick={() => setSubTab("owner-apps")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                subTab === "owner-apps"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Owner Apps ({localDetail.teams.length})
            </button>
            <button
              onClick={() => setSubTab("operator")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                subTab === "operator"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              Operator Sessions
            </button>
          </div>
        </div>

        {/* Content of selected sub-tab */}
        <div className="mt-4">
          {subTab === "displays" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live Screen & OBS Endpoints
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-white gap-1"
                  onClick={() => setShowObsSettings(!showObsSettings)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {showObsSettings ? "Hide OBS Overlay Settings" : "Configure OBS Overlay"}
                </Button>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/10 p-1">
                <DisplayEndpointRow
                  label="Live Viewer"
                  description="Public spectator live auction screen"
                  href={liveViewerPath(t.id)}
                  tournamentId={t.id}
                />
                <DisplayEndpointRow
                  label="Broadcast Overlay (OBS)"
                  description="Transparent lower-third graphics for live stream"
                  href={`${base}/obs`}
                  tournamentId={t.id}
                />
                <DisplayEndpointRow
                  label="Pre Auction & Break Timer"
                  description="Big screen intermission countdown"
                  href={`${base}/break-timer`}
                  tournamentId={t.id}
                />
                <DisplayEndpointRow
                  label="Side LED — Sponsors"
                  description="Dedicated LED banner sponsor reel"
                  href={sideDisplayPath(t.id, "sponsors")}
                  tournamentId={t.id}
                />
                <DisplayEndpointRow
                  label="Side LED — Player Profile"
                  description="Dedicated stage profile screen"
                  href={sideDisplayPath(t.id, "player")}
                  tournamentId={t.id}
                />
              </div>

              {showObsSettings && (
                <div className="mt-4 pt-2 border-t border-border">
                  <BroadcastControlPanel tournamentId={t.id} />
                </div>
              )}
            </div>
          )}

          {subTab === "owner-apps" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Team Owners ({localDetail.teams.length})</span>
                <span>Purse / Last Bid</span>
              </div>
              {localDetail.teams.length ? (
                <div className="rounded-lg border border-border/70 bg-muted/10 divide-y divide-border/60">
                  {localDetail.teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{team.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">({team.shortCode})</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Owner: {team.ownerName || "Unassigned"} {team.ownerEmail ? `· ${team.ownerEmail}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right text-xs">
                          <div className="text-white font-medium">
                            ₹{team.purseUsed.toLocaleString("en-IN")} / ₹{team.purse.toLocaleString("en-IN")}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            Last: {lastBidByTeam.get(team.id) || "None"}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                          <a href={`/tournament/${t.id}/owner/${team.id}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open App
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border/60 bg-muted/5 p-6 text-center text-sm text-muted-foreground">
                  No teams configured yet for this tournament.
                </div>
              )}
            </div>
          )}

          {subTab === "operator" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Auction Control Panels</span>
                <span>Mode & Health</span>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/10 divide-y divide-border/60">
                <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <div className="font-semibold text-white text-sm">Auction Operator Panel</div>
                    <div className="font-mono text-xs text-muted-foreground">/tournament/{t.id}/auction</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Main operator interface to control lots, timers, and sell players.
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className={t.localModeEnabled ? "border-amber-500/40 text-amber-300" : "border-primary/40 text-primary"}>
                      {t.localModeEnabled ? "Local-capable" : "Cloud"}
                    </Badge>
                    <LiveConnectionStatus tournamentId={t.id} />
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                      <a href={`/tournament/${t.id}/auction`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Console
                      </a>
                    </Button>
                  </div>
                </div>

                {t.localModeEnabled && (
                  <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors">
                    <div>
                      <div className="font-semibold text-amber-300 text-sm flex items-center gap-1.5">
                        <MonitorDown className="h-3.5 w-3.5" />
                        Local Mode Console
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">/tournament/{t.id}/local-mode</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Local device bridge & offline synchronization interface.
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">Local Active</Badge>
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs border-amber-500/40 text-amber-300" asChild>
                        <a href={`/tournament/${t.id}/local-mode`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
