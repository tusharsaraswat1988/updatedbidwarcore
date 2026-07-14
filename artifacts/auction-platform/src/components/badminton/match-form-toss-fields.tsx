/**
 * Optional toss fields on Create/Edit Match — save before court start.
 */

import { DarkSelect, FormField } from "@/components/badminton/page-chrome";
import type { SidePlayerForm } from "@/components/badminton/pair-side-picker";
import {
  buildDoublesTossFromForm,
  deriveServingSides,
  isDoublesPreMatchToss,
  isSinglesPreMatchToss,
  parsePreMatchToss,
  type BadmintonSideRef,
  type PlayerIndex,
  type PreMatchToss,
  type TossDecision,
} from "@/lib/badminton-pre-match-toss";

export type MatchFormTossState = {
  enabled: boolean;
  firstServer: BadmintonSideRef;
  tossWinnerSide: BadmintonSideRef;
  tossDecision: TossDecision;
  firstServerPlayerIndex: PlayerIndex;
  firstReceiverPlayerIndex: PlayerIndex;
};

export function emptyMatchFormToss(): MatchFormTossState {
  return {
    enabled: false,
    firstServer: "left",
    tossWinnerSide: "left",
    tossDecision: "serve",
    firstServerPlayerIndex: 0,
    firstReceiverPlayerIndex: 0,
  };
}

export function matchFormTossFromDetail(detail: Record<string, unknown> | null | undefined): MatchFormTossState {
  const parsed = parsePreMatchToss(detail?.preMatchTossJson);
  if (!parsed) return emptyMatchFormToss();
  if (isSinglesPreMatchToss(parsed)) {
    return {
      ...emptyMatchFormToss(),
      enabled: true,
      firstServer: parsed.firstServer,
    };
  }
  if (isDoublesPreMatchToss(parsed)) {
    return {
      enabled: true,
      firstServer: parsed.firstServingSide,
      tossWinnerSide: parsed.tossWinnerSide,
      tossDecision: parsed.tossDecision,
      firstServerPlayerIndex: parsed.firstServerPlayerIndex,
      firstReceiverPlayerIndex: parsed.firstReceiverPlayerIndex,
    };
  }
  return emptyMatchFormToss();
}

/** null = clear / do not record toss. */
export function matchFormTossToPayload(
  toss: MatchFormTossState,
  isPair: boolean,
): PreMatchToss | null {
  if (!toss.enabled) return null;
  if (isPair) {
    return buildDoublesTossFromForm({
      tossWinnerSide: toss.tossWinnerSide,
      tossDecision: toss.tossDecision,
      firstServerPlayerIndex: toss.firstServerPlayerIndex,
      firstReceiverPlayerIndex: toss.firstReceiverPlayerIndex,
    });
  }
  return { firstServer: toss.firstServer };
}

function playerLabel(p: SidePlayerForm, fallback: string): string {
  const name = p.name.trim() || p.short.trim();
  return name || fallback;
}

export function MatchFormTossFields({
  isPair,
  leftLabel,
  rightLabel,
  leftPlayer1,
  leftPlayer2,
  rightPlayer1,
  rightPlayer2,
  toss,
  onChange,
  disabled,
}: {
  isPair: boolean;
  leftLabel: string;
  rightLabel: string;
  leftPlayer1: SidePlayerForm;
  leftPlayer2: SidePlayerForm;
  rightPlayer1: SidePlayerForm;
  rightPlayer2: SidePlayerForm;
  toss: MatchFormTossState;
  onChange: (next: MatchFormTossState) => void;
  disabled?: boolean;
}) {
  const { firstServingSide, firstReceivingSide } = deriveServingSides(
    toss.tossWinnerSide,
    toss.tossDecision,
  );
  const servingPlayers =
    firstServingSide === "left"
      ? [
          { value: "0", label: playerLabel(leftPlayer1, "Left player 1") },
          { value: "1", label: playerLabel(leftPlayer2, "Left player 2") },
        ]
      : [
          { value: "0", label: playerLabel(rightPlayer1, "Right player 1") },
          { value: "1", label: playerLabel(rightPlayer2, "Right player 2") },
        ];
  const receivingPlayers =
    firstReceivingSide === "left"
      ? [
          { value: "0", label: playerLabel(leftPlayer1, "Left player 1") },
          { value: "1", label: playerLabel(leftPlayer2, "Left player 2") },
        ]
      : [
          { value: "0", label: playerLabel(rightPlayer1, "Right player 1") },
          { value: "1", label: playerLabel(rightPlayer2, "Right player 2") },
        ];

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Toss (optional)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record toss now if you do it for all matches upfront — Start Match can skip the court toss wizard.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium shrink-0 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={toss.enabled}
            disabled={disabled}
            onChange={(e) => onChange({ ...toss, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          Record now
        </label>
      </div>

      {toss.enabled && !disabled ? (
        isPair ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Toss winner">
              <DarkSelect
                value={toss.tossWinnerSide}
                onValueChange={(v) =>
                  onChange({ ...toss, tossWinnerSide: v as BadmintonSideRef })
                }
                options={[
                  { value: "left", label: leftLabel },
                  { value: "right", label: rightLabel },
                ]}
              />
            </FormField>
            <FormField label="Chose to">
              <DarkSelect
                value={toss.tossDecision}
                onValueChange={(v) =>
                  onChange({ ...toss, tossDecision: v as TossDecision })
                }
                options={[
                  { value: "serve", label: "Serve first" },
                  { value: "receive", label: "Receive first" },
                ]}
              />
            </FormField>
            <FormField label={`First server (${firstServingSide === "left" ? leftLabel : rightLabel})`}>
              <DarkSelect
                value={String(toss.firstServerPlayerIndex)}
                onValueChange={(v) =>
                  onChange({
                    ...toss,
                    firstServerPlayerIndex: (Number(v) === 1 ? 1 : 0) as PlayerIndex,
                  })
                }
                options={servingPlayers}
              />
            </FormField>
            <FormField label={`First receiver (${firstReceivingSide === "left" ? leftLabel : rightLabel})`}>
              <DarkSelect
                value={String(toss.firstReceiverPlayerIndex)}
                onValueChange={(v) =>
                  onChange({
                    ...toss,
                    firstReceiverPlayerIndex: (Number(v) === 1 ? 1 : 0) as PlayerIndex,
                  })
                }
                options={receivingPlayers}
              />
            </FormField>
          </div>
        ) : (
          <FormField label="First server">
            <DarkSelect
              value={toss.firstServer}
              onValueChange={(v) =>
                onChange({ ...toss, firstServer: v as BadmintonSideRef })
              }
              options={[
                { value: "left", label: leftLabel },
                { value: "right", label: rightLabel },
              ]}
            />
          </FormField>
        )
      ) : null}
    </div>
  );
}
