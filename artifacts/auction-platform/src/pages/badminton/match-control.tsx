/**
 * Match Control — pre-match ops + live director admin
 * Route: /tournament/:id/badminton/matches/:matchId/control
 *
 * Flow: Control Center → Match Control → Live Scoring
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { EmptyState, HubPageShell, PageHeader } from "@/components/badminton/page-chrome";
import { MatchControlCenter } from "@/components/badminton/match-control-center";
import { PreMatchControlPanel } from "@/components/badminton/pre-match-control";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { badmintonFetch, fetchBadmintonMatches } from "@/lib/badminton-api";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { matchFormatChipLabel } from "@/lib/match-format-display";
import {
  resolveMatchFormatFromDetail,
  type MatchControlPeerMatch,
  type MatchControlSnapshot,
} from "@/lib/badminton-match-control";
import { AlertCircle, Check, Copy, ExternalLink, Radio, Unlock } from "lucide-react";
import { forceUnlockBadmintonMatch } from "@/lib/scorer-api";
import { badmintonScorerMatchPath } from "@/lib/badminton-routes";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  const { data: branding } = useBadmintonBranding(tournamentId, {
    staleTime: 60_000,
    refetchInterval: false,
  });

  const state = data?.state;
  const detail = (data?.detail ?? null) as Record<string, unknown> | null;
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
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: !!tournamentId,
    staleTime: 8_000,
  });

  // Pre-start hold keeps engine status "scheduled"; post-start hold uses "on_hold" → director panel.
  const isPreMatch = state?.matchStatus === "scheduled";

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

  const [copiedPin, setCopiedPin] = useState(false);
  const [forceUnlocking, setForceUnlocking] = useState(false);
  const { toast } = useToast();

  const scorerPin = typeof detail?.scorerPin === "string" ? detail.scorerPin : null;
  const scorerHref = badmintonScorerMatchPath(matchId, tournamentId);

  function handleCopyPin() {
    if (!scorerPin) return;
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(scorerPin);
    }
    setCopiedPin(true);
    toast({
      title: "Scorer PIN Copied",
      description: `PIN ${scorerPin} copied to clipboard for match officials.`,
    });
    setTimeout(() => setCopiedPin(false), 2000);
  }

  async function handleForceUnlock() {
    setForceUnlocking(true);
    try {
      const res = await forceUnlockBadmintonMatch(tournamentId, matchId);
      toast({
        title: res.cleared ? "Scorer lock released" : "No lock present",
        description: res.cleared
          ? "Stuck scorer session was cleared. Another device can now connect."
          : "Match had no active session lock.",
      });
      refresh();
    } catch (e) {
      toast({
        title: "Force unlock failed",
        description: e instanceof Error ? e.message : "Could not unlock match",
        variant: "destructive",
      });
    } finally {
      setForceUnlocking(false);
    }
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Operations"
        title={isPreMatch ? "Match Control" : "Match Control"}
        subtitle={
          isPreMatch
            ? "Court and time are required before start. Fix blockers below, then Toss & Start."
            : state
              ? `${formatTeamPlayerLine(identityFromSideInfo(state.leftSide))} vs ${formatTeamPlayerLine(identityFromSideInfo(state.rightSide))} — tournament director`
              : "Loading…"
        }
        actions={formatLabel ? <ScoringFormatBadge label={formatLabel} /> : undefined}
      />

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="h-64 rounded-2xl bg-muted/40 border border-border animate-pulse" aria-busy="true" />
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
        ) : (
          <>
            {/* Scorer Connection Monitor & Emergency Unlock Bar */}
            {!isTerminal ? (
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary animate-pulse" />
                    <h3 className="font-bold text-sm text-foreground">Scorer Connection Monitor</h3>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        state.matchStatus === "live"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
                      )}
                    >
                      {state.matchStatus === "live" ? "Live Connected" : "Ready / Standby"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {scorerPin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPin}
                        className="font-mono text-xs gap-1.5 h-9 cursor-pointer"
                      >
                        {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        PIN: {scorerPin}
                      </Button>
                    ) : null}

                    <a
                      href={scorerHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs h-9 hover-elevate cursor-pointer shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Scorer Pad
                    </a>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleForceUnlock}
                      disabled={forceUnlocking}
                      className="h-9 text-xs font-semibold gap-1.5 cursor-pointer"
                      title="Clears any stuck tablet session so a new device can score"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      {forceUnlocking ? "Unlocking…" : "Emergency Force-Unlock"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Official scoring pad runs independently. If an umpire's tablet freezes or disconnects mid-game, trigger Emergency Force-Unlock to clear session ownership and hand off to a backup device.
                </p>
              </div>
            ) : null}

            {isPreMatch && snapshot ? (
              <PreMatchControlPanel
                snapshot={snapshot}
                peerMatches={peerMatches}
                onRefresh={refresh}
                scorerPin={scorerPin}
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
                    className="text-primary text-sm font-semibold hover:underline min-h-11 inline-flex items-center"
                  >
                    Back to Control Center
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </HubPageShell>
  );
}
