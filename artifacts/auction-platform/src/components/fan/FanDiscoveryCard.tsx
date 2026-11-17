import React from "react";
import { Link } from "wouter";
import { Calendar, MapPin, Users, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface FanDiscoveryCardProps {
  tournament: {
    id: number;
    name: string;
    sport: string;
    city: string;
    startDate: string;
    logoUrl?: string | null;
    status: "upcoming" | "live" | "completed";
    teamCount: number;
    playerCount: number;
  };
}

export function FanDiscoveryCard({ tournament }: FanDiscoveryCardProps) {
  return (
    <Link href={`/tournament/${tournament.id}/fan`}>
      <div className="group relative flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 hover:border-[hsl(var(--primary))] transition-all duration-200 hover:shadow-lg cursor-pointer">
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-10">
          <div className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", 
            tournament.status === "live" ? "bg-red-500/10 border-red-500/30 text-red-500" :
            tournament.status === "upcoming" ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
            "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
          )}>
            {tournament.status}
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-4 items-start">
            <div className="w-16 h-16 rounded-xl bg-[hsl(var(--muted))] overflow-hidden flex-shrink-0">
                {tournament.logoUrl ? (
                    <img src={tournament.logoUrl} alt={tournament.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                        <Award className="w-6 h-6" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate pr-16">{tournament.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{tournament.city}</span>
                    <span>•</span>
                    <span>{tournament.sport}</span>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-[hsl(var(--border))]">
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <Calendar className="w-3.5 h-3.5" />
                <span>{tournament.startDate}</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-[hsl(var(--foreground))]">
                <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                    <span>{tournament.teamCount} Teams</span>
                </div>
                <span>{tournament.playerCount} Players</span>
            </div>
        </div>
      </div>
    </Link>
  );
}
