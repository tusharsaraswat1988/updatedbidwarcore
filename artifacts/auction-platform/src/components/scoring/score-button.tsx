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
  default: "bg-card/70 hover:bg-card border-border/80 text-foreground active:bg-muted shadow-sm",
  run: "bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary active:bg-primary/25 shadow-sm",
  boundary: "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-400 active:bg-emerald-500/30 shadow-sm font-black",
  extra: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300 active:bg-amber-500/25 shadow-sm",
  wicket: "bg-red-500/15 hover:bg-red-500/25 border-red-500/40 text-red-400 active:bg-red-500/30 shadow-sm font-bold",
  undo: "bg-muted/30 hover:bg-muted/50 border-border/70 text-muted-foreground hover:text-foreground active:bg-muted shadow-sm",
  super_ball: "bg-gradient-to-br from-amber-400/20 via-yellow-500/20 to-amber-600/20 hover:from-amber-400/30 hover:to-amber-600/30 border-amber-400/60 text-amber-300 shadow-md shadow-amber-500/10 active:scale-[0.98] font-bold",
  active: "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20",
  muted: "bg-muted/15 border-border/40 text-muted-foreground",
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
        "flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border min-h-[3.5rem] sm:min-h-[4.25rem] p-1.5 touch-manipulation select-none transition-colors",
        "disabled:opacity-40 disabled:pointer-events-none active:scale-[0.96]",
        variantClasses[variant],
        className,
      )}
    >
      <span className="text-xl sm:text-2xl font-bold leading-none tabular-nums">{label}</span>
      {sublabel ? (
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider mt-0.5 sm:mt-1 opacity-70 truncate max-w-full px-0.5">
          {sublabel}
        </span>
      ) : null}
    </button>
  );
}
