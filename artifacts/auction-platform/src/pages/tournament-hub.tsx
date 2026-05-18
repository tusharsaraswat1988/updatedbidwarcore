import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useGetTournamentSummary,
  useGetTeamPurses,
  useUpdateTournament,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  Gavel, Monitor, Trophy, ExternalLink, Link2, Dices,
  Building2, Timer, PlusCircle, Trash2, Download,
  Settings, Megaphone, ShieldAlert, Image as ImageIcon, X, RotateCcw,
  Calendar as CalendarIcon, AlertTriangle, Upload, Pencil,
  Volume2, VolumeX, Play,
} from "lucide-react";
import { AuctionAudioManager } from "@/lib/audio-manager";
import { Skeleton } from "@/components/ui/skeleton";

type SponsorLogo = { url: string; name: string };

function SponsorLogosEditor({
  logos,
  onChange,
}: {
  logos: SponsorLogo[];
  onChange: (logos: SponsorLogo[]) => void;
}) {
  return (
    <div className="space-y-2">
      {logos.map((logo, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="flex-1 h-8 text-sm"
            value={logo.url}
            onChange={e => {
              const next = [...logos];
              next[i] = { ...next[i], url: e.target.value };
              onChange(next);
            }}
            placeholder="Logo URL (https://...)"
          />
          <Input
            className="w-28 h-8 text-sm"
            value={logo.name}
            onChange={e => {
              const next = [...logos];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
            placeholder="Sponsor name"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(logos.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-8 text-xs"
        onClick={() => onChange([...logos, { url: "", name: "" }])}
      >
        <PlusCircle className="w-3.5 h-3.5" /> Add Sponsor Logo
      </Button>
    </div>
  );
}

export default function TournamentHub() {
  const [, params] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  // Sports list loaded from master table for dynamic sport dropdown
  const [hubSports, setHubSports] = useState<{ id: number; name: string; slug: string }[]>([]);
  useEffect(() => {
    fetch("/api/sports").then(r => r.json()).then((d: { id: number; name: string; slug: string }[]) => setHubSports(d)).catch(() => {});
  }, []);
  type SettingsTab = "identity" | "auction" | "broadcast" | "recovery";
  const [activeSection, setActiveSection] = useState<SettingsTab>("identity");
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  // Snapshot of values when the dialog was opened — used by "Reset Section"
  const [origForm, setOrigForm] = useState<Record<string, string | number | boolean>>({});
  // Lazy audio manager for in-dialog sound previews
  const audioPreviewRef = useRef<AuctionAudioManager | null>(null);
  // Display names for uploaded audio files (not persisted — UI only)
  const [countdownFileName, setCountdownFileName] = useState("");
  const [soldFileName, setSoldFileName] = useState("");
  const [origSponsorLogos, setOrigSponsorLogos] = useState<SponsorLogo[]>([]);
  const [origBidTiers, setOrigBidTiers] = useState<Array<{ upTo?: number; increment: number }>>([]);
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  const [bidTiers, setBidTiers] = useState<Array<{ upTo?: number; increment: number }>>([
    { upTo: 100000, increment: 25000 },
    { upTo: 200000, increment: 50000 },
    { increment: 100000 },
  ]);
  const [exportLoading, setExportLoading] = useState(false);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const updateTournament = useUpdateTournament();

  function openEdit() {
    if (!tournament) return;
    const initialForm = {
      name: tournament.name,
      sport: tournament.sport,
      venue: tournament.venue || "",
      auctionDate: tournament.auctionDate || "",
      auctionTime: (tournament as any).auctionTime || "",
      logoUrl: tournament.logoUrl && !tournament.logoUrl.startsWith("data:") ? tournament.logoUrl : "",
      basePurse: String(tournament.basePurse ?? ""),
      minBid: String(tournament.minBid ?? ""),
      timerSeconds: String(tournament.timerSeconds ?? "30"),
      bidTimerSeconds: String((tournament as any).bidTimerSeconds ?? "15"),
      playerSelectionMode: (tournament as any).playerSelectionMode || "sequential",
      registrationDeadline: (tournament as any).registrationDeadline || "",
      registrationLimit: (tournament as any).registrationLimit != null ? String((tournament as any).registrationLimit) : "",
      minimumSquadSize: String((tournament as any).minimumSquadSize ?? 0),
      maximumSquadSize: String((tournament as any).maximumSquadSize ?? 0),
      audioEnabled: (tournament as any).audioEnabled ?? true,
      masterVolume: String((tournament as any).masterVolume ?? 80),
      countdownSoundEnabled: (tournament as any).countdownSoundEnabled ?? true,
      countdownSoundUrl: (tournament as any).countdownSoundUrl ?? "",
      countdownSoundVolume: String((tournament as any).countdownSoundVolume ?? 70),
      soldSoundEnabled: (tournament as any).soldSoundEnabled ?? true,
      soldSoundUrl: (tournament as any).soldSoundUrl ?? "",
      soldSoundVolume: String((tournament as any).soldSoundVolume ?? 80),
    };
    setEditForm(initialForm);
    setOrigForm(initialForm);
    // Restore display names for previously uploaded audio files
    setCountdownFileName((tournament as any).countdownSoundUrl ? "Custom file uploaded" : "");
    setSoldFileName((tournament as any).soldSoundUrl ? "Custom file uploaded" : "");
    // Load bidTiers from JSON column, fall back to legacy 5-column values
    let initialTiers: Array<{ upTo?: number; increment: number }>;
    try {
      const rawTiers = (tournament as any).bidTiers;
      if (rawTiers) {
        const parsed = JSON.parse(rawTiers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialTiers = parsed;
        } else { throw new Error("empty"); }
      } else {
        initialTiers = [
          { upTo: (tournament as any).bidTier1UpTo ?? 100000, increment: (tournament as any).bidTier1Increment ?? 25000 },
          { upTo: (tournament as any).bidTier2UpTo ?? 200000, increment: (tournament as any).bidTier2Increment ?? 50000 },
          { increment: (tournament as any).bidTier3Increment ?? 100000 },
        ];
      }
    } catch {
      initialTiers = [{ upTo: 100000, increment: 25000 }, { upTo: 200000, increment: 50000 }, { increment: 100000 }];
    }
    setBidTiers(initialTiers);
    setOrigBidTiers(initialTiers);

    let initialSponsors: SponsorLogo[];
    try {
      const parsed = tournament.sponsorLogos ? JSON.parse(tournament.sponsorLogos) : [];
      initialSponsors = Array.isArray(parsed) ? parsed : [];
    } catch { initialSponsors = []; }
    setSponsorLogos(initialSponsors);
    setOrigSponsorLogos(initialSponsors);

    setActiveSection("identity");
    setEditOpen(true);
  }

  function resetCurrentTab() {
    if (activeSection === "identity") {
      setEditForm(f => ({
        ...f,
        name: origForm.name,
        sport: origForm.sport,
        venue: origForm.venue,
        auctionDate: origForm.auctionDate,
        auctionTime: origForm.auctionTime,
        logoUrl: origForm.logoUrl,
        registrationDeadline: origForm.registrationDeadline,
        registrationLimit: origForm.registrationLimit,
      }));
    } else if (activeSection === "auction") {
      setEditForm(f => ({
        ...f,
        basePurse: origForm.basePurse,
        minBid: origForm.minBid,
        timerSeconds: origForm.timerSeconds,
        bidTimerSeconds: origForm.bidTimerSeconds,
        playerSelectionMode: origForm.playerSelectionMode,
        minimumSquadSize: origForm.minimumSquadSize,
        maximumSquadSize: origForm.maximumSquadSize,
      }));
      setBidTiers(origBidTiers);
    } else if (activeSection === "broadcast") {
      setSponsorLogos(origSponsorLogos);
      setEditForm(f => ({
        ...f,
        audioEnabled: origForm.audioEnabled,
        masterVolume: origForm.masterVolume,
        countdownSoundEnabled: origForm.countdownSoundEnabled,
        countdownSoundUrl: origForm.countdownSoundUrl,
        countdownSoundVolume: origForm.countdownSoundVolume,
        soldSoundEnabled: origForm.soldSoundEnabled,
        soldSoundUrl: origForm.soldSoundUrl,
        soldSoundVolume: origForm.soldSoundVolume,
      }));
      setCountdownFileName(origForm.countdownSoundUrl ? "Custom file uploaded" : "");
      setSoldFileName(origForm.soldSoundUrl ? "Custom file uploaded" : "");
    }
  }

  function handleAudioUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "countdownSoundUrl" | "soldSoundUrl",
    setFileName: (n: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("Audio file must be under 8 MB");
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setEditForm(f => ({ ...f, [field]: reader.result as string }));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function previewCountdownSound() {
    if (!audioPreviewRef.current) audioPreviewRef.current = new AuctionAudioManager();
    const mgr = audioPreviewRef.current;
    await mgr.unlock();
    mgr.setSettings({
      audioEnabled: true,
      masterVolume: 80,
      countdownSoundEnabled: true,
      countdownSoundUrl: (editForm.countdownSoundUrl as string).trim() || null,
      countdownSoundVolume: Number(editForm.countdownSoundVolume) || 70,
      soldSoundEnabled: false,
      soldSoundUrl: null,
      soldSoundVolume: 0,
    });
    mgr.previewCountdown();
  }

  async function previewSoldSound() {
    if (!audioPreviewRef.current) audioPreviewRef.current = new AuctionAudioManager();
    const mgr = audioPreviewRef.current;
    await mgr.unlock();
    mgr.setSettings({
      audioEnabled: true,
      masterVolume: 80,
      countdownSoundEnabled: false,
      countdownSoundUrl: null,
      countdownSoundVolume: 0,
      soldSoundEnabled: true,
      soldSoundUrl: (editForm.soldSoundUrl as string).trim() || null,
      soldSoundVolume: Number(editForm.soldSoundVolume) || 80,
    });
    mgr.previewSold();
  }

  async function handleExportForLocal() {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/export`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(tournament?.name || "tournament").replace(/\s+/g, "-").toLowerCase()}-bidwar-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleSave() {
    const filteredLogos = sponsorLogos.filter(l => l.url.trim());
    await updateTournament.mutateAsync({
      tournamentId,
      data: {
        name: editForm.name as string,
        sport: editForm.sport as string,
        venue: editForm.venue as string || undefined,
        auctionDate: editForm.auctionDate as string || undefined,
        auctionTime: editForm.auctionTime as string || undefined,
        logoUrl: editForm.logoUrl as string || undefined,
        sponsorLogos: JSON.stringify(filteredLogos),
        basePurse: Number(editForm.basePurse) || undefined,
        minBid: Number(editForm.minBid) || undefined,
        bidTiers: JSON.stringify(bidTiers.filter(t => t.increment > 0)),
        timerSeconds: Number(editForm.timerSeconds) || undefined,
        bidTimerSeconds: Number(editForm.bidTimerSeconds) || undefined,
        playerSelectionMode: editForm.playerSelectionMode as string || undefined,
        minimumSquadSize: editForm.minimumSquadSize !== "" && editForm.minimumSquadSize != null ? Number(editForm.minimumSquadSize) : 0,
        maximumSquadSize: editForm.maximumSquadSize !== "" && editForm.maximumSquadSize != null ? Number(editForm.maximumSquadSize) : 0,
        registrationDeadline: editForm.registrationDeadline ? (editForm.registrationDeadline as string) : null,
        registrationLimit: editForm.registrationLimit !== "" && editForm.registrationLimit != null
          ? Number(editForm.registrationLimit) || null
          : null,
        audioEnabled: editForm.audioEnabled === true,
        masterVolume: Number(editForm.masterVolume) || 80,
        countdownSoundEnabled: editForm.countdownSoundEnabled === true,
        countdownSoundUrl: (editForm.countdownSoundUrl as string).trim() || null,
        countdownSoundVolume: Number(editForm.countdownSoundVolume) || 70,
        soldSoundEnabled: editForm.soldSoundEnabled === true,
        soldSoundUrl: (editForm.soldSoundUrl as string).trim() || null,
        soldSoundVolume: Number(editForm.soldSoundVolume) || 80,
      } as any,
    });
    qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
    setEditOpen(false);
  }

  if (loadingTournament) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8">
        {/* Title + Quick Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              {tournament?.logoUrl && (
                <img src={tournament.logoUrl} alt={tournament.name} className="h-10 w-10 object-contain rounded" />
              )}
              <h1 className="text-4xl font-bold tracking-tight">{tournament?.name}</h1>
              <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold tracking-widest uppercase">
                {tournament?.status}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 font-mono text-sm flex items-center flex-wrap gap-x-2 gap-y-1">
              {tournament?.sport?.toUpperCase()}
              {(tournament as any)?.auctionCode && (
                <span className="text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded px-1.5 py-0.5 text-[11px] font-bold tracking-widest">
                  {(tournament as any).auctionCode}
                </span>
              )}
              {tournament?.organizerName && <span>· {tournament.organizerName}</span>}
              {tournament?.venue && <span>· {tournament.venue}</span>}
              <span>· BASE PURSE: {formatIndianRupee(tournament?.basePurse)}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => navigate(`/tournament/${tournamentId}/auction`)}
            >
              <Gavel className="w-4 h-4" /> Operator Panel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`/tournament/${tournamentId}/display`, "_blank")}
            >
              <Monitor className="w-4 h-4" /> LED Display <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-60" />
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/links`)}
            >
              <Link2 className="w-4 h-4" /> Links
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/fortune-wheel`)}
            >
              <Dices className="w-4 h-4" /> Fortune Wheel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/reports`)}
            >
              <Trophy className="w-4 h-4" /> Reports
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
              onClick={handleExportForLocal}
              disabled={exportLoading}
            >
              <Download className="w-4 h-4" /> {exportLoading ? "Exporting..." : "Export for Local"}
            </Button>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all"
              onClick={openEdit}
              title="Open tournament settings (identity, auction rules, broadcast, recovery)"
            >
              <Settings className="w-4 h-4" /> Tournament Settings
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Players</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold">{summary?.totalPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg"><Users className="w-5 h-5 text-blue-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Sold</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold text-green-500">{summary?.soldPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg"><UserCheck className="w-5 h-5 text-green-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Unsold</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold text-destructive">{summary?.unsoldPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg"><UserMinus className="w-5 h-5 text-destructive" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                  {loadingSummary ? <Skeleton className="h-9 w-24" /> : <p className="text-3xl font-display font-bold text-primary">{formatShortIndianRupee(summary?.totalSpent)}</p>}
                </div>
                <div className="p-3 bg-primary/10 rounded-lg"><Wallet className="w-5 h-5 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Purses */}
        <div>
          <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Team Purses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingPurses ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)
            ) : teamPurses?.map(team => {
              const usedPercentage = (team.purseUsed / team.purse) * 100;
              return (
                <Card key={team.teamId} className="bg-card/50 border-border">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={team.teamName} className="w-10 h-10 object-contain rounded" />
                        ) : (
                          <div className="w-4 h-8 rounded-sm" style={{ backgroundColor: team.color || "#444" }} />
                        )}
                        <div>
                          <h3 className="font-bold text-lg leading-none">{team.teamName}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{team.playersBought} Players</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-mono text-muted-foreground">{team.shortCode}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</p>
                        <p className="font-mono font-bold text-primary">{formatShortIndianRupee(team.purseRemaining)}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatShortIndianRupee(team.purseUsed)} Used</span>
                        <span>{formatShortIndianRupee(team.purse)} Total</span>
                      </div>
                      <Progress value={usedPercentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tournament Settings Dialog — 4 tabs (Identity / Auction / Broadcast / Recovery) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="max-w-3xl dark p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden"
          onPointerDownOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
        >
          {/* Sticky header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-card/50 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-5 h-5 text-primary" /> Tournament Settings
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Configure identity, auction rules, broadcast branding and recovery — all changes apply on Save.</p>
          </DialogHeader>

          {/* Sticky tab strip */}
          <div className="flex border-b border-border bg-background/50 flex-shrink-0 overflow-x-auto">
            {[
              { id: "identity" as const, label: "Identity", icon: Building2 },
              { id: "auction" as const, label: "Auction", icon: Gavel },
              { id: "broadcast" as const, label: "Broadcast", icon: Megaphone },
              { id: "recovery" as const, label: "Recovery", icon: ShieldAlert },
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all border-b-2 ${
                    active
                      ? "text-primary border-primary bg-primary/5"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/40"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            <div className="space-y-5">
              {activeSection === "identity" && (
                <>
                  {/* Tournament Logo — prominent at top */}
                  <div className="flex items-start gap-4 p-4 rounded-lg border border-border/60 bg-muted/10">
                    <div className="w-20 h-20 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                      {editForm.logoUrl ? (
                        <img
                          src={editForm.logoUrl as string}
                          alt="Logo preview"
                          className="w-full h-full object-contain"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <Label className="text-sm font-semibold">Tournament Logo</Label>
                      <p className="text-xs text-muted-foreground">Upload, crop, auto-enhance or remove the background — output is auto-compressed for the LED display.</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => setLogoEditorOpen(true)}
                        >
                          {editForm.logoUrl ? <><Pencil className="w-3.5 h-3.5" /> Edit Photo</> : <><Upload className="w-3.5 h-3.5" /> Upload Photo</>}
                        </Button>
                        {editForm.logoUrl && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                            onClick={() => setEditForm(f => ({ ...f, logoUrl: "" }))}
                          >
                            <X className="w-3.5 h-3.5" /> Remove
                          </Button>
                        )}
                      </div>
                      <details className="text-xs">
                        <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Or paste an image URL</summary>
                        <Input
                          value={editForm.logoUrl as string || ""}
                          onChange={e => setEditForm(f => ({ ...f, logoUrl: e.target.value }))}
                          placeholder="https://..."
                          className="h-8 mt-2"
                        />
                      </details>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tournament Name</Label>
                      <Input value={editForm.name as string || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Sport</Label>
                      <Select value={editForm.sport as string || "cricket"} onValueChange={v => setEditForm(f => ({ ...f, sport: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="dark">
                          {(hubSports.length > 0 ? hubSports : [{slug:"cricket",name:"Cricket"},{slug:"football",name:"Football"},{slug:"kabaddi",name:"Kabaddi"},{slug:"badminton",name:"Badminton"},{slug:"volleyball",name:"Volleyball"},{slug:"esports",name:"E-Sports"},{slug:"other",name:"Other"}]).map(s => (
                            <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Venue</Label>
                      <Input value={editForm.venue as string || ""} onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))} placeholder="Stadium name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Auction Date</Label>
                      <Input value={editForm.auctionDate as string || ""} onChange={e => setEditForm(f => ({ ...f, auctionDate: e.target.value }))} placeholder="15 March 2025" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Auction Time</Label>
                      <Input type="time" value={editForm.auctionTime as string || ""} onChange={e => setEditForm(f => ({ ...f, auctionTime: e.target.value }))} placeholder="14:00" />
                      <p className="text-[10px] text-muted-foreground">Used for 24h WhatsApp consent blast scheduling.</p>
                    </div>
                  </div>

                  {/* Player Registration Limits */}
                  <div className="border-t border-border/60 pt-4 space-y-3">
                    <div>
                      <Label className="text-sm font-semibold">Player Registration Link — Limits</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Control the public self-registration form. Leave a field blank for no limit.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Last Date to Register
                        </Label>
                        <Input
                          type="date"
                          value={editForm.registrationDeadline as string || ""}
                          onChange={e => setEditForm(f => ({ ...f, registrationDeadline: e.target.value }))}
                        />
                        <p className="text-[10px] text-muted-foreground">After this date the form auto-closes.</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Max Registrations</Label>
                        <Input
                          type="number"
                          min={1}
                          value={editForm.registrationLimit as string || ""}
                          onChange={e => setEditForm(f => ({ ...f, registrationLimit: e.target.value }))}
                          placeholder="e.g. 100"
                        />
                        <p className="text-[10px] text-muted-foreground">Form auto-closes once this many players have registered.</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
                    Organizer account, login password and contact details are managed from the super-admin panel — they no longer live in this dialog.
                  </p>
                </>
              )}

              {activeSection === "auction" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Points Per Team (₹)</Label>
                      <Input type="number" value={editForm.basePurse as number || 0} onChange={e => setEditForm(f => ({ ...f, basePurse: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Value of a Player (₹)</Label>
                      <Input type="number" value={editForm.minBid as number || 0} onChange={e => setEditForm(f => ({ ...f, minBid: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold">Bid Increment Tiers</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Increment rises as bids grow. Last tier has no upper limit.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setBidTiers(t => [...t.slice(0, -1), { upTo: 0, increment: 0 }, { increment: t[t.length - 1]?.increment ?? 100000 }])}
                      >
                        + Add Tier
                      </Button>
                    </div>
                    {bidTiers.map((tier, i) => {
                      const isLast = i === bidTiers.length - 1;
                      return (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">{isLast ? "Above all — Increment (₹)" : `Tier ${i + 1} — Up to (₹)`}</Label>
                            {isLast ? (
                              <div className="h-9 flex items-center px-3 rounded-md border border-border/50 bg-muted/20 text-muted-foreground text-sm">No limit</div>
                            ) : (
                              <Input
                                type="number"
                                value={tier.upTo ?? ""}
                                onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, upTo: Number(e.target.value) || 0 } : x))}
                                placeholder="e.g. 100000"
                              />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Increment (₹)</Label>
                            <Input
                              type="number"
                              value={tier.increment || ""}
                              onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, increment: Number(e.target.value) || 0 } : x))}
                              placeholder="e.g. 25000"
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            disabled={bidTiers.length <= 1}
                            onClick={() => setBidTiers(t => {
                              const next = t.filter((_, j) => j !== i);
                              if (next.length === 0) return t;
                              const last = { ...next[next.length - 1] };
                              delete last.upTo;
                              return [...next.slice(0, -1), last];
                            })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-muted-foreground" /> First Bid Timer (seconds)
                      </Label>
                      <Input type="number" value={editForm.timerSeconds as number || 30} onChange={e => setEditForm(f => ({ ...f, timerSeconds: e.target.value }))} min={5} max={300} />
                      <p className="text-xs text-muted-foreground">Timer when a new player is presented (no bids yet)</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-primary" /> Subsequent Bid Timer (seconds)
                      </Label>
                      <Input type="number" value={editForm.bidTimerSeconds as number || 15} onChange={e => setEditForm(f => ({ ...f, bidTimerSeconds: e.target.value }))} min={5} max={300} />
                      <p className="text-xs text-muted-foreground">Auto-restarts after every bid — owner panel bidding locks when it expires</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <Label className="flex items-center gap-1.5">
                      <Dices className="w-3.5 h-3.5 text-muted-foreground" /> Player Selection Mode
                    </Label>
                    <Select
                      value={editForm.playerSelectionMode as string || "sequential"}
                      onValueChange={v => setEditForm(f => ({ ...f, playerSelectionMode: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="dark">
                        <SelectItem value="sequential">Sequential — players come in order (by ID)</SelectItem>
                        <SelectItem value="random">Random — randomized draw each time</SelectItem>
                        <SelectItem value="manual">Manual — operator picks player from the queue</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Controls what "Next Player" does in the operator panel. Manual hides the Next button — operator must select from the queue list.
                    </p>
                  </div>
                  <div className="space-y-3 border-t border-border pt-4">
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400/70" /> Squad Rules
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reserve purse protection and player count limits. Set 0 to disable each rule.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Minimum Squad Size</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editForm.minimumSquadSize as string ?? "0"}
                          onChange={e => setEditForm(f => ({ ...f, minimumSquadSize: e.target.value }))}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Reserve purse is held for unfilled slots. Calculated using the lowest available base price at auction time.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Maximum Squad Size</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editForm.maximumSquadSize as string ?? "0"}
                          onChange={e => setEditForm(f => ({ ...f, maximumSquadSize: e.target.value }))}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Hard cap — teams cannot bid once they reach this many players.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeSection === "broadcast" && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" /> Sponsor Logos
                      </Label>
                      <span className="text-[10px] text-muted-foreground">{sponsorLogos.length} logo{sponsorLogos.length === 1 ? "" : "s"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Logos rotate in the LED display top-right corner every 2 seconds.</p>
                    <SponsorLogosEditor logos={sponsorLogos} onChange={setSponsorLogos} />
                  </div>
                  <div className="border-t border-border pt-4 space-y-4">
                    {/* Master Audio toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold flex items-center gap-1.5">
                          {editForm.audioEnabled
                            ? <Volume2 className="w-4 h-4 text-muted-foreground" />
                            : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                          Broadcast Audio
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Plays on the LED display screen only</p>
                      </div>
                      <Switch
                        checked={editForm.audioEnabled === true}
                        onCheckedChange={(v) => setEditForm(f => ({ ...f, audioEnabled: v }))}
                      />
                    </div>

                    {editForm.audioEnabled === true && (
                      <>
                        {/* Master Volume */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Master Volume</Label>
                            <span className="text-xs font-medium tabular-nums">{editForm.masterVolume}%</span>
                          </div>
                          <Slider
                            min={0} max={100} step={1}
                            value={[Number(editForm.masterVolume)]}
                            onValueChange={([v]) => setEditForm(f => ({ ...f, masterVolume: String(v) }))}
                          />
                        </div>

                        {/* Countdown Sound */}
                        <div className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                              Countdown Sound
                              <span className="text-[10px] text-muted-foreground font-normal">last 5 seconds</span>
                            </Label>
                            <Switch
                              checked={editForm.countdownSoundEnabled === true}
                              onCheckedChange={(v) => setEditForm(f => ({ ...f, countdownSoundEnabled: v }))}
                            />
                          </div>

                          {editForm.countdownSoundEnabled === true && (
                            <div className="space-y-2.5">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Custom audio file</Label>
                                <div className="flex items-center gap-2">
                                  <label className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                      <Upload className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{countdownFileName || "Upload .mp3 / .ogg / .wav"}</span>
                                    </div>
                                    <input
                                      type="file"
                                      accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac"
                                      className="hidden"
                                      onChange={(e) => handleAudioUpload(e, "countdownSoundUrl", setCountdownFileName)}
                                    />
                                  </label>
                                  {editForm.countdownSoundUrl && (
                                    <Button
                                      type="button" variant="ghost" size="icon"
                                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => { setEditForm(f => ({ ...f, countdownSoundUrl: "" })); setCountdownFileName(""); }}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {editForm.countdownSoundUrl ? "Custom file loaded — will replace built-in tick" : "No file selected — built-in digital tick will play"}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[11px] text-muted-foreground">Volume</Label>
                                    <span className="text-[11px] font-medium tabular-nums">{editForm.countdownSoundVolume}%</span>
                                  </div>
                                  <Slider
                                    min={0} max={100} step={1}
                                    value={[Number(editForm.countdownSoundVolume)]}
                                    onValueChange={([v]) => setEditForm(f => ({ ...f, countdownSoundVolume: String(v) }))}
                                  />
                                </div>
                                <Button
                                  type="button" size="sm" variant="outline"
                                  className="gap-1.5 h-7 text-xs shrink-0"
                                  onClick={previewCountdownSound}
                                >
                                  <Play className="w-3 h-3" /> Preview
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Sold Sound */}
                        <div className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                              <Gavel className="w-3.5 h-3.5 text-muted-foreground" />
                              Sold Sound
                              <span className="text-[10px] text-muted-foreground font-normal">on player sold</span>
                            </Label>
                            <Switch
                              checked={editForm.soldSoundEnabled === true}
                              onCheckedChange={(v) => setEditForm(f => ({ ...f, soldSoundEnabled: v }))}
                            />
                          </div>

                          {editForm.soldSoundEnabled === true && (
                            <div className="space-y-2.5">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Custom audio file</Label>
                                <div className="flex items-center gap-2">
                                  <label className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                      <Upload className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{soldFileName || "Upload .mp3 / .ogg / .wav"}</span>
                                    </div>
                                    <input
                                      type="file"
                                      accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac"
                                      className="hidden"
                                      onChange={(e) => handleAudioUpload(e, "soldSoundUrl", setSoldFileName)}
                                    />
                                  </label>
                                  {editForm.soldSoundUrl && (
                                    <Button
                                      type="button" variant="ghost" size="icon"
                                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => { setEditForm(f => ({ ...f, soldSoundUrl: "" })); setSoldFileName(""); }}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {editForm.soldSoundUrl ? "Custom file loaded — will replace built-in fanfare" : "No file selected — built-in fanfare will play"}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[11px] text-muted-foreground">Volume</Label>
                                    <span className="text-[11px] font-medium tabular-nums">{editForm.soldSoundVolume}%</span>
                                  </div>
                                  <Slider
                                    min={0} max={100} step={1}
                                    value={[Number(editForm.soldSoundVolume)]}
                                    onValueChange={([v]) => setEditForm(f => ({ ...f, soldSoundVolume: String(v) }))}
                                  />
                                </div>
                                <Button
                                  type="button" size="sm" variant="outline"
                                  className="gap-1.5 h-7 text-xs shrink-0"
                                  onClick={previewSoldSound}
                                >
                                  <Play className="w-3 h-3" /> Preview
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {activeSection === "recovery" && (
                <>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-muted-foreground" /> Auction Reset
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">Reset the live auction state — clears bids, returns all sold players to the pool, restores team purses.</p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive h-auto py-3"
                      onClick={() => {
                        setEditOpen(false);
                        navigate(`/tournament/${tournamentId}/reset`);
                      }}
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold">Open Auction Reset Page</span>
                        <span className="text-[11px] text-muted-foreground font-normal">Password-protected — operator gets one free reset, super admin override available.</span>
                      </div>
                    </Button>
                  </div>

                  <div className="border-t border-border pt-4 space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Gavel className="w-4 h-4 text-muted-foreground" /> Operator Recovery
                    </Label>
                    <p className="text-xs text-muted-foreground">Pause the auction or jump to the operator panel to undo the last bid.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="gap-2 h-auto py-3"
                        onClick={() => { setEditOpen(false); navigate(`/tournament/${tournamentId}/auction`); }}
                      >
                        <Gavel className="w-4 h-4" />
                        <span className="text-sm">Operator Panel</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 h-auto py-3"
                        onClick={() => { setEditOpen(false); window.open(`/tournament/${tournamentId}/display`, "_blank"); }}
                      >
                        <Monitor className="w-4 h-4" />
                        <span className="text-sm">Reload LED Display</span>
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-muted-foreground">Advanced recovery coming soon</p>
                          <p className="text-xs text-muted-foreground">Auto-save snapshots every 5 seconds, crash recovery, lock team bidding, force timer stop and re-auction queue management are planned for the next release.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex items-center gap-2 px-6 py-4 border-t border-border bg-card/50 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={resetCurrentTab}
              disabled={activeSection === "recovery"}
              title="Discard unsaved changes in this tab"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Section
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateTournament.isPending} className="min-w-[140px]">
              {updateTournament.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImageEditorDialog
        open={logoEditorOpen}
        onClose={() => setLogoEditorOpen(false)}
        initialUrl={editForm.logoUrl as string || undefined}
        aspect={1}
        title="Tournament Logo"
        onSave={url => setEditForm(f => ({ ...f, logoUrl: url }))}
      />
    </AppLayout>
  );
}
