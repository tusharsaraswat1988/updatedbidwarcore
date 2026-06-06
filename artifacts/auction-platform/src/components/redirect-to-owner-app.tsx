import { useEffect } from "react";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";

type Props = {
  tournamentId: string;
  teamId: string;
};

/** Legacy `/tournament/:id/owner/:teamId` → canonical owner-app onboarding URL. */
export function RedirectToOwnerApp({ tournamentId, teamId }: Props) {
  useEffect(() => {
    const tid = parseInt(tournamentId, 10);
    const tmid = parseInt(teamId, 10);
    const dest = ownerJoinPath(
      Number.isFinite(tid) ? tid : undefined,
      Number.isFinite(tmid) ? tmid : undefined,
    );
    window.location.replace(dest);
  }, [tournamentId, teamId]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">Opening owner app…</p>
    </div>
  );
}
