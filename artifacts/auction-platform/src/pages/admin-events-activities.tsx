import { useEffect } from "react";
import { useLocation } from "wouter";
import { Activity, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminAuth } from "@/hooks/use-auth";
import { AdminRecentActivityFeed } from "@/components/admin/admin-recent-activity-feed";

export default function AdminEventsActivitiesPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading } = useAdminAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoading, isLoggedIn, navigate]);

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Events & Activities"
      eyebrow="Platform audit & activity log"
      actions={
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Immutable Audit Trail Active</span>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Live Audit & Security Events
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time tracking of organizer actions, tournament configuration modifications, critical administrative changes, and suspicious activity patterns.
              </p>
            </div>
          </div>
        </div>

        <AdminRecentActivityFeed />
      </div>
    </AdminShell>
  );
}
