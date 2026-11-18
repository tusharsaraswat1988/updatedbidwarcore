import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/client';
import { TournamentSummary } from '../lib/api/types';
import { ActivityTicker } from '../components/ActivityTicker';
import { Header } from '../components/Header';
import { Link } from 'wouter';

export const HomePage = () => {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);

  useEffect(() => {
    apiClient.getTournaments().then(setTournaments);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Header />
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <ActivityTicker />
        
        {/* Featured Hero */}
        <section className="my-8 p-8 bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
          <h2 className="text-sm uppercase tracking-widest text-yellow-500 mb-2">Featured Live</h2>
          <h1 className="text-5xl font-bold mb-4">{tournaments[0]?.name || 'Loading...'}</h1>
          <Link href={`/tournament/${tournaments[0]?.slug}`} className="inline-block bg-yellow-500 text-slate-900 px-6 py-2 rounded-full font-bold hover:bg-yellow-400 transition">
            View Tournament
          </Link>
        </section>

        {/* Discovery Grid */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Discover Tournaments</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tournaments.map(t => (
              <div key={t.slug} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-yellow-500 transition shadow-lg">
                <h3 className="text-lg font-bold mb-2">{t.name}</h3>
                <div className="flex gap-2 mb-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'LIVE' ? 'bg-red-500' : 'bg-blue-600'}`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-4">{t.summary}</p>
                <Link href={`/tournament/${t.slug}`} className="text-yellow-500 font-bold hover:underline">
                  View Details →
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
