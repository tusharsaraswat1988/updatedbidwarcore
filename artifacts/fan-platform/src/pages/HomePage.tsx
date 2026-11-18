import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/client';
import { TournamentSummary } from '../lib/api/types';
import { ActivityTicker } from '../components/ActivityTicker';
import { Link } from 'wouter';

export const HomePage = () => {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);

  useEffect(() => {
    apiClient.getTournaments().then(setTournaments);
  }, []);

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-6">BidWar Fan Platform</h1>
      <ActivityTicker />
      
      <section className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Tournaments</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tournaments.map(t => (
            <Link key={t.slug} href={`/tournament/${t.slug}`}>
              <div className="border border-slate-700 p-4 rounded-lg hover:border-yellow-500 cursor-pointer">
                <h3 className="font-bold">{t.name}</h3>
                <span className={`text-xs px-2 py-1 rounded ${t.status === 'LIVE' ? 'bg-red-500' : 'bg-blue-500'}`}>{t.status}</span>
                <p className="text-sm mt-2">{t.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};
