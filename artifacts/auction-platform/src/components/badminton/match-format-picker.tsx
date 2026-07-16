/**
 * Compact scoring-format picker for category + match forms.
 * Supports inherit (parent default) or override via BWF presets / custom.
 */

import { useState } from "react";
import { Check } from "lucide-react";
import { FormField, inputClass } from "@/components/badminton/page-chrome";
import { matchFormatChipLabel } from "@/lib/match-format-display";
import { cn } from "@/lib/utils";
import {
  BADMINTON_FORMAT_PRESETS,
  badmintonFormatFromPreset,
  buildBadmintonFormatFromCustomInputs,
  inferBadmintonFormatPresetId,
  parseBadmintonMatchFormat,
  winByFromDeuceAt,
  type BadmintonFormatPresetId,
  type BadmintonMatchFormat,
} from "@workspace/badminton-core";

const PRESET_CARDS: Array<{
  id: BadmintonFormatPresetId;
  name: string;
  summary: string;
}> = [
  { id: "standard_bwf", name: "Standard BWF", summary: "Best of 3 · 21 points" },
  { id: "fast_match", name: "Fast Match", summary: "Best of 3 · 15 points" },
  { id: "single_game", name: "Single Game", summary: "1 game · 21 points" },
  { id: "custom", name: "Custom", summary: "Your games / points / win-by" },
];

const POINTS_CHOICES = [11, 15, 21] as const;

export type MatchFormatPickerValue =
  | { mode: "inherit" }
  | { mode: "override"; presetId: BadmintonFormatPresetId; format: BadmintonMatchFormat };

export function matchFormatPickerFromStored(
  raw: unknown | null | undefined,
): MatchFormatPickerValue {
  const format = parseBadmintonMatchFormat(raw);
  if (!format) return { mode: "inherit" };
  return {
    mode: "override",
    presetId: inferBadmintonFormatPresetId(format),
    format,
  };
}

/** Payload for create/update APIs — omit or null means inherit/clear. */
export function matchFormatJsonFromPicker(
  value: MatchFormatPickerValue,
): BadmintonMatchFormat | null | undefined {
  if (value.mode === "inherit") return null;
  return value.format;
}

