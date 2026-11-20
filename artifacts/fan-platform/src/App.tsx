import React, { useState, useCallback, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter, useParams } from 'wouter';
import { HomePage } from './pages/HomePage';
import UnifiedFanPage from './pages/unified-fan-page';
import { useBranding } from './hooks/use-branding';
import { applyPwaHeadBranding } from './lib/branding-pwa';
import './styles/global.css';

/** Vite serves this app under VITE_BASE_PATH (/fan/ in local dev). Strip it so "/" stays the home route. */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

function BrandingEffects() {
  const { logos, brandName, iconVersion } = useBranding();

  useEffect(() => {
    applyPwaHeadBranding(logos, "/manifest.webmanifest", iconVersion);

    if (brandName && brandName !== "BidWar") {
      document.title = document.title.replace(/BidWar/g, brandName);
    }
  }, [logos, brandName, iconVersion]);

  return null;
}

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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const persisted =
        localStorage.getItem('bidwar_fan_theme') ||
        localStorage.getItem('bidwar_theme') ||
        localStorage.getItem('theme');
      if (persisted === 'light' || persisted === 'dark') {
        return persisted;
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('bidwar_fan_theme', theme);
      localStorage.setItem('bidwar_theme', theme);
      localStorage.setItem('theme', theme);
    } catch {}
    document.documentElement.className = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('bidwar_fan_theme', next);
        localStorage.setItem('bidwar_theme', next);
        localStorage.setItem('theme', next);
      } catch {}
      return next;
    });
  }, []);

  return (
    <WouterRouter base={BASE}>
      <BrandingEffects />
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
