import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { MOBILE_APP_BASE, type MobileRoleId } from "@workspace/api-base/mobile-app-urls";
import { BootRouter } from "@/screens/BootRouter";
import { RoleSelectionScreen } from "@/screens/RoleSelection";
import { OrganizerAuthProvider } from "@/auth/organizer/AuthContext";
import { TeamOwnerAuthProvider } from "@/auth/team-owner/AuthContext";
import { OrganizerLoginScreen } from "@/screens/organizer/Login";
import { OrganizerDashboardScreen } from "@/screens/organizer/Dashboard";
import { OrganizerSettingsScreen } from "@/screens/organizer/Settings";
import { TeamOwnerMobileEntryScreen } from "@/screens/team-owner/MobileEntry";
import { TeamOwnerTournamentPickerScreen } from "@/screens/team-owner/TournamentPicker";
import { TeamOwnerAccessCodeScreen } from "@/screens/team-owner/AccessCode";
import { TeamOwnerPanelScreen } from "@/screens/team-owner/Panel";
import { TeamOwnerSettingsScreen } from "@/screens/team-owner/Settings";
import { setLastSelectedRole } from "@/lib/role-preference";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdatePrompt } from "@/components/UpdatePrompt";

/** Explicit base — do not use import.meta.env.BASE_URL (is "/" in Vite dev). */
const BASE = MOBILE_APP_BASE.replace(/\/$/, "");

function RolePreferenceSync() {
  const [location] = useLocation();
  useEffect(() => {
    let role: MobileRoleId | null = null;
    if (location.startsWith("/organizer")) role = "organizer";
    else if (location.startsWith("/team-owner")) role = "team-owner";
    if (role) setLastSelectedRole(role);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <RolePreferenceSync />
      <Switch>
        <Route path="/select-role" component={RoleSelectionScreen} />

        <Route path="/organizer/login" component={OrganizerLoginScreen} />
        <Route path="/organizer/dashboard" component={OrganizerDashboardScreen} />
        <Route path="/organizer/settings" component={OrganizerSettingsScreen} />

        <Route path="/team-owner/login" component={TeamOwnerMobileEntryScreen} />
        <Route path="/team-owner/tournaments" component={TeamOwnerTournamentPickerScreen} />
        <Route path="/team-owner/access-code/:tournamentId/:teamId" component={TeamOwnerAccessCodeScreen} />
        <Route path="/team-owner/panel/:tournamentId/:teamId" component={TeamOwnerPanelScreen} />
        <Route path="/team-owner/settings" component={TeamOwnerSettingsScreen} />

        <Route component={BootRouter} />
      </Switch>
    </>
  );
}

/**
 * Shared BidWar mobile shell.
 * Both auth providers mount together but remain isolated (separate cookies + storage keys).
 * Logging out one role never clears the other.
 */
export default function App() {
  return (
    <WouterRouter base={BASE}>
      <AppErrorBoundary>
        <OrganizerAuthProvider>
          <TeamOwnerAuthProvider>
            <OfflineBanner />
            <UpdatePrompt />
            <Router />
          </TeamOwnerAuthProvider>
        </OrganizerAuthProvider>
      </AppErrorBoundary>
    </WouterRouter>
  );
}
