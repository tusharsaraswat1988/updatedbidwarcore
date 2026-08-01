/**
 * Post-completion score correction — quick final scores + advanced reopen.
 */

import { useMemo, useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { FormActions, FormError, FormField, FormModal, inputClass } from "@/components/badminton/page-chrome";
import { badmintonFetch } from "@/lib/badminton-api";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { badmintonScorerMatchPath } from "@/lib/badminton-routes";
import { cn } from "@/lib/utils";

type GameRow = {
  leftScore: string;
  rightScore: string;
};

export function ReviseScoreDialog({
  tournamentId,
  matchId,
  matchLabel,
  state,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  matchId: number;
  matchLabel: string;
  state: BadmintonMatchState | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const totalGames = state?.format?.totalGames ?? 3;
  const need = Math.ceil(totalGames / 2);
  const initialGames = useMemo(() => {
    const completed = (state?.games ?? []).filter((g) => g.phase === "completed");
    if (completed.length > 0) {
      return completed.map((g) => ({
        leftScore: String(g.leftScore),
        rightScore: String(g.rightScore),
      }));
    }
    return [{ leftScore: "", rightScore: "" }];
  }, [state?.games]);

  const [games, setGames] = useState<GameRow[]>(initialGames);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"quick" | "advanced">("quick");

  function updateGame(idx: number, side: "leftScore" | "rightScore", value: string) {
    setGames((prev) => prev.map((g, i) => (i === idx ? { ...g, [side]: value } : g)));
  }

  function addGame() {
    if (games.length >= totalGames) return;
    setGames((prev) => [...prev, { leftScore: "", rightScore: "" }]);
  }

  function removeGame() {
    if (games.length <= 1) return;
    setGames((prev) => prev.slice(0, -1));
  }

  async function saveQuick() {
    setError("");
    const parsed = games.map((g, i) => {
      const leftScore = Number(g.leftScore);
      const rightScore = Number(g.rightScore);
      if (!Number.isInteger(leftScore) || !Number.isInteger(rightScore) || leftScore < 0 || rightScore < 0) {
        throw new Error(`Game ${i + 1}: enter valid scores`);
      }
      if (leftScore === rightScore) throw new Error(`Game ${i + 1}: cannot be a tie`);
      const winningSide = leftScore > rightScore ? ("left" as const) : ("right" as const);
      return { gameNumber: i + 1, leftScore, rightScore, winningSide };
    });

    let left = 0;
    let right = 0;
    for (const g of parsed) {
      if (g.winningSide === "left") left += 1;
      else right += 1;
    }
    if (left < need && right < need) {
      setError(`Winner must reach ${need} games`);
      return;
    }
    const winningSide = left > right ? "left" : "right";

    setBusy(true);
    try {
      await badmintonFetch(tournamentId, `/matches/${matchId}/revise-score`, {
        method: "POST",
        body: JSON.stringify({
          games: parsed,
          winningSide,
          note: note.trim() || undefined,
        }),
      });
      onSaved();
    } catch (e) {
      setError(friendlyBadmintonError(e, "Could not revise score"));
    } finally {
      setBusy(false);
    }
  }

  async function reopenAdvanced() {
    setBusy(true);
    setError("");
    try {
      await badmintonFetch(tournamentId, `/matches/${matchId}/reopen`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() || "Reopened for score correction" }),
      });
      onSaved();
      window.open(badmintonScorerMatchPath(matchId, tournamentId), "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(friendlyBadmintonError(e, "Could not reopen match"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title={`Revise score · ${matchLabel}`}
      subtitle="Correct the final result. Standings refresh automatically after save."
      onClose={onClose}
      size="md"
    >
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          className={cn(
            "min-h-10 px-3 rounded-lg text-xs font-semibold border",
            mode === "quick"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary border-border text-muted-foreground",
          )}
          onClick={() => setMode("quick")}
        >
          Quick final scores
        </button>
        <button
          type="button"
          className={cn(
            "min-h-10 px-3 rounded-lg text-xs font-semibold border",
            mode === "advanced"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary border-border text-muted-foreground",
          )}
          onClick={() => setMode("advanced")}
        >
          Advanced reopen
        </button>
      </div>

      {mode === "quick" ? (
        <div className="space-y-3">
          {games.map((g, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <FormField label={idx === 0 ? "Left" : `Game ${idx + 1} left`}>
                <input
                  inputMode="numeric"
                  value={g.leftScore}
                  onChange={(e) => updateGame(idx, "leftScore", e.target.value)}
                  className={inputClass}
                  placeholder="21"
                />
              </FormField>
              <span className="text-muted-foreground text-sm pb-2">G{idx + 1}</span>
              <FormField label={idx === 0 ? "Right" : `Game ${idx + 1} right`}>
                <input
                  inputMode="numeric"
                  value={g.rightScore}
                  onChange={(e) => updateGame(idx, "rightScore", e.target.value)}
                  className={inputClass}
                  placeholder="19"
                />
              </FormField>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-primary font-semibold"
              onClick={addGame}
              disabled={games.length >= totalGames}
            >
              + Add game
            </button>
            {games.length > 1 ? (
              <button type="button" className="text-xs text-muted-foreground" onClick={removeGame}>
                Remove last
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Reopens the match for live scoring / undo. Use this when you need to fix rally-by-rally
          history. The scorer page opens after reopen.
        </p>
      )}

      <div className="mt-4">
        <FormField label="Note (optional)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="Why was the score corrected?"
          />
        </FormField>
      </div>

      <div className="mt-3">
        <FormError message={error || undefined} />
      </div>

      <div className="mt-5">
        <FormActions
          onCancel={onClose}
          onSubmit={() => {
            if (mode === "quick") {
              void saveQuick().catch((e) =>
                setError(e instanceof Error ? e.message : "Could not revise score"),
              );
            } else {
              void reopenAdvanced();
            }
          }}
          submitLabel={
            busy ? "Saving…" : mode === "quick" ? "Save corrected score" : "Reopen for scoring"
          }
          saving={busy}
        />
      </div>
    </FormModal>
  );
}
