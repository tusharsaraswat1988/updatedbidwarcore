import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { getGetTournamentQueryKey, getListPlayersQueryKey, getListTeamsQueryKey } from "@workspace/api-client-react";
import { SettingsCard } from "@/components/settings/settings-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Gavel,
  ShieldCheck,
  Users,
  Image as ImageIcon,
} from "lucide-react";
import { auctionResetPath, auctionRoomPath } from "@/lib/tournament-navigation";

export interface DemoSessionState {
  loaded: boolean;
  sessionId?: string;
  createdAt?: string;
  teams?: number;
  players?: number;
  sponsors?: number;
  categories?: number;
  retentions?: number;
  ownerSessions?: number;
}

interface TrialDemoCardProps {
  tournamentId: number;
  tournament?: {
    status?: string | null;
    licenseStatus?: string | null;
    auctionEnabled?: boolean | null;
    name?: string | null;
  } | null;
  /** Current URL to return to after visiting the Clear Trial Data page */
  returnTo?: string;
  className?: string;
}

export function TrialDemoCard({
  tournamentId,
  tournament,
  returnTo,
  className,
}: TrialDemoCardProps) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justLoadedCounts, setJustLoadedCounts] = useState<{
    teams?: number;
    players?: number;
    sponsors?: number;
    categories?: number;
    retentions?: number;
    ownerSessions?: number;
  } | null>(null);

  const isTrialMode = !!tournament && tournament.licenseStatus === "trial";
  const isCompleted = tournament?.status === "completed";

  const demoSessionQuery = useQuery({
    queryKey: ["auction-demo-session", tournamentId],
    enabled: !!tournamentId && isTrialMode,
    queryFn: async (): Promise<DemoSessionState> => {
      const res = await apiFetch(`/tournaments/${tournamentId}/auction/demo-session`);
      if (!res.ok) return { loaded: false };
      return (await res.json()) as DemoSessionState;
    },
    staleTime: 5000,
  });

  const demoLoaded = demoSessionQuery.data?.loaded === true;

  async function handleLoadDemo() {
    if (!tournamentId || loading || demoLoaded) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/auction/demo-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Demo load failed (HTTP ${res.status})`);
      }

      const created = (await res.json()) as {
        sessionId: string;
        teams?: number;
        players?: number;
        sponsors?: number;
        categories?: number;
        retentions?: number;
        ownerSessions?: number;
      };

      setJustLoadedCounts({
        teams: created.teams ?? 2,
        players: created.players ?? 10,
        sponsors: created.sponsors ?? 5,
        categories: created.categories ?? 2,
        retentions: created.retentions ?? 1,
        ownerSessions: created.ownerSessions ?? 2,
      });

      // Invalidate relevant tournament & auction queries so UI updates immediately
      qc.invalidateQueries({ queryKey: ["auction-demo-session", tournamentId] });
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: ["auction-state", tournamentId] });
      qc.invalidateQueries({ queryKey: ["auction-readiness", tournamentId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load trial demo.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Strictly hide if tournament is already licensed or not in trial mode (prevents conflicts)
  if (!isTrialMode) {
    return null;
  }

  const counts = justLoadedCounts || {
    teams: demoSessionQuery.data?.teams ?? 2,
    players: demoSessionQuery.data?.players ?? 10,
    sponsors: demoSessionQuery.data?.sponsors ?? 5,
    categories: demoSessionQuery.data?.categories ?? 2,
    retentions: demoSessionQuery.data?.retentions ?? 1,
    ownerSessions: demoSessionQuery.data?.ownerSessions ?? 2,
  };

  return (
    <SettingsCard
      title="Trial Demo Simulation"
      description="Practise the live auction workflow with realistic test data before your official auction event."
      icon={<Sparkles className="w-4 h-4 text-amber-400" />}
      className={className}
      headerAction={
        demoLoaded ? (
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 gap-1 text-[11px] font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Demo Loaded
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[11px] font-medium">
            Trial Mode
          </Badge>
        )
      }
    >
      <div className="space-y-4">
        {/* Error message callout */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-destructive" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Unable to load demo data</p>
              <p className="mt-0.5 text-destructive/90">{error}</p>
            </div>
          </div>
        )}

        {/* Demo successfully loaded or active banner */}
        {demoLoaded ? (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3.5 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-semibold text-emerald-200">
                  Sample Auction Data Loaded
                </p>
                <p className="text-xs text-emerald-300/80 leading-relaxed">
                  The demo data is active in this tournament. You can now test the live operator
                  interface, place bids, test sound effects, and verify the display screen.
                </p>
              </div>
            </div>

            {/* Counts breakdown */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-border/50 bg-secondary/25 px-3 py-2 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Players</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {counts.players} <span className="text-[11px] text-muted-foreground font-normal">({counts.retentions} ret.)</span>
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/25 px-3 py-2 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Teams</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{counts.teams}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/25 px-3 py-2 text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Sponsors</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{counts.sponsors}</p>
              </div>
            </div>

            {/* Next actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/40">
              <a
                href={auctionRoomPath(tournamentId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Gavel className="w-3.5 h-3.5" />
                Open Auction Control
              </a>
              <Button
                variant="outline"
                size="sm"
                className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 gap-1.5 text-xs h-9 px-3"
                onClick={() => navigate(auctionResetPath(tournamentId, returnTo))}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Clear Trial Data
              </Button>
            </div>
          </div>
        ) : (
          /* Demo not loaded yet: Streamlined, professional layout */
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Load 10 sample players, 2 teams, 5 sponsors, auction settings and demo owner logins to practise the complete auction workflow. Includes sample photos and logos. Your existing tournament data will not be overwritten.
            </p>

            {/* Feature highlights pill strip */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Players</p>
                  <p className="text-xs font-semibold text-foreground truncate">10 (1 Retained)</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Teams</p>
                  <p className="text-xs font-semibold text-foreground truncate">2 (DTS & DRP)</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Sponsors</p>
                  <p className="text-xs font-semibold text-foreground truncate">5 Sample Logos</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground">
                {isCompleted ? "Unavailable — tournament is marked completed" : "Safe 1-click sandbox for live auction rehearsal"}
              </span>

              <Button
                type="button"
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold px-4 py-2 h-9 text-xs sm:text-sm rounded-lg shadow-sm transition-all gap-1.5 flex-shrink-0 disabled:opacity-50"
                disabled={loading || isCompleted}
                onClick={handleLoadDemo}
                data-testid="load-trial-demo-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading Trial Demo...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Load Trial Demo</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
