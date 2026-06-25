import { cn } from "@/lib/utils";

type ScoreButtonProps = {
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "run" | "extra" | "wicket" | "undo" | "muted";
  className?: string;
};

const variantClasses: Record<NonNullable<ScoreButtonProps["variant"]>, string> = {
  default: "bg-card border-border text-foreground active:bg-muted",
  run: "bg-primary/15 border-primary/40 text-primary active:bg-primary/25",
  extra: "bg-primary/10 border-primary/30 text-primary active:bg-primary/20",
  wicket: "bg-red-500/15 border-red-500/40 text-red-300 active:bg-red-500/25",
  undo: "bg-muted/40 border-border text-muted-foreground active:bg-muted",
  muted: "bg-muted/20 border-border/50 text-muted-foreground",
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
        "flex flex-col items-center justify-center rounded-2xl border min-h-[4.25rem] touch-manipulation select-none transition-colors",
        "disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97]",
        variantClasses[variant],
        className,
      )}
    >
      <span className="text-2xl font-bold leading-none tabular-nums">{label}</span>
      {sublabel ? (
        <span className="text-[10px] uppercase tracking-wider mt-1 opacity-70">{sublabel}</span>
      ) : null}
    </button>
  );
}
