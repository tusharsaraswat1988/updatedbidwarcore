import type { ReactNode } from "react";
import { useState } from "react";
import type { BadmintonMatchFormat, BadmintonMatchState } from "@workspace/badminton-core";
import {
  STANDARD_FORMAT,
  getSidePlayerSlots,
  isPairMatchKind,
  parseBadmintonMatchFormat,
} from "@workspace/badminton-core";
import { cn } from "@/lib/utils";
import { hubCardClass, BtnPrimary } from "@/components/badminton/form-ui";
import { sideJsonToStartSide } from "@/components/badminton/pair-side-picker";
import { ScoringFormatBadge } from "@/components/badminton/scoring-format-badge";
import { matchFormatChipLabel } from "@/lib/match-format-display";

type SetupStep = "toss_winner" | "toss_decision" | "first_server" | "first_receiver" | "confirm";

function resolveStartFormat(
  detail: unknown,
  state?: BadmintonMatchState | null,
): BadmintonMatchFormat {
  const d = detail as Record<string, unknown> | null;
  return (
    parseBadmintonMatchFormat(d?.matchFormatJson) ??
    state?.format ??
    STANDARD_FORMAT
  );
}

export function DoublesPreMatchSetup({
  state,
  detail,
  onStart,
}: {
  state: BadmintonMatchState;
  detail: unknown;
  onStart: (payload: unknown) => Promise<BadmintonMatchState>;
}) {
  const d = detail as Record<string, unknown> | null;
  const leftSideJson = (d?.leftSideJson ?? {}) as Record<string, unknown>;
  const rightSideJson = (d?.rightSideJson ?? {}) as Record<string, unknown>;
  const matchType = (d?.matchType as string) ?? "doubles";

  const leftSide = sideJsonToStartSide(leftSideJson);
  const rightSide = sideJsonToStartSide(rightSideJson);
  const leftPlayers = getSidePlayerSlots(leftSide);
  const rightPlayers = getSidePlayerSlots(rightSide);
  const matchFormat = resolveStartFormat(detail, state);
  const formatLabel = matchFormatChipLabel(matchFormat);

  const [step, setStep] = useState<SetupStep>("toss_winner");
  const [tossWinner, setTossWinner] = useState<"left" | "right" | null>(null);
  const [tossDecision, setTossDecision] = useState<"serve" | "receive" | null>(null);
  const [firstServerIndex, setFirstServerIndex] = useState<0 | 1 | null>(null);
  const [firstReceiverIndex, setFirstReceiverIndex] = useState<0 | 1 | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const servingSide: "left" | "right" | null =
    tossWinner && tossDecision
      ? tossDecision === "serve"
        ? tossWinner
        : tossWinner === "left"
          ? "right"
          : "left"
      : null;

  const receivingSide: "left" | "right" | null = servingSide
    ? servingSide === "left"
      ? "right"
      : "left"
    : null;

  const servingPlayers = servingSide === "left" ? leftPlayers : rightPlayers;
  const receivingPlayers = receivingSide === "left" ? leftPlayers : rightPlayers;
  const servingSideInfo = servingSide === "left" ? leftSide : rightSide;
  const receivingSideInfo = receivingSide === "left" ? leftSide : rightSide;

  async function handleStart() {
    if (
      !tossWinner ||
      !tossDecision ||
      !servingSide ||
      !receivingSide ||
      firstServerIndex == null ||
      firstReceiverIndex == null
    ) {
      return;
    }

    setStarting(true);
    setError("");
    try {
      await onStart({
        matchKind: matchType,
        format: matchFormat,
        leftSide,
        rightSide,
        firstServer: servingSide,
        doublesSetup: {
          tossWinnerSide: tossWinner,
          tossDecision,
          firstServingSide: servingSide,
          firstServerPlayerIndex: firstServerIndex,
          firstReceivingSide: receivingSide,
          firstReceiverPlayerIndex: firstReceiverIndex,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start match");
    } finally {
      setStarting(false);
    }
  }

  const stepNumber =
    step === "toss_winner"
      ? 1
      : step === "toss_decision"
        ? 2
        : step === "first_server"
          ? 3
          : 4;

  return (
    <PreMatchSetupFrame>
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/25 rounded-full px-4 py-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">
              Doubles Setup — Step {stepNumber}/4
            </span>
          </div>
          <h1 className="text-foreground font-display font-bold text-xl">Match Toss</h1>
          <div className="flex justify-center">
            <ScoringFormatBadge label={formatLabel} />
          </div>
          <p className="text-base font-semibold text-foreground">
            {step === "toss_winner" && "Who won the toss?"}
            {step === "toss_decision" && "What did the toss winner choose?"}
            {step === "first_server" && "Who serves first?"}
            {step === "first_receiver" && "Who receives first?"}
            {step === "confirm" && "Confirm and start match"}
          </p>
        </div>

        {step === "toss_winner" && (
          <SideChoiceGrid
            leftLabel={leftSide.label}
            rightLabel={rightSide.label}
            selected={tossWinner}
            onSelect={(side) => {
              setTossWinner(side);
              setStep("toss_decision");
            }}
          />
        )}

        {step === "toss_decision" && tossWinner && (
          <div className="grid grid-cols-2 gap-3">
            <ChoiceButton
              label="Serve"
              sublabel={`${tossWinner === "left" ? leftSide.label : rightSide.label} serves first`}
              selected={tossDecision === "serve"}
              onClick={() => {
                setTossDecision("serve");
                setStep("first_server");
              }}
            />
            <ChoiceButton
              label="Receive"
              sublabel={`${tossWinner === "left" ? rightSide.label : leftSide.label} serves first`}
              selected={tossDecision === "receive"}
              onClick={() => {
                setTossDecision("receive");
                setStep("first_server");
              }}
            />
          </div>
        )}

        {step === "first_server" && servingSide && (
          <PlayerChoiceGrid
            teamLabel={servingSideInfo.label}
            players={servingPlayers.slice(0, 2)}
            selectedIndex={firstServerIndex}
            onSelect={(index) => {
              setFirstServerIndex(index);
              setStep("first_receiver");
            }}
          />
        )}

        {step === "first_receiver" && receivingSide && (
          <PlayerChoiceGrid
            teamLabel={receivingSideInfo.label}
            players={receivingPlayers.slice(0, 2)}
            selectedIndex={firstReceiverIndex}
            onSelect={(index) => {
              setFirstReceiverIndex(index);
              setStep("confirm");
            }}
          />
        )}

        {step === "confirm" && servingSide && receivingSide && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 text-sm">
              <SummaryRow label="Toss winner" value={tossWinner === "left" ? leftSide.label : rightSide.label} />
              <SummaryRow label="Decision" value={tossDecision === "serve" ? "Serve" : "Receive"} />
              <SummaryRow
                label="First server"
                value={servingPlayers[firstServerIndex ?? 0]?.label ?? "—"}
              />
              <SummaryRow
                label="First receiver"
                value={receivingPlayers[firstReceiverIndex ?? 0]?.label ?? "—"}
              />
            </div>

            {error ? <p className="text-destructive text-sm text-center">{error}</p> : null}

            <BtnPrimary
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="w-full h-12 text-base"
            >
              {starting ? "Starting…" : "Start Doubles Match"}
            </BtnPrimary>

            <button
              type="button"
              onClick={() => setStep("toss_winner")}
              className="w-full text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              ← Restart setup
            </button>
          </div>
        )}

        {step !== "toss_winner" && step !== "confirm" && (
          <button
            type="button"
            onClick={() =>
              setStep(
                step === "toss_decision"
                  ? "toss_winner"
                  : step === "first_server"
                    ? "toss_decision"
                    : "first_server",
              )
            }
            className="w-full text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        )}
      </div>
    </PreMatchSetupFrame>
  );
}

function SideChoiceGrid({
  leftLabel,
  rightLabel,
  selected,
  onSelect,
}: {
  leftLabel: string;
  rightLabel: string;
  selected: "left" | "right" | null;
  onSelect: (side: "left" | "right") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ChoiceButton
        label="Team A"
        sublabel={leftLabel}
        selected={selected === "left"}
        onClick={() => onSelect("left")}
        accent="blue"
      />
      <ChoiceButton
        label="Team B"
        sublabel={rightLabel}
        selected={selected === "right"}
        onClick={() => onSelect("right")}
        accent="purple"
      />
    </div>
  );
}

function PlayerChoiceGrid({
  teamLabel,
  players,
  selectedIndex,
  onSelect,
}: {
  teamLabel: string;
  players: { label: string; shortLabel: string }[];
  selectedIndex: 0 | 1 | null;
  onSelect: (index: 0 | 1) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs text-center uppercase tracking-wider font-semibold">
        {teamLabel}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {players.map((player, index) => (
          <ChoiceButton
            key={player.label}
            label={`Player ${index + 1}`}
            sublabel={player.label}
            selected={selectedIndex === index}
            onClick={() => onSelect(index as 0 | 1)}
          />
        ))}
      </div>
    </div>
  );
}

function ChoiceButton({
  label,
  sublabel,
  selected,
  onClick,
  accent = "blue",
  prominent = false,
}: {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onClick: () => void;
  accent?: "blue" | "purple";
  prominent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[5.5rem] rounded-xl border px-3 py-4 flex flex-col items-center justify-center gap-1.5 transition-all text-center",
        selected
          ? accent === "purple"
            ? "border-primary/45 bg-primary/10 text-foreground ring-2 ring-primary/20"
            : "border-primary/45 bg-primary/10 text-foreground ring-2 ring-primary/20"
          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/40",
      )}
    >
      <span className={cn("font-semibold leading-snug", prominent ? "text-base sm:text-lg" : "text-sm")}>
        {label}
      </span>
      {sublabel ? (
        <span
          className={cn(
            "font-normal leading-snug",
            prominent ? "text-sm text-muted-foreground" : "text-xs opacity-80 line-clamp-2",
          )}
        >
          {sublabel}
        </span>
      ) : null}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-semibold text-right">{value}</span>
    </div>
  );
}

function PreMatchSetupFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-background">
      <div className={cn(hubCardClass, "w-full max-w-md p-5 sm:p-6")}>{children}</div>
    </div>
  );
}

