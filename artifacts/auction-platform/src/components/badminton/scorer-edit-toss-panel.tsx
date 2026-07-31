/**
 * Re-enter toss while live at 0–0 (after undoing points).
 * Supports swapping court ends + full toss / first server / receiver wizard.
 */

import { useMemo, useState } from "react";
import {
  canCorrectToss,
  isPairMatchKind,
  type BadmintonMatchState,
} from "@workspace/badminton-core";
import {
  DoublesPreMatchSetup,
  SinglesPreMatchSetup,
} from "@/components/badminton/doubles-pre-match-setup";
import { friendlyBadmintonError, toastSuccess } from "@/lib/badminton-ux";
import { cn } from "@/lib/utils";

function sideToJson(side: BadmintonMatchState["leftSide"]): Record<string, unknown> {
  return { ...side } as unknown as Record<string, unknown>;
}

export function ScorerEditTossPanel({
  state,
  onCorrectToss,
  onCancel,
}: {
  state: BadmintonMatchState;
  onCorrectToss: (payload: unknown) => Promise<BadmintonMatchState | void>;
  onCancel: () => void;
}) {
  const [swapEnds, setSwapEnds] = useState(false);
  const [error, setError] = useState("");

  const detail = useMemo(() => {
    const left = swapEnds ? state.rightSide : state.leftSide;
    const right = swapEnds ? state.leftSide : state.rightSide;
    return {
      matchType: state.matchKind,
      matchFormatJson: state.format,
      leftSideJson: sideToJson(left),
      rightSideJson: sideToJson(right),
    };
  }, [state.format, state.leftSide, state.matchKind, state.rightSide, swapEnds]);

  async function handleApply(payload: unknown) {
    setError("");
    const body = payload as Record<string, unknown>;
    try {
      await onCorrectToss({
        leftSide: body.leftSide,
        rightSide: body.rightSide,
        firstServer: body.firstServer,
        doublesSetup: body.doublesSetup,
        endsSwapped: swapEnds,
      });
      toastSuccess("Toss updated");
    } catch (e) {
      setError(friendlyBadmintonError(e, "Could not update toss"));
      throw e;
    }
  }

  if (!canCorrectToss(state)) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-3">
        <p className="text-amber-100 text-sm font-semibold">
          Undo all points back to 0–0 before editing the toss.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-4 rounded-xl bg-white/10 text-white/80 text-sm font-semibold"
        >
          Back to scoring
        </button>
      </div>
    );
  }

  const isPair = isPairMatchKind(state.matchKind);

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 space-y-3">
        <div>
          <p className="text-cyan-100/80 text-[10px] font-bold uppercase tracking-wider">
            Edit toss
          </p>
          <p className="text-white text-sm mt-1">
            Fix serve / receiver settings. Optionally swap which team is on which end.
          </p>
        </div>
        <label
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer",
            swapEnds
              ? "border-amber-400/50 bg-amber-500/15"
              : "border-white/15 bg-white/[0.04]",
          )}
        >
          <input
            type="checkbox"
            checked={swapEnds}
            onChange={(e) => setSwapEnds(e.target.checked)}
            className="size-5 accent-amber-400"
          />
          <span className="text-sm text-white font-semibold text-left">
            Swap court ends
            <span className="block text-xs font-normal text-white/55 mt-0.5">
              {swapEnds
                ? `${state.rightSide.label} → End 1 · ${state.leftSide.label} → End 2`
                : "Keep teams on their current ends"}
            </span>
          </span>
        </label>
      </div>

      {error ? (
        <p className="text-red-300 text-sm text-center" role="alert">
          {error}
        </p>
      ) : null}

      {isPair ? (
        <DoublesPreMatchSetup
          state={state}
          detail={detail}
          embedded
          onCancel={onCancel}
          onStart={handleApply}
          submitLabel="Apply toss"
          busyLabel="Saving…"
        />
      ) : (
        <SinglesPreMatchSetup
          detail={detail}
          embedded
          onCancel={onCancel}
          onStart={handleApply}
          submitLabel="Apply toss"
          busyLabel="Saving…"
        />
      )}
    </div>
  );
}

export function canShowEditToss(state: BadmintonMatchState): boolean {
  return canCorrectToss(state);
}
