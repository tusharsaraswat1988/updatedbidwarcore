import { cn } from "@/lib/utils";

/** Compact chip for active match format, e.g. "Best of 3 • 21 Points". */
export function ScoringFormatBadge({
  label,
  className,
}: {
  label: string | null | undefined;
  className?: string;
}) {
  if (!label?.trim()) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-primary/25 bg-primary/10",
        "px-2.5 py-1 text-[11px] font-semibold text-primary tracking-wide",
        className,
      )}
      title="Match format"
    >
      {label}
    </span>
  );
}
