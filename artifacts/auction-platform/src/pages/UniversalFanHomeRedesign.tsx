import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, MapPin, Star, Radio, Calendar, ChevronRight, Filter } from "lucide-react";
import { useFanFavorites } from "@/hooks/use-fan-favorites";
import { cn } from "@/lib/utils";
import { formatFanDate } from "@/lib/fan-date-utils";

interface FanDiscoveryCard {
  id: number;
  name: string;
  sport: string;
  city: string | null;
  venue: string | null;
  status: string;
  auctionDate: string | null;
  matchDates: string | null;
  isLive: boolean;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
}

interface FanDiscoveryResponse {
  items: FanDiscoveryCard[];
}

export default function UniversalFanHomeRedesign() {
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sportFilter, setSportFilter] = useState("all");
  const { isFavorite, toggleFavorite } = useFanFavorites();

  const { data } = useQuery<FanDiscoveryResponse>({
    queryKey: ["/api/fan/tournaments", search],
    queryFn: async () => {
      const res = await fetch(`/api/fan/tournaments?search=${search}`);
      return res.json();
    },
    staleTime: 15_000,
  });

  const spotlight = useMemo(() => data?.items.find(t => t.isLive) || data?.items[0], [data]);
  const upcoming = useMemo(() => data?.items.filter(t => !t.isLive && t.status !== 'completed').slice(0, 3) || [], [data]);

  const filteredTournaments = useMemo(() => {
    let items = data?.items || [];
    if (sportFilter !== "all") items = items.filter(t => t.sport === sportFilter);
    return items;
  }, [data, sportFilter]);

  return (
    <div className={`fan-arena-theme ${theme}`}>
      <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] transition-colors duration-300">
        
        {/* Header */}
        <header className="border-b border-[hsl(var(--border))] sticky top-0 bg-[hsl(var(--background))/80] backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="font-display font-black text-2xl tracking-tighter text-[hsl(var(--primary))]">BIDWAR</h1>
            <div className="flex items-center gap-6">
                <nav className="flex gap-6 text-xs font-bold uppercase tracking-widest">
                    <a href="#" className="text-[hsl(var(--primary))]">Discover</a>
                    <a href="#">Live</a>
                </nav>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 bg-[hsl(var(--card))] rounded-full">
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 space-y-12">
          {/* Hero Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {spotlight && (
                <div className="lg:col-span-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-8 rounded-3xl relative flex flex-col justify-end">
                    <span className="flex items-center gap-2 text-[hsl(var(--live))] font-bold text-xs uppercase mb-4"><Radio className="w-4 h-4" /> Live Now</span>
                    <h2 className="font-display font-black text-4xl">{spotlight.name}</h2>
                    <p className="mt-2 text-[hsl(var(--muted-foreground))]">{spotlight.sport} • {spotlight.city || 'TBD'}</p>
                    <Link to={`/tournament/${spotlight.id}/fan`} className="inline-block mt-6 bg-[hsl(var(--primary))] text-[hsl(var(--background))] px-6 py-2 rounded-xl text-sm font-bold">Enter Arena</Link>
                </div>
            )}
            
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-8 rounded-3xl">
                <h3 className="font-display font-bold text-lg mb-4">Upcoming</h3>
                {upcoming.length > 0 ? (
                    <div className="space-y-4">
                        {upcoming.map(t => (
                            <div key={t.id} className="flex justify-between items-center text-sm">
                                <span className="font-medium truncate">{t.name}</span>
                                <span className="text-[hsl(var(--muted-foreground))] text-xs">{formatFanDate(t.auctionDate)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">No upcoming events at the moment.</p>
                )}
            </div>
          </section>

          {/* Discovery */}
          <section>
            <div className="flex justify-between items-center mb-8">
                <h2 className="font-display font-bold text-2xl">Tournaments</h2>
                <div className="flex gap-2">
                    <select onChange={e => setSportFilter(e.target.value)} className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-4 py-2 rounded-xl text-xs font-bold">
                        <option value="all">All Sports</option>
                        <option value="cricket">Cricket</option>
                        <option value="badminton">Badminton</option>
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                        <input className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] py-2 pl-10 pr-4 rounded-xl text-xs" placeholder="Search..." onChange={e => setSearch(e.target.value)}/>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredTournaments.map((t) => (
                <div key={t.id} className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-6 rounded-2xl flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                        <span className={cn("text-[10px] font-bold uppercase", t.isLive ? "text-[hsl(var(--live))]" : "text-[hsl(var(--muted-foreground))]")}>
                            {t.isLive ? 'Live' : t.status === 'completed' ? 'Completed' : 'Upcoming'}
                        </span>
                        <Star className="w-4 h-4 cursor-pointer hover:fill-[hsl(var(--primary))]" onClick={() => toggleFavorite(t.id)} />
                    </div>
                    <h3 className="font-display font-bold text-lg leading-snug">{t.name}</h3>
                    <p className="text-[hsl(var(--muted-foreground))] text-xs mt-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3"/> {t.city || 'TBD'}
                    </p>
                  </div>
                  <Link to={`/tournament/${t.id}/fan`} className="block w-full text-center mt-6 py-2 border border-[hsl(var(--border))] rounded-xl text-xs font-bold hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--background))] transition-colors">
                    View
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
