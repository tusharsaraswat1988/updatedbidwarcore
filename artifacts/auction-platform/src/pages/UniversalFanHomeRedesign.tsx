import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, MapPin, Star, Radio, Calendar, ChevronRight } from "lucide-react";
import { useFanFavorites } from "@/hooks/use-fan-favorites";
import { cn } from "@/lib/utils";
import { formatFanDate } from "@/lib/fan-date-utils";

interface FanDiscoveryCard {
  id: number;
  name: string;
  sport: string;
  city: string | null;
  status: string;
  auctionDate: string | null;
  isLive: boolean;
}

interface FanDiscoveryResponse {
  items: FanDiscoveryCard[];
}

export default function UniversalFanHomeRedesign() {
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const { isFavorite, toggleFavorite } = useFanFavorites();

  const { data, isLoading, isError, refetch } = useQuery<FanDiscoveryResponse>({
    queryKey: ["/api/fan/tournaments", search],
    queryFn: async () => {
      const res = await fetch(`/api/fan/tournaments?search=${search}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 15_000,
  });

  const spotlight = useMemo(() => data?.items.find(t => t.isLive) || data?.items[0], [data]);

  if (isLoading) return <div className="text-center p-20">Loading Arena...</div>;
  if (isError) return <div className="text-center p-20 text-rose-500">Error loading data. <button onClick={() => refetch()} className="font-bold underline">Retry</button></div>;

  return (
    <div className={`fan-arena-theme ${theme}`}>
      <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] transition-colors duration-300">
        
        {/* Header */}
        <header className="border-b border-[hsl(var(--border))]">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <h1 className="font-display font-black text-3xl tracking-tighter text-[hsl(var(--primary))]">BIDWAR</h1>
            <div className="flex items-center gap-6">
                <nav className="flex gap-6 text-sm font-bold uppercase tracking-widest">
                    <a href="#">Discover</a>
                    <a href="#" className="text-[hsl(var(--muted-foreground))]">Live</a>
                </nav>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 bg-[hsl(var(--card))] rounded-full">
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 space-y-12">
          {/* Bento-style Hero/Live */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {spotlight && (
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-10 rounded-3xl relative">
                    <span className="flex items-center gap-2 text-[hsl(var(--live))] font-bold text-xs uppercase mb-6"><Radio className="w-4 h-4" /> Live Now</span>
                    <h2 className="font-display font-black text-6xl leading-none">{spotlight.name}</h2>
                    <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">{spotlight.sport} • {spotlight.city}</p>
                    <Link to={`/tournament/${spotlight.id}/fan`} className="inline-block mt-8 bg-[hsl(var(--primary))] text-[hsl(var(--background))] px-8 py-3 rounded-xl font-bold">View Match Center</Link>
                </div>
              )}
              <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-10 rounded-3xl">
                  <h3 className="font-display font-bold text-2xl">Upcoming Events</h3>
                  <p className="mt-2 text-[hsl(var(--muted-foreground))]">Stay tuned for the next big auction.</p>
              </div>
          </section>

          {/* Discovery */}
          <section>
            <div className="flex justify-between items-center mb-8">
                <h2 className="font-display font-bold text-3xl">All Tournaments</h2>
                <div className="flex items-center gap-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-4 rounded-xl">
                    <Search className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <input className="bg-transparent py-3 text-sm focus:outline-none" placeholder="Search..." onChange={e => setSearch(e.target.value)}/>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {data?.items.map((t) => (
                <div key={t.id} className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                        <span className={cn("text-[10px] font-bold uppercase", t.isLive ? "text-[hsl(var(--live))]" : "text-[hsl(var(--muted-foreground))]")}>{t.status}</span>
                        <Star className="w-4 h-4 cursor-pointer" onClick={() => toggleFavorite(t.id)} />
                    </div>
                    <h3 className="font-display font-bold text-lg">{t.name}</h3>
                  </div>
                  <Link to={`/tournament/${t.id}/fan`} className="block w-full text-center mt-6 py-3 border border-[hsl(var(--border))] rounded-xl text-sm font-bold hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--background))] transition-colors">
                    Enter Arena
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
