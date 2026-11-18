import React from 'react';
import { Link } from 'wouter';

export const Header = () => (
  <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center">
    <div className="text-2xl font-bold text-yellow-500">BIDWAR</div>
    <nav className="flex gap-4">
      <Link href="/" className="text-slate-300 hover:text-white">Home</Link>
      <button className="text-slate-300">Search</button>
      <button className="text-slate-300">Theme</button>
    </nav>
  </header>
);
