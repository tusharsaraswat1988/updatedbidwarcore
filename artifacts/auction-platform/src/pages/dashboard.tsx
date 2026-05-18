import { useState } from "react";
import { useLocation } from "wouter";
import { useListTournaments } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Calendar, MapPin, Activity, Trophy } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: tournaments, isLoading } = useListTournaments();
  const [search, setSearch] = useState("");

  const filteredTournaments = tournaments?.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.sport.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <div className="flex flex-col space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Tournaments</h1>
            <p className="text-muted-foreground mt-2">Manage all your sports auctions across franchises.</p>
          </div>
          <Button size="lg" onClick={() => setLocation("/tournament/new")} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-5 h-5" />
            New Tournament
          </Button>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search tournaments..." 
            className="pl-9 bg-card border-border h-11"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-48 animate-pulse bg-card/50" />
            ))}
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-24 bg-card/50 border border-border rounded-xl">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">No tournaments found</h3>
            <p className="text-muted-foreground mt-1 mb-6">Get started by creating your first auction event.</p>
            <Button onClick={() => setLocation("/tournament/new")} variant="outline">
              Create Tournament
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map(tournament => (
              <Card 
                key={tournament.id} 
                className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-[0_0_20px_rgba(234,179,8,0.1)] overflow-hidden flex flex-col"
                onClick={() => setLocation(`/tournament/${tournament.id}`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'} className={tournament.status === 'active' ? 'bg-green-500/20 text-green-500 border-green-500/20' : ''}>
                      {tournament.status.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {(tournament as { auctionCode?: string | null }).auctionCode && (
                        <Badge variant="outline" className="font-mono text-[10px] text-amber-400 border-amber-500/40 bg-amber-500/10">
                          {(tournament as { auctionCode?: string | null }).auctionCode}
                        </Badge>
                      )}
                      <Badge variant="outline" className="uppercase font-mono text-[10px]">
                        {tournament.sport}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-2xl mt-4 line-clamp-1 group-hover:text-primary transition-colors">
                    {tournament.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 opacity-70" />
                      <span>{tournament.auctionDate ? `${new Date(tournament.auctionDate).toLocaleDateString()}${(tournament as { auctionTime?: string | null }).auctionTime ? ` · ${(tournament as { auctionTime?: string | null }).auctionTime}` : ""}` : 'Date TBD'}</span>
                    </div>
                    {tournament.venue && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 opacity-70" />
                        <span className="line-clamp-1">{tournament.venue}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-4 border-t border-border mt-4">
                      <Activity className="w-4 h-4 opacity-70" />
                      <span className="font-medium text-foreground">Base Purse: {formatIndianRupee(tournament.basePurse)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
