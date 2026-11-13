/**
 * Mission Control court card — one court, clear primary action.
 */

import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import {
  badmintonMatchControlPath,
  badmintonScorerMatchPath,
} from "@/lib/badminton-routes";
import {
  fixtureSlotLabel,
  matchDisplayLabel,
  matchNumberLabel,
  type CourtBoardRow,
  type CourtOpsStatus,
} from "@/lib/badminton-control-center";
import { explainStartBlocker, courtDisplayPriority } from "@/lib/mission-control-ops";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import { identityFromLooseSide } from "@/lib/team-player-identity";
import { formatCourtOpsStatusLabel } from "@/lib/badminton-ux";
import { hubCardClass } from "@/components/badminton/page-chrome";
import { useBadmintonDirector } from "@/hooks/use-badminton-match";
import { forceUnlockBadmintonMatch } from "@/lib/scorer-api";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";
import { useToast } from "@/hooks/use-toast";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import { useState } from "react";

function courtLabel(c: { name: string; shortName?: string | null }): string {
  return c.shortName?.trim() || c.name;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusStyles(status: CourtOpsStatus): string {
  switch (status) {
    case "LIVE":
      return "bg-rose-50 text-rose-800 border-rose-300 font-semibold";
    case "DELAYED":
      return "bg-orange-50 text-orange-800 border-orange-300 font-semibold";
    case "READY":
      return "bg-amber-50 text-amber-800 border-amber-300 font-semibold";
    case "FINISHED":
      return "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold";
    default:
      return "bg-slate-100 text-slate-700 border-slate-300 font-medium";
  }
}

export function MissionControlCourtCard({
  tournamentId,
  row,
  categoryName,
  primaryMatchId,
}: {
  tournamentId: number;
  row: CourtBoardRow;
  categoryName: Map<number, string>;
  primaryMatchId: number | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const { court, status, currentMatch, nextMatch, nextFixture, readyOverflow } = row;
  const displayPriority = courtDisplayPriority(row);
  const startBlocker = explainStartBlocker(row);

  const matchId = currentMatch?.id ?? 0;
  const director = useBadmintonDirector(tournamentId, matchId);
  const matchStatus = currentMatch?.status ?? "";
  const isPaused = matchStatus === "paused";
  const isLive = status === "LIVE" || matchStatus === "live" || isPaused;
  const isFollowing =
    currentMatch != null && primaryMatchId != null && currentMatch.id === primaryMatchId;

  const nextLabel = nextMatch
    ? matchDisplayLabel(nextMatch)
    : nextFixture
      ? fixtureSlotLabel(nextFixture, categoryName.get(nextFixture.categoryId))
      : "—";

  const setPrimaryMutation = useMutation({
    mutationFn: (id: number) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/primary-broadcast`, {
        method: "PATCH",
        body: JSON.stringify({ matchId: id }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
      toast({ title: "Screens follow this court" });
    },
  });

  async function run(action: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await action();
      void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      toast({ title: ok });
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const primaryAction = resolveCourtPrimaryAction({
    tournamentId,
    row,
    startBlocker,
    isLive,
    isPaused,
    currentMatch,
    nextFixture,
    nextMatch,
  });

  return (
    <article
      className={cn(
        hubCardClass,
        "p-4 space-y-3",
        displayPriority === "LIVE" && "border-red-500/45 ring-1 ring-red-500/25",
        displayPriority === "DELAYED" && "border-orange-500/45 ring-1 ring-orange-500/20",
        displayPriority === "READY" && "border-amber-500/25",
        displayPriority === "WAITING" && "border-sky-500/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-slate-900 font-bold text-lg leading-tight">{courtLabel(court)}</h3>
          {isLive && isFollowing ? (
            <p className="text-amber-800 text-[11px] font-semibold mt-0.5">On venue & OBS</p>
          ) : isLive ? (
            <p className="text-slate-500 text-[11px] mt-0.5">Live · not on main screens</p>
          ) : null}
          {court.scorerName?.trim() ? (
            <p className="text-slate-600 text-[11px] mt-0.5 truncate">
              Scorer · {court.scorerName.trim()}
              {court.hasScorerPin || court.scorerPin ? " · PIN set" : ""}
            </p>
          ) : court.hasScorerPin || court.scorerPin ? (
            <p className="text-slate-500 text-[11px] mt-0.5">Court PIN set</p>
          ) : null}
        </div>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0",
            statusStyles(status),
          )}
        >
          {formatCourtOpsStatusLabel(status)}
          {isPaused ? " · Paused" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <MatchSlot
          title="Now"
          left={currentMatch?.state?.leftSide}
          right={currentMatch?.state?.rightSide}
          fallback={currentMatch ? matchDisplayLabel(currentMatch) : "—"}
          score={
            currentMatch?.state && (status === "LIVE" || isPaused)
              ? `${currentMatch.state.leftScore ?? 0}–${currentMatch.state.rightScore ?? 0}`
              : null
          }
          scoreMeta={
            currentMatch
              ? [
                  matchNumberLabel(currentMatch),
                  currentMatch.state && (status === "LIVE" || isPaused) && currentMatch.state.currentGame != null
                    ? `Game ${currentMatch.state.currentGame}`
                    : null,
                  currentMatch.state &&
                  (status === "LIVE" || isPaused) &&
                  currentMatch.state.gamesLeft != null &&
                  currentMatch.state.gamesRight != null
                    ? `Sets ${currentMatch.state.gamesLeft}–${currentMatch.state.gamesRight}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
              : null
          }
          sub={
            status === "DELAYED" && currentMatch?.scheduledAt
              ? `Was due ${formatTime(currentMatch.scheduledAt)}`
              : null
          }
        />
        <MatchSlot
          title="Next"
          left={nextMatch?.state?.leftSide}
          right={nextMatch?.state?.rightSide}
          fallback={nextLabel}
          sub={
            [
              nextMatch ? matchNumberLabel(nextMatch) : null,
              nextMatch?.scheduledAt || nextFixture?.scheduledAt
                ? formatTime(nextMatch?.scheduledAt ?? nextFixture?.scheduledAt)
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
      </div>

      {readyOverflow > 0 ? (
        <p className="text-amber-900 text-xs rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-medium">
          {readyOverflow + 1} matches ready on this court — start the earliest first.
        </p>
      ) : null}

      <div className="space-y-2 pt-0.5">
        <div className="flex flex-wrap gap-2">
          {primaryAction}

          {isLive && currentMatch && !isFollowing ? (
            <button
              type="button"
              disabled={setPrimaryMutation.isPending}
              onClick={() => setPrimaryMutation.mutate(currentMatch.id)}
              className="min-h-10 px-3 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold"
            >
              Show on screens
            </button>
          ) : null}

          {isLive && currentMatch ? (
            matchStatus === "on_hold" || (isPaused && currentMatch.state?.pauseReason === "ops_hold") ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => director.unhold(), "Hold cleared")}
                className="min-h-10 px-3 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 text-xs font-bold"
              >
                Resume Hold
              </button>
            ) : isPaused ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => director.resume(), "Match resumed")}
                className="min-h-10 px-3 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-xs font-bold"
              >
                Resume
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(() => director.hold("Court freed for another match"), "Match on hold")
                  }
                  className="min-h-10 px-3 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold shadow-xs"
                >
                  Hold
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => director.pause("technical_issue"), "Match paused")}
                  className="min-h-10 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-xs"
                >
                  Pause
                </button>
              </>
            )
          ) : null}
        </div>

        {currentMatch ? (
          <details className="group rounded-lg border border-slate-200 bg-slate-50/50 open:bg-slate-50">
            <summary className="cursor-pointer list-none min-h-9 px-2.5 flex items-center text-[11px] font-semibold text-slate-600 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
              More actions
              <span className="ml-auto text-slate-400 group-open:rotate-180 transition-transform" aria-hidden>
                ▾
              </span>
            </summary>
            <div className="flex flex-wrap gap-2 px-2.5 pb-2.5 pt-1">
              {isLive && isPaused ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                       () => forceUnlockBadmintonMatch(tournamentId, currentMatch.id),
                      "Scorer lock cleared",
                    )
                  }
                  className="min-h-9 px-2.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold shadow-xs"
                >
                  Unlock scorer
                </button>
              ) : null}

              <a
                href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
                className="min-h-9 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center shadow-xs"
              >
                Director
              </a>

              {isLive ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setFinishConfirmOpen(true)}
                    className="min-h-9 px-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold shadow-xs"
                  >
                    Force finish
                  </button>
                  <ConfirmActionDialog
                    open={finishConfirmOpen}
                    onOpenChange={setFinishConfirmOpen}
                    title="Force finish this match?"
                    description="Use only when scoring cannot complete normally. Prefer Director panel for walkover or retirement."
                    confirmLabel="Force finish"
                    busy={busy}
                    onConfirm={() => {
                      setFinishConfirmOpen(false);
                      void run(
                        () => director.forceEnd("Finished from Live Control"),
                        "Match finished",
                      );
                    }}
                  />
                </>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function MatchSlot({
  title,
  left,
  right,
  fallback,
  score,
  scoreMeta,
  sub,
}: {
  title: string;
  left: Parameters<typeof identityFromLooseSide>[0];
  right: Parameters<typeof identityFromLooseSide>[0];
  fallback: string;
  score?: string | null;
  scoreMeta?: string | null;
  sub?: string | null;
}) {
  const hasSides = left || right;
  return (
    <div>
      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
      {hasSides ? (
        <TeamPlayerVs
          left={identityFromLooseSide(left)}
          right={identityFromLooseSide(right)}
          size="xs"
          layout="inline"
          className="items-start"
        />
      ) : (
        <p className="text-slate-800 font-semibold truncate">{fallback}</p>
      )}
      {score ? (
        <p className="text-slate-900 text-xl tabular-nums mt-1 font-sans font-bold leading-none">{score}</p>
      ) : null}
      {scoreMeta ? <p className="text-slate-600 text-[11px] tabular-nums mt-1 font-semibold">{scoreMeta}</p> : null}
      {sub ? <p className="text-slate-500 text-xs mt-0.5">{sub}</p> : null}
    </div>
  );
}

