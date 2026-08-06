import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * ProgressHeader
 * Auction: Setup Checklist header + Progress on Tournament Hub
 * Badminton: setup checklist / step progress patterns
 */
export function ProgressHeader({
  title,
  icon,
  doneCount,
  totalCount,
  description,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  doneCount: number;
  totalCount: number;
  description?: ReactNode;
  className?: string;
}) {
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className={cn(className)}>
      <h2 className="text-base font-display font-bold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <p className="text-xs text-muted-foreground mt-0.5">
        {description ?? (
          <>
            {doneCount} of {totalCount} complete ({percent}%)
          </>
        )}
      </p>
      <Progress value={percent} className="h-1.5 mt-2 max-w-xs" />
    </div>
  );
}
