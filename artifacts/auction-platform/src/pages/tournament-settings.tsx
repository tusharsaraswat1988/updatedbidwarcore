import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useUpdateTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { HintLabel } from "@/components/ui/hint-label";
import type { SettingsFocusField, SettingsTab } from "@/lib/settings-navigation";
import { settingsPath } from "@/lib/settings-navigation";
import { auctionResetPath } from "@/lib/tournament-navigation";
import { DISPLAY_THEMES_LIST, type DisplayThemeName } from "@/lib/display-theme";
import { AuctionAudioManager } from "@/lib/audio-manager";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Settings,
  Building2, Timer, Trash2,
  Gavel, Monitor, ShieldAlert, Image as ImageIcon, X, RotateCcw,
  Calendar as CalendarIcon, AlertTriangle, Upload, Pencil,
  Volume2, VolumeX, Play, Coffee, ChevronDown, ChevronRight as ChevronRightIcon,
  Megaphone, Clapperboard, Loader2, Info, CalendarDays, CircleDot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { type SponsorLogo, normalizeSponsorLogos } from "@/lib/sponsor-logo";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";

function SponsorLogosEditor({
  logos,
  onChange,
  onUploadFile,
  uploadingIdx,
}: {
  logos: SponsorLogo[];
  onChange: (logos: SponsorLogo[]) => void;
  onUploadFile: (file: File, idx: number | "new") => void;
  uploadingIdx: number | "new" | null;
}) {
  return (
    <div className="space-y-2">
      {logos.length > 0 && (
        <div className="hidden sm:grid sm:grid-cols-[3.5rem_1fr_1fr_2rem] sm:gap-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Logo *</span>
          <span>Name</span>
          <span>Type</span>
          <span />
        </div>
      )}
      {logos.map((logo, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/5 p-2">
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground sm:hidden">Logo *</span>
            <label className="cursor-pointer" title="Click to replace logo image">
              <div className="w-14 h-10 rounded border border-border/50 bg-muted/20 overflow-hidden flex items-center justify-center">
                {uploadingIdx === i ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : logo.url ? (
                  <img src={logo.url} alt={logo.name || logo.type || "logo"} className="w-full h-full object-contain" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFile(f, i); e.target.value = ""; }}
                disabled={uploadingIdx !== null}
              />
            </label>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] text-muted-foreground sm:hidden">Name</span>
              <Input
                className="h-8 text-sm"
                value={logo.name ?? ""}
                onChange={e => { const next = [...logos]; next[i] = { ...next[i], name: e.target.value }; onChange(next); }}
                placeholder="Sponsor name (optional)"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] text-muted-foreground sm:hidden">Type</span>
              <Input
                className="h-8 text-sm"
                value={logo.type ?? ""}
                onChange={e => { const next = [...logos]; next[i] = { ...next[i], type: e.target.value }; onChange(next); }}
                placeholder="Sponsor type (optional)"
              />
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive mt-0 sm:mt-0"
            onClick={() => onChange(logos.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <label className="cursor-pointer block">
        <div className={`flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed text-xs transition-colors ${
          uploadingIdx === "new"
            ? "border-border/50 text-muted-foreground cursor-wait"
            : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        }`}>
          {uploadingIdx === "new"
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
            : <><Upload className="w-3.5 h-3.5" /> Add Sponsor Logo</>
          }
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFile(f, "new"); e.target.value = ""; }}
          disabled={uploadingIdx !== null}
        />
      </label>
    </div>
  );
}

export default function TournamentSettings() {
  const [, params] = useRoute("/tournament/:id/settings");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const { toast } = useToast();

  const [initialized, setInitialized] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsTab>("identity");
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  const audioPreviewRef = useRef<AuctionAudioManager | null>(null);
  const [countdownFileName, setCountdownFileName] = useState("");
  const [soldFileName, setSoldFileName] = useState("");
  const [breakEndFileName, setBreakEndFileName] = useState("");
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  const [bidTiers, setBidTiers] = useState<Array<{ upTo?: number; increment: number }>>([
    { increment: 0 },
  ]);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [showAdvancedAuction, setShowAdvancedAuction] = useState(false);
  const [datePickerVal, setDatePickerVal] = useState("");
  const [mainBannerUploading, setMainBannerUploading] = useState(false);
  const [sponsorUploadingIdx, setSponsorUploadingIdx] = useState<number | "new" | null>(null);
  const [hubSports, setHubSports] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [highlightField, setHighlightField] = useState<SettingsFocusField | null>(null);
  const [auditReason, setAuditReason] = useState("");

  const [displayTheme, setDisplayTheme] = useState<DisplayThemeName>(() => {
    try { return (localStorage.getItem(`display_theme_${tournamentId}`) ?? "default") as DisplayThemeName; }
    catch { return "default"; }
  });

  useEffect(() => {
    fetch("/api/sports").then(r => r.json()).then((d: { id: number; name: string; slug: string }[]) => setHubSports(d)).catch(() => {});
  }, []);

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const updateTournament = useUpdateTournament();

  useEffect(() => {
    if (!tournament || initialized) return;

    const initialForm = {
      name: tournament.name,
      sport: tournament.sport,
      venue: tournament.venue || "",
      auctionDate: tournament.auctionDate || "",
      auctionTime: tournament.auctionTime || "",
      logoUrl: tournament.logoUrl && !tournament.logoUrl.startsWith("data:") ? tournament.logoUrl : "",
      basePurse: String(tournament.basePurse ?? ""),
      minBid: String(tournament.minBid ?? ""),
      timerSeconds: String(tournament.timerSeconds ?? "30"),
      bidTimerSeconds: String(tournament.bidTimerSeconds ?? "15"),
      bidExtensionEnabled: tournament.bidExtensionEnabled ?? false,
      bidExtensionThresholdSeconds: String(tournament.bidExtensionThresholdSeconds ?? "3"),
      bidExtensionSeconds: String(tournament.bidExtensionSeconds ?? "5"),
      playerSelectionMode: tournament.playerSelectionMode || "sequential",
      registrationDeadline: tournament.registrationDeadline || "",
      registrationLimit: tournament.registrationLimit != null ? String(tournament.registrationLimit) : "",
      minimumSquadSize: String(tournament.minimumSquadSize ?? 0),
      maximumSquadSize: String(tournament.maximumSquadSize ?? 0),
      audioEnabled: tournament.audioEnabled ?? true,
      masterVolume: String(tournament.masterVolume ?? 80),
      countdownSoundEnabled: tournament.countdownSoundEnabled ?? true,
      countdownSoundUrl: tournament.countdownSoundUrl ?? "",
      countdownSoundVolume: String(tournament.countdownSoundVolume ?? 70),
      soldSoundEnabled: tournament.soldSoundEnabled ?? true,
      soldSoundUrl: tournament.soldSoundUrl ?? "",
      soldSoundVolume: String(tournament.soldSoundVolume ?? 80),
      breakEndMusicEnabled: tournament.breakEndMusicEnabled ?? false,
      breakEndMusicUrl: String(tournament.breakEndMusicUrl ?? ""),
      breakEndMusicVolume: String(tournament.breakEndMusicVolume ?? 80),
      mainBannerUrl: tournament.mainBannerUrl ?? "",
      mainBannerEnabled: tournament.mainBannerEnabled ?? false,
      mainBannerFit: tournament.mainBannerFit ?? "cover",
      matchDates: tournament.matchDates ?? "",
      scoringEnabled: tournament.scoringEnabled ?? false,
      scoringPin: tournament.scoringPin ?? "",
    };
    setEditForm(initialForm);

    setCountdownFileName(tournament.countdownSoundUrl ? "Custom file uploaded" : "");
    setSoldFileName(tournament.soldSoundUrl ? "Custom file uploaded" : "");
    setBreakEndFileName(tournament.breakEndMusicUrl ? "Custom file uploaded" : "");

    let initialTiers: Array<{ upTo?: number; increment: number }>;
    try {
      const rawTiers = tournament.bidTiers;
      if (rawTiers) {
        const parsed = JSON.parse(rawTiers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialTiers = parsed;
        } else { throw new Error("empty"); }
      } else {
        initialTiers = [
          { upTo: tournament.bidTier1UpTo ?? 100000, increment: tournament.bidTier1Increment ?? 25000 },
          { upTo: tournament.bidTier2UpTo ?? 200000, increment: tournament.bidTier2Increment ?? 50000 },
          { increment: tournament.bidTier3Increment ?? 100000 },
        ];
      }
    } catch {
      initialTiers = [{ upTo: 100000, increment: 25000 }, { upTo: 200000, increment: 50000 }, { increment: 100000 }];
    }
    setBidTiers(initialTiers);

    let initialSponsors: SponsorLogo[];
    try {
      const parsed = tournament.sponsorLogos ? JSON.parse(tournament.sponsorLogos) : [];
      initialSponsors = normalizeSponsorLogos(parsed);
    } catch { initialSponsors = []; }
    setSponsorLogos(initialSponsors);

    setInitialized(true);
  }, [tournament, initialized]);

  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as SettingsTab | null;
    if (tab === "identity" || tab === "auction" || tab === "broadcast" || tab === "scoring" || tab === "recovery") {
      setActiveSection(tab);
    }
    const focus = params.get("focus") as SettingsFocusField | null;
    if (!focus) return;
    if (focus === "registration") setActiveSection("identity");
    if (["bidTiers", "minSquad", "maxSquad"].includes(focus)) setShowAdvancedAuction(true);
    setHighlightField(focus);
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`settings-field-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    const clearTimer = window.setTimeout(() => setHighlightField(null), 4500);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [initialized]);

  function fieldWrapClass(field: SettingsFocusField, needsAttention = false) {
    const highlight = highlightField === field ? "ring-2 ring-primary/50 rounded-lg p-1 -m-1" : "";
    const pulse = needsAttention ? "ring-2 ring-amber-500/50 animate-pulse rounded-lg p-1 -m-1" : "";
    return highlight || pulse;
  }

  function applyCricketPreset() {
    setActiveSection("auction");
    setShowAdvancedAuction(true);
    const increment = Number(editForm.minBid) > 0 ? Math.max(5000, Math.round(Number(editForm.minBid) / 2)) : 5000;
    setEditForm(f => ({
      ...f,
      timerSeconds: "30",
      bidTimerSeconds: "15",
      playerSelectionMode: "random",
      minimumSquadSize: Number(f.minimumSquadSize) > 0 ? f.minimumSquadSize : "11",
      maximumSquadSize: Number(f.maximumSquadSize) > 0 ? f.maximumSquadSize : "15",
      minBid: Number(f.minBid) > 0 ? f.minBid : "10000",
    }));
    setBidTiers([{ increment }]);
    toast({ title: "Cricket preset applied", description: "Review values and click Save Changes." });
  }

  function handleDisplayThemeChange(t: DisplayThemeName) {
    setDisplayTheme(t);
    try { localStorage.setItem(`display_theme_${tournamentId}`, t); } catch { /* ignore */ }
    try {
      const ch = new BroadcastChannel("bidwar_display_theme");
      ch.postMessage({ tournamentId, theme: t });
      ch.close();
    } catch { /* ignore */ }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB"); e.target.value = ""; return; }
    setMainBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload failed");
      const data = await r.json() as { url?: string };
      if (data.url) setEditForm(f => ({ ...f, mainBannerUrl: data.url as string }));
    } catch { alert("Image upload failed. Please try again."); }
    finally { setMainBannerUploading(false); e.target.value = ""; }
  }

  async function handleSponsorLogoUpload(file: File, idx: number | "new") {
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB"); return; }
    setSponsorUploadingIdx(idx);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload failed");
      const data = await r.json() as { url?: string };
      if (data.url) {
        const url = data.url as string;
        if (idx === "new") {
          setSponsorLogos(prev => [...prev, { url, name: "", type: "" }]);
        } else {
          setSponsorLogos(prev => prev.map((l, i) => i === idx ? { ...l, url } : l));
        }
      }
    } catch { alert("Sponsor logo upload failed. Please try again."); }
    finally { setSponsorUploadingIdx(null); }
  }

  function handleAudioUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "countdownSoundUrl" | "soldSoundUrl" | "breakEndMusicUrl",
    setFileName: (n: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("Audio file must be under 8 MB"); e.target.value = ""; return; }
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
      audioEnabled: true, masterVolume: 80,
      countdownSoundEnabled: true,
      countdownSoundUrl: (editForm.countdownSoundUrl as string).trim() || null,
      countdownSoundVolume: Number(editForm.countdownSoundVolume) || 70,
      soldSoundEnabled: false, soldSoundUrl: null, soldSoundVolume: 0,
      breakEndMusicEnabled: false, breakEndMusicUrl: null, breakEndMusicVolume: 80,
    });
    mgr.previewCountdown();
  }

  async function previewSoldSound() {
    if (!audioPreviewRef.current) audioPreviewRef.current = new AuctionAudioManager();
    const mgr = audioPreviewRef.current;
    await mgr.unlock();
    mgr.setSettings({
      audioEnabled: true, masterVolume: 80,
      countdownSoundEnabled: false, countdownSoundUrl: null, countdownSoundVolume: 0,
      soldSoundEnabled: true,
      soldSoundUrl: (editForm.soldSoundUrl as string).trim() || null,
      soldSoundVolume: Number(editForm.soldSoundVolume) || 80,
      breakEndMusicEnabled: false, breakEndMusicUrl: null, breakEndMusicVolume: 80,
    });
    mgr.previewSold();
  }

  async function previewBreakEnd() {
    if (!audioPreviewRef.current) audioPreviewRef.current = new AuctionAudioManager();
    const mgr = audioPreviewRef.current;
    await mgr.unlock();
    mgr.setSettings({
      audioEnabled: true, masterVolume: 80,
      countdownSoundEnabled: false, countdownSoundUrl: null, countdownSoundVolume: 0,
      soldSoundEnabled: false, soldSoundUrl: null, soldSoundVolume: 0,
      breakEndMusicEnabled: true,
      breakEndMusicUrl: (editForm.breakEndMusicUrl as string).trim() || null,
      breakEndMusicVolume: Number(editForm.breakEndMusicVolume) || 80,
    });
    mgr.previewBreakEnd();
  }

  async function handleSave() {
    if (!isAuditReasonValid(auditReason)) {
      toast({ title: "Reason required", description: "Auction rule changes require a reason (minimum 10 characters).", variant: "destructive" });
      return;
    }
    const filteredLogos = sponsorLogos.filter(l => l.url.trim());
    await updateTournament.mutateAsync({
      tournamentId,
      data: {
        reason: auditReason.trim(),
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
        bidExtensionEnabled: editForm.bidExtensionEnabled === true,
        bidExtensionThresholdSeconds: Number(editForm.bidExtensionThresholdSeconds) || undefined,
        bidExtensionSeconds: Number(editForm.bidExtensionSeconds) || undefined,
        playerSelectionMode: (editForm.playerSelectionMode as string || undefined) as import("@workspace/api-client-react").TournamentUpdatePlayerSelectionMode | undefined,
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
        breakEndMusicEnabled: editForm.breakEndMusicEnabled === true,
        breakEndMusicUrl: (editForm.breakEndMusicUrl as string).trim() || null,
        breakEndMusicVolume: Number(editForm.breakEndMusicVolume) || 80,
        mainBannerUrl: (editForm.mainBannerUrl as string).trim() || null,
        mainBannerEnabled: editForm.mainBannerEnabled === true,
        mainBannerFit: ((editForm.mainBannerFit as string) || "cover") as "cover" | "contain",
        matchDates: (editForm.matchDates as string).trim() || null,
        scoringEnabled: editForm.scoringEnabled === true,
        scoringPin: (editForm.scoringPin as string).trim() || null,
      },
    });
    qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
    toast({ title: "Settings saved", description: "Your auction rules have been updated." });
    navigate(`/tournament/${tournamentId}`);
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "identity", label: "Basic Info", icon: Building2 },
    { id: "auction", label: "Auction Rules", icon: Gavel },
    { id: "broadcast", label: "Screen & Sound", icon: Megaphone },
    ...(editForm.sport === "cricket"
      ? [{ id: "scoring" as const, label: "Cricket Scoring", icon: CircleDot }]
      : []),
    { id: "recovery", label: "Reset", icon: ShieldAlert },
  ];

  if (loadingTournament || !initialized) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={() => navigate(`/tournament/${tournamentId}`)}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
              <Settings className="w-5 h-5 text-primary flex-shrink-0" />
              Tournament Settings
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tournament?.name} — all changes take effect when you click Save.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 flex-shrink-0 min-w-[220px] max-w-md">
          <AuditReasonField
            value={auditReason}
            onChange={setAuditReason}
            label="Reason for changes"
            placeholder="Why are auction rules or settings being updated?"
          />
          <Button
            onClick={handleSave}
            disabled={updateTournament.isPending || !isAuditReasonValid(auditReason)}
            className="min-w-[140px]"
          >
            {updateTournament.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Sticky tab strip */}
      <div className="flex border-b border-border mb-6 overflow-x-auto sticky top-0 bg-background z-10 -mx-8 px-8 pt-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
                active
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-5 pb-12 max-w-3xl">

        {/* ── IDENTITY ── */}
        {activeSection === "identity" && (
          <>
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border/60 bg-card/50">
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
                    {(hubSports.length > 0 ? hubSports : [
                      { slug: "cricket", name: "Cricket" }, { slug: "football", name: "Football" },
                      { slug: "kabaddi", name: "Kabaddi" }, { slug: "badminton", name: "Badminton" },
                      { slug: "volleyball", name: "Volleyball" }, { slug: "esports", name: "E-Sports" },
                      { slug: "other", name: "Other" },
                    ]).map(s => (
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

            {/* Match Schedule */}
            <div className="border-t border-border/60 pt-4 space-y-3">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                  Match Schedule
                  <Badge variant="outline" className="text-xs font-normal ml-0.5">Optional</Badge>
                </Label>
                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                  Add the dates when matches will be played. When set, player availability is shown as per-day checkboxes instead of a free-text field. Leave empty to hide availability from all player forms and views.
                </p>
              </div>
              {(() => {
                const settingsMatchDates = (editForm.matchDates as string || "").split(",").filter(Boolean);
                return (
                  <>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={datePickerVal}
                        onChange={e => setDatePickerVal(e.target.value)}
                        className="w-auto"
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!datePickerVal || settingsMatchDates.includes(datePickerVal)) return;
                            setEditForm(f => ({ ...f, matchDates: [...settingsMatchDates, datePickerVal].sort().join(",") }));
                            setDatePickerVal("");
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!datePickerVal || settingsMatchDates.includes(datePickerVal)}
                        onClick={() => {
                          if (!datePickerVal || settingsMatchDates.includes(datePickerVal)) return;
                          setEditForm(f => ({ ...f, matchDates: [...settingsMatchDates, datePickerVal].sort().join(",") }));
                          setDatePickerVal("");
                        }}
                      >
                        Add Date
                      </Button>
                    </div>
                    {settingsMatchDates.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {settingsMatchDates.map(d => {
                          const label = new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                          return (
                            <Badge key={d} variant="secondary" className="gap-1.5 pr-1.5">
                              {label}
                              <button
                                type="button"
                                className="hover:text-destructive rounded-sm"
                                onClick={() => setEditForm(f => ({ ...f, matchDates: settingsMatchDates.filter(x => x !== d).join(",") }))}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div id="settings-field-registration" className={`border-t border-border/60 pt-4 space-y-3 ${fieldWrapClass("registration")}`}>
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
              Organizer account, login password and contact details are managed by the platform support team.
            </p>
          </>
        )}

        {/* ── AUCTION RULES ── */}
        {activeSection === "auction" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
              <p className="text-xs text-muted-foreground">These are the most important settings. Set them before your auction starts.</p>
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={applyCricketPreset}>
                Use standard cricket settings
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Team Budget (₹)
                  <FieldTooltip text="How many rupees each team can spend in total. Every team starts with this amount. Set this to your league's purse size, e.g. ₹1,00,00,000 for IPL-style." />
                </Label>
                <Input type="number" value={editForm.basePurse as number || 0} onChange={e => setEditForm(f => ({ ...f, basePurse: e.target.value }))} />
              </div>
              <div id="settings-field-minBid" className={`space-y-2 ${fieldWrapClass("minBid", Number(editForm.minBid) <= 0)}`}>
                <Label className="flex items-center gap-1">
                  <HintLabel hint="Sabse kam daam jahan se bidding shuru hogi">Minimum Player Value (₹)</HintLabel>
                  <FieldTooltip text="The lowest amount any player can be sold for. Bidding for a player starts at this value unless the player's category overrides it." />
                </Label>
                <Input type="number" value={editForm.minBid as number || 0} onChange={e => setEditForm(f => ({ ...f, minBid: e.target.value }))} />
              </div>
            </div>

            <div id="settings-field-bidTiers" className={`space-y-2 border-t border-border pt-4 ${fieldWrapClass("bidTiers", !bidTiers.some(t => t.increment > 0))}`}>
              <Label className="flex items-center gap-1 text-sm font-semibold">
                Bid Increase Amount (₹)
                <FieldTooltip text="How much the bid goes up each time a team raises. For example, if set to ₹10,000 and the current bid is ₹50,000 — the next bid will be ₹60,000. Use the Advanced section below if you want the increment to change as bids get higher." />
              </Label>
              <p className="text-xs text-muted-foreground">How much each bid raise adds to the current amount.</p>
              {bidTiers.length === 1 ? (
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    className="max-w-[200px]"
                    value={bidTiers[0]?.increment || ""}
                    onChange={e => setBidTiers([{ increment: Number(e.target.value) || 0 }])}
                    placeholder="e.g. 10000"
                  />
                  <span className="text-xs text-muted-foreground">added with every raise</span>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-lg bg-muted/20 border border-border/50 text-xs text-muted-foreground">
                  Advanced bid tiers are enabled — see below to adjust.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div id="settings-field-openingTimer" className={`space-y-2 ${fieldWrapClass("openingTimer", Number(editForm.timerSeconds) <= 0)}`}>
                <Label className="flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                  <HintLabel hint="Naya player aane par kitni der wait karein">Opening Timer (seconds)</HintLabel>
                  <FieldTooltip text="Countdown shown when a new player appears on screen before anyone bids. If no one bids in time, the player is passed." />
                </Label>
                <Input type="number" value={editForm.timerSeconds as number || 30} onChange={e => setEditForm(f => ({ ...f, timerSeconds: e.target.value }))} min={5} max={300} />
                <p className="text-xs text-muted-foreground">Time before first bid — recommended: 30 seconds</p>
              </div>
              <div id="settings-field-bidTimer" className={`space-y-2 ${fieldWrapClass("bidTimer", Number(editForm.bidTimerSeconds) <= 0)}`}>
                <Label className="flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-primary" />
                  <HintLabel hint="Har bid ke baad kitni der">Bid Timer (seconds)</HintLabel>
                  <FieldTooltip text="After each bid, this timer resets. When it runs out, the highest bidder wins the player. Shorter timers create more urgency — recommended: 15 seconds." />
                </Label>
                <Input type="number" value={editForm.bidTimerSeconds as number || 15} onChange={e => setEditForm(f => ({ ...f, bidTimerSeconds: e.target.value }))} min={5} max={300} />
                <p className="text-xs text-muted-foreground">Time between bids — recommended: 15 seconds</p>
              </div>
            </div>

            <div id="settings-field-bidExtension" className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="flex items-center gap-1">
                    Bid Extension
                    <FieldTooltip text="When the timer is in its last few seconds and a new bid arrives, add extra seconds instead of only resetting to the full bid timer." />
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">Extend the clock on late bids — common in live auctions.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editForm.bidExtensionEnabled === true}
                  onClick={() => setEditForm(f => ({ ...f, bidExtensionEnabled: !f.bidExtensionEnabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editForm.bidExtensionEnabled ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editForm.bidExtensionEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>
              {editForm.bidExtensionEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Trigger threshold (seconds)</Label>
                    <Input
                      type="number"
                      value={editForm.bidExtensionThresholdSeconds as string}
                      onChange={e => setEditForm(f => ({ ...f, bidExtensionThresholdSeconds: e.target.value }))}
                      min={1}
                      max={60}
                    />
                    <p className="text-xs text-muted-foreground">Extend when timer has this many seconds or fewer left.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Extension duration (seconds)</Label>
                    <Input
                      type="number"
                      value={editForm.bidExtensionSeconds as string}
                      onChange={e => setEditForm(f => ({ ...f, bidExtensionSeconds: e.target.value }))}
                      min={1}
                      max={120}
                    />
                    <p className="text-xs text-muted-foreground">Seconds added to the remaining time on a late bid.</p>
                  </div>
                </div>
              )}
            </div>

            <div id="settings-field-playerOrder" className={`space-y-2 border-t border-border pt-4 ${fieldWrapClass("playerOrder")}`}>
              <Label className="flex items-center gap-1">
                Player Order
                <FieldTooltip text="Controls which player comes up next when the operator presses Next Player. Sequential = in the order you added them. Random = random draw each time. Manual = operator picks from a list." />
              </Label>
              <Select
                value={editForm.playerSelectionMode as string || "sequential"}
                onValueChange={v => setEditForm(f => ({ ...f, playerSelectionMode: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="dark">
                  <SelectItem value="sequential">In order — players come up one by one as added</SelectItem>
                  <SelectItem value="random">Random draw — recommended for most tournaments</SelectItem>
                  <SelectItem value="manual">Manual — operator picks from the queue list</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowAdvancedAuction(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left"
              >
                {showAdvancedAuction
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRightIcon className="w-4 h-4" />}
                Advanced Settings
                <span className="ml-auto text-[10px] font-normal text-muted-foreground/60">Squad limits, tiered bid increments</span>
              </button>

              {showAdvancedAuction && (
                <div className="mt-4 space-y-5">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-1">
                        Tiered Bid Increase Rules
                        <FieldTooltip text="For advanced leagues: set different bid increments at different price points. For example, bids under ₹1L go up by ₹10K, bids over ₹1L go up by ₹25K. Most organisers don't need this — leave it as one tier." />
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        The bid amount added per raise changes as bids grow higher. Most auctions only need one tier.
                      </p>
                    </div>
                    <div className="flex justify-end">
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
                            <Label className="text-[10px] text-muted-foreground">{isLast ? "Any amount above — Raise by (₹)" : `Up to (₹) — Tier ${i + 1}`}</Label>
                            {isLast ? (
                              <div className="h-9 flex items-center px-3 rounded-md border border-border/50 bg-muted/20 text-muted-foreground text-sm">No upper limit</div>
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
                            <Label className="text-[10px] text-muted-foreground">Raise by (₹)</Label>
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

                  <div className="space-y-3 border-t border-border pt-4">
                    <div>
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400/70" /> Squad Size Limits
                        <FieldTooltip text="Control how many players each team must or can buy. Minimum: teams must reach this count — the system reserves budget for unfilled slots. Maximum: teams cannot bid once full. Set 0 to disable." />
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Set 0 to disable each limit.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div id="settings-field-minSquad" className={`space-y-2 ${fieldWrapClass("minSquad", Number(editForm.minimumSquadSize) <= 0)}`}>
                        <Label className="text-xs">Minimum Players per Team</Label>
                        <Input
                          type="number" min={0} max={100}
                          value={editForm.minimumSquadSize as string ?? "0"}
                          onChange={e => setEditForm(f => ({ ...f, minimumSquadSize: e.target.value }))}
                        />
                        <p className="text-[10px] text-muted-foreground">Budget is reserved for unfilled slots so teams can't overbid early.</p>
                      </div>
                      <div id="settings-field-maxSquad" className={`space-y-2 ${fieldWrapClass("maxSquad", Number(editForm.maximumSquadSize) <= 0)}`}>
                        <Label className="text-xs">Maximum Players per Team</Label>
                        <Input
                          type="number" min={0} max={100}
                          value={editForm.maximumSquadSize as string ?? "0"}
                          onChange={e => setEditForm(f => ({ ...f, maximumSquadSize: e.target.value }))}
                        />
                        <p className="text-[10px] text-muted-foreground">Teams cannot bid once they reach this count.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── BROADCAST ── */}
        {activeSection === "broadcast" && (
          <>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Clapperboard className="w-4 h-4 text-muted-foreground" /> Main Banner
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Full-screen display for felicitation, announcements, chief guest welcome, winner moments, etc. Toggle it live from the operator panel.</p>
                </div>
                <Switch
                  checked={editForm.mainBannerEnabled === true}
                  onCheckedChange={(v) => setEditForm(f => ({ ...f, mainBannerEnabled: v }))}
                />
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-3">
                {editForm.mainBannerUrl ? (
                  <div className="space-y-2">
                    <div className="relative rounded-md overflow-hidden border border-border/40 bg-black" style={{ aspectRatio: "16/7" }}>
                      <img
                        src={editForm.mainBannerUrl as string}
                        alt="Banner preview"
                        className="w-full h-full object-cover object-center"
                      />
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 h-7 w-7 bg-black/70 hover:bg-black/90 text-white/80 hover:text-white rounded flex items-center justify-center transition-colors"
                        onClick={() => setEditForm(f => ({ ...f, mainBannerUrl: "" }))}
                        title="Remove banner"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <label className="cursor-pointer">
                      <div className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ${mainBannerUploading ? "cursor-wait opacity-60" : ""}`}>
                        {mainBannerUploading
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                          : <><Upload className="w-3 h-3" /> Replace image</>
                        }
                      </div>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerUpload} disabled={mainBannerUploading} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <div className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 py-7 transition-colors ${mainBannerUploading ? "cursor-wait bg-muted/10" : "hover:bg-muted/10 bg-muted/5"}`}>
                      {mainBannerUploading
                        ? <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Uploading...</span></>
                        : <><Upload className="w-5 h-5 text-muted-foreground" /><span className="text-xs font-medium text-muted-foreground">Click to upload banner image</span><span className="text-[10px] text-muted-foreground">JPG, PNG or WEBP &mdash; max 5 MB</span></>
                      }
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerUpload} disabled={mainBannerUploading} />
                  </label>
                )}

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Display mode on LED screen</Label>
                  <div className="flex gap-1.5">
                    {(["cover", "contain"] as const).map(fit => (
                      <button
                        key={fit}
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, mainBannerFit: fit }))}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                          editForm.mainBannerFit === fit
                            ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                            : "bg-muted/20 border border-border/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {fit === "cover" ? "Crop to Fill" : "Fit to Screen"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" /> Sponsor Logos
                </Label>
                <span className="text-[10px] text-muted-foreground">{sponsorLogos.length} logo{sponsorLogos.length === 1 ? "" : "s"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Logo image is required; name and type are optional. Sponsors rotate on the LED display and Broadcast Overlay every 2 seconds.
              </p>
              <SponsorLogosEditor
                logos={sponsorLogos}
                onChange={setSponsorLogos}
                onUploadFile={handleSponsorLogoUpload}
                uploadingIdx={sponsorUploadingIdx}
              />
            </div>

            <div className="border-t border-border/50 pt-4 space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-muted-foreground" /> LED Display Theme
              </Label>
              <p className="text-xs text-muted-foreground">Visual colour theme for the big screen. Changes take effect immediately on the live display.</p>
              <div className="flex items-center gap-2 flex-wrap">
                {DISPLAY_THEMES_LIST.map(t => (
                  <button
                    key={t.id}
                    title={t.label}
                    onClick={() => handleDisplayThemeChange(t.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      displayTheme === t.id
                        ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-300"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.dot }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
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
                              <input type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac" className="hidden"
                                onChange={(e) => handleAudioUpload(e, "countdownSoundUrl", setCountdownFileName)} />
                            </label>
                            {editForm.countdownSoundUrl && (
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => { setEditForm(f => ({ ...f, countdownSoundUrl: "" })); setCountdownFileName(""); }}>
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
                            <Slider min={0} max={100} step={1}
                              value={[Number(editForm.countdownSoundVolume)]}
                              onValueChange={([v]) => setEditForm(f => ({ ...f, countdownSoundVolume: String(v) }))} />
                          </div>
                          <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={previewCountdownSound}>
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
                              <input type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac" className="hidden"
                                onChange={(e) => handleAudioUpload(e, "soldSoundUrl", setSoldFileName)} />
                            </label>
                            {editForm.soldSoundUrl && (
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => { setEditForm(f => ({ ...f, soldSoundUrl: "" })); setSoldFileName(""); }}>
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
                            <Slider min={0} max={100} step={1}
                              value={[Number(editForm.soldSoundVolume)]}
                              onValueChange={([v]) => setEditForm(f => ({ ...f, soldSoundVolume: String(v) }))} />
                          </div>
                          <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={previewSoldSound}>
                            <Play className="w-3 h-3" /> Preview
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Break End Sound */}
                  <div className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Coffee className="w-3.5 h-3.5 text-muted-foreground" />
                        Break End Sound
                        <span className="text-[10px] text-muted-foreground font-normal">on break timer expiry</span>
                      </Label>
                      <Switch
                        checked={editForm.breakEndMusicEnabled === true}
                        onCheckedChange={(v) => setEditForm(f => ({ ...f, breakEndMusicEnabled: v }))}
                      />
                    </div>
                    {editForm.breakEndMusicEnabled === true && (
                      <div className="space-y-2.5">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Custom audio file</Label>
                          <div className="flex items-center gap-2">
                            <label className="flex-1 cursor-pointer">
                              <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                <Upload className="w-3 h-3 shrink-0" />
                                <span className="truncate">{breakEndFileName || "Upload .mp3 / .ogg / .wav"}</span>
                              </div>
                              <input type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac" className="hidden"
                                onChange={(e) => handleAudioUpload(e, "breakEndMusicUrl", setBreakEndFileName)} />
                            </label>
                            {editForm.breakEndMusicUrl && (
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => { setEditForm(f => ({ ...f, breakEndMusicUrl: "" })); setBreakEndFileName(""); }}>
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {editForm.breakEndMusicUrl ? "Custom file loaded — will replace built-in chime" : "No file selected — built-in chime will play"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] text-muted-foreground">Volume</Label>
                              <span className="text-[11px] font-medium tabular-nums">{editForm.breakEndMusicVolume}%</span>
                            </div>
                            <Slider min={0} max={100} step={1}
                              value={[Number(editForm.breakEndMusicVolume)]}
                              onValueChange={([v]) => setEditForm(f => ({ ...f, breakEndMusicVolume: String(v) }))} />
                          </div>
                          <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={previewBreakEnd}>
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

        {/* ── CRICKET SCORING ── */}
        {activeSection === "scoring" && editForm.sport === "cricket" && (
          <>
            <div className="rounded-lg border border-border/60 bg-card/50 p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CircleDot className="w-4 h-4 text-primary" />
                  Mobile Scorer & LED
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Uses sold and retained players from your auction as playing squads. Points table updates automatically when matches finish.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Enable cricket scoring</p>
                  <p className="text-xs text-muted-foreground">Shows scorer, LED board, and points table on the tournament hub.</p>
                </div>
                <Switch
                  checked={editForm.scoringEnabled === true}
                  onCheckedChange={(v) => setEditForm((f) => ({ ...f, scoringEnabled: v }))}
                />
              </div>

              {editForm.scoringEnabled === true && (
                <div className="space-y-2">
                  <Label htmlFor="scoring-pin">Delegate scorer PIN (optional)</Label>
                  <Input
                    id="scoring-pin"
                    value={editForm.scoringPin as string}
                    onChange={(e) => setEditForm((f) => ({ ...f, scoringPin: e.target.value }))}
                    placeholder="4–12 characters for ground staff"
                    maxLength={12}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ground staff can score without your organizer login when they enter this PIN on the scorer screen.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── RECOVERY ── */}
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
                onClick={() => navigate(auctionResetPath(tournamentId, settingsPath(tournamentId, "recovery")))}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Open Auction Reset Page</span>
                  <span className="text-[11px] text-muted-foreground font-normal">Password-protected — enter your organizer password to clear practice auction data.</span>
                </div>
              </Button>
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
