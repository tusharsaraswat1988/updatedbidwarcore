import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { StageFrame } from "./StageFrame";
import { TopStrip } from "./TopStrip";
import { PlayerPortrait } from "./PlayerPortrait";
import { BidCenter } from "./BidCenter";
import { TimerPanel } from "./TimerPanel";
import { BidLadder } from "./BidLadder";
import { ChyronStrip } from "./ChyronStrip";
import { SponsorSpotlight } from "./SponsorSpotlight";
import { EffectsLayer } from "./EffectsLayer";
import { RandomPlayerReveal, MAX_REVEAL_WINDOW_MS } from "../random-player-reveal";
import { listenToRandomReveal } from "@/lib/auction-reveal-broadcast";
import type { LedView } from "@/lib/led-view/types";

/** Row heights scale with the 16:9 stage canvas (cqh), not the browser viewport. */
const STAGE_GRID_ROWS = "grid-rows-[5.2cqh_1fr_minmax(4.5cqh,8%)]";
const STAGE_GRID_ROWS_LIVE = "grid-rows-[5.2cqh_1fr_minmax(6.7cqh,12%)_minmax(4.5cqh,8%)]";

/**
 * V1 LED stage layout — pure presentation over a LedView snapshot.
 */
export function LedStageContent({ view, tournamentId }: { view: LedView; tournamentId?: number }) {
  const [activeReveal, setActiveReveal] = useState<{ playerId: number; startedAt: number } | null>(null);
  const [completedPlayerId, setCompletedPlayerId] = useState<string | null>(null);
  const completedPlayerRef = useRef<string | null>(null);

  const overlayActive =
    view.derivedState === "teamWise" ||
    view.derivedState === "playerWise" ||
    view.derivedState === "topSold" ||
    view.derivedState === "banner" ||
    view.derivedState === "teamPurse" ||
    view.derivedState === "fortuneWheel" ||
    view.derivedState === "break" ||
    view.derivedState === "preAuction" ||
    view.derivedState === "paused";

  // Server authoritative reveal sync
  useEffect(() => {
    if (view.randomPlayerReveal && view.currentPlayer) {
      const pId = String(view.randomPlayerReveal.playerId);
      const curId = String(view.currentPlayer.id);
      if (pId === curId && completedPlayerRef.current !== curId) {
        const elapsed = Date.now() - view.randomPlayerReveal.startedAt;
        if (elapsed < MAX_REVEAL_WINDOW_MS) {
          setActiveReveal(view.randomPlayerReveal);
        }
      }
    }
  }, [view.randomPlayerReveal, view.currentPlayer]);

  // Local tab BroadcastChannel sync
  useEffect(() => {
    if (!tournamentId) return;
    return listenToRandomReveal(tournamentId, (payload) => {
      const pId = String(payload.playerId);
      if (completedPlayerRef.current !== pId) {
        const elapsed = Date.now() - payload.startedAt;
        if (elapsed < MAX_REVEAL_WINDOW_MS) {
          setActiveReveal(payload);
        }
      }
    });
  }, [tournamentId]);

  // Dismiss reveal on active bidding, sold/unsold, pause, or operator overlays
  useEffect(() => {
    if (
      overlayActive ||
      view.state.isBidding ||
      view.derivedState === "sold" ||
      view.derivedState === "unsold" ||
      view.derivedState === "paused"
    ) {
      setActiveReveal(null);
    }
  }, [overlayActive, view.state.isBidding, view.derivedState]);

  // Reset completion marker when player clears or transitions to a different player
  useEffect(() => {
    if (!view.currentPlayer) {
      setActiveReveal(null);
      completedPlayerRef.current = null;
      setCompletedPlayerId(null);
    } else if (completedPlayerRef.current && completedPlayerRef.current !== String(view.currentPlayer.id)) {
      completedPlayerRef.current = null;
      setCompletedPlayerId(null);
    }
  }, [view.currentPlayer]);

  if (overlayActive) {
    return (
      <StageFrame>
        <EffectsLayer view={view} />
      </StageFrame>
    );
  }

  if (!view.currentPlayer && view.derivedState !== "awaitingNext") {
    return (
      <StageFrame>
        <div className={`absolute inset-0 grid ${STAGE_GRID_ROWS} font-['Barlow_Condensed']`}>
          <TopStrip view={view} />
          <div className="relative min-h-0 h-full w-full">
            <SponsorSpotlight
              tournamentName={view.tournament.name}
              sponsors={view.sponsors ?? []}
            />
          </div>
          <ChyronStrip view={view} />
        </div>
        <EffectsLayer view={view} />
      </StageFrame>
    );
  }

  return (
    <StageFrame>
      {view.currentPlayer || view.derivedState === "awaitingNext" ? (
        <div className={`absolute inset-0 grid ${STAGE_GRID_ROWS_LIVE} font-['Barlow_Condensed']`}>
          <TopStrip view={view} />
          <div className="grid grid-cols-[28%_1fr_24%] gap-[1.2%] p-[1.5%]">
            <PlayerPortrait view={view} />
            <BidCenter view={view} />
            <TimerPanel view={view} />
          </div>
          <BidLadder view={view} />
          <ChyronStrip view={view} />
        </div>
      ) : (
        <div className={`absolute inset-0 grid ${STAGE_GRID_ROWS} font-['Barlow_Condensed']`}>
          <TopStrip view={view} />
          <div />
          <ChyronStrip view={view} />
        </div>
      )}
      <EffectsLayer view={view} />

      <AnimatePresence>
        {activeReveal && view.currentPlayer && String(activeReveal.playerId) === String(view.currentPlayer.id) && (
          <RandomPlayerReveal
            key={`random-reveal-${activeReveal.playerId}`}
            selectedPlayer={view.currentPlayer}
            candidatePool={view.state.players}
            roleLabel={view.roleLabel}
            auctionUnit={view.tournament.auctionUnit}
            tournamentName={view.tournament.name}
            startedAt={activeReveal.startedAt}
            onComplete={() => {
              if (view.currentPlayer) {
                const cId = String(view.currentPlayer.id);
                completedPlayerRef.current = cId;
                setCompletedPlayerId(cId);
              }
              setActiveReveal(null);
            }}
          />
        )}
      </AnimatePresence>
    </StageFrame>
  );
}
