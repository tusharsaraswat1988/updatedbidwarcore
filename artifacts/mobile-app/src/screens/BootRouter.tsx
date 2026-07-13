import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { parseOwnerDeepLink } from "@workspace/api-base/owner-onboarding";
import { getLastSelectedRole } from "@/lib/role-preference";
import { getRoleModule } from "@/roles/registry";
import { RoleSelectionScreen } from "@/screens/RoleSelection";

/**
 * On first launch → role selection.
 * On later launches → open login for previously selected role.
 * Team Owner deep links (?tournamentId=&teamId=) route like owner-app /join.
 */
export function BootRouter() {
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const deepLink = parseOwnerDeepLink(window.location.search);
    if (deepLink) {
      setLocation(
        `/team-owner/login?tournamentId=${deepLink.tournamentId}&teamId=${deepLink.teamId}`,
      );
      return;
    }

    const last = getLastSelectedRole();
    if (last) {
      const mod = getRoleModule(last);
      if (mod) {
        setLocation(mod.loginRoute);
        return;
      }
    }
    setReady(true);
  }, [setLocation]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]" aria-busy="true">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <RoleSelectionScreen />;
}
