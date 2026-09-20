import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";

/**
 * EmptyState
 * Auction / Sports sport-agnostic empty copy on organizer pages
 */
export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  action?: {
    label: string;
    onClick?: () => void;
    /** Prefer href for SPA navigation (avoids full reload). */
    href?: string;
  };
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex p-4 rounded-xl bg-primary/10 mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-foreground font-display font-bold text-lg">{title}</h3>
      <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">{desc}</p>
      {action ? (
        <div className="mt-6">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 text-sm"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 text-sm"
            >
              {action.label}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
