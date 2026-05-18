import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { OwnerRoute } from "@/screens/OwnerRoute";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Router() {
  return (
    <Switch>
      <Route path="/tournament/:id/owner/:teamId" component={OwnerRoute} />
      <Route>
        <div className="h-full flex items-center justify-center bg-[#09090b]">
          <div className="text-center space-y-3">
            <p className="text-[#71717a] text-sm">Open your owner link to join the auction.</p>
            <p className="text-[10px] text-[#3f3f46] uppercase tracking-widest">Powered by BidWar</p>
          </div>
        </div>
      </Route>
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
