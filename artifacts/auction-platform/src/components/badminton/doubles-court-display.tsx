import type { BadmintonMatchState } from "@workspace/badminton-core";
import { getCourtQuadrantPlayers } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

type CourtVariant = "scorer" | "display" | "mini";

interface DoublesCourtDisplayProps {
  state: BadmintonMatchState;
  variant?: CourtVariant;
  className?: string;
  /** Scorer console uses full names; LED/display keep short labels. */
  preferShortNames?: boolean;
}

function QuadrantCell({
  label,
  isServer,
  isReceiver,
  variant,
  ledTheme = false,
}: {
  label: string;
  isServer: boolean;
  isReceiver: boolean;
  variant: CourtVariant;
  ledTheme?: boolean;
}) {
  const isMini = variant === "mini";
  const isScorer = variant === "scorer";

  const cellStyle =
    ledTheme && isServer
      ? {
          backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
          borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
          boxShadow: "inset 0 0 20px var(--accent-glow)",
        }
      : ledTheme && isReceiver
        ? {
            backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
          }
        : undefined;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center border transition-all duration-300 min-w-0",
        isMini
          ? "p-2.5 min-h-[58px] overflow-hidden"
          : isScorer
            ? "p-2 min-h-0 overflow-hidden"
            : "p-5 min-h-[80px]",
        !ledTheme && isServer
          ? "bg-primary/15 border-primary/50 shadow-[inset_0_0_20px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
          : !ledTheme && isReceiver
            ? "bg-sky-500/10 border-sky-400/40"
            : !ledTheme && "bg-white/[0.03] border-white/10",
        ledTheme && !isServer && !isReceiver && "bg-white/[0.03] border-white/10",
      )}
      style={cellStyle}
    >
      <span
        className={cn(
          "font-bold text-white text-center leading-tight max-w-full",
          isMini
            ? "text-sm bw-name-full"
            : isScorer
              ? "text-[11px] sm:text-xs line-clamp-2"
              : "text-base bw-name-full",
        )}
        style={
          ledTheme && isServer
            ? { color: "var(--accent)" }
            : !ledTheme && isServer
              ? undefined
              : undefined
        }
      >
        <span className={cn(!ledTheme && isServer && "text-primary")}>{label}</span>
      </span>
      {(isServer || isReceiver) && (
        <div className={cn("flex items-center gap-1 mt-1", isMini && "mt-0.5")}>
          {isServer && (
            <span
              className={cn(isMini ? "text-xs" : "text-[10px] font-semibold", !ledTheme && "text-primary")}
              style={{ color: ledTheme ? "var(--accent)" : undefined }}
            >
              {isMini ? "🟡" : "🟡 Serve"}
            </span>
          )}
          {isReceiver && (
            <span
              className={cn(isMini ? "text-xs" : "text-[10px] font-semibold text-sky-300")}
              style={{ color: ledTheme ? "var(--accent)" : undefined }}
            >
              {isMini ? "👁" : "👁 Receive"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function EndLabel({ end, sideHint }: { end: "1" | "2"; sideHint: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1.5 px-2 bg-white/[0.04] border-b border-white/10">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
        End {end}
      </span>
      <span className="text-[10px] text-white/40 truncate">{sideHint}</span>
    </div>
  );
}

export function DoublesCourtDisplay({
  state,
  variant = "scorer",
  ledTheme = false,
  preferShortNames,
  className,
}: DoublesCourtDisplayProps & { ledTheme?: boolean }) {
  // Full names on scorer + LED unless caller explicitly requests short labels.
  const preferShort = preferShortNames === true;
  const court = getCourtQuadrantPlayers(state, { preferShort });
  if (!court) return null;

  const isMini = variant === "mini";
  const isScorer = variant === "scorer";
  const end1Hint =
    state.leftSide.franchiseName?.trim() ||
    state.leftSide.teamName?.trim() ||
    state.leftSide.shortLabel ||
    "Left";
  const end2Hint =
    state.rightSide.franchiseName?.trim() ||
    state.rightSide.teamName?.trim() ||
    state.rightSide.shortLabel ||
    "Right";

  return (
    <div
      className={cn(
        "w-full",
        isScorer && "h-full min-h-0 max-h-full flex flex-col",
        className,
      )}
    >
      {!isMini && !isScorer && (
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest text-center mb-2">
          Court Positions
        </p>
      )}
      <div
        className={cn(
          "grid grid-cols-2 overflow-hidden rounded-xl border border-white/15",
          isMini ? "rounded-lg" : "rounded-2xl",
          isScorer && "flex-1 min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto_minmax(0,1fr)]",
        )}
      >
        {isScorer ? (
          <div className="col-span-2">
            <EndLabel end="1" sideHint={end1Hint} />
          </div>
        ) : (
          <div className="col-span-2 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        )}

        <QuadrantCell
          label={court.topLeft.label}
          isServer={court.topLeft.isServer}
          isReceiver={court.topLeft.isReceiver}
          variant={variant}
          ledTheme={ledTheme}
        />
        <QuadrantCell
          label={court.topRight.label}
          isServer={court.topRight.isServer}
          isReceiver={court.topRight.isReceiver}
          variant={variant}
          ledTheme={ledTheme}
        />

        <div className="col-span-2 flex items-center gap-2 px-3 py-1 bg-white/[0.03]">
          <div className="flex-1 h-px bg-white/15" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Net</span>
          <div className="flex-1 h-px bg-white/15" />
        </div>

        {isScorer ? (
          <div className="col-span-2">
            <EndLabel end="2" sideHint={end2Hint} />
          </div>
        ) : null}

        <QuadrantCell
          label={court.bottomLeft.label}
          isServer={court.bottomLeft.isServer}
          isReceiver={court.bottomLeft.isReceiver}
          variant={variant}
          ledTheme={ledTheme}
        />
        <QuadrantCell
          label={court.bottomRight.label}
          isServer={court.bottomRight.isServer}
          isReceiver={court.bottomRight.isReceiver}
          variant={variant}
          ledTheme={ledTheme}
        />
      </div>
    </div>
  );
}
