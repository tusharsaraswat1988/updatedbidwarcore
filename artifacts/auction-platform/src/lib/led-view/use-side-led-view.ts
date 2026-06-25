import { useMemo } from "react";
import { useLedView } from "./use-led-view";
import { withSideLedState } from "./derive-side-led-state";
import type { LedView } from "./types";

/** Side LED view — same data as main display, operator overlay modes stripped. */
export function useSideLedView(
  tournamentId: number,
  connectionStatus: LedView["connectionStatus"] = "connected",
): LedView {
  const view = useLedView(tournamentId, connectionStatus);
  return useMemo(() => withSideLedState(view), [view]);
}
