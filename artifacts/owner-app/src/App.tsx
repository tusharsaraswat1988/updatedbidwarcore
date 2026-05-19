import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { OwnerRoute } from "@/screens/OwnerRoute";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LAST_URL_KEY = "owner_last_path";

function Fallback() {
  const saved = localStorage.getItem(LAST_URL_KEY);
  if (saved) {
    return <Redirect to={saved} />;
  }
  return (
    <div className="h-full flex items-center justify-center bg-[#09090b]">
      <div className="text-center space-y-3 px-8">
        <p className="text-[#71717a] text-sm leading-relaxed">
          Open your owner link to join the auction.
        </p>
        <p className="text-[10px] text-[#3f3f46] uppercase tracking-widest">
          Powered by BidWar
        </p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/tournament/:id/owner/:teamId" component={OwnerRoute} />
      <Route component={Fallback} />
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
