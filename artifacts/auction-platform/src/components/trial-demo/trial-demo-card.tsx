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
  KeyRound,
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

  const demoSessionQuery = useQuery({
    queryKey: ["auction-demo-session", tournamentId],
    enabled: !!tournamentId,
    queryFn: async (): Promise<DemoSessionState> => {
      const res = await apiFetch(`/tournaments/${tournamentId}/auction/demo-session`);
      if (!res.ok) return { loaded: false };
      return (await res.json()) as DemoSessionState;
    },
    staleTime: 5000,
  });

  const demoLoaded = demoSessionQuery.data?.loaded === true;
  const isTrialMode = tournament?.licenseStatus !== "active";
  const isCompleted = tournament?.status === "completed";

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

  // Hide entirely if tournament license is active (not eligible for trial mode)
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
      title="Trial Demo Practice"
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
          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[11px] font-medium">
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
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="rounded border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-400/80">Players</p>
                <p className="text-sm font-bold text-foreground">
                  {counts.players} <span className="text-[11px] text-muted-foreground font-normal">({counts.retentions} retained)</span>
                </p>
              </div>
              <div className="rounded border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-400/80">Teams</p>
                <p className="text-sm font-bold text-foreground">{counts.teams}</p>
              </div>
              <div className="rounded border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-400/80">Sponsors</p>
                <p className="text-sm font-bold text-foreground">{counts.sponsors}</p>
              </div>
              <div className="rounded border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-400/80">Owner Logins</p>
                <p className="text-sm font-bold text-foreground">{counts.ownerSessions}</p>
              </div>
            </div>

            {/* Demo Owner Credentials Box for testing */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Demo Owner Logins (For Testing Live Bidding)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-border/50 bg-background/60 p-2 space-y-1">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>[Demo] Thunder Strikers (DTS)</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono border-amber-500/40 text-amber-300">
                      PIN: DEMO01
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Owner: Vikram Malhotra &bull; Mobile: <span className="font-mono text-foreground/90 font-medium">9800000001</span>
                  </p>
                </div>
                <div className="rounded border border-border/50 bg-background/60 p-2 space-y-1">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>[Demo] Royal Phoenix (DRP)</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono border-amber-500/40 text-amber-300">
                      PIN: DEMO02
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Owner: Ananya Iyer &bull; Mobile: <span className="font-mono text-foreground/90 font-medium">9800000002</span>
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/80 leading-normal">
                Use PIN <code className="font-mono text-amber-300 font-semibold">DEMO01</code> or <code className="font-mono text-amber-300 font-semibold">DEMO02</code> to sign into the team owner app and test live bidding during auction practice.
              </p>
            </div>

            {/* Next actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <a
                href={auctionRoomPath(tournamentId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Gavel className="w-3.5 h-3.5" />
                Open Auction Control
              </a>
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200 gap-1.5 text-xs h-9"
                onClick={() => navigate(auctionResetPath(tournamentId, returnTo))}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Clear Trial Data
              </Button>
            </div>
          </div>
        ) : (
          /* Demo not loaded yet: Show the primary button and required explanatory text */
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                type="button"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 h-auto text-sm shadow-md transition-all gap-2 flex-shrink-0 disabled:opacity-50"
                disabled={loading || isCompleted}
                onClick={handleLoadDemo}
                data-testid="load-trial-demo-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading Trial Demo...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Load Trial Demo
                  </>
                )}
              </Button>

              {isCompleted && (
                <span className="text-xs text-muted-foreground">
                  (Unavailable — tournament is marked completed)
                </span>
              )}
            </div>

            {/* Exact explanatory text required by specification */}
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Load 10 sample players, 2 teams, 5 sponsors, auction settings and demo owner logins to practise the complete auction workflow. Includes sample photos and logos. Your existing tournament data will not be overwritten.
            </p>

            {/* Feature highlights pill strip */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px] text-muted-foreground/80">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                10 Cricket Players (1 Retained)
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                2 Teams (DTS & DRP)
              </span>
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-primary" />
                5 Sponsor Logos
              </span>
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-primary" />
                2 Demo Owner Logins
              </span>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
