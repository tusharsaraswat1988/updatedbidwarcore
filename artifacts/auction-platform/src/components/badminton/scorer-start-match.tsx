/**
 * Scorer tablet — start a scheduled match after PIN/lock (toss or saved toss).
 */

import { useState } from "react";
import { isPairMatchKind, parseBadmintonMatchFormat, STANDARD_FORMAT } from "@workspace/badminton-core";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  DoublesPreMatchSetup,
  SinglesPreMatchSetup,
} from "@/components/badminton/doubles-pre-match-setup";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { BtnPrimary, FormError, hubCardClass } from "@/components/badminton/form-ui";
import {
  buildStartPayloadFromPreMatchToss,
  hasCompleteMatchRoster,
  resolveMatchFormatFromDetail,
} from "@/lib/badminton-match-control";
import { isPreMatchTossComplete, parsePreMatchToss } from "@/lib/badminton-pre-match-toss";
import { matchFormatChipLabel } from "@/lib/match-format-display";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { cn } from "@/lib/utils";

function sideLabel(side: Record<string, unknown> | undefined, fallback: string): string {
  const label = typeof side?.label === "string" ? side.label.trim() : "";
  return label || fallback;
}

export function ScorerStartMatchPanel({
  detail,
  onStart,
  onBack,
}: {
  tournamentId: number;
  matchId: number;
  detail: Record<string, unknown> | null | undefined;
  onStart: (payload: unknown) => Promise<BadmintonMatchState | void>;
  onBack: () => void;
}) {
  const d = detail ?? {};
  const matchType = typeof d.matchType === "string" ? d.matchType : "singles";
  const leftSideJson = (d.leftSideJson ?? {}) as Record<string, unknown>;
  const rightSideJson = (d.rightSideJson ?? {}) as Record<string, unknown>;
  const leftLabel = sideLabel(leftSideJson, "Side A");
  const rightLabel = sideLabel(rightSideJson, "Side B");
  const courtLabel =
    typeof d.courtNumber === "string" || typeof d.courtNumber === "number"
      ? `Court ${d.courtNumber}`
      : typeof d.courtLabel === "string"
        ? d.courtLabel
        : null;
  const matchFormat = parseBadmintonMatchFormat(d.matchFormatJson) ?? STANDARD_FORMAT;
  const formatLabel = matchFormatChipLabel(resolveMatchFormatFromDetail(d));

  const blocking = !hasCompleteMatchRoster(leftSideJson, rightSideJson, matchType);

  const savedToss = parsePreMatchToss(d.preMatchTossJson);
  const hasSavedToss = isPreMatchTossComplete(matchType, savedToss);
  const isPair = isPairMatchKind(matchType);

  const [showTossSetup, setShowTossSetup] = useState(!hasSavedToss);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startDetail = {
    matchType,
    matchFormatJson: matchFormat,
    leftSideJson,
    rightSideJson,
  };

  async function handleTossStart(payload: unknown) {
    setBusy(true);
    setError("");
    try {
      await onStart(payload);
    } catch (e) {
      const msg = friendlyBadmintonError(e, "Could not start the match");
      setError(msg);
      setBusy(false);
      throw new Error(msg);
    }
  }

  async function handleStartWithSavedToss() {
    if (!savedToss || !hasSavedToss || blocking) return;
    setBusy(true);
    setError("");
    try {
      await onStart(buildStartPayloadFromPreMatchToss(startDetail, savedToss));
    } catch (e) {
      setError(friendlyBadmintonError(e, "Could not start the match"));
      setBusy(false);
    }
  }

  if (blocking) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-white text-xl font-bold">Cannot start yet</h1>
        <p className="text-white/55 text-sm">
          Players are not fully assigned on both sides. Ask the organizer to fix the roster, then
          return here.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white/10 px-6 font-bold text-white"
        >
          Back to Scorer Home
        </button>
      </div>
    );
  }

  if (showTossSetup) {
    return (
      <div className="w-full max-w-lg space-y-4">
        {error ? <FormError message={error} /> : null}
        {isPair ? (
          <DoublesPreMatchSetup
            detail={startDetail}
            embedded
            onCancel={hasSavedToss ? () => setShowTossSetup(false) : onBack}
            onStart={handleTossStart}
          />
        ) : (
          <SinglesPreMatchSetup
            detail={startDetail}
            embedded
            onCancel={hasSavedToss ? () => setShowTossSetup(false) : onBack}
            onStart={handleTossStart}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <div className={cn(hubCardClass, "space-y-4 p-5")}>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Ready to start</p>
          <h1 className="text-xl font-bold text-white">
            {leftLabel} vs {rightLabel}
          </h1>
          <div className="flex justify-center">
            <ScoringFormatBadge label={formatLabel} />
          </div>
          {courtLabel ? (
            <p className="text-sm text-white/45">{courtLabel}</p>
          ) : null}
          <p className="text-sm text-white/55">
            Toss was saved when the match was created. Confirm and start scoring.
          </p>
        </div>

        {error ? <FormError message={error} /> : null}

        <BtnPrimary
          type="button"
          disabled={busy}
          onClick={() => void handleStartWithSavedToss()}
          className="h-14 w-full text-base"
        >
          {busy ? "Starting…" : "Start Match"}
        </BtnPrimary>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setShowTossSetup(true);
            setError("");
          }}
          className="w-full text-sm text-white/45 hover:text-white/80"
        >
          Re-enter toss instead
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm text-white/40 hover:text-white/70"
      >
        Back to Scorer Home
      </button>
    </div>
  );
}
