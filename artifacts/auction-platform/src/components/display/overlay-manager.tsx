import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TeamOverlay } from "./team-overlay";
import { PlayerOverlay } from "./player-overlay";
import { Top5Overlay } from "./top5-overlay";
import { FortuneWheelOverlay } from "./fortune-wheel-overlay";
import { BannerOverlay } from "./banner-overlay";
import type { CategoryLite, DisplayPlayerFilter, PlayerLite, PurseRow, WheelItem } from "./types";

/**
 * Orchestrates the mutually-coordinated full-screen overlays:
 *   - team-purse table (operator-toggled)
 *   - player registry table (operator-toggled, filterable)
 *   - top-5 buys leaderboard (operator-toggled)
 *   - fortune wheel (separate `fortuneWheelActive` flag, can stack)
 *
 * Break/pre-auction countdown is intentionally NOT rendered here — it is
 * rendered directly in the main content area of DisplayShell so it does not
 * cover the top AuctionHeader / sponsor strip, and sits below sold-stamp
 * animations in the stacking order.
 *
 * Render isolation:
 *  - Each overlay is its own React.memo'd subtree. Switching `overlayMode`
 *    swaps which child renders inside the AnimatePresence, but does not
 *    rerender siblings.
 *  - The fortune wheel uses its own AnimatePresence so it can layer over
 *    or coexist with the other overlays without remounting them.
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
  bannerUrl,
  bannerFit,
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
  bannerUrl: string | null | undefined;
  bannerFit: string | null | undefined;
}) {
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
        {overlayMode === "banner" && (
          <motion.div
            key="overlay-banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            className="absolute inset-0"
          >
            <BannerOverlay bannerUrl={bannerUrl} fit={bannerFit} />
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
    </>
  );
});
