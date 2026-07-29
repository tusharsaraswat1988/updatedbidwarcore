import type { ReactNode } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { ScorerConsoleHeader } from "@/components/badminton/scorer-console-header";
import { MatchIdentityStrip } from "@/components/badminton/match-identity-strip";
import { ScorerMatchBanners } from "@/components/badminton/scorer-match-banners";
import { ScorerStatusStrip } from "@/components/badminton/scorer-status-strip";
import { ScorerIntervalModal } from "@/components/badminton/scorer-interval-modal";
import { ScorerCourtChangeModal } from "@/components/badminton/scorer-court-change-modal";
import { ScorerReadyDialog } from "@/components/badminton/scorer-ready-dialog";
import {
  useScorerAssistance,
  useVoiceAssist,
  useVoiceAssistSetting,
} from "@/hooks/use-scorer-assistance";

interface ScorerAssistanceShellProps {
  state: BadmintonMatchState;
  tournamentName: string;
  courtNumber?: string;
  categoryName?: string;
  /** Header chrome label — "Umpire Console" for /umpire alias (S4-05). */
  consoleTitle?: string;
  onStartInterval: () => Promise<unknown>;
  onEndInterval: () => Promise<unknown>;
  onAcknowledgeCourtChange: () => Promise<unknown>;
  children: (ctx: {
    scoringBlocked: boolean;
    onAwardPoint: (side: "left" | "right") => void;
  }) => ReactNode;
  onAwardPoint: (side: "left" | "right") => Promise<unknown>;
}

export function ScorerAssistanceShell({
  state,
  tournamentName,
  courtNumber,
  categoryName,
  consoleTitle,
  onStartInterval,
  onEndInterval,
  onAcknowledgeCourtChange,
  onAwardPoint,
  children,
}: ScorerAssistanceShellProps) {
  const { enabled: voiceEnabled, toggle: toggleVoice } = useVoiceAssistSetting();
  const {
    snapshot,
    courtChangeAcknowledged,
    markCourtChangeAcknowledged,
    showReadyConfirm,
    readyConfirmReason,
    confirmReady,
  } = useScorerAssistance(state);

  useVoiceAssist(snapshot, voiceEnabled);

  const showCourtChangeModal =
    snapshot.courtChangeRequired && !courtChangeAcknowledged && !state.inInterval;

  const showIntervalPrompt =
    snapshot.intervalDue &&
    courtChangeAcknowledged &&
    !state.inInterval &&
    state.matchStatus === "live";

  async function handleCourtChangeAck() {
    await onAcknowledgeCourtChange();
    markCourtChangeAcknowledged();
    await onStartInterval();
  }

  function guardedAward(side: "left" | "right") {
    if (snapshot.scoringBlocked) return;
    void onAwardPoint(side);
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0f1e]">
      <ScorerConsoleHeader
        tournamentName={tournamentName}
        courtNumber={courtNumber}
        voiceEnabled={voiceEnabled}
        onToggleVoice={toggleVoice}
        consoleTitle={consoleTitle}
      />

      <MatchIdentityStrip
        state={state}
        courtNumber={courtNumber}
        categoryName={categoryName}
      />

      <ScorerMatchBanners banners={snapshot.banners} />
      <ScorerStatusStrip panel={snapshot.panel} />

      {snapshot.endsChangeDue && (
        <div className="shrink-0 mx-3 mb-2 rounded-lg border border-teal-400/35 bg-teal-900/40 px-3 py-2 text-center">
          <p className="text-teal-100 text-sm font-bold">
            Change ends before Game {snapshot.panel.currentGame}
          </p>
        </div>
      )}

      {showIntervalPrompt && (
        <div className="shrink-0 px-3 pb-2">
          <button
            type="button"
            onClick={() => void onStartInterval()}
            className="w-full h-11 rounded-lg bg-purple-700/80 border border-purple-400/40 text-white font-bold text-sm"
          >
            Start interval
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {children({ scoringBlocked: snapshot.scoringBlocked, onAwardPoint: guardedAward })}
      </div>

      <ScorerCourtChangeModal open={showCourtChangeModal} onAcknowledge={handleCourtChangeAck} />

      <ScorerIntervalModal
        open={state.inInterval}
        onResumeEarly={onEndInterval}
        onEndInterval={onEndInterval}
      />

      <ScorerReadyDialog
        open={showReadyConfirm}
        reason={readyConfirmReason}
        onConfirm={confirmReady}
      />
    </div>
  );
}
