import { cn } from "@/lib/utils";

/** Amber badge shown when a tournament is on a trial (non-active) auction license. */
export function TrialLicenseBadge({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "led";
}) {
  const sizeClass =
    size === "led"
      ? "text-[9px] font-mono uppercase tracking-[0.35em] px-2 py-0.5"
      : "text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide";

  return (
    <span
      className={cn(
        "inline-flex items-center border border-amber-500/40 bg-amber-500/15 text-amber-400",
        sizeClass,
        className,
      )}
      title="Trial auction license — upgrade to live when ready"
    >
      Trial
    </span>
  );
}
