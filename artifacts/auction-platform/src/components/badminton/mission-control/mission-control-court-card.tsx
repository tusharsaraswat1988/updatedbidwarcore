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
      return "bg-red-500/15 text-red-400 border-red-500/30";
    case "DELAYED":
      return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    case "READY":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "FINISHED":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-white/8 text-white/50 border-white/10";
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
          <h3 className="text-white font-bold text-lg leading-tight">{courtLabel(court)}</h3>
          {isLive && isFollowing ? (
            <p className="text-amber-200/90 text-[11px] font-semibold mt-0.5">On venue & OBS</p>
          ) : isLive ? (
            <p className="text-white/35 text-[11px] mt-0.5">Live · not on main screens</p>
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
              ? `${currentMatch.state.leftScore ?? 0}–${currentMatch.state.rightScore ?? 0}${
                  currentMatch.state.currentGame != null ? ` · G${currentMatch.state.currentGame}` : ""
                }`
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
            nextMatch?.scheduledAt || nextFixture?.scheduledAt
              ? formatTime(nextMatch?.scheduledAt ?? nextFixture?.scheduledAt)
              : null
          }
        />
      </div>

      {readyOverflow > 0 ? (
        <p className="text-orange-200/90 text-xs rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
          {readyOverflow + 1} matches ready on this court — start the earliest first.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-0.5">
        {primaryAction}

        {isLive && currentMatch && !isFollowing ? (
          <button
            type="button"
            disabled={setPrimaryMutation.isPending}
            onClick={() => setPrimaryMutation.mutate(currentMatch.id)}
            className="min-h-10 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-50 text-xs font-semibold"
          >
            Show on screens
          </button>
        ) : null}

        {isLive && currentMatch ? (
          isPaused ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => director.resume(), "Match resumed")}
              className="min-h-10 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-bold"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => director.pause("technical_issue"), "Match paused")}
              className="min-h-10 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 text-xs font-semibold"
            >
              Pause
            </button>
          )
        ) : null}

        {isLive && currentMatch && isPaused ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => forceUnlockBadmintonMatch(tournamentId, currentMatch.id),
                "Scorer lock cleared",
              )
            }
            className="min-h-10 px-3 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-100 text-xs font-semibold"
          >
            Unlock scorer
          </button>
        ) : null}

        {currentMatch ? (
          <a
            href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
            className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 text-xs font-semibold inline-flex items-center"
          >
            Director
          </a>
        ) : null}

        {isLive && currentMatch ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFinishConfirmOpen(true)}
              className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/55 text-xs font-semibold"
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
    </article>
  );
}

function MatchSlot({
  title,
  left,
  right,
  fallback,
  score,
  sub,
}: {
  title: string;
  left: Parameters<typeof identityFromLooseSide>[0];
  right: Parameters<typeof identityFromLooseSide>[0];
  fallback: string;
  score?: string | null;
  sub?: string | null;
}) {
  const hasSides = left || right;
  return (
    <div>
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
      {hasSides ? (
        <TeamPlayerVs
          left={identityFromLooseSide(left)}
          right={identityFromLooseSide(right)}
          size="xs"
          layout="inline"
          className="items-start"
        />
      ) : (
        <p className="text-white font-medium truncate">{fallback}</p>
      )}
      {score ? <p className="text-white/70 text-xs tabular-nums mt-1 font-semibold">{score}</p> : null}
      {sub ? <p className="text-white/40 text-xs mt-0.5">{sub}</p> : null}
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
          className="min-h-10 px-4 rounded-lg bg-purple-500/25 hover:bg-purple-500/35 text-purple-100 text-sm font-bold inline-flex items-center"
        >
          Assign match
        </Link>
      );
    }
    return (
      <Link
        href={`/tournament/${tournamentId}/badminton/schedule`}
        className="min-h-10 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white/75 text-sm font-semibold inline-flex items-center"
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
            className="min-h-10 px-4 rounded-lg text-sm font-bold bg-white/10 text-white/40 cursor-not-allowed"
          >
            Start match
          </button>
          <p className="text-[11px] text-amber-200/90">{startBlocker}</p>
        </div>
      );
    }
    return (
      <a
        href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
        className={cn(
          "min-h-10 px-4 rounded-lg text-sm font-bold inline-flex items-center",
          status === "DELAYED"
            ? "bg-orange-500/30 hover:bg-orange-500/40 text-orange-50"
            : "bg-amber-500/30 hover:bg-amber-500/40 text-amber-50",
        )}
      >
        Start match
      </a>
    );
  }

  if (isLive && currentMatch) {
    return (
      <a
        href={badmintonScorerMatchPath(currentMatch.id, tournamentId)}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-10 px-4 rounded-lg bg-red-500/30 hover:bg-red-500/40 text-red-100 text-sm font-bold inline-flex items-center"
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
          className="min-h-10 px-4 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-50 text-sm font-bold inline-flex items-center"
        >
          Assign next
        </Link>
      );
    }
    if (nextMatch) {
      return (
        <a
          href={badmintonMatchControlPath(tournamentId, nextMatch.id)}
          className="min-h-10 px-4 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-50 text-sm font-bold inline-flex items-center"
        >
          Start next
        </a>
      );
    }
    return (
      <Link
        href={`/tournament/${tournamentId}/badminton/schedule`}
        className="min-h-10 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white/75 text-sm font-semibold inline-flex items-center"
      >
        Schedule next
      </Link>
    );
  }

  return null;
}
