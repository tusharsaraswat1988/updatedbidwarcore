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
}: {
  label: string;
  isServer: boolean;
  isReceiver: boolean;
  variant: CourtVariant;
}) {
  const isMini = variant === "mini";
  const isScorer = variant === "scorer";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center border transition-all duration-300",
        isMini ? "p-2 min-h-[48px]" : isScorer ? "p-4 min-h-[72px]" : "p-5 min-h-[80px]",
        isServer
          ? "bg-[#ffd700]/15 border-[#ffd700]/50 shadow-[inset_0_0_20px_rgba(255,215,0,0.15)]"
          : isReceiver
            ? "bg-[#4fc3f7]/10 border-[#4fc3f7]/40"
            : "bg-white/[0.03] border-white/10",
      )}
    >
      <span
        className={cn(
          "font-bold text-white text-center leading-tight",
          isMini ? "text-xs" : isScorer ? "text-sm" : "text-base",
          isServer && "text-[#ffd700]",
        )}
      >
        {label}
      </span>
      {(isServer || isReceiver) && (
        <div className={cn("flex items-center gap-1 mt-1", isMini && "mt-0.5")}>
          {isServer && (
            <span className={cn("text-[#ffd700]", isMini ? "text-[10px]" : "text-xs")}>
              {isMini ? "🟡" : "🟡 Serve"}
            </span>
          )}
          {isReceiver && (
            <span className={cn("text-[#4fc3f7]", isMini ? "text-[10px]" : "text-xs")}>
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
  className,
}: DoublesCourtDisplayProps) {
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
        />
        <QuadrantCell
          label={court.topRight.label}
          isServer={court.topRight.isServer}
          isReceiver={court.topRight.isReceiver}
          variant={variant}
        />

        <div className="col-span-2 h-px bg-white/10" />

        <QuadrantCell
          label={court.bottomLeft.label}
          isServer={court.bottomLeft.isServer}
          isReceiver={court.bottomLeft.isReceiver}
          variant={variant}
        />
        <QuadrantCell
          label={court.bottomRight.label}
          isServer={court.bottomRight.isServer}
          isReceiver={court.bottomRight.isReceiver}
          variant={variant}
        />
      </div>
    </div>
  );
}
