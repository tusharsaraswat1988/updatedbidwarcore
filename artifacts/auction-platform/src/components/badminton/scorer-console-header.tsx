import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { cn } from "@/lib/utils";

interface ScorerConsoleHeaderProps {
  tournamentName: string;
  courtNumber?: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  showVoiceToggle?: boolean;
  showBrandMark?: boolean;
  className?: string;
}

/** Compact top bar — tournament context + BidWar identity. Stays under ~40px. */
export function ScorerConsoleHeader({
  tournamentName,
  courtNumber,
  voiceEnabled,
  onToggleVoice,
  showVoiceToggle = true,
  showBrandMark = true,
  className,
}: ScorerConsoleHeaderProps) {
  return (
    <header
      className={cn(
        "shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/95 backdrop-blur-sm",
        "min-h-[2.25rem] max-h-10",
        className,
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[11px] sm:text-xs leading-tight">
        <span className="font-semibold text-foreground truncate">{tournamentName}</span>
        {courtNumber ? (
          <>
            <span className="text-muted-foreground/50 shrink-0" aria-hidden>
              |
            </span>
            <span className="text-muted-foreground shrink-0 whitespace-nowrap">Court {courtNumber}</span>
          </>
        ) : null}
      </div>

      {showBrandMark ? <BadmintonPublicBrandMark variant="scorer-bar" /> : null}

      {showVoiceToggle ? (
        <button
          type="button"
          onClick={onToggleVoice}
          className="shrink-0 text-[9px] uppercase tracking-wide px-2 py-1 rounded border border-white/10 text-white/45 hover:text-white/75"
          aria-pressed={voiceEnabled}
        >
          Voice {voiceEnabled ? "On" : "Off"}
        </button>
      ) : null}
    </header>
  );
}
