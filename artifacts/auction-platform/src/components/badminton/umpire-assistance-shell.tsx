import type { ReactNode } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { UmpireMatchBanners } from "@/components/badminton/umpire-match-banners";
import { UmpireServeReceiveBar } from "@/components/badminton/umpire-serve-receive-bar";
import { UmpireConfidencePanel } from "@/components/badminton/umpire-confidence-panel";
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
    <div className="h-full flex flex-col lg:flex-row bg-[#0a0f1e]">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="shrink-0 flex items-center justify-between px-3 pt-2">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold">
            Umpire Assist
          </p>
          <button
            type="button"
            onClick={toggleVoice}
            className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-lg border border-white/10 text-white/50 hover:text-white/80"
          >
            Voice {voiceEnabled ? "On" : "Off"}
          </button>
        </div>

        <UmpireMatchBanners banners={snapshot.banners} />
        <UmpireServeReceiveBar
          serverLabel={snapshot.serverLabel}
          receiverLabel={snapshot.receiverLabel}
        />

        {showIntervalPrompt && (
          <div className="shrink-0 px-3 py-2">
            <button
              type="button"
              onClick={() => void onStartInterval()}
              className="w-full h-12 rounded-xl bg-purple-700/80 border border-purple-400/40 text-white font-bold text-sm"
            >
              Start Interval ({Math.ceil(state.format.pointsPerGame / 2)} points reached)
            </button>
          </div>
        )}

        <UmpireConfidencePanel panel={snapshot.panel} variant="mobile" />

        <div className="flex-1 min-h-0">
          {children({ scoringBlocked: snapshot.scoringBlocked, onAwardPoint: guardedAward })}
        </div>
      </div>

      <UmpireConfidencePanel panel={snapshot.panel} />

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
