/**
 * Cricket OBS Pre-Match / Waiting Slate
 * Broadcast waiting plate matching the canonical BidWar dark carbon design system.
 */

import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";
import { BROADCAST_OVERLAY_SAFE_INSET_X } from "@/lib/broadcast-overlay";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

export function CricketObsWaiting({ vm }: { vm: CricketObsViewModel }) {
  let title = "WAITING FOR NEXT MATCH";
  let subtitle = "BIDWAR CRICKET BROADCAST";

  if (vm.phase === "pre_match") {
    title =
      vm.home && vm.away
        ? `${vm.home.shortCode}  VS  ${vm.away.shortCode}`
        : "MATCH STARTING SOON";
    subtitle = "PRE-MATCH BUILD UP";
  } else if (vm.phase === "match_unavailable") {
    title = "MATCH NOT ON LIVE FEED";
    subtitle = "OPEN CRICKET OBS LIVE FOR ACTIVE FIXTURE";
  }

  return (
    <div
      className="w-full flex items-center justify-between border-t border-white/10 shadow-lg py-5"
      style={{
        background: BIDWAR_SCOREBOARD_SHELL,
        paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        fontFamily: BROADCAST_FONTS.body,
      }}
    >
      <div className="flex flex-col justify-center">
        <span
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: BIDWAR_BROADCAST_YELLOW }}
        >
          {subtitle}
        </span>
        <h2
          className="mt-1 text-3xl font-normal uppercase tracking-wide text-white leading-none"
          style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
        >
          {title}
        </h2>
      </div>

      <div
        className="border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70"
        style={{ background: BIDWAR_SCOREBOARD_PANEL }}
      >
        LIVE BROADCAST FEED READY
      </div>
    </div>
  );
}
