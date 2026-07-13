/**
 * Tournament Broadcast Console
 * Route: /tournament/:id/badminton/broadcast
 *
 * Tournament-centric control surface: persistent Venue / OBS / Scorer / Results
 * links that auto-follow Primary Broadcast. Does not change scoring or lifecycle.
 */

import { useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Monitor,
  Radio,
  Tablet,
  Trophy,
  CircleDot,
} from "lucide-react";
import { badmintonFetch } from "@/lib/badminton-api";
import { cn } from "@/lib/utils";
import { identityFromSideInfo } from "@/lib/team-player-identity";
import {
  HubPageShell,
  PageHeader,
  hubCardClass,
  hubPanelClass,
  EmptyState,
} from "@/components/badminton/page-chrome";
import { BroadcastLinkCard } from "@/components/badminton/broadcast-link-card";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildCourtBroadcastChips,
  broadcastConsoleStatusLabel,
  currentGameLabel,
  currentScoreLabel,
  deriveBroadcastConsoleStatus,
  findUpNextMatch,
  formatEstimatedStart,
  listLiveMatches,
  matchCategoryLabel,
  matchCourtLabel,
  matchIdentityLine,
  resolvePrimaryBroadcastMatchId,
  softFeedStatus,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";

export default function BadmintonBroadcastPage() {
  const [, params] = useRoute("/tournament/:id/badminton/broadcast");
  const tournamentId = parseInt(params?.id ?? "0", 10);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: branding } = useBadmintonBranding(tournamentId);

  const { data: matches = [], isLoading } = useQuery<BroadcastConsoleMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
    refetchInterval: 6_000,
  });

  const liveMatches = useMemo(() => listLiveMatches(matches), [matches]);
  const primaryMatchId = useMemo(
    () =>
      resolvePrimaryBroadcastMatchId(matches, branding?.primaryBroadcastMatchId ?? null),
    [matches, branding?.primaryBroadcastMatchId],
  );
  const primaryMatch = matches.find((m) => m.id === primaryMatchId) ?? null;
  const upNext = useMemo(
    () => findUpNextMatch(matches, primaryMatchId),
    [matches, primaryMatchId],
  );
  const consoleStatus = deriveBroadcastConsoleStatus(liveMatches.length, !!upNext);
  const feedStatus = softFeedStatus(!!primaryMatch);
  const courtChips = useMemo(
    () => buildCourtBroadcastChips(matches, primaryMatchId),
    [matches, primaryMatchId],
  );

  const setPrimaryMutation = useMutation({
    mutationFn: (matchId: number) =>
      badmintonFetch(tournamentId, `/primary-broadcast`, {
        method: "PATCH",
        body: JSON.stringify({ matchId }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
    },
  });

  // Keep stored primary in sync when only one court is live.
  useEffect(() => {
    if (!tournamentId || liveMatches.length !== 1) return;
    const soleId = liveMatches[0].id;
    if (branding?.primaryBroadcastMatchId === soleId) return;
    if (branding === undefined) return;
    setPrimaryMutation.mutate(soleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-sync on sole-live transitions
  }, [tournamentId, liveMatches.length, liveMatches[0]?.id, branding?.primaryBroadcastMatchId]);

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Step 7 · Broadcast"
        title="Tournament Broadcast Console"
        subtitle="One Venue Display URL and one OBS Overlay URL for the whole tournament — they follow the live court automatically."
      />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : matches.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No matches to broadcast yet"
            desc="Create and schedule matches first, then return here for persistent venue and OBS links."
            action={{
              label: "Go to matches",
              onClick: () => navigate(`/tournament/${tournamentId}/badminton/matches`),
            }}
          />
        ) : (
          <>
            {/* Status strip */}
            <section className={cn(hubPanelClass, "p-4 flex flex-wrap items-center gap-3")}>
              <StatusPill
                active={consoleStatus === "live_active" || consoleStatus === "multi_live"}
                label={broadcastConsoleStatusLabel(consoleStatus)}
              />
              <StatusPill label={`Overlay · ${feedStatus.overlay}`} />
              <StatusPill label={`Venue Display · ${feedStatus.venue}`} />
            </section>

            {/* Persistent links */}
            <section className="grid sm:grid-cols-2 gap-4">
              <BroadcastLinkCard
                kind="venue-display"
                tournamentId={tournamentId}
                title="Venue Display"
                help="Displays scores on TVs inside the venue. Set once — it follows the Primary Broadcast match."
                icon={Monitor}
              />
              <BroadcastLinkCard
                kind="obs-overlay"
                tournamentId={tournamentId}
                title="OBS Overlay"
                help="Used inside OBS Studio as a Browser Source. Persistent URL — never change it mid-tournament."
                icon={Radio}
              />
              <BroadcastLinkCard
                kind="scorer-home"
                tournamentId={tournamentId}
                title="Scorer Home"
                help="Shared with umpires. One link + PIN for assigned courts and matches."
                icon={Tablet}
              />
              <BroadcastLinkCard
                kind="public-results"
                tournamentId={tournamentId}
                title="Public Results"
                help="Tournament results page for players, parents, and the public board."
                icon={Trophy}
              />
            </section>

            {/* Multi-court */}
            {courtChips.length > 0 ? (
              <section className={cn(hubPanelClass, "p-4 space-y-3")}>
                <div>
                  <h2 className="text-sm font-display font-bold text-foreground">Courts</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Overlay follows Primary Broadcast only. Simultaneous live courts do not auto-switch.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {courtChips.map((chip) => (
                    <div
                      key={chip.key}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                        chip.status === "LIVE"
                          ? "border-red-500/40 bg-red-500/10 text-red-100"
                          : "border-sky-500/35 bg-sky-500/10 text-sky-100",
                      )}
                    >
                      <CircleDot className="w-3.5 h-3.5" />
                      <span className="font-semibold">{chip.label}</span>
                      <span className="uppercase tracking-wider font-mono opacity-80">
                        {chip.status}
                      </span>
                      {chip.status === "LIVE" && liveMatches.length > 1 ? (
                        chip.isPrimary ? (
                          <span className="ml-1 rounded bg-amber-500/20 text-amber-100 px-1.5 py-0.5 font-bold uppercase tracking-wide">
                            Primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={setPrimaryMutation.isPending || chip.matchId == null}
                            onClick={() => chip.matchId != null && setPrimaryMutation.mutate(chip.matchId)}
                            className="ml-1 rounded border border-white/15 px-1.5 py-0.5 font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
                          >
                            Set Primary
                          </button>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* NOW LIVE */}
            <section className={cn(hubCardClass, "p-5 sm:p-6 border-red-500/25 bg-gradient-to-br from-red-500/10 via-transparent to-transparent")}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-2.5 w-2.5 rounded-full",
                      primaryMatch ? "bg-red-500 animate-pulse" : "bg-white/25",
                    )}
                  />
                  <h2 className="text-xs font-mono uppercase tracking-[0.25em] text-red-200/90 font-bold">
                    Now Live
                  </h2>
                </div>
                {primaryMatch ? (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-200/80">
                    Primary Broadcast
                  </span>
                ) : null}
              </div>

              {primaryMatch?.state ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                    <span>{matchCourtLabel(primaryMatch)}</span>
                    <span className="text-white/20">·</span>
                    <span>{matchCategoryLabel(primaryMatch)}</span>
                  </div>
                  <TeamPlayerVs
                    left={identityFromSideInfo(primaryMatch.state.leftSide)}
                    right={identityFromSideInfo(primaryMatch.state.rightSide)}
                    size="lg"
                    tone="muted"
                    layout="stack"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetaBlock label="Current Game" value={currentGameLabel(primaryMatch.state)} />
                    <MetaBlock label="Current Score" value={currentScoreLabel(primaryMatch.state)} />
                    <MetaBlock label="Broadcast Status" value={broadcastConsoleStatusLabel(consoleStatus)} />
                    <MetaBlock label="Overlay Status" value={feedStatus.overlay} />
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-lg font-display font-bold text-foreground/90">
                    {consoleStatus === "waiting_next"
                      ? "Waiting for next match"
                      : "No live match"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Venue Display and OBS Overlay stay on the same URLs. They will switch
                    automatically when a match goes live.
                  </p>
                </div>
              )}
            </section>

            {/* Up Next */}
            <section className={cn(hubPanelClass, "p-5 space-y-3")}>
              <h2 className="text-sm font-display font-bold text-foreground">Up Next</h2>
              {upNext ? (
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <MetaBlock label="Next Match" value={matchCategoryLabel(upNext)} />
                  <MetaBlock label="Court" value={matchCourtLabel(upNext)} />
                  <MetaBlock label="Identity" value={matchIdentityLine(upNext)} />
                  <MetaBlock
                    label="Estimated Start"
                    value={formatEstimatedStart(upNext.scheduledAt)}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming match queued.</p>
              )}
            </section>

            {/* Help */}
            <section className={cn(hubPanelClass, "p-5 space-y-3")}>
              <h2 className="text-sm font-display font-bold text-foreground">How this works</h2>
              <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li>
                  <span className="text-foreground font-semibold">Venue Display</span>
                  {" — "}
                  Displays scores on TVs inside the venue.
                </li>
                <li>
                  <span className="text-foreground font-semibold">OBS Overlay</span>
                  {" — "}
                  Used inside OBS Studio. Keep one Browser Source for the whole event.
                </li>
                <li>
                  <span className="text-foreground font-semibold">Scorer Home</span>
                  {" — "}
                  Shared with umpires. They pick the court/match after entering the PIN.
                </li>
                <li>
                  Operators never change display or overlay URLs mid-tournament. The console
                  follows the live (or Primary) match.
                </li>
              </ul>
            </section>
          </>
        )}
      </div>
    </HubPageShell>
  );
}

function StatusPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center min-h-8 px-3 rounded-full border text-[11px] font-semibold tracking-wide",
        active
          ? "border-red-500/40 bg-red-500/15 text-red-100"
          : "border-white/10 bg-white/5 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
