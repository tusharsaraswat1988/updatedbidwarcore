/**
 * Mission Control top bar — status strip + global primary action.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import type { PrimaryAction } from "@/lib/mission-control-ops";

export function MissionControlTopBar({
  tournamentName,
  liveCount,
  readyCount,
  delayedCount,
  completedCount,
  primaryAction,
  emergencyActive,
  onEmergency,
  onResumePresentation,
}: {
  tournamentName: string;
  liveCount: number;
  readyCount: number;
  delayedCount: number;
  completedCount: number;
  primaryAction: PrimaryAction;
  emergencyActive?: boolean;
  onEmergency?: () => void;
  onResumePresentation?: () => void;
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
      className={cn(hubCardClass, "p-3 sm:p-4 sticky top-0 z-20 backdrop-blur-md bg-card/95 space-y-3")}
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
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {primaryAction.disabled ? (
          <div className="flex-1 min-w-0">
            <button
              type="button"
              disabled
              className="w-full sm:w-auto min-h-12 px-5 rounded-xl bg-white/10 text-white/45 text-sm font-bold cursor-not-allowed"
              title={primaryAction.disabledReason}
            >
              {primaryAction.label}
            </button>
            {primaryAction.disabledReason ? (
              <p className="text-[11px] text-amber-200/90 mt-1">{primaryAction.disabledReason}</p>
            ) : null}
          </div>
        ) : primaryAction.href ? (
          <Link
            href={primaryAction.href}
            className="w-full sm:w-auto min-h-12 px-5 rounded-xl bg-amber-500/30 hover:bg-amber-500/40 text-amber-50 text-sm font-bold inline-flex items-center justify-center"
          >
            {primaryAction.label}
          </Link>
        ) : (
          <button
            type="button"
            className="w-full sm:w-auto min-h-12 px-5 rounded-xl bg-amber-500/30 hover:bg-amber-500/40 text-amber-50 text-sm font-bold"
          >
            {primaryAction.label}
          </button>
        )}

        {emergencyActive ? (
          <button
            type="button"
            onClick={onResumePresentation}
            className="min-h-12 px-4 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-100 text-xs font-bold"
          >
            Resume tournament screens
          </button>
        ) : (
          <button
            type="button"
            onClick={onEmergency}
            className="min-h-12 px-4 rounded-xl border border-orange-500/40 bg-orange-500/15 hover:bg-orange-500/25 text-orange-100 text-xs font-bold"
          >
            Emergency pause
          </button>
        )}
      </div>
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
