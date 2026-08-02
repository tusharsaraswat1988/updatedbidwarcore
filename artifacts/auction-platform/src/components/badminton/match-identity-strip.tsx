/**
 * Live scorer match identity strip — compact team VS team context.
 * Player names live on the score buttons / court diagram; this strip stays team-first.
 * Standalone (no franchise) falls back to player names via TeamPlayerCard.
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import { identityFromSideInfo } from "@/lib/team-player-identity";
import { cn } from "@/lib/utils";

export function MatchIdentityStrip({
  state,
  categoryName,
  matchNumber,
  className,
}: {
  state: BadmintonMatchState;
  /** Kept for call-site compatibility; court is shown in ScorerConsoleHeader. */
  courtNumber?: string;
  matchNumber?: string;
  categoryName?: string;
  className?: string;
}) {
  const category = categoryName?.trim();
  const matchLabel = matchNumber?.trim() ? `Match ${matchNumber.trim()}` : null;
  const meta = [matchLabel, category].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "shrink-0 mx-3 mb-2 rounded-xl border border-border bg-card/80 px-3 py-1.5 min-w-0 overflow-hidden",
        className,
      )}
    >
      {meta ? (
        <div className="mb-1 min-w-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {meta}
        </div>
      ) : null}
      <TeamPlayerVs
        left={identityFromSideInfo(state.leftSide)}
        right={identityFromSideInfo(state.rightSide)}
        size="xs"
        layout="inline"
        showPlayer={false}
        tone="led"
      />
    </div>
  );
}