export function MatchFormatPicker({
  value,
  onChange,
  inheritLabel,
  inheritOptionLabel = "Use tournament default",
  disabled = false,
}: {
  value: MatchFormatPickerValue;
  onChange: (next: MatchFormatPickerValue) => void;
  /** Shown when inherit is selected — e.g. "Tournament: Fast Match · 15". */
  inheritLabel: string;
  inheritOptionLabel?: string;
  disabled?: boolean;
}) {
  const [customPointsMode, setCustomPointsMode] = useState(() => {
    if (value.mode !== "override" || value.presetId !== "custom") return false;
    return !POINTS_CHOICES.includes(value.format.pointsPerGame as 11 | 15 | 21);
  });

  const presetId = value.mode === "override" ? value.presetId : null;
  const format =
    value.mode === "override" ? value.format : BADMINTON_FORMAT_PRESETS.standard_bwf;
  const winBy = winByFromDeuceAt(format.pointsPerGame, format.deuceAt);

  function selectInherit() {
    onChange({ mode: "inherit" });
    setCustomPointsMode(false);
  }

  function selectPreset(id: BadmintonFormatPresetId) {
    if (id === "custom") {
      const next =
        value.mode === "override"
          ? badmintonFormatFromPreset("custom", value.format)
          : badmintonFormatFromPreset("custom");
      onChange({ mode: "override", presetId: "custom", format: next });
      return;
    }
    setCustomPointsMode(false);
    onChange({
      mode: "override",
      presetId: id,
      format: badmintonFormatFromPreset(id),
    });
  }

  function updateCustom(partial: {
    totalGames?: 1 | 3 | 5;
    pointsPerGame?: number;
    winBy?: number;
    maxPoints?: number | null;
    midGameSideChange?: boolean;
  }) {
    const base = value.mode === "override" ? value.format : BADMINTON_FORMAT_PRESETS.standard_bwf;
    const next = buildBadmintonFormatFromCustomInputs({
      totalGames: (partial.totalGames ?? base.totalGames) as 1 | 3 | 5,
      pointsPerGame: partial.pointsPerGame ?? base.pointsPerGame,
      winBy: partial.winBy ?? winByFromDeuceAt(base.pointsPerGame, base.deuceAt),
      maxPoints: partial.maxPoints === undefined ? base.maxPoints : partial.maxPoints,
      midGameSideChange: partial.midGameSideChange ?? base.midGameSideChange,
    });
    onChange({ mode: "override", presetId: "custom", format: next });
  }

  return (
    <div className={cn("space-y-3", disabled && "opacity-60 pointer-events-none")}>
      <FormField label="Scoring format">
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={selectInherit}
            className={cn(
              "w-full text-left rounded-xl border px-3 py-2.5 transition-colors",
              value.mode === "inherit"
                ? "border-primary/40 bg-primary/10"
                : "border-border/60 bg-card/40 hover:border-primary/25",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{inheritOptionLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{inheritLabel}</p>
              </div>
              {value.mode === "inherit" ? (
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
              ) : null}
            </div>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_CARDS.map((card) => {
              const selected = value.mode === "override" && presetId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectPreset(card.id)}
                  className={cn(
                    "text-left rounded-xl border px-3 py-2.5 transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/60 bg-card/40 hover:border-primary/25",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{card.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.summary}</p>
                    </div>
                    {selected ? (
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </FormField>

      {value.mode === "override" ? (
        <p className="text-[11px] text-muted-foreground">
          Override:{" "}
          <span className="font-semibold text-foreground/80">
            {matchFormatChipLabel(value.format, value.presetId)}
          </span>
        </p>
      ) : null}

      {value.mode === "override" && value.presetId === "custom" ? (
        <div className="rounded-xl border border-border/60 bg-card/30 px-3 py-3 space-y-4">
          <FormField label="Number of games">
            <div className="flex flex-wrap gap-2">
              {([1, 3, 5] as const).map((n) => (
                <ChoiceChip
                  key={n}
                  label={n === 1 ? "1 Game" : `Best of ${n}`}
                  selected={format.totalGames === n}
                  onClick={() => updateCustom({ totalGames: n })}
                />
              ))}
            </div>
          </FormField>

          <FormField label="Points per game">
            <div className="flex flex-wrap gap-2">
              {POINTS_CHOICES.map((n) => (
                <ChoiceChip
                  key={n}
                  label={`${n} Points`}
                  selected={!customPointsMode && format.pointsPerGame === n}
                  onClick={() => {
                    setCustomPointsMode(false);
                    updateCustom({ pointsPerGame: n });
                  }}
                />
              ))}
              <ChoiceChip
                label="Other"
                selected={customPointsMode}
                onClick={() => setCustomPointsMode(true)}
              />
            </div>
            {customPointsMode ? (
              <input
                type="number"
                min={1}
                max={99}
                className={cn(inputClass, "mt-2 max-w-[8rem]")}
                value={format.pointsPerGame}
                onChange={(e) =>
                  updateCustom({ pointsPerGame: parseInt(e.target.value, 10) || 21 })
                }
              />
            ) : null}
          </FormField>

          <FormField label="Win by">
            <div className="flex flex-wrap gap-2">
              <ChoiceChip
                label="Win by 1"
                selected={winBy === 1}
                onClick={() => updateCustom({ winBy: 1 })}
              />
              <ChoiceChip
                label="Win by 2"
                selected={winBy === 2}
                onClick={() => updateCustom({ winBy: 2 })}
              />
            </div>
          </FormField>

          <FormField label="Maximum score">
            <input
              type="number"
              min={format.pointsPerGame}
              max={99}
              className={cn(inputClass, "max-w-[8rem]")}
              value={format.maxPoints}
              onChange={(e) =>
                updateCustom({
                  maxPoints: parseInt(e.target.value, 10) || format.pointsPerGame,
                })
              }
            />
          </FormField>

          {format.totalGames > 1 ? (
            <FormField label="Final game side change">
              <div className="flex flex-wrap gap-2">
                <ChoiceChip
                  label="On"
                  selected={format.midGameSideChange}
                  onClick={() => updateCustom({ midGameSideChange: true })}
                />
                <ChoiceChip
                  label="Off"
                  selected={!format.midGameSideChange}
                  onClick={() => updateCustom({ midGameSideChange: false })}
                />
              </div>
            </FormField>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
        selected
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
      )}
    >
      {label}
    </button>
  );
}
