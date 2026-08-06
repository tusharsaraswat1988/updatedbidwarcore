import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ReviewPanel / ReviewInfoRow
 * Auction: InfoRow summary grids on Competition setup card
 * Badminton: summary panels in setup/review flows
 */
export function ReviewInfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/40 bg-muted/10 px-3 py-2", className)}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

export function ReviewPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-2 text-sm sm:grid-cols-2", className)}>{children}</div>;
}
