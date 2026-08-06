import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * PlatformCard
 * Auction: `.org-kpi-card` pattern on Tournament Hub
 * Badminton: HubKpiCard (page-chrome.tsx)
 */
export function PlatformCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("org-kpi-card", className)}>{children}</div>;
}

export function HubKpiCard({
  label,
  value,
  icon: Icon,
  tint = "primary",
  pulse,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tint?: "primary" | "amber" | "blue" | "green" | "red" | "purple" | "muted";
  pulse?: boolean;
}) {
  const tintMap = {
    primary: { well: "bg-primary/10", icon: "text-primary" },
    amber: { well: "bg-amber-500/10", icon: "text-amber-500" },
    blue: { well: "bg-blue-500/10", icon: "text-blue-500" },
    green: { well: "bg-green-500/10", icon: "text-green-500" },
    red: { well: "bg-red-500/10", icon: "text-red-500" },
    purple: { well: "bg-purple-500/10", icon: "text-purple-500" },
    muted: { well: "bg-muted/30", icon: "text-muted-foreground" },
  };
  const t = tintMap[tint];

  return (
    <Card className="bg-card border-border hover:border-primary/20 transition-colors">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-display font-bold tabular-nums">{value}</p>
          </div>
          <div className={cn("p-3 rounded-lg relative", t.well)}>
            <Icon className={cn("w-5 h-5", t.icon)} />
            {pulse ? (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
