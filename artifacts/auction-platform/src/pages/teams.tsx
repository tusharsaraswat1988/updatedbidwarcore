import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useListTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Wallet, ExternalLink, Copy, Check } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

function TeamForm({ tournamentId, team, onClose }: { tournamentId: number; team?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const [form, setForm] = useState({
    name: team?.name || "",
    shortCode: team?.shortCode || "",
    ownerName: team?.ownerName || "",
    ownerMobile: team?.ownerMobile || "",
    color: team?.color || "#3B82F6",
    purse: team?.purse || 10000000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (team) {
      await updateTeam.mutateAsync({ tournamentId, teamId: team.id, data: form });
    } else {
      await createTeam.mutateAsync({ tournamentId, data: form });
    }
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Team Name</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Mumbai Hawks" />
        </div>
        <div className="space-y-2">
          <Label>Short Code</Label>
          <Input value={form.shortCode} onChange={e => setForm(f => ({ ...f, shortCode: e.target.value.toUpperCase() }))} required placeholder="MHK" maxLength={5} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Owner Name</Label>
          <Input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} required placeholder="Ravi Mehta" />
        </div>
        <div className="space-y-2">
          <Label>Owner Mobile</Label>
          <Input value={form.ownerMobile} onChange={e => setForm(f => ({ ...f, ownerMobile: e.target.value }))} placeholder="+91 9999999999" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Team Color</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-12 h-10 rounded cursor-pointer border border-border bg-transparent" />
            <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="#3B82F6" className="font-mono" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Purse (₹)</Label>
          <Input type="number" value={form.purse} onChange={e => setForm(f => ({ ...f, purse: parseInt(e.target.value) || 0 }))} required />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" disabled={createTeam.isPending || updateTeam.isPending}>
          {team ? "Update Team" : "Add Team"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={copy} title="Copy owner link">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

export default function Teams() {
  const [, params] = useRoute("/tournament/:id/teams");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const { data: teams, isLoading } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const deleteTeam = useDeleteTeam();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  async function handleDelete(teamId: number) {
    if (!confirm("Remove this team?")) return;
    await deleteTeam.mutateAsync({ tournamentId, teamId });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
  }

  function getOwnerLink(teamId: number) {
    return `${location.origin}/tournament/${tournamentId}/owner/${teamId}`;
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Teams</h1>
            <p className="text-muted-foreground mt-2">{teams?.length || 0} teams registered in this auction.</p>
          </div>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2" onClick={() => setEditing(null)}>
                <Plus className="w-5 h-5" /> Add Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg dark">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Team" : "Add New Team"}</DialogTitle>
              </DialogHeader>
              <TeamForm tournamentId={tournamentId} team={editing} onClose={() => { setOpen(false); setEditing(null); }} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams?.map(team => {
              const ownerLink = getOwnerLink(team.id);
              return (
                <Card key={team.id} className="overflow-hidden border-border hover:border-primary/30 transition-all">
                  <div className="h-2" style={{ backgroundColor: team.color || "#444" }} />
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-sm"
                          style={{ backgroundColor: `${team.color}22`, color: team.color || "#fff", border: `1px solid ${team.color}44` }}
                        >
                          {team.shortCode}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{team.name}</h3>
                          <p className="text-xs text-muted-foreground">{team.ownerName}</p>
                          {team.ownerMobile && <p className="text-xs text-muted-foreground font-mono">{team.ownerMobile}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(team); setOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(team.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Wallet className="w-4 h-4" />
                        <span>Purse: <span className="text-foreground font-semibold">{formatShortIndianRupee(team.purse)}</span></span>
                      </div>
                      <Badge
                        variant={team.isBiddingEnabled ? "default" : "secondary"}
                        className={team.isBiddingEnabled ? "bg-green-500/20 text-green-400 border-green-500/20" : ""}
                      >
                        {team.isBiddingEnabled ? "Bidding ON" : "Blocked"}
                      </Badge>
                    </div>

                    {/* Owner Panel Link */}
                    <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner Panel Link</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">{ownerLink}</p>
                      </div>
                      <CopyButton text={ownerLink} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                        onClick={() => navigate(`/tournament/${tournamentId}/owner/${team.id}`)}
                        title="Open owner panel"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Card
              className="border-dashed border-2 border-border hover:border-primary/50 cursor-pointer transition-all flex items-center justify-center h-52"
              onClick={() => { setEditing(null); setOpen(true); }}
            >
              <div className="text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Add Team</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
