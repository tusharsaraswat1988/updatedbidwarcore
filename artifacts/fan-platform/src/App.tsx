import React, { useState, useEffect } from 'react';
import { Route, Switch } from 'wouter';
import { HomePage } from './pages/HomePage';
import { TournamentDetail } from './pages/TournamentDetail';
import './styles/global.css';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);
  
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Switch>
        <Route path="/">
          <HomePage toggleTheme={toggleTheme} theme={theme} />
        </Route>
        <Route path="/tournament/:slug" component={TournamentDetail} />
        <Route>404: Page Not Found</Route>
      </Switch>
    </div>
  );
}
