/**
 * Match Control — pre-match ops + live director admin
 * Route: /tournament/:id/badminton/matches/:matchId/control
 *
 * Flow: Control Center → Match Control → Live Scoring
 */

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { EmptyState, HubPageShell, PageHeader } from "@/components/badminton/page-chrome";
import { MatchControlCenter } from "@/components/badminton/match-control-center";
import { PreMatchControlPanel } from "@/components/badminton/pre-match-control";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { badmintonFetch } from "@/lib/badminton-api";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { matchFormatChipLabel } from "@/lib/match-format-display";
import {
  resolveMatchFormatFromDetail,
  type MatchControlPeerMatch,
  type MatchControlSnapshot,
} from "@/lib/badminton-match-control";
import { AlertCircle } from "lucide-react";
import {
  formatTeamPlayerLine,
  identityFromFranchiseFields,
  identityFromSideInfo,
} from "@/lib/team-player-identity";

function sideLabelFromJson(side: Record<string, unknown> | undefined, fallback: string): string {
  if (!side) return fallback;
  const label = typeof side.label === "string" ? side.label.trim() : "";
  const short = typeof side.shortLabel === "string" ? side.shortLabel.trim() : "";
  const player = label || short || fallback;
  const identity = identityFromFranchiseFields(player, {
    franchiseName: typeof side.franchiseName === "string" ? side.franchiseName : undefined,
    franchiseLogoUrl: typeof side.franchiseLogoUrl === "string" ? side.franchiseLogoUrl : undefined,
    teamName: typeof side.teamName === "string" ? side.teamName : undefined,
    teamLogoUrl: typeof side.teamLogoUrl === "string" ? side.teamLogoUrl : undefined,
  }, typeof side.teamColor === "string" ? side.teamColor : undefined);
  return formatTeamPlayerLine(identity);
}

type MatchListRow = {
  id: number;
  status: string;
  scheduledAt?: string | null;
  fixtureId?: number | null;
  detail: Record<string, unknown> | null;
};

type FixtureRow = {
  id: number;
  scheduledAt?: string | null;
  scoringMatchId?: number | null;
};

