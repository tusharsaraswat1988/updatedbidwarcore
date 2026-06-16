import { useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { STANDARD_FORMAT, getSidePlayerSlots, isPairMatchKind } from "@workspace/badminton-core";
import { sideJsonToStartSide } from "@/components/badminton/pair-side-picker";

type SetupStep = "toss_winner" | "toss_decision" | "first_server" | "first_receiver" | "confirm";

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
        format: STANDARD_FORMAT,
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
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/25 rounded-full px-4 py-1.5 mb-4">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">
              Doubles Setup — Step {stepNumber}/4
            </span>
          </div>
          <h1 className="text-white text-2xl font-black">Match Toss</h1>
          <p className="text-white/40 text-sm mt-1">
            {step === "toss_winner" && "Who won the toss?"}
            {step === "toss_decision" && "What did the toss winner choose?"}
            {step === "first_server" && "Choose the first server"}
            {step === "first_receiver" && "Choose the first receiver"}
            {step === "confirm" && "Confirm and start match"}
          </p>
        </div>

        {step === "toss_winner" && (
          <SideChoiceGrid
            leftLabel={leftSide.shortLabel}
            rightLabel={rightSide.shortLabel}
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
              sublabel={`${tossWinner === "left" ? leftSide.shortLabel : rightSide.shortLabel} serves first`}
              selected={tossDecision === "serve"}
              onClick={() => {
                setTossDecision("serve");
                setStep("first_server");
              }}
            />
            <ChoiceButton
              label="Receive"
              sublabel={`${tossWinner === "left" ? rightSide.shortLabel : leftSide.shortLabel} serves first`}
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
            teamLabel={servingSideInfo.shortLabel}
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
            teamLabel={receivingSideInfo.shortLabel}
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
            <div className="bg-white/5 rounded-2xl p-4 border border-white/8 space-y-3 text-sm">
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

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full h-16 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-black text-lg transition-colors"
            >
              {starting ? "Starting…" : "Start Doubles Match"}
            </button>

            <button
              onClick={() => setStep("toss_winner")}
              className="w-full text-white/40 text-sm hover:text-white/60"
            >
              ← Restart setup
            </button>
          </div>
        )}

        {step !== "toss_winner" && step !== "confirm" && (
          <button
            onClick={() =>
              setStep(
                step === "toss_decision"
                  ? "toss_winner"
                  : step === "first_server"
                    ? "toss_decision"
                    : "first_server",
              )
            }
            className="w-full text-white/40 text-sm hover:text-white/60"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
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
      <p className="text-white/50 text-xs text-center uppercase tracking-widest">{teamLabel}</p>
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
}: {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onClick: () => void;
  accent?: "blue" | "purple";
}) {
  return (
    <button
      onClick={onClick}
      className={`h-20 rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all border ${
        selected
          ? accent === "blue"
            ? "bg-[#0070f3]/20 border-[#0070f3]/50 text-white"
            : "bg-[#7c3aed]/20 border-[#7c3aed]/50 text-white"
          : "bg-white/5 border-white/10 text-white/50 hover:bg-white/8"
      }`}
    >
      <span>{label}</span>
      {sublabel && <span className="text-xs font-normal opacity-70 truncate max-w-[120px]">{sublabel}</span>}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-white font-semibold text-right">{value}</span>
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

  const [firstServer, setFirstServer] = useState<"left" | "right">("left");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      await onStart({
        matchKind: matchType,
        format: STANDARD_FORMAT,
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
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-white text-2xl font-black">Ready to Start</h1>
          <p className="text-white/40 text-sm mt-1">Select who serves first</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ChoiceButton
            label="Serve"
            sublabel={leftSide.shortLabel}
            selected={firstServer === "left"}
            onClick={() => setFirstServer("left")}
          />
          <ChoiceButton
            label="Serve"
            sublabel={rightSide.shortLabel}
            selected={firstServer === "right"}
            onClick={() => setFirstServer("right")}
            accent="purple"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          onClick={handleStart}
          disabled={starting}
          className="w-full h-16 rounded-2xl bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-black text-lg"
        >
          {starting ? "Starting…" : "Start Match"}
        </button>
      </div>
    </div>
  );
}

export function isDoublesMatchType(matchType: string): boolean {
  return isPairMatchKind(matchType);
}
