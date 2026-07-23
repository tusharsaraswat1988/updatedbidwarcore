/**
 * Mission Control top bar — live operational status (not dashboard KPIs).
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";

export function MissionControlTopBar({
  tournamentName,
  liveCount,
  readyCount,
  delayedCount,
  completedCount,
  nextReadyId,
  tournamentId,
  alertText,
}: {
  tournamentName: string;
  liveCount: number;
  readyCount: number;
  delayedCount: number;
  completedCount: number;
  nextReadyId: number | null;
  tournamentId: number;
  alertText?: string | null;
}) {
  const [now, setNow] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header
      className={cn(hubCardClass, "p-3 sm:p-4 sticky top-0 z-20 backdrop-blur-md bg-card/95")}
      aria-label="Mission Control status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">Tournament</p>
          <p className="text-sm sm:text-base font-semibold text-foreground truncate">
            {tournamentName || "Badminton"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tabular-nums">
          <span className="text-white/40">{now}</span>
          <StatusChip label="Live" value={liveCount} tone="live" />
          <StatusChip label="Ready" value={readyCount} tone="ready" />
          <StatusChip label="Delayed" value={delayedCount} tone="delayed" />
          <StatusChip label="Completed" value={completedCount} tone="done" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nextReadyId != null ? (
            <a
              href={badmintonMatchControlPath(tournamentId, nextReadyId)}
              className="min-h-10 px-3 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-100 text-xs font-bold inline-flex items-center"
            >
              Start next ready
            </a>
          ) : (
            <Link
              href={`/tournament/${tournamentId}/badminton/schedule`}
              className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/75 text-xs font-semibold inline-flex items-center"
            >
              Open schedule
            </Link>
          )}
        </div>
      </div>
      {alertText ? (
        <p
          className="mt-3 text-xs font-semibold text-orange-200 rounded-lg border border-orange-500/35 bg-orange-500/10 px-3 py-2"
          role="alert"
        >
          {alertText}
        </p>
      ) : null}
    </header>
  );
}

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "live" | "ready" | "delayed" | "done";
}) {
  const toneClass =
    tone === "live"
      ? "text-red-300"
      : tone === "ready"
        ? "text-amber-200"
        : tone === "delayed"
          ? "text-orange-200"
          : "text-emerald-300";
  return (
    <span className={cn("inline-flex items-baseline gap-1", toneClass)}>
      <span className="text-base font-bold">{value}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
    </span>
  );
}
