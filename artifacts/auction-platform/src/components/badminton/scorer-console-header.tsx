import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { cn } from "@/lib/utils";

interface ScorerConsoleHeaderProps {
  tournamentName: string;
  courtNumber?: string;
  matchNumber?: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  showVoiceToggle?: boolean;
  showBrandMark?: boolean;
  className?: string;
}

/** Top bar — tournament context + BidWar identity. */
export function ScorerConsoleHeader({
  tournamentName,
  courtNumber,
  matchNumber,
  voiceEnabled,
  onToggleVoice,
  showVoiceToggle = true,
  showBrandMark = true,
  className,
}: ScorerConsoleHeaderProps) {
  const meta = [
    courtNumber?.trim() ? `Court ${courtNumber.trim()}` : null,
    matchNumber?.trim() ? `Match ${matchNumber.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header
      className={cn(
        "shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-card/95 backdrop-blur-sm",
        "min-h-12",
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm leading-tight truncate" title={tournamentName}>
          {tournamentName}
        </p>
        {meta ? (
          <p className="text-muted-foreground text-[11px] leading-tight mt-0.5 truncate">{meta}</p>
        ) : null}
      </div>

      {showBrandMark ? <BadmintonPublicBrandMark variant="scorer-bar" /> : null}

      {showVoiceToggle ? (
        <button
          type="button"
          onClick={onToggleVoice}
          className="shrink-0 text-[9px] uppercase tracking-wide px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
          aria-pressed={voiceEnabled}
        >
          Voice {voiceEnabled ? "On" : "Off"}
        </button>
      ) : null}
    </header>
  );
}
