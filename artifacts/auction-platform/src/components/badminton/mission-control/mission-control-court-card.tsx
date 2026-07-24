/**
 * Mission Control court card — one court = one operational unit.
 */

import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import {
  badmintonMatchControlPath,
  badmintonScorerMatchPath,
} from "@/lib/badminton-routes";
import {
  badmintonQrImageUrl,
  badmintonScorerHomePublicUrl,
} from "@/lib/badminton-broadcast-urls";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const hasScorerPin = !!(court.hasScorerPin || (court.scorerPin && court.scorerPin.trim()));
  const scorerHomeUrl = badmintonScorerHomePublicUrl(tournamentId);
  const scorerLabel = !hasScorerPin
    ? "No PIN"
    : isLive
      ? isPaused
        ? "Paused — reconnect if needed"
        : "Live scoring"
      : "PIN ready";

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
        <div>
          <h3 className="text-white font-bold text-lg leading-tight">{courtLabel(court)}</h3>
          <p className="text-white/35 text-xs mt-0.5">{court.name}</p>
        </div>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0",
            statusStyles(status),
          )}
        >
          {formatCourtOpsStatusLabel(status)}
          {isPaused ? " · PAUSED" : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        <FollowPill label="Broadcast" on={isFollowing && isLive} />
        <FollowPill label="LED" on={isFollowing && isLive} />
        <FollowPill label="OBS" on={isFollowing && isLive} />
        <span
          className={cn(
            "px-2 py-1 rounded border",
            hasScorerPin
              ? "border-sky-500/35 bg-sky-500/10 text-sky-200"
              : "border-white/10 bg-white/5 text-white/45",
          )}
        >
          Scorer · {scorerLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">
            Current match
          </p>
          {currentMatch?.state?.leftSide || currentMatch?.state?.rightSide ? (
            <TeamPlayerVs
              left={identityFromLooseSide(currentMatch.state?.leftSide)}
              right={identityFromLooseSide(currentMatch.state?.rightSide)}
              size="xs"
              layout="inline"
              className="items-start"
            />
          ) : (
            <p className="text-white font-medium truncate">
              {currentMatch ? matchDisplayLabel(currentMatch) : "—"}
            </p>
          )}
          {currentMatch?.state && (status === "LIVE" || isPaused) ? (
            <p className="text-white/70 text-xs tabular-nums mt-1 font-semibold">
              {currentMatch.state.leftScore ?? 0}–{currentMatch.state.rightScore ?? 0}
              {currentMatch.state.currentGame != null
                ? ` · Game ${currentMatch.state.currentGame}`
                : ""}
            </p>
          ) : null}
          {status === "DELAYED" && currentMatch?.scheduledAt ? (
            <p className="text-orange-300/80 text-xs mt-0.5">
              Was due {formatTime(currentMatch.scheduledAt)}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">
            Next match
          </p>
          {nextMatch?.state?.leftSide || nextMatch?.state?.rightSide ? (
            <TeamPlayerVs
              left={identityFromLooseSide(nextMatch.state?.leftSide)}
              right={identityFromLooseSide(nextMatch.state?.rightSide)}
              size="xs"
              layout="inline"
              className="items-start"
            />
          ) : (
            <p className="text-white/85 font-medium truncate">{nextLabel}</p>
          )}
          {(nextMatch?.scheduledAt || nextFixture?.scheduledAt) && (
            <p className="text-white/40 text-xs mt-0.5">
              {formatTime(nextMatch?.scheduledAt ?? nextFixture?.scheduledAt)}
            </p>
          )}
        </div>
      </div>

      {readyOverflow > 0 ? (
        <p className="text-orange-200/90 text-xs rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
          {readyOverflow + 1} ready on this court — start the earliest first.
        </p>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(scorerHomeUrl).then(() => {
                toast({
                  title: "Scorer Home copied",
                  description: hasScorerPin
                    ? "Share with the court scorer along with the PIN."
                    : "Set a court PIN in Tournament Setup → Courts.",
                });
              });
            }}
            className="min-h-10 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy scorer link
          </button>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/80 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            QR
          </button>
          {isLive && currentMatch && !isFollowing ? (
            <button
              type="button"
              disabled={setPrimaryMutation.isPending}
              onClick={() => setPrimaryMutation.mutate(currentMatch.id)}
              className="min-h-10 px-3 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-50 text-xs font-bold"
            >
              Focus court
            </button>
          ) : null}
          {isLive && currentMatch ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => forceUnlockBadmintonMatch(tournamentId, currentMatch.id),
                  "Scorer lock cleared — scorer can reconnect",
                )
              }
              className="min-h-10 px-3 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-100 text-xs font-semibold"
            >
              Reconnect scorer
            </button>
          ) : null}
        </div>
        {hasScorerPin && court.scorerPin ? (
          <p className="text-[11px] font-mono text-sky-300/90">PIN {court.scorerPin}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 pt-0.5">
        {status === "EMPTY" ? (
          nextFixture ? (
            <Link
              href={`/tournament/${tournamentId}/badminton/matches?fixture=${nextFixture.id}`}
              className="min-h-10 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold inline-flex items-center"
            >
              Assign next match
            </Link>
          ) : (
            <Link
              href={`/tournament/${tournamentId}/badminton/schedule`}
              className="min-h-10 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold inline-flex items-center"
            >
              Schedule next
            </Link>
          )
        ) : null}

        {(status === "READY" || status === "DELAYED") && currentMatch ? (
          startBlocker ? (
            <div className="w-full space-y-1">
              <button
                type="button"
                disabled
                title={startBlocker}
                className="min-h-10 px-4 rounded-lg text-sm font-bold bg-white/10 text-white/40 cursor-not-allowed"
              >
                {status === "DELAYED" ? "Start (delayed)" : "Start match"}
              </button>
              <p className="text-[11px] text-amber-200/90">{startBlocker}</p>
            </div>
          ) : (
            <a
              href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
              className={cn(
                "min-h-10 px-4 rounded-lg text-sm font-bold inline-flex items-center",
                status === "DELAYED"
                  ? "bg-orange-500/30 hover:bg-orange-500/40 text-orange-50"
                  : "bg-amber-500/25 hover:bg-amber-500/35 text-amber-100",
              )}
            >
              {status === "DELAYED" ? "Start (delayed)" : "Start match"}
            </a>
          )
        ) : null}

        {isLive && currentMatch ? (
          <>
            <a
              href={badmintonScorerMatchPath(currentMatch.id, tournamentId)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-10 px-4 rounded-lg bg-red-500/25 hover:bg-red-500/35 text-red-200 text-sm font-bold inline-flex items-center"
            >
              Open scoring
            </a>
            {isPaused ? (
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
                onClick={() =>
                  run(() => director.pause("technical_issue"), "Match paused")
                }
                className="min-h-10 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 text-xs font-bold"
              >
                Pause
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Force-finish this match? Use only when scoring cannot complete normally.",
                  )
                ) {
                  return;
                }
                void run(
                  () => director.forceEnd("Finished from Mission Control"),
                  "Match finished",
                );
              }}
              className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs font-semibold"
            >
              Finish
            </button>
          </>
        ) : null}

        {status === "FINISHED" && currentMatch ? (
          <>
            <a
              href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
              className="min-h-10 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-semibold inline-flex items-center"
            >
              View match
            </a>
            {nextFixture ? (
              <Link
                href={`/tournament/${tournamentId}/badminton/matches?fixture=${nextFixture.id}`}
                className="min-h-10 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs font-bold inline-flex items-center"
              >
                Assign next match
              </Link>
            ) : nextMatch ? (
              <a
                href={badmintonMatchControlPath(tournamentId, nextMatch.id)}
                className="min-h-10 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs font-bold inline-flex items-center"
              >
                Start next
              </a>
            ) : (
              <Link
                href={`/tournament/${tournamentId}/badminton/schedule`}
                className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/80 text-xs font-semibold inline-flex items-center"
              >
                Schedule next
              </Link>
            )}
          </>
        ) : null}

        {currentMatch && status !== "FINISHED" ? (
          <a
            href={badmintonMatchControlPath(tournamentId, currentMatch.id)}
            className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 text-xs font-semibold inline-flex items-center"
          >
            View match
          </a>
        ) : null}
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Scorer Home · {court.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={badmintonQrImageUrl(scorerHomeUrl)}
              alt={`QR for Scorer Home — ${court.name}`}
              className="rounded-lg border border-border"
              width={240}
              height={240}
            />
            <p className="text-xs text-muted-foreground text-center">
              Scan to open Scorer Home. Court PIN still required.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function FollowPill({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cn(
        "px-2 py-1 rounded border",
        on
          ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
          : "border-white/10 bg-white/5 text-white/40",
      )}
    >
      {label} {on ? "· Following" : "· —"}
    </span>
  );
}