function resolveCourtPrimaryAction(input: {
  tournamentId: number;
  row: CourtBoardRow;
  startBlocker: string | null;
  isLive: boolean;
  isPaused: boolean;
  currentMatch: CourtBoardRow["currentMatch"];
  nextFixture: CourtBoardRow["nextFixture"];
  nextMatch: CourtBoardRow["nextMatch"];
}): React.ReactNode {
  const { tournamentId, row, startBlocker, isLive, currentMatch, nextFixture, nextMatch } = input;
  const { status } = row;

  if (status === "EMPTY") {
    if (nextFixture) {
      return (
        <Link
          href={`/tournament/${tournamentId}/badminton/matches?fixture=${nextFixture.id}`}
          className="min-h-10 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold inline-flex items-center shadow-xs"
        >
          Assign match
        </Link>
      );
    }
    return (
      <Link
        href={`/tournament/${tournamentId}/badminton/schedule`}
        className="min-h-10 px-4 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold inline-flex items-center shadow-xs"
      >
        Open schedule
      </Link>
    );
  }

  if ((status === "READY" || status === "DELAYED") && currentMatch) {
    if (startBlocker) {
      return (
        <div className="w-full space-y-1">
          <button
            type="button"
            disabled
            title={startBlocker}
            className="min-h-10 px-4 rounded-lg text-sm font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
          >
            Start match
          </button>
          <p className="text-[11px] text-amber-800 font-medium">{startBlocker}</p>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <a
          href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
          className={cn(
            "min-h-10 px-4 rounded-lg text-sm font-bold inline-flex items-center shadow-xs",
            status === "DELAYED"
              ? "bg-amber-500 hover:bg-amber-600 text-slate-900"
              : "bg-primary hover:bg-amber-500 text-primary-foreground",
          )}
        >
          Start match
        </a>
        <p className="text-[11px] text-slate-500 font-medium">Toss &amp; start in Match Control</p>
      </div>
    );
  }

  if (isLive && currentMatch) {
    return (
      <a
        href={badmintonScorerMatchPath(currentMatch.id, tournamentId)}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-10 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold inline-flex items-center shadow-xs"
      >
        Open scoring
      </a>
    );
  }

  if (status === "FINISHED") {
    if (nextFixture) {
      return (
        <Link
          href={`/tournament/${tournamentId}/badminton/matches?fixture=${nextFixture.id}`}
          className="min-h-10 px-4 rounded-lg bg-primary hover:bg-amber-500 text-primary-foreground text-sm font-bold inline-flex items-center shadow-xs"
        >
          Assign next
        </Link>
      );
    }
    if (nextMatch) {
      return (
        <a
          href={badmintonMatchControlPath(tournamentId, nextMatch.id)}
          className="min-h-10 px-4 rounded-lg bg-primary hover:bg-amber-500 text-primary-foreground text-sm font-bold inline-flex items-center shadow-xs"
        >
          Start next
        </a>
      );
    }
    return (
      <Link
        href={`/tournament/${tournamentId}/badminton/schedule`}
        className="min-h-10 px-4 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold inline-flex items-center shadow-xs"
      >
        Schedule next
      </Link>
    );
  }

  return null;
}
