import { cn } from "@/lib/utils";

/**
 * ErrorBanner
 * Auction: destructive bordered message on EPIC setup cards
 * Badminton: FormError (`form-ui.tsx`) twin language
 */
export function ErrorBanner({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;

  return (
    <p
      className={cn(
        "text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2",
        className,
      )}
    >
      {message}
    </p>
  );
}
