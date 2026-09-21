import { cn } from "@/lib/utils";

type ScoreButtonProps = {
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "run" | "boundary" | "extra" | "wicket" | "undo" | "super_ball" | "active" | "muted";
  className?: string;
};

const variantClasses: Record<NonNullable<ScoreButtonProps["variant"]>, string> = {
  default: "bg-[#141d3b]/80 hover:bg-[#1c274e] border-white/10 text-white active:scale-[0.96] shadow-sm",
  run: "bg-gradient-to-b from-[#182652] to-[#0f1938] hover:from-[#20326b] hover:to-[#142149] border-sky-500/30 text-sky-200 active:scale-[0.96] shadow-md shadow-sky-950/20",
  boundary: "bg-gradient-to-b from-emerald-900/40 to-emerald-950/80 hover:from-emerald-800/50 hover:to-emerald-900/90 border-emerald-500/40 text-emerald-300 active:scale-[0.96] shadow-md shadow-emerald-950/30 font-black",
  extra: "bg-gradient-to-b from-amber-950/40 to-[#1c1608] hover:from-amber-900/50 hover:to-[#271f0a] border-amber-500/40 text-amber-300 active:scale-[0.96] shadow-sm",
  wicket: "bg-gradient-to-b from-rose-900/50 to-red-950/90 hover:from-rose-800/60 hover:to-red-900/90 border-rose-500/50 text-rose-200 active:scale-[0.96] shadow-lg shadow-rose-950/40 font-bold",
  undo: "bg-[#121933]/70 hover:bg-[#1a2345] border-white/10 text-slate-300 hover:text-white active:scale-[0.96] shadow-sm",
  super_ball: "bg-gradient-to-br from-amber-500/30 via-yellow-500/20 to-amber-600/30 hover:from-amber-500/40 hover:to-amber-600/40 border-amber-400/60 text-amber-300 shadow-md shadow-amber-500/20 active:scale-[0.96] font-bold",
  active: "bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/30 font-bold",
  muted: "bg-white/[0.03] border-white/5 text-white/30",
};

export function ScoreButton({
  label,
  sublabel,
  onClick,
  disabled,
  variant = "default",
  className,
}: ScoreButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border min-h-[2.75rem] sm:min-h-[3.75rem] h-full p-1 touch-manipulation select-none transition-all duration-100 backdrop-blur-xs",
        "disabled:opacity-30 disabled:pointer-events-none active:scale-[0.94]",
        variantClasses[variant],
        className,
      )}
    >
      <span className="text-lg sm:text-2xl font-black leading-none tabular-nums tracking-tight">{label}</span>
      {sublabel ? (
        <span className="text-[8.5px] sm:text-[10px] uppercase font-bold tracking-wider mt-1 opacity-80 truncate max-w-full px-0.5 leading-none">
          {sublabel}
        </span>
      ) : null}
    </button>
  );
}
