/**
 * Category status card — In Progress / Completed overview.
 * Does not dump full match history (that lives under Recent Results).
 */

import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import {
  categoryDisplayName,
  type CategoryResultsBlock,
} from "@/lib/badminton-results";
import { matchDisplayLabel } from "@/lib/badminton-control-center";

export function CategoryStatusCard({
  block,
  tournamentId,
}: {
  block: CategoryResultsBlock;
  tournamentId: number;
}) {
  const name = categoryDisplayName(block.category);
  const completed = block.champion != null || block.remainingCount === 0;
  const status = completed ? "Completed" : block.live.length > 0 ? "Live" : "In Progress";

  return (
    <div
      id={`category-${block.category.id}`}
      className={cn(
        hubCardClass,
        "p-4 scroll-mt-24",
        completed && "border-emerald-500/20",
        block.live.length > 0 && "border-red-500/25",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-white font-bold text-lg truncate">{name}</h3>
          <p className="text-white/35 text-xs mt-0.5">
            {block.completed.length} completed
            {block.remainingCount > 0 ? ` · ${block.remainingCount} left` : ""}
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border flex-none",
            status === "Completed" && "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
            status === "Live" && "bg-red-500/15 text-red-300 border-red-500/30",
            status === "In Progress" && "bg-amber-500/10 text-amber-200 border-amber-500/25",
          )}
        >
          {status}
        </span>
      </div>

      {block.champion ? (
        <p className="mt-3 text-sm">
          <span className="text-white/40">Champion · </span>
          <a href="#champions" className="text-amber-200 font-semibold hover:underline">
            {block.champion.winnerLabel}
          </a>
        </p>
      ) : null}

      {block.live.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
          {block.live.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white/80 truncate">{matchDisplayLabel(m)}</span>
              <span className="text-red-300 text-xs font-semibold flex-none">
                {m.state ? `${m.state.leftScore}–${m.state.rightScore}` : "LIVE"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!completed && block.upcoming.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
          {block.upcoming.slice(0, 3).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white/65 truncate">{matchDisplayLabel(m)}</span>
              <Link
                href={badmintonMatchControlPath(tournamentId, m.id)}
                className="text-[#4fc3f7] text-xs font-semibold hover:underline flex-none"
              >
                Prep
              </Link>
            </li>
          ))}
          {block.upcoming.length > 3 ? (
            <li className="text-white/30 text-xs">+{block.upcoming.length - 3} more upcoming</li>
          ) : null}
        </ul>
      ) : null}

      {block.collections.length > 0 ? (
        <a
          href={`#bracket-${block.category.id}`}
          className="inline-block mt-3 text-white/40 text-xs font-semibold hover:text-white/70 hover:underline"
        >
          View bracket →
        </a>
      ) : null}
    </div>
  );
}
