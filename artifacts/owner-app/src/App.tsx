import { Switch, Route, Router as WouterRouter } from "wouter";
import { OwnerRoute } from "@/screens/OwnerRoute";
import { Launcher } from "@/screens/Launcher";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Router() {
  return (
    <Switch>
      <Route path="/tournament/:id/owner/:teamId" component={OwnerRoute} />
      <Route component={Launcher} />
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={BASE}>
      <Router />
    </WouterRouter>
  );
}
