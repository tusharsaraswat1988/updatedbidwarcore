/**
 * Badminton Broadcast Center
 * Route: /tournament/:id/badminton/broadcast
 *
 * Central place for display, OBS overlays, and scorer access — no raw URLs on the hub.
 */

import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Radio, Shield } from "lucide-react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { badmintonFetch } from "@/lib/badminton-api";
import { cn } from "@/lib/utils";
import {
  formatTeamPlayerVsLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";
import {
  HubPageShell,
  PageHeader,
  hubCardClass,
  hubPanelClass,
  EmptyState,
} from "@/components/badminton/page-chrome";
import { BadmintonBroadcastActions } from "@/components/badminton/broadcast-actions";
import { DarkSelect } from "@/components/badminton/form-ui";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import { Skeleton } from "@/components/ui/skeleton";

interface MatchRow {
  id: number;
  status: string;
  detail: Record<string, unknown> | null;
  state: BadmintonMatchState | null;
}

function matchLabel(match: MatchRow): string {
  const state = match.state;
  const detail = match.detail ?? {};
  if (state) {
    return formatTeamPlayerVsLine(
      identityFromSideInfo(state.leftSide, { preferShort: true }),
      identityFromSideInfo(state.rightSide, { preferShort: true }),
    );
  }
  return (detail.matchLabel as string | undefined) ?? `Match #${match.id}`;
}

export default function BadmintonBroadcastPage() {
  const [, params] = useRoute("/tournament/:id/badminton/broadcast");
  const tournamentId = parseInt(params?.id ?? "0");
  const [location, navigate] = useLocation();

  const selectedMatchId = (() => {
    const q = location.split("?")[1] ?? "";
    const match = new URLSearchParams(q).get("match");
    return match ? parseInt(match, 10) : null;
  })();

  const { data: matches = [], isLoading } = useQuery<MatchRow[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
  });

  const selectedMatch = selectedMatchId
    ? matches.find((m) => m.id === selectedMatchId)
    : matches.find((m) => m.status === "live") ?? matches[0];

  const activeMatchId = selectedMatch?.id ?? null;

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Step 7 · Broadcast"
        title="Broadcast Center"
        subtitle="Displays, stream overlays, and scorer access for each match"
      />

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : matches.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No matches to broadcast yet"
            desc="Create and schedule matches first, then return here to set up displays and overlays."
            action={{
              label: "Go to matches",
              onClick: () => navigate(`/tournament/${tournamentId}/badminton/matches`),
            }}
          />
        ) : (
          <>
            <section className={cn(hubPanelClass, "space-y-4")}>
              <div>
                <h2 className="text-sm font-display font-bold text-foreground">Select match</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose which match you are setting up for the venue or stream.
                </p>
              </div>
              <DarkSelect
                value={activeMatchId ? String(activeMatchId) : ""}
                onValueChange={(v) => navigate(`/tournament/${tournamentId}/badminton/broadcast?match=${v}`)}
                placeholder="Choose a match…"
                options={matches.map((m) => ({
                  value: String(m.id),
                  label: `${matchLabel(m)}${m.status === "live" ? " · LIVE" : ""}`,
                }))}
              />
            </section>

            {activeMatchId && selectedMatch && (
              <section className="space-y-4">
                <div className={cn(hubCardClass, "p-4 flex items-center justify-between gap-3")}>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Broadcasting</p>
                    <p className="text-lg font-display font-bold text-foreground truncate">
                      {matchLabel(selectedMatch)}
                    </p>
                    {selectedMatch.detail?.courtNumber ? (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        Court {String(selectedMatch.detail.courtNumber)}
                      </p>
                    ) : null}
                    {selectedMatch.detail?.scorerPin ? (
                      <p className="text-xs text-amber-300/90 font-mono mt-0.5">
                        Scorer PIN {String(selectedMatch.detail.scorerPin)}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={badmintonMatchControlPath(tournamentId, activeMatchId)}
                    className="h-9 px-4 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Match Control
                  </Link>
                </div>

                <BadmintonBroadcastActions
                  matchId={activeMatchId}
                  tournamentId={tournamentId}
                  matchLabel={matchLabel(selectedMatch)}
                />
              </section>
            )}
          </>
        )}
      </div>
    </HubPageShell>
  );
}
