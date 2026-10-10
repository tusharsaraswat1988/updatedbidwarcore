import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ScoreButtonProps = {
  label: ReactNode;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?:
    | "default"
    | "run"
    | "boundary"
    | "boundarySix"
    | "extra"
    | "wicket"
    | "undo"
    | "super_ball"
    | "active"
    | "muted";
  className?: string;
};

const variantClasses: Record<NonNullable<ScoreButtonProps["variant"]>, string> = {
  default:
    "bg-gradient-to-b from-[#182344] to-[#0e162c] hover:from-[#22315c] hover:to-[#141f3e] border-white/15 text-slate-100 active:scale-[0.93] shadow-md shadow-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  run:
    "bg-gradient-to-b from-[#1c294a] via-[#141e38] to-[#0c1326] hover:from-[#24355f] hover:to-[#121c35] border-sky-400/30 text-sky-100 active:scale-[0.93] shadow-md shadow-sky-950/40 shadow-[inset_0_1px_0_rgba(56,189,248,0.2)]",
  boundary:
    "bg-gradient-to-b from-emerald-600/35 via-emerald-800/30 to-emerald-950/90 hover:from-emerald-500/45 hover:to-emerald-900/95 border-emerald-400/60 text-emerald-100 active:scale-[0.93] shadow-lg shadow-emerald-950/60 shadow-[inset_0_1px_0_rgba(52,211,153,0.3)] font-black",
  boundarySix:
    "bg-gradient-to-b from-indigo-600/40 via-purple-700/35 to-violet-950/90 hover:from-indigo-500/50 hover:to-violet-900/95 border-purple-400/60 text-purple-100 active:scale-[0.93] shadow-lg shadow-purple-950/60 shadow-[inset_0_1px_0_rgba(192,132,252,0.3)] font-black",
  extra:
    "bg-gradient-to-b from-amber-600/30 via-amber-800/25 to-[#241705] hover:from-amber-500/40 hover:to-[#362207] border-amber-400/50 text-amber-200 active:scale-[0.93] shadow-md shadow-amber-950/40 shadow-[inset_0_1px_0_rgba(251,191,36,0.25)]",
  wicket:
    "bg-gradient-to-b from-rose-600/45 via-red-600/35 to-rose-950/95 hover:from-rose-500/55 hover:to-rose-900/95 border-rose-400/70 text-rose-50 active:scale-[0.93] shadow-xl shadow-rose-950/70 shadow-[inset_0_1px_0_rgba(251,113,133,0.35)] font-black",
  undo:
    "bg-gradient-to-b from-slate-700/40 via-slate-800/40 to-slate-900/90 hover:from-slate-600/50 hover:to-slate-800/95 border-white/20 text-slate-100 hover:text-white active:scale-[0.93] shadow-md shadow-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
  super_ball:
    "bg-gradient-to-br from-amber-400/35 via-yellow-500/25 to-amber-600/40 hover:from-amber-400/50 hover:to-amber-600/50 border-amber-300/70 text-amber-200 shadow-lg shadow-amber-500/25 shadow-[inset_0_1px_0_rgba(253,224,71,0.4)] active:scale-[0.93] font-black",
  active:
    "bg-sky-500 text-slate-950 border-sky-300 shadow-lg shadow-sky-500/40 font-bold",
  muted:
    "bg-white/[0.03] border-white/5 text-white/30",
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
        "group relative flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border min-h-[2.75rem] sm:min-h-[3.85rem] h-full w-full min-w-0 p-1 touch-manipulation select-none transition-all duration-150 backdrop-blur-md cursor-pointer",
        "disabled:opacity-30 disabled:pointer-events-none disabled:cursor-not-allowed",
        variantClasses[variant],
        className,
      )}
    >
      <span className="text-xl sm:text-2xl font-black leading-none tabular-nums tracking-tight font-mono transition-transform duration-100 group-hover:scale-105">
        {label}
      </span>
      {sublabel ? (
        <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider mt-1 opacity-90 truncate max-w-full px-1 leading-none">
          {sublabel}
        </span>
      ) : null}
    </button>
  );
}
