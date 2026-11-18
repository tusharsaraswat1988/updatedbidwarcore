import React from 'react';
import { Route, Switch, Link } from 'wouter';
import { HomePage } from './pages/HomePage';
import { TournamentDetail } from './pages/TournamentDetail';
import './styles/global.css';

export default function App() {
  return (
    <div className="app-shell min-h-screen bg-slate-900 text-white">
      <nav className="p-4 border-b border-slate-700">
        <Link href="/" className="text-xl font-bold">BidWar Fan</Link>
      </nav>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/tournament/:slug" component={TournamentDetail} />
        <Route>404: Page Not Found</Route>
      </Switch>
    </div>
  );
}
