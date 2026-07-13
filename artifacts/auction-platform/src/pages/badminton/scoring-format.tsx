/**
 * Match Format
 * Route: /tournament/:id/badminton/scoring-format
 *
 * Tournament-level default. New matches inherit this;
 * started matches keep the frozen format from MATCH_STARTED.
 */

import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Check } from "lucide-react";
import {
  HubPageShell,
  BtnSecondary,
  hubPanelClass,
  FormField,
  FormError,
  inputClass,
} from "@/components/badminton/page-chrome";
import { BadmintonSetupWizardChrome } from "@/components/badminton/setup-wizard-chrome";
import { SetupTerm } from "@/components/badminton/setup-guide-panel";
import {
  useBadmintonScoringFormat,
  useSaveBadmintonScoringFormat,
} from "@/hooks/use-badminton-scoring-format";
import {
  matchFormatChipLabel,
  matchFormatSummaryLines,
} from "@/lib/match-format-display";
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { cn } from "@/lib/utils";
import {
  BADMINTON_FORMAT_PRESETS,
  badmintonFormatFromPreset,
  buildBadmintonFormatFromCustomInputs,
  winByFromDeuceAt,
  type BadmintonFormatPresetId,
  type BadmintonMatchFormat,
} from "@workspace/badminton-core";

const PRESET_ORDER: BadmintonFormatPresetId[] = [
  "standard_bwf",
  "fast_match",
  "single_game",
  "custom",
];

type PresetCardCopy = {
  id: BadmintonFormatPresetId;
  name: string;
  bestOf: string;
  points: string;
  winBy: string;
  recommended?: boolean;
  hint?: string;
};

const PRESET_CARDS: PresetCardCopy[] = [
  {
    id: "standard_bwf",
    name: "Standard BWF",
    bestOf: "Best of 3",
    points: "21 Points",
    winBy: "Win by 2 Points",
    recommended: true,
  },
  {
    id: "fast_match",
    name: "Fast Match",
    bestOf: "Best of 3",
    points: "15 Points",
    winBy: "Win by 2 Points",
  },
  {
    id: "single_game",
    name: "Single Game",
    bestOf: "1 Game",
    points: "21 Points",
    winBy: "Win by 2 Points",
  },
  {
    id: "custom",
    name: "Custom",
    bestOf: "Your choice",
    points: "Your points",
    winBy: "Your rules",
    hint: "For advanced organizers only",
  },
];

const POINTS_CHOICES = [11, 15, 21] as const;

