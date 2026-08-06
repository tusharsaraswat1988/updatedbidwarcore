import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { BtnPrimary } from "@/components/badminton/form-ui";

/**
 * EmptyState
 * Auction: ad-hoc empty copy on organizer pages (adopts this API)
 * Badminton: EmptyState formerly in page-chrome.tsx
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
            <Link href={action.href}>
              <BtnPrimary type="button">{action.label}</BtnPrimary>
            </Link>
          ) : (
            <BtnPrimary type="button" onClick={action.onClick}>
              {action.label}
            </BtnPrimary>
          )}
        </div>
      ) : null}
    </div>
  );
}
