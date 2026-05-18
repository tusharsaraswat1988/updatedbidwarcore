import { useEffect, useRef, useState, useCallback } from "react";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { useRoute } from "wouter";
import {
  useListPlayers,
  useListCategories,
  useListTeams,
  useGetTournament,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  useBulkCreatePlayers,
  useSearchGlobalPlayers,
  getSearchGlobalPlayersQueryKey,
  useListImportSources,
  getListImportSourcesQueryKey,
  useListImportCandidates,
  getListImportCandidatesQueryKey,
  useImportPlayersFromTournament,
  getListPlayersQueryKey,
  getListCategoriesQueryKey,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
  PlayerInputRole,
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
import { Plus, Pencil, Trash2, User, Upload, Download, ExternalLink, X, ArrowLeft, DatabaseZap, Loader2 } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Global Player Search Autocomplete ────────────────────────────────────────

type SuggestionProfile = {
  id: number;
  name: string;
  mobileNumber?: string | null;
  city?: string | null;
  age?: number | null;
  role?: string | null;
  photoUrl?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  specialization?: string | null;
  achievements?: string | null;
  jerseyNumber?: string | null;
  cricheroUrl?: string | null;
  availabilityDates?: string | null;
  basePrice?: number;
  appearanceCount: number;
};

function GlobalPlayerSearch({ value, onChange, onFillFromProfile }: {
  value: string;
  onChange: (v: string) => void;
  onFillFromProfile: (p: SuggestionProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(value), 300);
    return () => clearTimeout(t);
  }, [value]);

  const { data: suggestions } = useSearchGlobalPlayers(
    { q: debouncedQ, limit: 8 },
    { query: { queryKey: getSearchGlobalPlayersQueryKey({ q: debouncedQ }), enabled: debouncedQ.length >= 2 } },
  );

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const showDropdown = open && debouncedQ.length >= 2 && (suggestions?.length ?? 0) > 0;

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        required
        placeholder="Full name"
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          {suggestions!.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center gap-3 border-b border-border/40 last:border-0"
              onMouseDown={() => { onFillFromProfile(p as SuggestionProfile); setOpen(false); }}
            >
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{p.name}</span>
                  {p.role && <span className="text-xs text-muted-foreground capitalize">{p.role}</span>}
                  {p.appearanceCount > 1 && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      {p.appearanceCount} tournaments
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {p.city && <span>{p.city}</span>}
                  {p.mobileNumber && <span className="font-mono">{p.mobileNumber}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tournament Import Dialog ──────────────────────────────────────────────────

function TournamentImportDialog({ tournamentId, categories, onClose }: {
  tournamentId: number;
  categories: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [sourceTournamentId, setSourceTournamentId] = useState<number | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [overrideCategoryId, setOverrideCategoryId] = useState<string>("");
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  const importMutation = useImportPlayersFromTournament();

  const { data: sources, isLoading: sourcesLoading } = useListImportSources(tournamentId, {
    query: { queryKey: getListImportSourcesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: candidates, isLoading: candidatesLoading } = useListImportCandidates(
    tournamentId,
    { sourceTournamentId: sourceTournamentId ?? 0 },
    {
      query: {
        queryKey: getListImportCandidatesQueryKey(tournamentId, { sourceTournamentId: sourceTournamentId ?? 0 }),
        enabled: !!sourceTournamentId,
      },
    },
  );

  const filteredCandidates = (candidates || []).filter(p => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.mobileNumber || "").includes(search);
  });

  const nonDupeCount = (candidates || []).filter(p => !p.isDuplicate).length;
  const dupeCount = (candidates || []).filter(p => p.isDuplicate).length;

  function selectAllNonDupes() {
    setSelectedIds(new Set((candidates || []).filter(p => !p.isDuplicate).map(p => p.id)));
  }

  function deselectAll() { setSelectedIds(new Set()); }

  function togglePlayer(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selectedIds.size === 0 || !sourceTournamentId) return;
    const res = await importMutation.mutateAsync({
      tournamentId,
      data: {
        sourceTournamentId,
        playerIds: Array.from(selectedIds),
        categoryId: overrideCategoryId ? parseInt(overrideCategoryId) : undefined,
      },
    });
    setResult(res);
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
  }

  // Result screen
  if (result) {
    return (
      <div className="space-y-5">
        <div className={`p-5 rounded-lg border ${result.imported > 0 ? "border-green-500/40 bg-green-500/10" : "border-yellow-500/40 bg-yellow-500/10"}`}>
          <p className="font-bold text-xl">{result.imported} player{result.imported !== 1 ? "s" : ""} imported</p>
          {result.skipped > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{result.skipped} skipped — already in tournament</p>
          )}
        </div>
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    );
  }

  // Step 1 — Source selection
  if (step === 1) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Select a tournament to import players from.</p>
        {sourcesLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : (sources || []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DatabaseZap className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No other tournaments found</p>
            <p className="text-xs mt-1">Other tournaments with registered players will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {(sources || []).map(s => (
              <button
                key={s.id}
                type="button"
                className="w-full text-left border border-border hover:border-primary/50 hover:bg-accent/40 rounded-lg p-4 transition-all"
                onClick={() => { setSourceTournamentId(s.id); setSourceName(s.name); setStep(2); }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {s.sport}{s.auctionDate ? ` · ${s.auctionDate}${(s as { auctionTime?: string | null }).auctionTime ? ` ${(s as { auctionTime?: string | null }).auctionTime}` : ""}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono shrink-0">{s.playerCount} players</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2 — Player selection
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setStep(1); setSelectedIds(new Set()); setSearch(""); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-sm truncate">{sourceName}</span>
        <span className="text-muted-foreground text-xs ml-auto shrink-0">{selectedIds.size} selected</span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Filter by name or mobile..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={selectAllNonDupes} disabled={nonDupeCount === 0}>
          All ({nonDupeCount})
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={deselectAll} disabled={selectedIds.size === 0}>
          Clear
        </Button>
      </div>

      {dupeCount > 0 && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
          {dupeCount} player{dupeCount !== 1 ? "s" : ""} already in this tournament — shown greyed out
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="text-xs whitespace-nowrap text-muted-foreground">Override category:</Label>
          <Select value={overrideCategoryId} onValueChange={setOverrideCategoryId}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Keep original" />
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value="">Keep original</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5 max-h-[38vh] overflow-y-auto pr-0.5">
        {candidatesLoading ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-13" />)
        ) : filteredCandidates.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10">No players found</p>
        ) : filteredCandidates.map(p => (
          <button
            key={p.id}
            type="button"
            disabled={p.isDuplicate}
            className={`w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition-all border ${
              p.isDuplicate
                ? "opacity-40 cursor-not-allowed border-border/30 bg-card/20"
                : selectedIds.has(p.id)
                ? "border-primary/60 bg-primary/10"
                : "border-border hover:border-primary/30 hover:bg-accent/40"
            }`}
            onClick={() => !p.isDuplicate && togglePlayer(p.id)}
          >
            <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded border border-border bg-card">
              {selectedIds.has(p.id) && !p.isDuplicate && (
                <div className="w-2.5 h-2.5 bg-primary rounded-sm" />
              )}
              {p.isDuplicate && <X className="w-2.5 h-2.5 text-yellow-500" />}
            </div>
            <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{p.name}</span>
                {p.role && <span className="text-xs text-muted-foreground capitalize">{p.role}</span>}
                {p.isDuplicate && <span className="text-[10px] font-semibold text-yellow-400">Already in tournament</span>}
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                {p.city && <span>{p.city}</span>}
                {p.mobileNumber && <span className="font-mono">{p.mobileNumber}</span>}
                {p.age != null && <span>Age {p.age}</span>}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground shrink-0">
              {formatIndianRupee(p.basePrice)}
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 pt-2 border-t border-border">
        <Button
          className="flex-1"
          disabled={selectedIds.size === 0 || importMutation.isPending}
          onClick={handleImport}
        >
          {importMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
          ) : (
            <><DatabaseZap className="w-4 h-4 mr-2" /> Import {selectedIds.size} Player{selectedIds.size !== 1 ? "s" : ""}</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Player Form ───────────────────────────────────────────────────────────────

function PlayerForm({ tournamentId, player, categories, tournament, onClose }: {
  tournamentId: number;
  player?: any;
  categories: any[];
  tournament?: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [filledFromProfile, setFilledFromProfile] = useState(false);
  const [basePriceTouched, setBasePriceTouched] = useState(false);
  const [mobileError, setMobileError] = useState("");

  // Dynamic roles from sport master table
  const [sportRoles, setSportRoles] = useState<{ id: number; roleName: string }[]>([]);
  useEffect(() => {
    const slug = tournament?.sport ?? "cricket";
    fetch(`/api/sports/by-slug/${encodeURIComponent(slug)}/roles`)
      .then(r => r.json())
      .then((d: { id: number; roleName: string }[]) => setSportRoles(d))
      .catch(() => {});
  }, [tournament?.sport]);

  // Spec groups state — populated after role selection (see effects below, after form state)
  type SpecOption = { id: number; optionName: string };
  type SpecGroup = { id: number; groupName: string; displayOrder: number; optional: boolean; options: SpecOption[] };
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([]);
  const isFirstSpecRender = useRef(true);
  const SPEC_KEYS = ["battingStyle", "bowlingStyle", "specialization"] as const;

  // Sync basePrice default when tournament loads after the form opens (new players only)
  useEffect(() => {
    if (!player && !basePriceTouched && tournament?.minBid) {
      setForm(f => ({ ...f, basePrice: tournament.minBid }));
    }
  }, [tournament?.minBid, player, basePriceTouched]);

  const [form, setForm] = useState({
    name: player?.name || "",
    city: player?.city || "",
    role: player?.role || "",
    battingStyle: player?.battingStyle || "",
    bowlingStyle: player?.bowlingStyle || "",
    specialization: player?.specialization || "",
    age: player?.age ? String(player.age) : "",
    photoUrl: player?.photoUrl && !player.photoUrl.startsWith("data:") ? player.photoUrl : "",
    basePrice: player?.basePrice || tournament?.minBid || 100000,
    jerseyNumber: player?.jerseyNumber || "",
    achievements: player?.achievements || "",
    mobileNumber: player?.mobileNumber || "",
    cricheroUrl: player?.cricheroUrl || "",
    availabilityDates: player?.availabilityDates || "",
    retainedPrice: player?.retainedPrice ? String(player.retainedPrice) : "",
    status: player?.status || "available",
    categoryId: player?.categoryId ? String(player.categoryId) : "",
  });

  const [submitError, setSubmitError] = useState("");

  // selectedRoleId must be derived AFTER form state to avoid temporal dead zone
  const selectedRoleId = sportRoles.find(r => r.roleName === form.role)?.id;
  useEffect(() => {
    if (!selectedRoleId) { setSpecGroups([]); return; }
    fetch(`/api/sports/roles/${selectedRoleId}/specs`)
      .then(r => r.json())
      .then((d: SpecGroup[]) => setSpecGroups(d))
      .catch(() => setSpecGroups([]));
  }, [selectedRoleId]);
  useEffect(() => {
    if (isFirstSpecRender.current) { isFirstSpecRender.current = false; return; }
    setForm(prev => ({ ...prev, battingStyle: "", bowlingStyle: "", specialization: "" }));
  }, [selectedRoleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mobile = form.mobileNumber.trim();
    if (!mobile) {
      setMobileError("Mobile number is required");
      return;
    }
    setMobileError("");
    setSubmitError("");
    const data = {
      name: form.name,
      city: form.city || undefined,
      role: form.role as PlayerInputRole,
      battingStyle: form.battingStyle || undefined,
      bowlingStyle: form.bowlingStyle || undefined,
      specialization: form.specialization || undefined,
      age: form.age ? parseInt(form.age) : undefined,
      photoUrl: form.photoUrl || undefined,
      basePrice: parseInt(String(form.basePrice)) || 0,
      jerseyNumber: form.jerseyNumber || undefined,
      achievements: form.achievements || undefined,
      mobileNumber: mobile,
      cricheroUrl: form.cricheroUrl || undefined,
      availabilityDates: form.availabilityDates || undefined,
      retainedPrice: form.retainedPrice ? parseInt(form.retainedPrice) : undefined,
      status: form.status,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
    };
    try {
      if (player) {
        await updatePlayer.mutateAsync({ tournamentId, playerId: player.id, data });
      } else {
        await createPlayer.mutateAsync({ tournamentId, data });
      }
      qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to save player";
      setSubmitError(msg);
    }
  }

  const f = (key: string, val: string | number) => setForm(prev => ({ ...prev, [key]: val }));

  function fillFromProfile(p: SuggestionProfile) {
    setForm(prev => ({
      ...prev,
      name: p.name,
      city: p.city || prev.city,
      role: p.role || prev.role,
      age: p.age != null ? String(p.age) : prev.age,
      photoUrl: p.photoUrl || prev.photoUrl,
      battingStyle: p.battingStyle || prev.battingStyle,
      bowlingStyle: p.bowlingStyle || prev.bowlingStyle,
      specialization: p.specialization || prev.specialization,
      achievements: p.achievements || prev.achievements,
      jerseyNumber: p.jerseyNumber || prev.jerseyNumber,
      cricheroUrl: p.cricheroUrl || prev.cricheroUrl,
      mobileNumber: p.mobileNumber || prev.mobileNumber,
      basePrice: p.basePrice || prev.basePrice,
    }));
    setFilledFromProfile(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Player Name *</Label>
          {player ? (
            <Input value={form.name} onChange={e => f("name", e.target.value)} required placeholder="Full name" />
          ) : (
            <>
              <GlobalPlayerSearch
                value={form.name}
                onChange={v => { f("name", v); setFilledFromProfile(false); }}
                onFillFromProfile={fillFromProfile}
              />
              {filledFromProfile && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <DatabaseZap className="w-3 h-3" />
                  Filled from player history
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setFilledFromProfile(false)}
                  >
                    · clear
                  </button>
                </p>
              )}
            </>
          )}
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.categoryId} onValueChange={v => f("categoryId", v)}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent className="dark">
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Row 2: Mobile (required) | Role */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Mobile Number *</Label>
          <Input value={form.mobileNumber} onChange={e => { f("mobileNumber", e.target.value); if (mobileError) setMobileError(""); }} required placeholder="+91 98765 43210" />
          {mobileError && <p className="text-xs text-destructive mt-1">{mobileError}</p>}
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={v => f("role", v)}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent className="dark">
              {(sportRoles.length > 0
                ? sportRoles.map(r => ({ value: r.roleName, label: r.roleName }))
                : ["Batsman","Bowler","All-Rounder","Wicketkeeper","Player"].map(r => ({ value: r, label: r }))
              ).map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Row 3: City | Age */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>City</Label>
          <Input value={form.city} onChange={e => f("city", e.target.value)} placeholder="Mumbai" />
        </div>
        <div className="space-y-2">
          <Label>Age</Label>
          <Input type="number" value={form.age} onChange={e => f("age", e.target.value)} placeholder="25" />
        </div>
      </div>
      {/* Row 4: Base Price | Jersey No */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Base Price (₹) *</Label>
          <Input type="number" value={form.basePrice} onChange={e => { setBasePriceTouched(true); f("basePrice", e.target.value); }} required />
        </div>
        <div className="space-y-2">
          <Label>Jersey No.</Label>
          <Input value={form.jerseyNumber} onChange={e => f("jerseyNumber", e.target.value)} placeholder="7" />
        </div>
      </div>
      {/* Dynamic spec groups: loaded from sport master per selected role */}
      {specGroups.length > 0 ? (
        <div className={`grid gap-4 ${specGroups.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {specGroups.slice(0, 3).map((group, idx) => {
            const key = SPEC_KEYS[idx];
            if (!key) return null;
            return (
              <div key={group.id} className="space-y-2">
                <Label>{group.groupName}{!group.optional && " *"}</Label>
                {group.options.length > 0 ? (
                  <Select value={form[key]} onValueChange={v => f(key, v)}>
                    <SelectTrigger><SelectValue placeholder={`Select ${group.groupName}`} /></SelectTrigger>
                    <SelectContent className="dark">
                      {group.options.map(o => (
                        <SelectItem key={o.id} value={o.optionName}>{o.optionName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form[key]} onChange={e => f(key, e.target.value)} placeholder={group.groupName} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback free-text spec fields when no master data for this sport/role */
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Batting Style</Label>
            <Input value={form.battingStyle} onChange={e => f("battingStyle", e.target.value)} placeholder="Right-hand" />
          </div>
          <div className="space-y-2">
            <Label>Bowling Style</Label>
            <Input value={form.bowlingStyle} onChange={e => f("bowlingStyle", e.target.value)} placeholder="Right-arm fast" />
          </div>
          <div className="space-y-2">
            <Label>Specialization</Label>
            <Input value={form.specialization} onChange={e => f("specialization", e.target.value)} placeholder="Power hitter, Death bowler..." />
          </div>
        </div>
      )}
      {/* Player Photo */}
      <div className="space-y-2">
          <Label>Player Photo</Label>
          <div className="flex gap-2 items-start">
            <div className="w-12 h-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.photoUrl ? (
                <img
                  src={form.photoUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <User className="w-5 h-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setPhotoEditorOpen(true)}
                >
                  {form.photoUrl ? <><Pencil className="w-3 h-3" /> Edit Photo</> : <><Upload className="w-3 h-3" /> Upload Photo</>}
                </Button>
                {form.photoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => f("photoUrl", "")}
                  >
                    <X className="w-3 h-3" /> Remove
                  </Button>
                )}
              </div>
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Or paste an image URL</summary>
                <Input value={form.photoUrl} onChange={e => f("photoUrl", e.target.value)} placeholder="https://..." className="text-xs h-7 mt-1.5" />
              </details>
            </div>
          </div>
          <ImageEditorDialog
            open={photoEditorOpen}
            onClose={() => setPhotoEditorOpen(false)}
            initialUrl={form.photoUrl || undefined}
            aspect={1}
            title="Player Photo"
            onSave={url => f("photoUrl", url)}
          />
        </div>
      <div className="space-y-2">
        <Label>Availability Dates</Label>
        <Input value={form.availabilityDates} onChange={e => f("availabilityDates", e.target.value)} placeholder="18, 19, 20 March 2025" />
      </div>
      <div className="space-y-2">
        <Label>Crichero URL</Label>
        <Input value={form.cricheroUrl} onChange={e => f("cricheroUrl", e.target.value)} placeholder="https://crichero.com/player/..." />
      </div>
      <div className="space-y-2">
        <Label>Achievements</Label>
        <Input value={form.achievements} onChange={e => f("achievements", e.target.value)} placeholder="Player of the Season 2024..." />
      </div>

      {/* Retained player section */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Retained Player (Optional)</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => f("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="dark">
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="retained">Retained (Pre-sold)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.status === "retained" && (
            <div className="space-y-2">
              <Label>Retained Price (₹)</Label>
              <Input type="number" value={form.retainedPrice} onChange={e => f("retainedPrice", e.target.value)} placeholder="e.g. 1000000" />
            </div>
          )}
        </div>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          <span className="flex-shrink-0">!</span>
          {submitError}
        </div>
      )}
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" disabled={createPlayer.isPending || updatePlayer.isPending}>
          {player ? "Update Player" : "Add Player"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Bulk Upload Dialog ────────────────────────────────────────────────────────

function BulkUploadDialog({ tournamentId, categories, onClose }: {
  tournamentId: number;
  categories: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const bulkCreate = useBulkCreatePlayers();
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const TEMPLATE_HEADERS = "name,basePrice,role,city,age,battingStyle,bowlingStyle,specialization,jerseyNumber,achievements,mobileNumber,availabilityDates,cricheroUrl";

  function downloadTemplate() {
    const content = TEMPLATE_HEADERS + "\nRohit Sharma,1000000,batsman,Mumbai,36,Right-hand bat,Right-arm medium,,45,IPL Winner 2024,9876543210,18-20 March,https://crichero.com/rohit";
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "players_template.csv";
    a.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsv(ev.target?.result as string || "");
    reader.readAsText(file);
  }

  function parseCsv(raw: string): any[] {
    const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim());
      const row: Record<string, any> = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ""; });
      return {
        name: row["name"] || "Unknown",
        basePrice: parseInt(row["baseprice"] || row["base_price"] || "100000") || 100000,
        role: row["role"] || undefined,
        city: row["city"] || undefined,
        age: row["age"] ? parseInt(row["age"]) : undefined,
        battingStyle: row["battingstyle"] || row["batting_style"] || undefined,
        bowlingStyle: row["bowlingstyle"] || row["bowling_style"] || undefined,
        specialization: row["specialization"] || undefined,
        jerseyNumber: row["jerseynumber"] || row["jersey_number"] || undefined,
        achievements: row["achievements"] || undefined,
        mobileNumber: row["mobilenumber"] || row["mobile_number"] || row["mobile"] || undefined,
        availabilityDates: row["availabilitydates"] || row["availability_dates"] || row["availability"] || undefined,
        cricheroUrl: row["cricherourl"] || row["crichero_url"] || row["crichero"] || undefined,
      };
    });
  }

  async function handleUpload() {
    const players = parseCsv(csv);
    if (!players.length) return;
    const res = await bulkCreate.mutateAsync({ tournamentId, data: { players } });
    setResult({ created: res.created, failed: res.failed, errors: res.errors ?? [] });
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
  }

  const parsed = csv ? parseCsv(csv) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Upload a CSV file with player details. One player per row.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
          <Download className="w-3.5 h-3.5" /> Template
        </Button>
      </div>

      {!result && (
        <>
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-sm">Click to upload CSV</p>
            <p className="text-xs text-muted-foreground mt-1">or paste CSV data below</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
          <textarea
            className="w-full h-36 bg-card border border-border rounded-lg p-3 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={`Paste CSV here:\n${TEMPLATE_HEADERS}\nPlayer Name,100000,batsman,...`}
            value={csv}
            onChange={e => setCsv(e.target.value)}
          />
          {parsed.length > 0 && (
            <div className="bg-card/50 border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{parsed.length} player(s) ready to upload:</p>
              <div className="flex flex-wrap gap-1">
                {parsed.slice(0, 10).map((p, i) => (
                  <span key={i} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">{p.name}</span>
                ))}
                {parsed.length > 10 && <span className="text-xs text-muted-foreground">+{parsed.length - 10} more</span>}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={parsed.length === 0 || bulkCreate.isPending}
              onClick={handleUpload}
            >
              <Upload className="w-4 h-4 mr-2" />
              {bulkCreate.isPending ? "Uploading..." : `Upload ${parsed.length} Players`}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${result.failed === 0 ? "border-green-500/40 bg-green-500/10" : "border-yellow-500/40 bg-yellow-500/10"}`}>
            <p className="font-bold text-lg">{result.created} players uploaded successfully</p>
            {result.failed > 0 && (
              <p className="text-sm text-destructive mt-1">{result.failed} failed</p>
            )}
            {result.errors.length > 0 && (
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                {result.errors.map((e, i) => <li key={i}>· {e}</li>)}
              </ul>
            )}
          </div>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Status badge colours ──────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  available: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  sold: "bg-green-500/20 text-green-400 border-green-500/20",
  unsold: "bg-red-500/20 text-red-400 border-red-500/20",
  retained: "bg-purple-500/20 text-purple-400 border-purple-500/20",
};

// ─── Players Page ──────────────────────────────────────────────────────────────

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
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const deletePlayer = useDeletePlayer();
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
      (p.role || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.mobileNumber || "").includes(search);
    return matchesTab && matchesSearch;
  });

  const catMap = Object.fromEntries((categories || []).map(c => [c.id, c]));
  const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t]));
  const retainedCount = (players || []).filter(p => p.status === "retained").length;

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight">Players</h1>
              {tournament?.auctionCode && (
                <Badge variant="outline" className="font-mono text-sm text-primary border-primary/40 px-2 py-0.5">
                  {tournament.auctionCode}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-2">
              {players?.length || 0} players registered
              {retainedCount > 0 && <span className="text-purple-400 ml-2">· {retainedCount} retained</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => setBulkOpen(true)}
            >
              <Upload className="w-4 h-4" /> Bulk Upload
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => setImportOpen(true)}
            >
              <DatabaseZap className="w-4 h-4" /> Import Players
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => window.open(`/tournament/${tournamentId}/register`, "_blank")}
            >
              <ExternalLink className="w-4 h-4" /> Reg. Link
            </Button>
            <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2" onClick={() => setEditing(null)}>
                  <Plus className="w-5 h-5" /> Add Player
                </Button>
              </DialogTrigger>
              <DialogContent
                className="max-w-lg dark"
                onPointerDownOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Player" : "Add Player"}</DialogTitle>
                </DialogHeader>
                <PlayerForm
                  key={editing?.id ?? "new"}
                  tournamentId={tournamentId}
                  player={editing}
                  categories={categories || []}
                  tournament={tournament}
                  onClose={() => { setOpen(false); setEditing(null); }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search by name, city, role, or mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-card">
              <TabsTrigger value="all">All ({players?.length || 0})</TabsTrigger>
              <TabsTrigger value="available">Available</TabsTrigger>
              <TabsTrigger value="retained">Retained</TabsTrigger>
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
                        {player.mobileNumber && (
                          <span className="text-xs text-muted-foreground font-mono">{player.mobileNumber}</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {player.city && <span>{player.city}</span>}
                        {player.role && <span className="capitalize">· {player.role}</span>}
                        {player.age && <span>· Age {player.age}</span>}
                        {player.battingStyle && <span>· {player.battingStyle}</span>}
                        {player.availabilityDates && <span className="text-blue-400">· Avail: {player.availabilityDates}</span>}
                        {team && (
                          <span className="font-semibold" style={{ color: team.color || "#fff" }}>· {team.name}</span>
                        )}
                      </div>
                      {player.cricheroUrl && (
                        <a href={player.cricheroUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-0.5 inline-block">
                          Crichero Profile
                        </a>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {player.status === "retained" ? (
                        <>
                          <p className="font-mono font-bold text-purple-400">{player.retainedPrice ? `₹${(player.retainedPrice/100000).toFixed(1)}L` : "Retained"}</p>
                          <p className="text-xs text-muted-foreground">retained</p>
                        </>
                      ) : (
                        <>
                          <p className="font-mono font-bold text-primary">{formatIndianRupee(player.soldPrice || player.basePrice)}</p>
                          <p className="text-xs text-muted-foreground">{player.soldPrice ? "sold" : "base"}</p>
                        </>
                      )}
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

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-xl dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Bulk Player Upload
            </DialogTitle>
          </DialogHeader>
          <BulkUploadDialog
            tournamentId={tournamentId}
            categories={categories || []}
            onClose={() => setBulkOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Import Players Dialog */}
      <Dialog open={importOpen} onOpenChange={v => { setImportOpen(v); }}>
        <DialogContent className="max-w-2xl dark max-h-[92vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DatabaseZap className="w-5 h-5" /> Import Players from Tournament
            </DialogTitle>
          </DialogHeader>
          <TournamentImportDialog
            tournamentId={tournamentId}
            categories={categories || []}
            onClose={() => setImportOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
