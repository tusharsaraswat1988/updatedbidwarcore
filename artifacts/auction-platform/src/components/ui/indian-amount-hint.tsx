import { formatIndianAmountWords } from "@/lib/format";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { cn } from "@/lib/utils";

export function IndianAmountHint({
  value,
  unit = "rupee",
  className,
}: {
  value: string | number | null | undefined;
  unit?: AuctionUnit;
  className?: string;
}) {
  const words = formatIndianAmountWords(value, unit);
  if (!words) return null;

  return (
    <p className={cn("text-xs text-amber-400/80 font-medium", className)}>
      {words}
    </p>
  );
}
