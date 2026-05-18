import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TeamOverlay } from "./team-overlay";
import { PlayerOverlay } from "./player-overlay";
import { Top5Overlay } from "./top5-overlay";
import { FortuneWheelOverlay } from "./fortune-wheel-overlay";
import { BreakCountdownOverlay } from "./break-countdown-overlay";
import type { CategoryLite, DisplayPlayerFilter, PlayerLite, PurseRow, WheelItem } from "./types";

/**
 * Orchestrates the mutually-coordinated full-screen overlays:
 *   - team-purse table (operator-toggled)
 *   - player registry table (operator-toggled, filterable)
 *   - top-5 buys leaderboard (operator-toggled)
 *   - fortune wheel (separate `fortuneWheelActive` flag, can stack)
 *   - break / pre-auction countdown (displayCountdown field)
 *
 * Render isolation:
 *  - Each overlay is its own React.memo'd subtree. Switching `overlayMode`
 *    swaps which child renders inside the AnimatePresence, but does not
 *    rerender siblings.
 *  - The fortune wheel uses its own AnimatePresence so it can layer over
 *    or coexist with the other overlays without remounting them.
 *  - The countdown overlay uses its own AnimatePresence and layers on top
 *    of everything except the fortune wheel.
 *  - Children receive only the slices they actually consume; the parent
 *    DisplayShell passes useMemo'd values for stable identity.
 */
export const OverlayManager = memo(function OverlayManager({
  overlayMode,
  stripPurses,
  currentBidTeamId,
  tournamentName,
  allPlayers,
  allCategories,
  playerFilter,
  fortuneWheelActive,
  wheelItems,
  wheelWinner,
  wheelSpinning,
  displayCountdownType,
  displayCountdownEndsAt,
  displayCountdownLabel,
}: {
  overlayMode: string | null | undefined;
  stripPurses: PurseRow[];
  currentBidTeamId: number | null | undefined;
  tournamentName: string | null | undefined;
  allPlayers: PlayerLite[];
  allCategories: CategoryLite[];
  playerFilter: DisplayPlayerFilter;
  fortuneWheelActive: boolean | null | undefined;
  wheelItems: WheelItem[];
  wheelWinner: string | null | undefined;
  wheelSpinning: boolean | null | undefined;
  displayCountdownType: "break" | "pre-auction" | null;
  displayCountdownEndsAt: string | null;
  displayCountdownLabel: string | null;
}) {
  const showCountdown = !!displayCountdownType && !!displayCountdownEndsAt;

  return (
    <>
      {/* LED Display Overlays — Team / Player / Top 5 */}
      <AnimatePresence mode="wait">
        {overlayMode === "team" && stripPurses.length > 0 && (
          <motion.div
            key="overlay-team"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <TeamOverlay
              purses={stripPurses}
              currentBidTeamId={currentBidTeamId}
              tournamentName={tournamentName ?? undefined}
            />
          </motion.div>
        )}
        {overlayMode === "player" && (
          <motion.div
            key="overlay-player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <PlayerOverlay
              players={allPlayers}
              purses={stripPurses}
              categories={allCategories}
              tournamentName={tournamentName ?? undefined}
              filter={playerFilter}
            />
          </motion.div>
        )}
        {overlayMode === "top5" && (
          <motion.div
            key="overlay-top5"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <Top5Overlay
              players={allPlayers}
              purses={stripPurses}
              tournamentName={tournamentName ?? undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fortune Wheel Overlay */}
      <AnimatePresence>
        {fortuneWheelActive && (
          <motion.div
            key="fortune-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <FortuneWheelOverlay items={wheelItems} winner={wheelWinner} wheelSpinning={wheelSpinning ?? false} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Break / Pre-Auction Countdown Overlay — layers above everything */}
      <AnimatePresence>
        {showCountdown && (
          <motion.div
            key={`countdown-${displayCountdownEndsAt}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            <BreakCountdownOverlay
              type={displayCountdownType!}
              endsAt={displayCountdownEndsAt!}
              label={displayCountdownLabel}
              tournamentName={tournamentName}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
