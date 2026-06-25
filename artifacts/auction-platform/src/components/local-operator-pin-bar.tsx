import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { getLocalOperatorPin, setLocalOperatorPin } from "@/lib/local-operator-pin";

type LocalOperatorPinBarProps = {
  tournamentId: number;
};

/** Venue operator PIN entry — shown on BidWar Local when a PIN was exported from cloud. */
export function LocalOperatorPinBar({ tournamentId }: LocalOperatorPinBarProps) {
  const [savedPin, setSavedPin] = useState(() => getLocalOperatorPin(tournamentId));
  const [draft, setDraft] = useState(savedPin ?? "");

  useEffect(() => {
    setSavedPin(getLocalOperatorPin(tournamentId));
    setDraft(getLocalOperatorPin(tournamentId) ?? "");
  }, [tournamentId]);

  if (!isBidWarLocalHost()) return null;

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <div className="min-w-[200px] flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">
          Venue operator PIN
        </p>
        <p className="text-xs text-muted-foreground">
          {savedPin
            ? "PIN saved for this browser session. Change it if you re-exported from cloud."
            : "Enter the PIN from your BidWar Local connection kit to control the auction."}
        </p>
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="4-digit PIN"
        className="h-8 w-28 font-mono"
        inputMode="numeric"
        autoComplete="off"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 border-amber-500/40"
        onClick={() => {
          const trimmed = draft.trim();
          if (!trimmed) return;
          setLocalOperatorPin(tournamentId, trimmed);
          setSavedPin(trimmed);
        }}
      >
        {savedPin ? "Update PIN" : "Save PIN"}
      </Button>
    </div>
  );
}
