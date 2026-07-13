/**
 * Live scorer match identity strip — Court · Category · Team/Player VS Team/Player.
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import { identityFromSideInfo } from "@/lib/team-player-identity";
import { cn } from "@/lib/utils";

export function MatchIdentityStrip({
  state,
  courtNumber,
  categoryName,
  className,
}: {
  state: BadmintonMatchState;
  courtNumber?: string;
  categoryName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 mx-3 mb-2 rounded-xl border border-white/10 bg-[#070b16] px-3 py-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
        {courtNumber ? <span>Court {courtNumber}</span> : null}
        {categoryName ? <span className="truncate max-w-[60%]">{categoryName}</span> : null}
      </div>
      <TeamPlayerVs
        left={identityFromSideInfo(state.leftSide, { preferShort: true })}
        right={identityFromSideInfo(state.rightSide, { preferShort: true })}
        size="sm"
        layout="stack"
        tone="led"
      />
    </div>
  );
}