/** Singles pre-match — side serves first only. */
export function SinglesPreMatchSetup({
  detail,
  onStart,
}: {
  detail: unknown;
  onStart: (payload: unknown) => Promise<BadmintonMatchState>;
}) {
  const d = detail as Record<string, unknown> | null;
  const leftSideJson = (d?.leftSideJson ?? {}) as Record<string, unknown>;
  const rightSideJson = (d?.rightSideJson ?? {}) as Record<string, unknown>;
  const matchType = (d?.matchType as string) ?? "singles";

  const leftSide = sideJsonToStartSide(leftSideJson);
  const rightSide = sideJsonToStartSide(rightSideJson);
  const matchFormat = resolveStartFormat(detail);
  const formatLabel = matchFormatChipLabel(matchFormat);

  const [firstServer, setFirstServer] = useState<"left" | "right">("left");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      await onStart({
        matchKind: matchType,
        format: matchFormat,
        leftSide,
        rightSide,
        firstServer,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start match");
    } finally {
      setStarting(false);
    }
  }

  return (
    <PreMatchSetupFrame>
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-foreground font-display font-bold text-xl tracking-tight">Ready to Start</h1>
          <div className="flex justify-center">
            <ScoringFormatBadge label={formatLabel} />
          </div>
          <p className="text-lg sm:text-xl font-display font-bold text-foreground">
            Who serves first?
          </p>
          <p className="text-sm text-muted-foreground">
            Tap the player who will open the rally with the first serve.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ChoiceButton
            label={leftSide.label}
            sublabel="Serves first"
            selected={firstServer === "left"}
            onClick={() => setFirstServer("left")}
            prominent
          />
          <ChoiceButton
            label={rightSide.label}
            sublabel="Serves first"
            selected={firstServer === "right"}
            onClick={() => setFirstServer("right")}
            accent="purple"
            prominent
          />
        </div>

        {error ? <p className="text-destructive text-sm text-center">{error}</p> : null}

        <BtnPrimary
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="w-full h-12 text-base"
        >
          {starting ? "Starting…" : "Start Match"}
        </BtnPrimary>
      </div>
    </PreMatchSetupFrame>
  );
}

export function isDoublesMatchType(matchType: string): boolean {
  return isPairMatchKind(matchType);
}
