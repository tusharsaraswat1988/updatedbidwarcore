import React, { useState } from "react";
import { Search, Filter, Trophy } from "lucide-react";
import { FanDiscoveryCard } from "@/components/fan/FanDiscoveryCard";

export function UniversalFanHome() {
  const [search, setSearch] = useState("");

  // Mock data for demonstration - in production this will be fetched via hook
  const tournaments = [
    { id: 1, name: "BPL Season 2026", sport: "Cricket", city: "Mumbai", startDate: "Oct 20, 2026", status: "upcoming" as const, teamCount: 8, playerCount: 120 },
    { id: 2, name: "Royal Badminton Open", sport: "Badminton", city: "Delhi", startDate: "Nov 01, 2026", status: "live" as const, teamCount: 4, playerCount: 32 },
  ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold">Fan Arena</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Discover and follow your favorite tournaments</p>
        </div>
        
        {/* Search & Filter */}
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                <input 
                    type="text" 
                    placeholder="Search tournaments..." 
                    className="pl-9 pr-4 py-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <button className="p-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl hover:bg-[hsl(var(--accent))] transition-colors">
                <Filter className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            </button>
        </div>
      </div>

      {/* Grid */}
      {tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map(t => <FanDiscoveryCard key={t.id} tournament={t} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[hsl(var(--muted-foreground))]">
            <Trophy className="w-12 h-12 mb-4 opacity-20" />
            <p>No tournaments found</p>
        </div>
      )}
    </div>
  );
}