export default function BadmintonMatchControlPage() {
  const [, params] = useRoute("/tournament/:id/badminton/matches/:matchId/control");
  const tournamentId = parseInt(params?.id ?? "0");
  const matchId = parseInt(params?.matchId ?? "0");
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useBadmintonMatch(tournamentId, matchId);
  const { data: branding } = useBadmintonBranding(tournamentId);

  const state = data?.state;
  const detail = (data?.detail ?? null) as Record<string, unknown> | null;
  const isPreMatch = state?.matchStatus === "scheduled";
  const isTerminal = state
    ? ["completed", "walkover", "retired", "disqualified", "abandoned"].includes(
        state.matchStatus,
      )
    : false;

  const categoryId =
    typeof detail?.categoryId === "number" ? detail.categoryId : null;

  const { data: categories = [] } = useQuery<Array<{ id: number; name: string; code?: string | null }>>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  // Reuse day-of list query (same key as Control Center) — no dedicated per-match list fetch.
  const { data: allMatches = [] } = useQuery<MatchListRow[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId && !!isPreMatch,
    staleTime: 8_000,
  });

  const { data: fixtures = [] } = useQuery<FixtureRow[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures`),
    enabled: !!tournamentId && !!isPreMatch,
    staleTime: 15_000,
  });

  const format = useMemo(() => resolveMatchFormatFromDetail(detail), [detail]);
  const formatLabel = matchFormatChipLabel(format);

  const listRow = useMemo(
    () => allMatches.find((m) => m.id === matchId) ?? null,
    [allMatches, matchId],
  );

  const fixtureId =
    typeof detail?.fixtureId === "number"
      ? detail.fixtureId
      : listRow?.fixtureId ?? null;

  const fixtureRow = useMemo(
    () =>
      fixtureId != null
        ? fixtures.find((f) => f.id === fixtureId) ??
          fixtures.find((f) => f.scoringMatchId === matchId) ??
          null
        : fixtures.find((f) => f.scoringMatchId === matchId) ?? null,
    [fixtures, fixtureId, matchId],
  );

  const peerMatches: MatchControlPeerMatch[] = useMemo(
    () =>
      allMatches.map((m) => ({
        id: m.id,
        status: m.status,
        scheduledAt: m.scheduledAt,
        detail: m.detail,
      })),
    [allMatches],
  );

  const snapshot: MatchControlSnapshot | null = useMemo(() => {
    if (!state || !detail) return null;

    const leftJson = (detail.leftSideJson as Record<string, unknown>) ?? {};
    const rightJson = (detail.rightSideJson as Record<string, unknown>) ?? {};
    const cat = categoryId != null ? categories.find((c) => c.id === categoryId) : undefined;

    return {
      tournamentId,
      matchId,
      tournamentName: branding?.displayName?.trim() || `Tournament #${tournamentId}`,
      categoryName: cat ? cat.code?.trim() || cat.name : null,
      courtLabel:
        typeof detail.courtNumber === "string" && detail.courtNumber.trim()
          ? detail.courtNumber
          : typeof detail.courtId === "number"
            ? `Court #${detail.courtId}`
            : null,
      courtId: typeof detail.courtId === "number" ? detail.courtId : null,
      scheduledAt: listRow?.scheduledAt ?? fixtureRow?.scheduledAt ?? null,
      matchFormat: format,
      matchFormatLabel: formatLabel,
      matchType: (detail.matchType as string) ?? state.matchKind ?? "singles",
      leftLabel: sideLabelFromJson(leftJson, state.leftSide?.shortLabel || "Left"),
      rightLabel: sideLabelFromJson(rightJson, state.rightSide?.shortLabel || "Right"),
      leftSideJson: leftJson,
      rightSideJson: rightJson,
      preMatchTossJson: detail.preMatchTossJson,
      fixtureId: fixtureId ?? fixtureRow?.id ?? null,
      matchStatus: state.matchStatus,
    };
  }, [
    state,
    detail,
    tournamentId,
    matchId,
    branding?.displayName,
    categoryId,
    categories,
    listRow,
    fixtureRow,
    fixtureId,
    format,
    formatLabel,
  ]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["badminton-match", tournamentId, matchId] });
    void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
    void qc.invalidateQueries({ queryKey: ["badminton-fixtures-all", tournamentId] });
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Operations"
        title={isPreMatch ? "Match Control" : "Match Control"}
        subtitle={
          isPreMatch
            ? "Court and time are required before start. Fix blockers below, then Toss & Start."
            : state
              ? `${formatTeamPlayerLine(identityFromSideInfo(state.leftSide, { preferShort: true }))} vs ${formatTeamPlayerLine(identityFromSideInfo(state.rightSide, { preferShort: true }))} — tournament director`
              : "Loading…"
        }
        actions={formatLabel ? <ScoringFormatBadge label={formatLabel} /> : undefined}
      />

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="h-64 rounded-2xl bg-white/4 animate-pulse" aria-busy="true" />
        ) : error || !state ? (
          <EmptyState
            icon={AlertCircle}
            title="Could not load this match"
            desc={friendlyBadmintonError(error, "Check your connection, then retry.")}
            action={{
              label: "Retry",
              onClick: () => void refetch(),
            }}
          />
        ) : isPreMatch && snapshot ? (
          <PreMatchControlPanel
            snapshot={snapshot}
            peerMatches={peerMatches}
            onRefresh={refresh}
            scorerPin={typeof detail?.scorerPin === "string" ? detail.scorerPin : null}
          />
        ) : (
          <>
            {!isTerminal ? <DirectorStatusBanner state={state} /> : null}
            <MatchControlCenter
              tournamentId={tournamentId}
              matchId={matchId}
              state={state}
            />
            <div className="flex justify-center">
              <Link
                href={`/tournament/${tournamentId}/badminton/control`}
                className="text-[#4fc3f7] text-sm font-semibold hover:underline min-h-11 inline-flex items-center"
              >
                Back to Control Center
              </Link>
            </div>
          </>
        )}
      </div>
    </HubPageShell>
  );
}
