/**
 * Collapsible champion card for Tournament Summary — winner + runner-up + score.
 * Reuses Team → Player identity when available.
 */

import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import { identityFromCombinedLabel } from "@/lib/team-player-identity";
import type { SummaryChampion } from "@/lib/badminton-tournament-summary";

export function SummaryChampionCard({
  champion,
  defaultOpen = true,
}: {
  champion: SummaryChampion;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const winner =
    champion.winnerIdentity ?? identityFromCombinedLabel(champion.winnerLabel);
  const runnerUp =
    champion.runnerUpIdentity ??
    (champion.runnerUpLabel ? identityFromCombinedLabel(champion.runnerUpLabel) : null);

  return (
    <article
      className={cn(
        hubCardClass,
        "overflow-hidden border-amber-500/35 bg-gradient-to-br from-amber-500/20 via-amber-500/[0.06] to-transparent",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
      >
        <div className="h-12 w-12 rounded-xl bg-amber-500/25 border border-amber-500/40 flex items-center justify-center flex-none">
          <Trophy className="h-6 w-6 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-amber-200/80 text-[10px] font-bold uppercase tracking-[0.22em]">
            Champion
          </p>
          <p className="text-white font-bold text-lg sm:text-xl truncate mt-0.5">
            {champion.categoryName}
          </p>
          <p className="text-white/55 text-sm truncate mt-0.5">{champion.winnerLabel}</p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-white/40 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="px-5 pb-5 pt-0 space-y-5 border-t border-white/5">
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            <div className="rounded-xl border border-amber-500/25 bg-black/20 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-200/70 mb-3">
                Winner
              </p>
              <TeamPlayerCard identity={winner} size="lg" tone="muted" layout="stack" />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-3">
                Runner-up
              </p>
              {runnerUp ? (
                <TeamPlayerCard identity={runnerUp} size="lg" tone="muted" layout="stack" />
              ) : (
                <p className="text-white/35 text-sm">Not recorded</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-white/45">{champion.roundLabel}</span>
            <span className="text-emerald-300 font-semibold font-mono">{champion.scoreLine}</span>
            {champion.outcomeLabel !== "Completed" ? (
              <span className="text-amber-200/70 text-xs">{champion.outcomeLabel}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
