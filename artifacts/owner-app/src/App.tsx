import { Switch, Route, Router as WouterRouter } from "wouter";
import { OWNER_APP_BASE } from "@workspace/api-base/owner-urls";
import { BrandingEffects } from "@/components/BrandingEffects";
import { OwnerRoute } from "@/screens/OwnerRoute";
import { Launcher } from "@/screens/Launcher";
import { MobileEntry } from "@/screens/MobileEntry";
import { TeamPicker } from "@/screens/TeamPicker";

/** Explicit base — do not use import.meta.env.BASE_URL (is "/" in Vite dev). */
const BASE = OWNER_APP_BASE.replace(/\/$/, "");

function Router() {
  return (
    <Switch>
      <Route path="/join/teams" component={TeamPicker} />
      <Route path="/join" component={MobileEntry} />
      <Route path="/tournament/:id/owner/:teamId" component={OwnerRoute} />
      <Route component={Launcher} />
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={BASE}>
      <BrandingEffects />
      <Router />
    </WouterRouter>
  );
}
