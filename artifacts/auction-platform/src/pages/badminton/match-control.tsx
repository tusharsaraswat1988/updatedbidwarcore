/**
 * Match Control Page — Tournament Director administration
 * Route: /tournament/:id/badminton/matches/:matchId/control
 */

import { useRoute } from "wouter";
import { HubPageShell, PageHeader } from "@/components/badminton/page-chrome";
import { MatchControlCenter } from "@/components/badminton/match-control-center";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { parseBadmintonMatchFormat } from "@workspace/badminton-core";
import { matchFormatChipLabel } from "@/lib/match-format-display";

export default function BadmintonMatchControlPage() {
  const [, params] = useRoute("/tournament/:id/badminton/matches/:matchId/control");
  const tournamentId = parseInt(params?.id ?? "0");
  const matchId = parseInt(params?.matchId ?? "0");

  const { data, isLoading, error } = useBadmintonMatch(tournamentId, matchId);
  const state = data?.state;
  const detail = data?.detail as Record<string, unknown> | undefined;
  const format =
    state?.format ??
    parseBadmintonMatchFormat(detail?.matchFormatJson) ??
    null;
  const formatLabel = format ? matchFormatChipLabel(format) : null;

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Match Control Center"
        subtitle={
          state
            ? `${state.leftSide.shortLabel} vs ${state.rightSide.shortLabel} — tournament director (not umpire scoring)`
            : "Loading…"
        }
        actions={formatLabel ? <ScoringFormatBadge label={formatLabel} /> : undefined}
      />

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="h-64 rounded-2xl bg-white/4 animate-pulse" />
        ) : error || !state ? (
          <p className="text-red-400 text-center">Failed to load match</p>
        ) : (
          <>
            <DirectorStatusBanner state={state} />
            <MatchControlCenter
              tournamentId={tournamentId}
              matchId={matchId}
              state={state}
            />
          </>
        )}
      </div>
    </HubPageShell>
  );
}
