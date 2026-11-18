import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api/client';
import { TournamentSummary } from '../lib/api/types';
import { ActivityTicker } from '../components/ActivityTicker';
import { Header } from '../components/Header';
import { Link } from 'wouter';
import { Trophy, Users, MapPin, Search } from 'lucide-react';

export const HomePage = ({ toggleTheme, theme }: { toggleTheme: () => void, theme: 'dark' | 'light' }) => {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    apiClient.getTournaments().then(setTournaments);
  }, []);

  const filtered = tournaments.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Header toggleTheme={toggleTheme} theme={theme} />
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <ActivityTicker />
        
        {/* Search */}
        <div className="my-6 relative">
          <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Search size={20} /> Search Tournaments...
          </button>
          {isSearchOpen && (
            <input 
              autoFocus
              className="mt-2 w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700"
              placeholder="Enter tournament name..."
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </div>

        {/* Featured Hero */}
        <section className="my-8 p-8 bg-gradient-to-r from-yellow-600 to-amber-700 dark:from-yellow-700 dark:to-amber-900 rounded-2xl text-white shadow-xl">
          <div className="max-w-2xl">
            <h2 className="text-sm uppercase tracking-widest mb-2 font-bold opacity-90">Featured Live - {tournaments[0]?.name.split(' ')[0]}</h2>
            <h1 className="text-5xl font-bold mb-4">{tournaments[0]?.name || 'Loading...'}</h1>
            <div className="flex gap-4 mb-6 text-sm opacity-90">
              <span className="flex items-center gap-1"><Trophy size={16}/> Professional Series</span>
              <span className="flex items-center gap-1"><Users size={16}/> 12 Teams Active</span>
            </div>
            <Link href={`/tournament/${tournaments[0]?.slug}`} className="inline-block bg-white text-yellow-800 px-6 py-2 rounded-full font-bold hover:bg-slate-100 transition">
              View Tournament
            </Link>
          </div>
        </section>

        {/* Discovery Grid */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Discover Tournaments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(t => (
              <div key={t.slug} className="group bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-yellow-500 transition-all shadow-md">
                <div className="h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                  <Trophy size={48} className="text-slate-400 dark:text-slate-600" />
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase text-white ${t.status === 'LIVE' ? 'bg-red-500' : t.status === 'SOON' ? 'bg-blue-600' : 'bg-slate-500'}`}>
                      {t.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{t.name}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">{t.summary}</p>
                  <Link href={`/tournament/${t.slug}`} className="block text-center text-yellow-600 dark:text-yellow-500 font-bold hover:underline">
                    View Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
