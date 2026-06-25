import type { ReactNode } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { ScorerConsoleHeader } from "@/components/badminton/scorer-console-header";
import { UmpireMatchBanners } from "@/components/badminton/umpire-match-banners";
import { UmpireStatusStrip } from "@/components/badminton/umpire-status-strip";
import { UmpireIntervalModal } from "@/components/badminton/umpire-interval-modal";
import { UmpireCourtChangeModal } from "@/components/badminton/umpire-court-change-modal";
import { UmpireReadyDialog } from "@/components/badminton/umpire-ready-dialog";
import {
  useUmpireAssistance,
  useVoiceAssist,
  useVoiceAssistSetting,
} from "@/hooks/use-umpire-assistance";

interface UmpireAssistanceShellProps {
  state: BadmintonMatchState;
  tournamentName: string;
  courtNumber?: string;
  onStartInterval: () => Promise<unknown>;
  onEndInterval: () => Promise<unknown>;
  onAcknowledgeCourtChange: () => Promise<unknown>;
  children: (ctx: {
    scoringBlocked: boolean;
    onAwardPoint: (side: "left" | "right") => void;
  }) => ReactNode;
  onAwardPoint: (side: "left" | "right") => Promise<unknown>;
}

export function UmpireAssistanceShell({
  state,
  tournamentName,
  courtNumber,
  onStartInterval,
  onEndInterval,
  onAcknowledgeCourtChange,
  onAwardPoint,
  children,
}: UmpireAssistanceShellProps) {
  const { enabled: voiceEnabled, toggle: toggleVoice } = useVoiceAssistSetting();
  const {
    snapshot,
    courtChangeAcknowledged,
    markCourtChangeAcknowledged,
    showReadyConfirm,
    readyConfirmReason,
    confirmReady,
  } = useUmpireAssistance(state);

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
      />

      <UmpireMatchBanners banners={snapshot.banners} />
      <UmpireStatusStrip panel={snapshot.panel} />

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

      <UmpireCourtChangeModal open={showCourtChangeModal} onAcknowledge={handleCourtChangeAck} />

      <UmpireIntervalModal
        open={state.inInterval}
        onResumeEarly={onEndInterval}
        onEndInterval={onEndInterval}
      />

      <UmpireReadyDialog
        open={showReadyConfirm}
        reason={readyConfirmReason}
        onConfirm={confirmReady}
      />
    </div>
  );
}
