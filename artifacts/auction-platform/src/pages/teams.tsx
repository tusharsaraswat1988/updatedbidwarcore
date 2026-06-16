import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useListTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useGetTournament,
  useGetTeamPurses,
  useGetAuctionState,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
  getGetTeamPursesQueryKey,
  getGetAuctionStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Wallet, ExternalLink, Copy, Check, KeyRound, RefreshCw, Wand2, AlertTriangle, Upload, Image as ImageIcon, X, ShieldAlert, Star, TrendingDown } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { OptionalEmailField } from "@/components/optional-email-field";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageEditorDialog } from "@/components/image-editor-dialog";

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

const DEFAULT_TEAM_COLORS = [
  "#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#A855F7", "#EC4899",
  "#06B6D4", "#F97316", "#14B8A6", "#8B5CF6", "#E11D48", "#84CC16",
  "#0EA5E9", "#D97706", "#10B981", "#6366F1",
] as const;

function normalizeHexColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return hex.toUpperCase();
}

function pickNextTeamColor(usedColors: (string | null | undefined)[]): string {
  const used = new Set(
    usedColors.map(normalizeHexColor).filter((c): c is string => !!c),
  );
  const available = DEFAULT_TEAM_COLORS.find(c => !used.has(c));
  if (available) return available;
  const index = used.size % DEFAULT_TEAM_COLORS.length;
  return DEFAULT_TEAM_COLORS[index];
}

