import { formatIndianAmountWords } from "@/lib/format";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { cn } from "@/lib/utils";

export function IndianAmountHint({
  value,
  unit = "points",
  className,
}: {
  value: string | number | null | undefined;
  unit?: AuctionUnit;
  className?: string;
}) {
  const words = formatIndianAmountWords(value, unit);
  if (!words) return null;

  const display = unit === "rupee" && /^\d+$/.test(words) ? `₹${words}` : words;

  return (
    <p className={cn("text-xs text-amber-400/80 font-medium", className)}>
      {display}
    </p>
  );
}
