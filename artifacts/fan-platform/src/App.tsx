import React, { useState, useCallback, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter, useParams } from 'wouter';
import { HomePage } from './pages/HomePage';
import UnifiedFanPage from './pages/unified-fan-page';
import './styles/global.css';

/** Vite serves this app under VITE_BASE_PATH (/fan/ in local dev). Strip it so "/" stays the home route. */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

/** Thin adapter: extracts :publicSlug from the route and passes it to UnifiedFanPage. */
function FanPageRoute({
  toggleTheme,
  theme,
}: {
  toggleTheme: () => void;
  theme: "dark" | "light";
}) {
  const params = useParams<{ publicSlug: string }>();
  return (
    <UnifiedFanPage
      routeIdentifier={params.publicSlug ?? ""}
      toggleTheme={toggleTheme}
      theme={theme}
    />
  );
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);

  return (
    <WouterRouter base={BASE}>
      <div className="min-h-screen bg-[#f4f6fb] text-slate-900 transition-colors duration-300 dark:bg-[#0B101B] dark:text-slate-100">
        <Switch>
          <Route path="/">
            <HomePage toggleTheme={toggleTheme} theme={theme} />
          </Route>
          {/* Tournament fan pages: /VN830108, /RC732504, etc. */}
          <Route path="/:publicSlug">
            <FanPageRoute toggleTheme={toggleTheme} theme={theme} />
          </Route>
          <Route>404: Page Not Found</Route>
        </Switch>
      </div>
    </WouterRouter>
  );
}
