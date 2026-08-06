import { Skeleton } from "@/components/ui/skeleton";
import { PlatformSurface } from "@/components/platform/platform-surface";
import { cn } from "@/lib/utils";
import { AsyncLoadingPanel, AsyncLoadingInline } from "@/components/badminton/form-ui";

/**
 * LoadingState
 * Auction: Skeleton blocks inside EPIC setup card surfaces
 * Badminton: AsyncLoadingPanel / AsyncLoadingInline
 */
export function LoadingState({
  variant = "setup-card",
  className,
  message = "Loading…",
}: {
  variant?: "setup-card" | "panel" | "inline";
  className?: string;
  message?: string;
}) {
  if (variant === "panel") {
    return <AsyncLoadingPanel message={message} />;
  }
  if (variant === "inline") {
    return <AsyncLoadingInline message={message} />;
  }

  return (
    <PlatformSurface className={cn("space-y-3", className)}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-10 w-full" />
    </PlatformSurface>
  );
}
