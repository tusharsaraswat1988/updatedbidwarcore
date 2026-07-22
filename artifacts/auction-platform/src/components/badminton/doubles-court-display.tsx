import type { BadmintonMatchState } from "@workspace/badminton-core";
import { getCourtQuadrantPlayers } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

type CourtVariant = "scorer" | "display" | "mini";

interface DoublesCourtDisplayProps {
  state: BadmintonMatchState;
  variant?: CourtVariant;
  className?: string;
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
        "relative flex flex-col items-center justify-center border transition-all duration-300",
          isMini ? "p-2.5 min-h-[58px]" : isScorer ? "p-4 min-h-[72px]" : "p-5 min-h-[80px]",
        !ledTheme && isServer
          ? "bg-[#ffd700]/15 border-[#ffd700]/50 shadow-[inset_0_0_20px_rgba(255,215,0,0.15)]"
          : !ledTheme && isReceiver
            ? "bg-[#4fc3f7]/10 border-[#4fc3f7]/40"
            : !ledTheme && "bg-white/[0.03] border-white/10",
        ledTheme && !isServer && !isReceiver && "bg-white/[0.03] border-white/10",
      )}
      style={cellStyle}
    >
      <span
        className={cn(
          "font-bold text-white text-center leading-tight",
          isMini ? "text-sm" : isScorer ? "text-sm" : "text-base",
        )}
        style={ledTheme && isServer ? { color: "var(--accent)" } : !ledTheme && isServer ? { color: "#ffd700" } : undefined}
      >
        {label}
      </span>
      {(isServer || isReceiver) && (
        <div className={cn("flex items-center gap-1 mt-1", isMini && "mt-0.5")}>
          {isServer && (
            <span
              className={cn(isMini ? "text-xs" : "text-xs")}
              style={{ color: ledTheme ? "var(--accent)" : "#ffd700" }}
            >
              {isMini ? "🟡" : "🟡 Serve"}
            </span>
          )}
          {isReceiver && (
            <span
              className={cn(isMini ? "text-xs" : "text-xs")}
              style={{ color: ledTheme ? "var(--accent)" : "#4fc3f7" }}
            >
              {isMini ? "👁" : "👁 Receive"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function DoublesCourtDisplay({
  state,
  variant = "scorer",
  ledTheme = false,
  className,
}: DoublesCourtDisplayProps & { ledTheme?: boolean }) {
  const court = getCourtQuadrantPlayers(state);
  if (!court) return null;

  const isMini = variant === "mini";

  return (
    <div className={cn("w-full", className)}>
      {!isMini && (
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest text-center mb-2">
          Court Positions
        </p>
      )}
      <div
        className={cn(
          "grid grid-cols-2 overflow-hidden rounded-xl border border-white/15",
          isMini ? "rounded-lg" : "rounded-2xl",
        )}
      >
        {/* Net indicator */}
        <div className="col-span-2 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

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

        <div className="col-span-2 h-px bg-white/10" />

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
