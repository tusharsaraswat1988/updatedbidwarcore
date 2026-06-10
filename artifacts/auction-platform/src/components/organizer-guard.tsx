import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { AppLayout } from "@/components/layout";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

export function OrganizerGuard({ tournamentId, children }: { tournamentId: number; children: ReactNode }) {
  const { isLoggedIn, isLoading } = useOrganizerAuth(tournamentId);
  const [, navigate] = useLocation();

  const [location] = useLocation();

  const {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes,
  } = useOrganizerInactivityLogout({
    enabled: isLoggedIn && !isLoading,
    tournamentId,
  });

  useEffect(() => {
    if (!isLoading && !isLoggedIn && tournamentId) {
      navigate(`/organizer?next=${encodeURIComponent(location)}`);
    }
  }, [isLoggedIn, isLoading, tournamentId, navigate, location]);

  if (isLoading) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shield className="w-5 h-5 animate-pulse" />
            <span className="text-sm">Checking access...</span>
          </div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }
  if (!isLoggedIn) return null;

  return (
    <>
      {children}
      {warningVisible && (
        <AdminLockWarning
          secondsLeft={warningSecondsLeft}
          lockMinutes={lockMinutes}
          onContinue={continueSession}
        />
      )}
    </>
  );
}
