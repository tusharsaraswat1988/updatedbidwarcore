import React from 'react';
import { Route, Switch, Link } from 'wouter';
import { HomePage } from './pages/HomePage';
import './styles/global.css';

export default function App() {
  return (
    <div className="app-shell">
      <nav className="nav-bar">
        <Link href="/">BidWar Fan</Link>
      </nav>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route>404: Page Not Found</Route>
      </Switch>
    </div>
  );
}
