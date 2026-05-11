import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListPlayers,
  useListCategories,
  useListTeams,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  getListPlayersQueryKey,
  getListCategoriesQueryKey,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, User } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

function PlayerForm({ tournamentId, player, categories, onClose }: {
  tournamentId: number;
  player?: any;
  categories: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const [form, setForm] = useState({
    name: player?.name || "",
    city: player?.city || "",
    role: player?.role || "batsman",
    battingStyle: player?.battingStyle || "",
    bowlingStyle: player?.bowlingStyle || "",
    age: player?.age ? String(player.age) : "",
    photoUrl: player?.photoUrl || "",
    basePrice: player?.basePrice || 100000,
    jerseyNumber: player?.jerseyNumber || "",
    achievements: player?.achievements || "",
    categoryId: player?.categoryId ? String(player.categoryId) : (categories[0]?.id ? String(categories[0].id) : ""),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      city: form.city || undefined,
      role: form.role,
      battingStyle: form.battingStyle || undefined,
      bowlingStyle: form.bowlingStyle || undefined,
      age: form.age ? parseInt(form.age) : undefined,
      photoUrl: form.photoUrl || undefined,
      basePrice: parseInt(String(form.basePrice)) || 0,
      jerseyNumber: form.jerseyNumber || undefined,
      achievements: form.achievements || undefined,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
    };
    if (player) {
      await updatePlayer.mutateAsync({ tournamentId, playerId: player.id, data });
    } else {
      await createPlayer.mutateAsync({ tournamentId, data });
    }
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Player Name *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Full name" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent className="dark">
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>City</Label>
          <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Mumbai" />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="dark">
              {["batsman","bowler","all-rounder","wicketkeeper","midfielder","forward","defender","goalkeeper","other"].map(r => (
                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Base Price (₹) *</Label>
          <Input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Age</Label>
          <Input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="25" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Batting Style</Label>
          <Input value={form.battingStyle} onChange={e => setForm(f => ({ ...f, battingStyle: e.target.value }))} placeholder="Right-hand" />
        </div>
        <div className="space-y-2">
          <Label>Bowling Style</Label>
          <Input value={form.bowlingStyle} onChange={e => setForm(f => ({ ...f, bowlingStyle: e.target.value }))} placeholder="Right-arm fast" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Jersey No.</Label>
          <Input value={form.jerseyNumber} onChange={e => setForm(f => ({ ...f, jerseyNumber: e.target.value }))} placeholder="7" />
        </div>
        <div className="space-y-2">
          <Label>Photo URL</Label>
          <Input value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://..." />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Achievements</Label>
        <Input value={form.achievements} onChange={e => setForm(f => ({ ...f, achievements: e.target.value }))} placeholder="Player of the Season 2024..." />
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" disabled={createPlayer.isPending || updatePlayer.isPending}>
          {player ? "Update Player" : "Add Player"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

const statusColors: Record<string, string> = {
  available: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  sold: "bg-green-500/20 text-green-400 border-green-500/20",
  unsold: "bg-red-500/20 text-red-400 border-red-500/20",
};

export default function Players() {
  const [, params] = useRoute("/tournament/:id/players");
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const { data: players, isLoading } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: categories } = useListCategories(tournamentId, {
    query: { queryKey: getListCategoriesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const deletePlayer = useDeletePlayer();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  async function handleDelete(playerId: number) {
    if (!confirm("Remove this player?")) return;
    await deletePlayer.mutateAsync({ tournamentId, playerId });
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
  }

  const filtered = (players || []).filter(p => {
    const matchesTab = tab === "all" || p.status === tab;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.city || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.role || "").toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const catMap = Object.fromEntries((categories || []).map(c => [c.id, c]));
  const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t]));

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Players</h1>
            <p className="text-muted-foreground mt-2">{players?.length || 0} players registered.</p>
          </div>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2" onClick={() => setEditing(null)}>
                <Plus className="w-5 h-5" /> Add Player
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg dark">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Player" : "Add Player"}</DialogTitle>
              </DialogHeader>
              <PlayerForm
                tournamentId={tournamentId}
                player={editing}
                categories={categories || []}
                onClose={() => { setOpen(false); setEditing(null); }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-card">
              <TabsTrigger value="all">All ({players?.length || 0})</TabsTrigger>
              <TabsTrigger value="available">Available</TabsTrigger>
              <TabsTrigger value="sold">Sold</TabsTrigger>
              <TabsTrigger value="unsold">Unsold</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(player => {
              const cat = player.categoryId ? catMap[player.categoryId] : null;
              const team = player.teamId ? teamMap[player.teamId] : null;
              return (
                <Card key={player.id} className="border-border hover:border-primary/20 transition-all">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {player.photoUrl ? (
                        <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{player.name}</h3>
                        {player.jerseyNumber && (
                          <span className="text-xs text-muted-foreground font-mono">#{player.jerseyNumber}</span>
                        )}
                        <Badge variant="outline" className={statusColors[player.status] || ""}>{player.status}</Badge>
                        {cat && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ color: cat.colorCode || "#F59E0B", borderColor: `${cat.colorCode}44` }}
                          >
                            {cat.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {player.city && <span>{player.city}</span>}
                        {player.role && <span className="capitalize">· {player.role}</span>}
                        {player.age && <span>· Age {player.age}</span>}
                        {team && (
                          <span className="font-semibold" style={{ color: team.color || "#fff" }}>· {team.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-primary">{formatIndianRupee(player.soldPrice || player.basePrice)}</p>
                      <p className="text-xs text-muted-foreground">{player.soldPrice ? "sold" : "base"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(player); setOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(player.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No players found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
