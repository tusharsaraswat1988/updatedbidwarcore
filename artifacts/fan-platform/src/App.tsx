import React from 'react';
import { Route, Switch } from 'wouter';
import { HomePage } from './pages/HomePage';
import { TournamentDetail } from './pages/TournamentDetail';
import './styles/global.css';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/tournament/:slug" component={TournamentDetail} />
        <Route>404: Page Not Found</Route>
      </Switch>
    </div>
  );
}
