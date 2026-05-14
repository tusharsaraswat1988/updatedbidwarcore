/**
 * Re-export of the shared ServerCountdown configured with the display
 * variant. Lives in /components/display/ for discoverability — the
 * actual countdown lives in /components/server-countdown so it can be
 * shared with the operator and owner panels (single source of truth).
 *
 * Render isolation: ServerCountdown owns its own 250ms tick interval
 * inside a memoized subtree, so timer ticks never reach the parent
 * DisplayShell or any sibling broadcast component.
 */
import { memo } from "react";
import { ServerCountdown } from "@/components/server-countdown";

export const AuctionCountdown = memo(function AuctionCountdown({ timerEndsAt, timerType }: {
  timerEndsAt: string | null | undefined;
  timerType?: string | null;
}) {
  return <ServerCountdown variant="display" timerEndsAt={timerEndsAt} timerType={timerType} />;
});