export default function BadmintonScoringFormatPage() {
  const [, params] = useRoute("/tournament/:id/badminton/scoring-format");
  const tournamentId = parseInt(params?.id ?? "0");
  const [, setLocation] = useLocation();

  const { data, isLoading } = useBadmintonScoringFormat(tournamentId);
  const saveMutation = useSaveBadmintonScoringFormat(tournamentId);

  const [presetId, setPresetId] = useState<BadmintonFormatPresetId>("standard_bwf");
  const [format, setFormat] = useState<BadmintonMatchFormat>(
    BADMINTON_FORMAT_PRESETS.standard_bwf,
  );
  const [customPointsMode, setCustomPointsMode] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!data) return;
    const nextPreset = (PRESET_ORDER.includes(data.presetId as BadmintonFormatPresetId)
      ? data.presetId
      : "custom") as BadmintonFormatPresetId;
    setPresetId(nextPreset);
    setFormat(data.format);
    setCustomPointsMode(
      nextPreset === "custom" && !POINTS_CHOICES.includes(data.format.pointsPerGame as 11 | 15 | 21),
    );
  }, [data]);

  const chipLabel = matchFormatChipLabel(format, presetId);
  const summaryLines = matchFormatSummaryLines(format);
  const winBy = winByFromDeuceAt(format.pointsPerGame, format.deuceAt);
  const courtsHref = `/tournament/${tournamentId}/badminton/courts`;

  function selectPreset(id: BadmintonFormatPresetId) {
    setPresetId(id);
    setMessage("");
    setError("");
    if (id === "custom") {
      setFormat((prev) => badmintonFormatFromPreset("custom", prev));
      return;
    }
    setFormat(badmintonFormatFromPreset(id));
    setCustomPointsMode(false);
  }

  function updateCustom(partial: {
    totalGames?: 1 | 3 | 5;
    pointsPerGame?: number;
    winBy?: number;
    maxPoints?: number | null;
    midGameSideChange?: boolean;
  }) {
    setPresetId("custom");
    setFormat((prev) =>
      buildBadmintonFormatFromCustomInputs({
        totalGames: (partial.totalGames ?? prev.totalGames) as 1 | 3 | 5,
        pointsPerGame: partial.pointsPerGame ?? prev.pointsPerGame,
        winBy: partial.winBy ?? winByFromDeuceAt(prev.pointsPerGame, prev.deuceAt),
        maxPoints: partial.maxPoints === undefined ? prev.maxPoints : partial.maxPoints,
        midGameSideChange: partial.midGameSideChange ?? prev.midGameSideChange,
      }),
    );
  }

  async function handleSave(andContinue: boolean) {
    setMessage("");
    setError("");
    try {
      await saveMutation.mutateAsync({ presetId, format });
      toastSuccess("Scoring rules saved", "New matches will use these rules.");
      if (andContinue) {
        setLocation(courtsHref);
        return;
      }
      setMessage("Scoring rules saved. New matches will use these rules.");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not save scoring rules. Try again.";
      setError(msg);
      toastError(e, "Could not save scoring rules");
    }
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <BadmintonSetupWizardChrome
        tournamentId={tournamentId}
        stepId="scoring_format"
        onContinue={() => {
          void handleSave(true);
        }}
        continueLabel={saveMutation.isPending ? "Saving…" : "Continue"}
        continueDisabled={saveMutation.isPending}
        guideExtras={
          <div className="space-y-2">
            <SetupTerm term="Points" meaning="how many points win a game (for example 21)." />
            <SetupTerm term="Best of 3" meaning="first side to win 2 games wins the match." />
            <SetupTerm
              term="Scoring Rules"
              meaning="saved once for the tournament; new matches use them automatically."
            />
          </div>
        }
      >
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="h-48 rounded-xl bg-muted/20 animate-pulse" />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Applies to:{" "}
              <span className="font-semibold text-foreground/80">Entire Tournament</span>
            </p>

            {/* Live summary */}
            <div className={cn(hubPanelClass, "space-y-3")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-widest text-primary">
                  Current Scoring Rules
                </h2>
                <span className="text-[11px] font-semibold text-primary/80 border border-primary/20 rounded-md px-2 py-0.5">
                  {chipLabel}
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {summaryLines.map((line) => (
                  <div key={line.label} className="flex items-baseline justify-between gap-3 sm:block">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {line.label}
                    </dt>
                    <dd className="text-sm font-semibold text-foreground sm:mt-0.5">
                      {line.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Presets */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Choose a format
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_CARDS.map((card) => {
                  const selected = presetId === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => selectPreset(card.id)}
                      className={cn(
                        "text-left rounded-xl border px-4 py-3.5 transition-colors relative",
                        selected
                          ? "border-primary/40 bg-primary/10 shadow-[0_0_0_1px] shadow-primary/10"
                          : "border-border/60 bg-card/40 hover:border-primary/25",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{card.name}</p>
                            {card.recommended ? (
                              <span className="text-[9px] font-bold uppercase tracking-wider rounded bg-green-500/15 text-green-400 border border-green-500/25 px-1.5 py-0.5">
                                Recommended
                              </span>
                            ) : null}
                          </div>
                          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                            <li>{card.bestOf}</li>
                            <li>{card.points}</li>
                            <li>{card.winBy}</li>
                          </ul>
                          {card.hint ? (
                            <p className="text-[10px] text-muted-foreground/70 mt-2">{card.hint}</p>
                          ) : null}
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

            {/* Custom only when selected */}
            {presetId === "custom" ? (
              <div className={cn(hubPanelClass, "space-y-5")}>
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Custom settings
                </h2>

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
                      label="Win by 1 Point"
                      selected={winBy === 1}
                      onClick={() => updateCustom({ winBy: 1 })}
                    />
                    <ChoiceChip
                      label="Win by 2 Points"
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
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Highest score allowed in a game (for example 30 in standard play).
                  </p>
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

              <div className="flex flex-col gap-3 pt-1">
              <BtnSecondary
                type="button"
                onClick={() => handleSave(false)}
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto"
              >
                Save Changes
              </BtnSecondary>
              {message ? (
                <p className="text-sm text-emerald-400 font-medium" role="status">
                  {message}
                </p>
              ) : null}
              {error ? <FormError message={error} /> : null}
            </div>
          </>
        )}
      </div>
      </BadmintonSetupWizardChrome>
    </HubPageShell>
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
