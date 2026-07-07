import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TeamPurse } from "@workspace/api-client-react";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
} from "@/lib/bidwar-broadcast-colors";
import { SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX } from "@/components/display/sponsor-ticker";
import { BreakCountdownOverlay } from "@/components/display/break-countdown-overlay";
import { AuctionStatusOverlay } from "@/components/display/auction-status-overlay";
import { deriveAuctionDisplayMode } from "@/lib/auction-display-status";
import type { AuctionState } from "@workspace/api-client-react";
import type { BroadcastFrame } from "../director/types";
import { AuctionLowerThird } from "./auction-lower-third";
import { OutcomeLowerThird } from "./outcome-lower-third";
import { SummaryLowerThird } from "./summary-lower-third";
import { Top5LowerThird } from "./top5-lower-third";
import { TeamLowerThird, useTeamOverviewMaps } from "./team-lower-third";
import { TEAM_TICKER_HEIGHT_PX } from "./obs-tokens";
import type { TeamTickerRow } from "./team-ticker";

type ObsLowerThirdSceneProps = {
  frame: BroadcastFrame;
  state: AuctionState | undefined;
  teamPurses: TeamPurse[] | undefined;
  formatAmount: (n: number) => string;
  tournamentName: string | null;
  bottomStackHeight: number;
};

export const ObsLowerThirdScene = memo(function ObsLowerThirdScene({
  frame,
  state,
  teamPurses: _teamPurses,
  formatAmount,
  tournamentName,
  bottomStackHeight,
}: ObsLowerThirdSceneProps) {
  const displayMode = useMemo(() => deriveAuctionDisplayMode(state), [state]);
  const scene = frame.scene;
  const context = frame.currentContext;
  const { teamModelsById, teamIndexById } = useTeamOverviewMaps(frame.teamOverviews);

  const showOutcome = scene.kind === "SOLD" || scene.kind === "UNSOLD";
  const showAuction =
    context === "AUCTION" &&
    scene.kind === "AUCTION" &&
    !!scene.player &&
    !showOutcome &&
    displayMode.overlayMode !== "paused";
  const showTop5 = context === "TOP5" && !!frame.top5 && !showOutcome;
  const showTeam = context === "TEAM" && !!frame.team && !showOutcome;
  const showSummary = context === "SUMMARY" && scene.kind === "SUMMARY";
  const showBreak = context === "BREAK" && scene.kind === "BREAK";
  const showWaiting = context === "WAITING" && scene.kind === "WAITING";

  const showAwaitingPlayer =
    !!state &&
    context === "AUCTION" &&
    scene.kind === "AUCTION" &&
    !scene.player &&
    !showOutcome &&
    !displayMode.isBreak &&
    displayMode.overlayMode !== "paused";

  return (
    <>
      {displayMode.overlayMode === "paused" && <AuctionStatusOverlay mode="paused" />}

      {showBreak && (
        <BreakCountdownOverlay
          key={scene.breakEndsAt}
          endsAt={scene.breakEndsAt}
          message={scene.breakMessage}
          tournamentName={tournamentName}
          compact
          compactPlacement="bottom"
          compactBottomOffset={bottomStackHeight}
        />
      )}

      {showWaiting && scene.countdownTargetIso && (
        <BreakCountdownOverlay
          key={scene.countdownTargetIso}
          endsAt={scene.countdownTargetIso}
          message={scene.standbyLabel}
          tournamentName={tournamentName}
          compact
          compactPlacement="bottom"
          compactBottomOffset={bottomStackHeight}
        />
      )}

      <AnimatePresence mode="wait">
        {showOutcome && (
          <OutcomeLowerThird
            key={`outcome-${scene.player.name}-${frame.sceneId}`}
            model={scene}
            formatAmount={formatAmount}
            bottomOffset={bottomStackHeight}
          />
        )}

        {showAuction && (
          <AuctionLowerThird
            key={`auction-${scene.player?.name}`}
            model={scene}
            formatAmount={formatAmount}
            freezeBidUpdates={displayMode.freezeBidUpdates}
            dimmed={displayMode.showStatusOverlay}
            bottomOffset={bottomStackHeight}
          />
        )}

        {showTop5 && frame.top5 && (
          <Top5LowerThird
            key="top5"
            model={frame.top5}
            bottomOffset={bottomStackHeight}
          />
        )}

        {showTeam && frame.team && (
          <TeamLowerThird
            key={`team-${frame.team.teamId}`}
            model={frame.team}
            bottomOffset={bottomStackHeight}
            teamIndexById={teamIndexById}
            teamModelsById={teamModelsById}
          />
        )}

        {showSummary && (
          <SummaryLowerThird
            key="summary"
            model={scene}
            bottomOffset={bottomStackHeight}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAwaitingPlayer ? (
          <motion.div
            key="awaiting-player"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: bottomStackHeight + 18,
              zIndex: 28,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 22px",
                borderTop: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
                borderBottom: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
                background: "rgba(0,0,0,0.42)",
                backdropFilter: "blur(4px)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: BIDWAR_BROADCAST_YELLOW,
                  opacity: 0.85,
                  animation: "livePulse 1.6s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.38em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.62)",
                  fontFamily: "monospace",
                }}
              >
                Awaiting new player
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
});

export function buildTeamTickerRows(teamPurses: TeamPurse[] | undefined): TeamTickerRow[] {
  return (teamPurses ?? []).map((t) => ({
    name: t.teamName,
    shortCode: t.shortCode,
    color: t.color ?? null,
    logoUrl: t.logoUrl,
    playersBought: t.playersBought,
    playersDue:
      t.maximumSquadSize > 0 ? Math.max(0, t.maximumSquadSize - t.playersBought) : null,
  }));
}

export function computeBottomStackHeight(teamCount: number): number {
  const teamTickerOffset = teamCount > 0 ? TEAM_TICKER_HEIGHT_PX : 0;
  return SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX + teamTickerOffset;
}
