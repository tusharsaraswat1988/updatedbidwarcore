import { useEffect } from "react";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import { GlobalLoadingScreen } from "@/components/global-loading-screen";

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

  return <GlobalLoadingScreen label="Opening owner panel…" />;
}