function TeamForm({
  tournamentId, team, existingShortCodes, existingTeamColors, basePurse, onClose,
}: {
  tournamentId: number;
  team?: any;
  existingShortCodes: string[];
  existingTeamColors: (string | null | undefined)[];
  basePurse: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const isNew = !team;
  const defaultNewColor = pickNextTeamColor(existingTeamColors);

  const [form, setForm] = useState({
    name: team?.name || "",
    shortCode: team?.shortCode || "",
    ownerName: team?.ownerName || "",
    ownerMobile: team?.ownerMobile ? sanitizeMobileInput(team.ownerMobile) : "",
    ownerEmail: team?.ownerEmail || "",
    ownerPhotoUrl: team?.ownerPhotoUrl && !team.ownerPhotoUrl.startsWith("data:") ? team.ownerPhotoUrl : "",
    color: team?.color || defaultNewColor,
    purse: team?.purse || basePurse,
    logoUrl: team?.logoUrl && !team.logoUrl.startsWith("data:") ? team.logoUrl : "",
  });
  const [shortCodeManuallyEdited, setShortCodeManuallyEdited] = useState(!isNew);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [ownerPhotoEditorOpen, setOwnerPhotoEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [ownerEmailError, setOwnerEmailError] = useState("");

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

  useEffect(() => {
    setForm({
      name: team?.name || "",
      shortCode: team?.shortCode || "",
      ownerName: team?.ownerName || "",
      ownerMobile: team?.ownerMobile ? sanitizeMobileInput(team.ownerMobile) : "",
      ownerEmail: team?.ownerEmail || "",
      ownerPhotoUrl: team?.ownerPhotoUrl && !team.ownerPhotoUrl.startsWith("data:") ? team.ownerPhotoUrl : "",
      color: team?.color || pickNextTeamColor(existingTeamColors),
      purse: team?.purse || basePurse,
      logoUrl: team?.logoUrl && !team.logoUrl.startsWith("data:") ? team.logoUrl : "",
    });
    setShortCodeManuallyEdited(!isNew);
    setError("");
    setOwnerEmailError("");
  }, [team?.id, team?.ownerPhotoUrl, team?.logoUrl, team?.name, team?.ownerName, team?.ownerMobile, team?.ownerEmail, team?.shortCode, team?.color, team?.purse, basePurse, isNew, existingTeamColors]);

  const shortCodeDuplicate = takenCodes.has(form.shortCode.toUpperCase());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOwnerEmailError("");
    const mobileResult = parseIndianMobile(form.ownerMobile);
    if (!mobileResult.ok) {
      setError(mobileResult.error);
      return;
    }
    const ownerEmailResult = parseOptionalEmail(form.ownerEmail);
    if (!ownerEmailResult.ok) {
      setOwnerEmailError(ownerEmailResult.error);
      return;
    }
    if (shortCodeDuplicate) {
      setError(`Short code "${form.shortCode.toUpperCase()}" is already taken by another team`);
      return;
    }
    const payload = {
      name: form.name.trim(),
      shortCode: form.shortCode.trim().toUpperCase(),
      ownerName: form.ownerName.trim(),
      ownerMobile: mobileResult.normalized,
      ownerEmail: ownerEmailResult.email || "",
      ownerPhotoUrl: form.ownerPhotoUrl.trim() || "",
      color: form.color,
      logoUrl: form.logoUrl.trim() || "",
      ...(team ? { purse: form.purse } : {}),
    };
    try {
      if (team) {
        await updateTeam.mutateAsync({ tournamentId, teamId: team.id, data: payload });
      } else {
        await createTeam.mutateAsync({ tournamentId, data: payload });
      }
      await qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
      onClose();
    } catch (err: any) {
      const body = err?.response?.data;
      if (body?.field === "ownerEmail") {
        setOwnerEmailError(body.error || "Please enter a valid email address");
        return;
      }
      setError(body?.error || err?.message || "Failed to save team");
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
        <Label>Team Name <span className="text-destructive">*</span></Label>
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
          Short Code <span className="text-destructive">*</span>
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
          <Label>Owner Name <span className="text-destructive">*</span></Label>
          <Input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} required placeholder="Ravi Mehta" />
        </div>
        <div className="space-y-2">
          <Label>Owner Mobile <span className="text-destructive">*</span></Label>
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={form.ownerMobile}
            onChange={e => setForm(f => ({ ...f, ownerMobile: sanitizeMobileInput(e.target.value) }))}
            required
            placeholder="10-digit mobile (e.g. 9876543210)"
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">Digits only — must start with 6, 7, 8, or 9.</p>
        </div>
      </div>

      <OptionalEmailField
        id="owner-email"
        label="Owner Email Address (Optional)"
        value={form.ownerEmail}
        onChange={v => { setForm(f => ({ ...f, ownerEmail: v })); if (ownerEmailError) setOwnerEmailError(""); }}
        error={ownerEmailError || undefined}
      />

      <div className="space-y-2">
        <Label>Owner Photo <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
        <div className="flex items-start gap-3">
          {form.ownerPhotoUrl ? (
            <img
              src={form.ownerPhotoUrl}
              alt="Owner"
              className="h-12 w-12 flex-shrink-0 rounded-full border border-border object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => setOwnerPhotoEditorOpen(true)}
              >
                {form.ownerPhotoUrl ? <><Pencil className="w-3.5 h-3.5" /> Change Photo</> : <><Upload className="w-3.5 h-3.5" /> Upload Photo</>}
              </Button>
              {form.ownerPhotoUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setForm(f => ({ ...f, ownerPhotoUrl: "" }))}
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Shown on team reports when uploaded.</p>
          </div>
        </div>
        <ImageEditorDialog
          open={ownerPhotoEditorOpen}
          onClose={() => setOwnerPhotoEditorOpen(false)}
          initialUrl={form.ownerPhotoUrl || undefined}
          aspect={1}
          title="Owner Photo"
          onSave={url => setForm(f => ({ ...f, ownerPhotoUrl: url }))}
        />
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
            <Label>Purse (₹) <span className="text-destructive">*</span></Label>
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
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => setLogoEditorOpen(true)}
              >
                {form.logoUrl ? <><Pencil className="w-3.5 h-3.5" /> Edit Logo</> : <><Upload className="w-3.5 h-3.5" /> Upload Logo</>}
              </Button>
              {form.logoUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  onClick={() => setForm(f => ({ ...f, logoUrl: "" }))}
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>
        <ImageEditorDialog
          open={logoEditorOpen}
          onClose={() => setLogoEditorOpen(false)}
          initialUrl={form.logoUrl || undefined}
          aspect={1}
          title="Team Logo"
          onSave={url => setForm(f => ({ ...f, logoUrl: url }))}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          className="flex-1"
          disabled={createTeam.isPending || updateTeam.isPending || shortCodeDuplicate}
        >
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
  const { data: auctionState } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const isAuctionEnded =
    tournament?.status === "completed" ||
    auctionState?.licenseStatus === "completed" ||
    auctionState?.status === "completed";
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const deleteTeam = useDeleteTeam();
  const updateTeam = useUpdateTeam();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<number | null>(null);

  const existingShortCodes = (teams || []).map(t => t.shortCode);
  const existingTeamColors = useMemo(() => (teams || []).map(t => t.color), [teams]);
  const basePurse = tournament?.basePurse ?? 10000000;

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteTeam.mutateAsync({ tournamentId, teamId: deleteTarget.id });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
    setDeleteTarget(null);
  }

  function handleRegenerateCode(teamId: number) {
    setRegenerateTarget(teamId);
  }

  async function confirmRegenerateCode() {
    if (!regenerateTarget) return;
    await updateTeam.mutateAsync({
      tournamentId,
      teamId: regenerateTarget,
      data: { regenerateCode: true },
    });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
    setRegenerateTarget(null);
  }

  function getOwnerLink(teamId: number) {
    return `${location.origin}/owner-app/join?tournamentId=${tournamentId}&teamId=${teamId}`;
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8">
        {/* T011: flow guard — remind organiser once exactly 1 team added */}
        {!isLoading && (teams?.length ?? 0) === 1 && !isAuctionEnded && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex items-start gap-3 max-w-xl">
            <Users className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 text-sm">Teams: 1 of 2 — add one more</p>
              <p className="text-xs text-muted-foreground mt-1">
                An auction needs at least 2 teams bidding against each other. Add a second franchise to continue.
              </p>
            </div>
          </div>
        )}
        {!isLoading && (teams?.length ?? 0) > 2 && tournament?.licenseStatus !== "active" && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex items-start gap-3 max-w-2xl">
            <Users className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 text-sm">Practice mode: only 2 teams can bid</p>
              <p className="text-xs text-muted-foreground mt-1">
                You can add all teams now, but during practice only the first 2 teams can place bids. All teams will work after live activation.
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Franchise Teams</h1>
            <p className="text-muted-foreground mt-2">
              {(teams?.length || 0) >= 2
                ? `${teams?.length} teams added — ready for players`
                : `Teams: ${teams?.length || 0} of 2 minimum`}
            </p>
          </div>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2" onClick={() => setEditing(null)}>
                <Plus className="w-5 h-5" /> Add Team
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-lg dark"
              onPointerDownOutside={e => e.preventDefault()}
              onEscapeKeyDown={e => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Team" : "Add New Team"}</DialogTitle>
              </DialogHeader>
              <TeamForm
                key={editing?.id ?? "new"}
                tournamentId={tournamentId}
                team={editing}
                existingShortCodes={existingShortCodes}
                existingTeamColors={existingTeamColors}
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
        ) : teams?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/20 py-16 px-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="font-display font-bold text-xl mb-2">Add your first team</h3>
            <p className="text-muted-foreground text-sm mb-1">
              Teams are the franchises that will bid in the auction. Each team gets a budget (purse) to spend on players.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              You need at least 2 teams before you can add players.
            </p>
            <Button className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4" /> Add First Team
            </Button>
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
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="w-10 h-10 rounded-lg object-contain border border-border bg-muted/20"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-sm"
                            style={{ backgroundColor: `${team.color}22`, color: team.color || "#fff", border: `1px solid ${team.color}44` }}
                          >
                            {team.shortCode}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{team.name}</h3>
                          <p className="text-xs text-muted-foreground">{team.ownerName}</p>
                          {team.ownerMobile && <p className="text-xs text-muted-foreground font-mono">{team.ownerMobile}</p>}
                          {team.ownerEmail && <p className="text-xs text-muted-foreground break-all">{team.ownerEmail}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(team); setOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: team.id, name: team.name })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Purse + Squad Summary */}
                    {(() => {
                      const tp = teamPurses?.find(p => p.teamId === team.id);
                      const originalPurse = tp?.originalPurse ?? team.purse;
                      const boosterTotal = tp?.boosterTotal ?? 0;
                      const effectiveCapacity = tp?.effectiveCapacity ?? team.purse;
                      const purseRemaining = effectiveCapacity - (team.purseUsed || 0);
                      const spendable = tp?.spendablePurse ?? purseRemaining;
                      const reserved = tp?.reservePurse ?? 0;
                      const bought = tp?.playersBought ?? 0;
                      const retained = tp?.retainedCount ?? 0;
                      const slotsNeeded = tp?.slotsRequired ?? 0;
                      const minSquad = tp?.minimumSquadSize ?? tournament?.minimumSquadSize ?? 0;
                      const maxSquad = tp?.maximumSquadSize ?? 0;
                      const maxReached = maxSquad > 0 && bought >= maxSquad;
                      const minMet = minSquad === 0 || slotsNeeded === 0;
                      const canBuyMore = maxSquad > 0 ? maxSquad - bought : null;
                      const topName = tp?.topPlayerName ?? null;
                      const topAmt = tp?.topPlayerAmount ?? null;
                      return (
                        <div className="space-y-3 pt-3 border-t border-border">
                          {/* Bidding status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <Wallet className="w-3.5 h-3.5" />
                              <span>Capacity: <span className="text-foreground font-semibold">{formatShortIndianRupee(effectiveCapacity)}</span></span>
                            </div>
                            <Badge
                              variant={team.isBiddingEnabled ? "default" : "secondary"}
                              className={team.isBiddingEnabled ? "bg-green-500/20 text-green-400 border-green-500/20 text-[10px]" : "text-[10px]"}
                            >
                              {team.isBiddingEnabled ? "Bidding ON" : "Blocked"}
                            </Badge>
                          </div>

                          {/* Purse breakdown grid */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Original</p>
                              <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatShortIndianRupee(originalPurse)}</p>
                            </div>
                            <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                              <p className="text-[10px] text-amber-400/80 uppercase tracking-wider mb-0.5">Boosters</p>
                              <p className="text-sm font-bold font-mono tabular-nums text-amber-400">+{formatShortIndianRupee(boosterTotal)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Capacity</p>
                              <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatShortIndianRupee(effectiveCapacity)}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Remaining</p>
                              <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatShortIndianRupee(purseRemaining)}</p>
                            </div>
                            <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2">
                              <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider mb-0.5">Max Bid / Player</p>
                              <p className={`text-sm font-bold font-mono tabular-nums ${maxReached ? "text-red-400" : "text-emerald-400"}`}>
                                {maxReached ? "Squad full" : formatShortIndianRupee(spendable)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Spent</p>
                              <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatShortIndianRupee(team.purseUsed || 0)}</p>
                            </div>
                            {reserved > 0 ? (
                              <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                                <p className="text-[10px] text-amber-400/80 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                  <ShieldAlert className="w-2.5 h-2.5" /> Reserved
                                </p>
                                <p className="text-sm font-bold font-mono tabular-nums text-amber-400">{formatShortIndianRupee(reserved)}</p>
                                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">for {slotsNeeded} slot{slotsNeeded !== 1 ? "s" : ""}</p>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Reserved</p>
                                <p className="text-sm font-bold font-mono tabular-nums text-muted-foreground/50">—</p>
                              </div>
                            )}
                          </div>

                          {/* Squad status */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className={`text-xs font-semibold ${maxReached ? "text-red-400" : slotsNeeded > 0 ? "text-amber-400" : minSquad > 0 ? "text-green-400" : "text-foreground"}`}>
                                  {bought} bought{retained > 0 ? ` (${retained} retained)` : ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px]">
                                {minSquad > 0 && (
                                  <span className={slotsNeeded > 0 ? "text-amber-400" : "text-green-400"}>
                                    min {minSquad}{slotsNeeded > 0 ? ` · need ${slotsNeeded}` : " met"}
                                  </span>
                                )}
                                {maxSquad > 0 && (
                                  <span className={maxReached ? "text-red-400 font-bold" : "text-muted-foreground"}>
                                    max {maxSquad}{canBuyMore !== null && !maxReached ? ` · ${canBuyMore} left` : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            {maxSquad > 0 && (
                              <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${maxReached ? "bg-red-400" : slotsNeeded > 0 ? "bg-amber-400" : "bg-green-400"}`}
                                  style={{ width: `${Math.min(100, (bought / maxSquad) * 100)}%` }}
                                />
                              </div>
                            )}
                            {!minMet && minSquad > 0 && (
                              <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                {slotsNeeded} more player{slotsNeeded !== 1 ? "s" : ""} required to meet minimum squad
                              </p>
                            )}
                            {minMet && minSquad > 0 && (
                              <p className="text-[10px] text-green-400/70">Minimum squad requirement met</p>
                            )}
                          </div>

                          {/* Top player */}
                          {topName && (
                            <div className="flex items-center gap-2 bg-amber-500/6 border border-amber-500/20 rounded-lg px-3 py-2">
                              <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Top Buy</p>
                                <p className="text-xs font-bold text-foreground truncate">{topName}</p>
                              </div>
                              {topAmt != null && (
                                <p className="text-sm font-display font-black tabular-nums text-amber-400 flex-shrink-0">
                                  {formatShortIndianRupee(topAmt)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                    {isAuctionEnded ? (
                      <div className="flex items-center gap-2 bg-muted/20 border border-border/50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner Panel Link</p>
                          <p className="text-xs text-muted-foreground/50 italic">Auction ended</p>
                        </div>
                      </div>
                    ) : (
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
                          onClick={() => window.open(getOwnerLink(team.id), "_blank", "noopener,noreferrer")}
                          title="Open owner panel"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
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

      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">{deleteTarget?.name}</strong> from this tournament? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteTeam.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteTeam.isPending} onClick={() => void confirmDelete()}>
              {deleteTeam.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Removing…
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Yes, remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenerateTarget !== null} onOpenChange={(open) => { if (!open) setRegenerateTarget(null); }}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle>Regenerate owner access code?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The old code will stop working immediately. Team owners will need the new code to bid.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateTarget(null)} disabled={updateTeam.isPending}>
              Cancel
            </Button>
            <Button disabled={updateTeam.isPending} onClick={() => void confirmRegenerateCode()}>
              {updateTeam.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Regenerating…
                </>
              ) : (
                "Regenerate code"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
