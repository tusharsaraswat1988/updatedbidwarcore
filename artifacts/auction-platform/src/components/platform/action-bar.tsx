import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ActionBar
 * Auction: Lock/Ready button rows on EPIC setup cards; operator session action slot
 * Badminton: FormActions row (`form-ui.tsx`)
 */
export function ActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3", className)}>
      {children}
    </div>
  );
}
