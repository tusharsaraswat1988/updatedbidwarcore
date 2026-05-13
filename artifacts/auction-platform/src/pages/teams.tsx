import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useListTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useGetTournament,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Wallet, ExternalLink, Copy, Check, KeyRound, RefreshCw, Wand2, AlertTriangle } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

function compressImageToDataUrl(file: File, maxPx = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.onerror = reject;
      img.src = ev.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function generateShortCode(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3);
  const initials = words.map(w => w[0]).join("");
  return initials.slice(0, 3);
}

function makeUniqueCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i <= 9; i++) {
    const candidate = (base.slice(0, 2) + i).toUpperCase();
    if (!taken.has(candidate)) return candidate;
  }
  for (let i = 65; i <= 90; i++) {
    const candidate = (base.slice(0, 2) + String.fromCharCode(i)).toUpperCase();
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

function TeamForm({
  tournamentId, team, existingShortCodes, basePurse, onClose,
}: {
  tournamentId: number;
  team?: any;
  existingShortCodes: string[];
  basePurse: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const isNew = !team;

  const [form, setForm] = useState({
    name: team?.name || "",
    shortCode: team?.shortCode || "",
    ownerName: team?.ownerName || "",
    ownerMobile: team?.ownerMobile || "",
    color: team?.color || "#3B82F6",
    purse: team?.purse || basePurse,
    logoUrl: team?.logoUrl || "",
  });
  const [shortCodeManuallyEdited, setShortCodeManuallyEdited] = useState(!isNew);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState("");

  const takenCodes = new Set(
    existingShortCodes.filter(c => !team || c !== team.shortCode)
  );

  useEffect(() => {
    if (isNew && !shortCodeManuallyEdited && form.name) {
      const base = generateShortCode(form.name);
      const unique = makeUniqueCode(base, takenCodes);
      setForm(f => ({ ...f, shortCode: unique }));
    }
  }, [form.name, isNew, shortCodeManuallyEdited]);

  const shortCodeDuplicate = takenCodes.has(form.shortCode.toUpperCase());

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setForm(f => ({ ...f, logoUrl: dataUrl }));
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (shortCodeDuplicate) {
      setError(`Short code "${form.shortCode.toUpperCase()}" is already taken by another team`);
      return;
    }
    try {
      if (team) {
        await updateTeam.mutateAsync({ tournamentId, teamId: team.id, data: form });
      } else {
        await createTeam.mutateAsync({ tournamentId, data: form });
      }
      qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to save team");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Team Name (full width) */}
      <div className="space-y-2">
        <Label>Team Name</Label>
        <Input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
          placeholder="Mumbai Hawks"
        />
      </div>

      {/* Short Code — auto-generated, editable */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          Short Code
          {isNew && !shortCodeManuallyEdited && (
            <span className="text-[10px] font-normal text-primary flex items-center gap-0.5">
              <Wand2 className="w-3 h-3" /> auto-generated
            </span>
          )}
        </Label>
        <div className="relative">
          <Input
            value={form.shortCode}
            onChange={e => {
              setShortCodeManuallyEdited(true);
              setForm(f => ({ ...f, shortCode: e.target.value.toUpperCase() }));
            }}
            required
            placeholder="CSK"
            maxLength={5}
            className={shortCodeDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {isNew && shortCodeManuallyEdited && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
              onClick={() => {
                setShortCodeManuallyEdited(false);
                const base = generateShortCode(form.name);
                const unique = makeUniqueCode(base, takenCodes);
                setForm(f => ({ ...f, shortCode: unique }));
              }}
            >
              <Wand2 className="w-3 h-3" /> reset
            </button>
          )}
        </div>
        {shortCodeDuplicate && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            This code is already used — please choose a different one
          </p>
        )}
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
        {/* Purse — only show when editing existing team */}
        {!isNew && (
          <div className="space-y-2">
            <Label>Purse (₹)</Label>
            <Input type="number" value={form.purse} onChange={e => setForm(f => ({ ...f, purse: parseInt(e.target.value) || 0 }))} required />
          </div>
        )}
      </div>

      {/* Purse info for new teams */}
      {isNew && (
        <div className="flex items-center gap-2 rounded-md bg-muted/20 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
          <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
          Purse automatically set to <span className="text-foreground font-semibold ml-1">{formatShortIndianRupee(basePurse)}</span>
          <span className="ml-1">(from Auction Hub settings)</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>Team Logo</Label>
        <div className="flex items-center gap-3">
          {form.logoUrl && (
            <img src={form.logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded border border-border flex-shrink-0" onError={e => (e.currentTarget.style.display = "none")} />
          )}
          <div className="flex-1 space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors">
                {logoUploading ? "Uploading..." : "Upload Logo"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} disabled={logoUploading} />
            </label>
            <p className="text-[10px] text-muted-foreground">PNG, JPG, SVG — auto-compressed to 256px</p>
          </div>
          {form.logoUrl && (
            <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setForm(f => ({ ...f, logoUrl: "" }))}>Remove</button>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" disabled={createTeam.isPending || updateTeam.isPending || logoUploading || shortCodeDuplicate}>
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
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const deleteTeam = useDeleteTeam();
  const updateTeam = useUpdateTeam();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const existingShortCodes = (teams || []).map(t => t.shortCode);
  const basePurse = tournament?.basePurse ?? 10000000;

  async function handleDelete(teamId: number) {
    if (!confirm("Remove this team?")) return;
    await deleteTeam.mutateAsync({ tournamentId, teamId });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
  }

  async function handleRegenerateCode(teamId: number) {
    if (!confirm("Regenerate access code? The old code will stop working immediately.")) return;
    await updateTeam.mutateAsync({ tournamentId, teamId, data: { regenerateCode: true } });
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
              <TeamForm
                tournamentId={tournamentId}
                team={editing}
                existingShortCodes={existingShortCodes}
                basePurse={basePurse}
                onClose={() => { setOpen(false); setEditing(null); }}
              />
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

                    {/* Access Code */}
                    {team.accessCode && (
                      <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                        <KeyRound className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner Access Code</p>
                          <p className="text-sm font-display font-black tracking-[0.2em] text-primary">{team.accessCode}</p>
                        </div>
                        <CopyButton text={team.accessCode} />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                          title="Regenerate access code"
                          disabled={updateTeam.isPending}
                          onClick={() => handleRegenerateCode(team.id)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

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
