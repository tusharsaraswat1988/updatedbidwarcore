import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useUpdateTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { BannerFrame } from "@/components/display/banner-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
  ArrowLeft, Settings, UserPlus,
  Building2, Timer, Trash2,
  Gavel, Monitor, ShieldAlert, Image as ImageIcon, X, RotateCcw,
  Calendar as CalendarIcon, AlertTriangle, Upload, Pencil,
  Volume2, VolumeX, Play, Coffee, ChevronDown, ChevronRight as ChevronRightIcon,
  Megaphone, Clapperboard, Loader2, Info, CalendarDays, Crop,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { type SponsorLogo, normalizeSponsorLogos } from "@/lib/sponsor-logo";
import { SettingsCard } from "@/components/settings/settings-card";
import { DEFAULT_SETTINGS_AUDIT_REASON, SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SponsorLogosEditor } from "@/components/settings/sponsor-logos-editor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [bannerEditorInitial, setBannerEditorInitial] = useState<string | undefined>();
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const [sponsorUploadingIdx, setSponsorUploadingIdx] = useState<number | "new" | null>(null);
  const [hubSports, setHubSports] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [highlightField, setHighlightField] = useState<SettingsFocusField | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState("");

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

  const buildSnapshot = useCallback((
    form: Record<string, string | number | boolean>,
    tiers: Array<{ upTo?: number; increment: number }>,
    logos: SponsorLogo[],
  ) => JSON.stringify({ form, tiers, logos: logos.filter(l => l.url.trim()) }), []);

  const hydrateFromTournament = useCallback((t: NonNullable<typeof tournament>) => {
    const initialForm = {
      name: t.name,
      sport: t.sport,
      venue: t.venue || "",
      auctionDate: t.auctionDate || "",
      auctionTime: t.auctionTime || "",
      logoUrl: t.logoUrl && !t.logoUrl.startsWith("data:") ? t.logoUrl : "",
      basePurse: String(t.basePurse ?? ""),
      minBid: String(t.minBid ?? ""),
      timerSeconds: String(t.timerSeconds ?? "30"),
      bidTimerSeconds: String(t.bidTimerSeconds ?? "15"),
      bidExtensionEnabled: t.bidExtensionEnabled ?? false,
      bidExtensionThresholdSeconds: String(t.bidExtensionThresholdSeconds ?? "3"),
      bidExtensionSeconds: String(t.bidExtensionSeconds ?? "5"),
      playerSelectionMode: t.playerSelectionMode || "sequential",
      registrationDeadline: t.registrationDeadline || "",
      registrationLimit: t.registrationLimit != null ? String(t.registrationLimit) : "",
      minimumSquadSize: String(t.minimumSquadSize ?? 0),
      maximumSquadSize: String(t.maximumSquadSize ?? 0),
      audioEnabled: t.audioEnabled ?? true,
      masterVolume: String(t.masterVolume ?? 80),
      countdownSoundEnabled: t.countdownSoundEnabled ?? true,
      countdownSoundUrl: t.countdownSoundUrl ?? "",
      countdownSoundVolume: String(t.countdownSoundVolume ?? 70),
      soldSoundEnabled: t.soldSoundEnabled ?? true,
      soldSoundUrl: t.soldSoundUrl ?? "",
      soldSoundVolume: String(t.soldSoundVolume ?? 80),
      breakEndMusicEnabled: t.breakEndMusicEnabled ?? false,
      breakEndMusicUrl: String(t.breakEndMusicUrl ?? ""),
      breakEndMusicVolume: String(t.breakEndMusicVolume ?? 80),
      mainBannerUrl: t.mainBannerUrl ?? "",
      mainBannerEnabled: t.mainBannerEnabled ?? false,
      mainBannerFit: t.mainBannerFit ?? "cover",
      matchDates: t.matchDates ?? "",
    };
    setEditForm(initialForm);

    setCountdownFileName(t.countdownSoundUrl ? "Custom file uploaded" : "");
    setSoldFileName(t.soldSoundUrl ? "Custom file uploaded" : "");
    setBreakEndFileName(t.breakEndMusicUrl ? "Custom file uploaded" : "");

    let initialTiers: Array<{ upTo?: number; increment: number }>;
    try {
      const rawTiers = t.bidTiers;
      if (rawTiers) {
        const parsed = JSON.parse(rawTiers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialTiers = parsed;
        } else { throw new Error("empty"); }
      } else {
        initialTiers = [
          { upTo: t.bidTier1UpTo ?? 100000, increment: t.bidTier1Increment ?? 25000 },
          { upTo: t.bidTier2UpTo ?? 200000, increment: t.bidTier2Increment ?? 50000 },
          { increment: t.bidTier3Increment ?? 100000 },
        ];
      }
    } catch {
      initialTiers = [{ upTo: 100000, increment: 25000 }, { upTo: 200000, increment: 50000 }, { increment: 100000 }];
    }
    setBidTiers(initialTiers);

    let initialSponsors: SponsorLogo[];
    try {
      const parsed = t.sponsorLogos ? JSON.parse(t.sponsorLogos) : [];
      initialSponsors = normalizeSponsorLogos(parsed);
    } catch { initialSponsors = []; }
    setSponsorLogos(initialSponsors);
    setBaselineSnapshot(buildSnapshot(initialForm, initialTiers, initialSponsors));
  }, [buildSnapshot]);

  useEffect(() => {
    if (!tournament || initialized) return;
    hydrateFromTournament(tournament);
    setInitialized(true);
  }, [tournament, initialized, hydrateFromTournament]);

  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as SettingsTab | null;
    if (tab === "identity" || tab === "auction" || tab === "broadcast" || tab === "recovery") {
      setActiveSection(tab);
    }
    const focus = params.get("focus") as SettingsFocusField | null;
    if (!focus) return;
    if (focus === "registration") setActiveSection("identity");
    if (focus === "bidTiers") setShowAdvancedAuction(true);
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

  function closeBannerEditor() {
    if (bannerEditorInitial?.startsWith("blob:")) {
      URL.revokeObjectURL(bannerEditorInitial);
    }
    setBannerEditorOpen(false);
    setBannerEditorInitial(undefined);
  }

  function openBannerAdjust() {
    const url = (editForm.mainBannerUrl as string) || undefined;
    setBannerEditorInitial(url);
    setBannerEditorOpen(true);
  }

  function handleBannerFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please choose JPG, PNG, or WEBP");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setBannerEditorInitial(objectUrl);
    setBannerEditorOpen(true);
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

  const isDirty = useMemo(
    () => baselineSnapshot !== "" && buildSnapshot(editForm, bidTiers, sponsorLogos) !== baselineSnapshot,
    [baselineSnapshot, buildSnapshot, editForm, bidTiers, sponsorLogos],
  );

  function handleDiscard() {
    if (!tournament) return;
    hydrateFromTournament(tournament);
    toast({ title: "Changes discarded", description: "Settings restored to last saved state." });
  }

  async function handleSave() {
    const filteredLogos = sponsorLogos.filter(l => l.url.trim());
    await updateTournament.mutateAsync({
      tournamentId,
      data: {
        reason: DEFAULT_SETTINGS_AUDIT_REASON,
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
      <div className="w-full max-w-[1500px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
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
              {tournament?.name} — changes apply when you save.
            </p>
          </div>
        </div>
        <SettingsSaveBar
          isDirty={isDirty}
          isSaving={updateTournament.isPending}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      </div>

      {isDirty ? (
        <p className="sm:hidden text-xs text-amber-500 mb-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden />
          Unsaved changes
        </p>
      ) : null}

      {/* Sticky tab strip */}
      <div className="flex border-b border-border mb-5 overflow-x-auto sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pt-1 -mx-1 px-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold transition-all border-b-2 ${
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
      <div className="space-y-4 pb-10">

        {/* ── IDENTITY ── */}
        {activeSection === "identity" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SettingsCard
              title="Tournament Information"
              description="Logo, name, and sport shown across your tournament hub and LED display."
              icon={<ImageIcon className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                  {editForm.logoUrl ? (
                    <img
                      src={editForm.logoUrl as string}
                      alt="Logo preview"
                      className="w-full h-full object-contain"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setLogoEditorOpen(true)}>
                      {editForm.logoUrl ? <><Pencil className="w-3.5 h-3.5" /> Edit Photo</> : <><Upload className="w-3.5 h-3.5" /> Upload Photo</>}
                    </Button>
                    {editForm.logoUrl ? (
                      <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1" onClick={() => setEditForm(f => ({ ...f, logoUrl: "" }))}>
                        <X className="w-3.5 h-3.5" /> Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tournament Name</Label>
                  <Input value={editForm.name as string || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
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
            </SettingsCard>

            <SettingsCard
              title="Event Details"
              description="Venue and auction schedule for your live event."
              icon={<Building2 className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Venue</Label>
                  <Input value={editForm.venue as string || ""} onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))} placeholder="Stadium name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Auction Date</Label>
                  <DatePicker
                    value={editForm.auctionDate as string || ""}
                    onChange={auctionDate => setEditForm(f => ({ ...f, auctionDate }))}
                    placeholder="Select auction date"
                    disablePastDates
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Auction Time</Label>
                  <Input type="time" value={editForm.auctionTime as string || ""} onChange={e => setEditForm(f => ({ ...f, auctionTime: e.target.value }))} placeholder="14:00" />
                  <p className="text-[10px] text-muted-foreground">Used for 24h WhatsApp consent blast scheduling.</p>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Registration"
              description="Control the public self-registration form. Leave blank for no limit."
              icon={<UserPlus className="w-4 h-4 text-muted-foreground" />}
              className={fieldWrapClass("registration")}
            >
              <div id="settings-field-registration" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Last Registration Date
                  </Label>
                  <Input type="date" value={editForm.registrationDeadline as string || ""} onChange={e => setEditForm(f => ({ ...f, registrationDeadline: e.target.value }))} />
                  <p className="text-[10px] text-muted-foreground">After this date the form auto-closes.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Registrations</Label>
                  <Input type="number" min={1} value={editForm.registrationLimit as string || ""} onChange={e => setEditForm(f => ({ ...f, registrationLimit: e.target.value }))} placeholder="e.g. 100" />
                  <p className="text-[10px] text-muted-foreground">Form auto-closes once this many players have registered.</p>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Match Schedule"
              description="When set, player availability uses per-day checkboxes instead of free text."
              icon={<CalendarDays className="w-4 h-4 text-amber-400" />}
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-normal">Optional</Badge>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3 text-blue-400" /> Leave empty to hide availability fields.
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
                      <Button type="button" variant="outline" size="sm" disabled={!datePickerVal || settingsMatchDates.includes(datePickerVal)} onClick={() => {
                        if (!datePickerVal || settingsMatchDates.includes(datePickerVal)) return;
                        setEditForm(f => ({ ...f, matchDates: [...settingsMatchDates, datePickerVal].sort().join(",") }));
                        setDatePickerVal("");
                      }}>
                        Add Date
                      </Button>
                    </div>
                    {settingsMatchDates.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {settingsMatchDates.map(d => {
                          const label = new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                          return (
                            <Badge key={d} variant="secondary" className="gap-1.5 pr-1.5">
                              {label}
                              <button type="button" className="hover:text-destructive rounded-sm" onClick={() => setEditForm(f => ({ ...f, matchDates: settingsMatchDates.filter(x => x !== d).join(",") }))}>
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </SettingsCard>

            <p className="lg:col-span-2 text-[11px] text-muted-foreground">
              Organizer account, login password and contact details are managed by the platform support team.
            </p>
          </div>
        )}

        {/* ── AUCTION RULES ── */}
        {activeSection === "auction" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Set these before your auction starts.</p>
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={applyCricketPreset}>
                Use standard cricket settings
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard
                title="Budget & Pricing"
                description="Team purse, minimum player value, and bid increment."
                icon={<Gavel className="w-4 h-4 text-muted-foreground" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      Team Budget (₹)
                      <FieldTooltip text="How many rupees each team can spend in total. Every team starts with this amount. Set this to your league's purse size, e.g. ₹1,00,00,000 for IPL-style." />
                    </Label>
                    <Input type="number" value={editForm.basePurse as number || 0} onChange={e => setEditForm(f => ({ ...f, basePurse: e.target.value }))} />
                  </div>
                  <div id="settings-field-minBid" className={`space-y-1.5 ${fieldWrapClass("minBid", Number(editForm.minBid) <= 0)}`}>
                    <Label className="flex items-center gap-1">
                      <HintLabel hint="Sabse kam daam jahan se bidding shuru hogi">Minimum Player Value (₹)</HintLabel>
                      <FieldTooltip text="The lowest amount any player can be sold for. Bidding for a player starts at this value unless the player's category overrides it." />
                    </Label>
                    <Input type="number" value={editForm.minBid as number || 0} onChange={e => setEditForm(f => ({ ...f, minBid: e.target.value }))} />
                  </div>
                </div>
                <div id="settings-field-bidTiers" className={`space-y-1.5 ${fieldWrapClass("bidTiers", !bidTiers.some(t => t.increment > 0))}`}>
                  <Label className="flex items-center gap-1">
                    Bid Increase Amount (₹)
                    <FieldTooltip text="How much the bid goes up each time a team raises. For example, if set to ₹10,000 and the current bid is ₹50,000 — the next bid will be ₹60,000. Use the Advanced section below if you want the increment to change as bids get higher." />
                  </Label>
                  {bidTiers.length === 1 ? (
                    <div className="flex items-center gap-3">
                      <Input type="number" className="max-w-[200px]" value={bidTiers[0]?.increment || ""} onChange={e => setBidTiers([{ increment: Number(e.target.value) || 0 }])} placeholder="e.g. 10000" />
                      <span className="text-xs text-muted-foreground">per raise</span>
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-lg bg-muted/20 border border-border/50 text-xs text-muted-foreground">
                      Tiered increments enabled — adjust in Advanced Settings below.
                    </div>
                  )}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Timers"
                description="Opening countdown, bid timer, and late-bid extension."
                icon={<Timer className="w-4 h-4 text-muted-foreground" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div id="settings-field-openingTimer" className={`space-y-1.5 ${fieldWrapClass("openingTimer", Number(editForm.timerSeconds) <= 0)}`}>
                    <Label className="flex items-center gap-1">
                      <HintLabel hint="Naya player aane par kitni der wait karein">Opening Timer (sec)</HintLabel>
                      <FieldTooltip text="Countdown shown when a new player appears on screen before anyone bids. If no one bids in time, the player is passed." />
                    </Label>
                    <Input type="number" value={editForm.timerSeconds as number || 30} onChange={e => setEditForm(f => ({ ...f, timerSeconds: e.target.value }))} min={5} max={300} />
                    <p className="text-[10px] text-muted-foreground">Recommended: 30 seconds</p>
                  </div>
                  <div id="settings-field-bidTimer" className={`space-y-1.5 ${fieldWrapClass("bidTimer", Number(editForm.bidTimerSeconds) <= 0)}`}>
                    <Label className="flex items-center gap-1">
                      <HintLabel hint="Har bid ke baad kitni der">Bid Timer (sec)</HintLabel>
                      <FieldTooltip text="After each bid, this timer resets. When it runs out, the highest bidder wins the player. Shorter timers create more urgency — recommended: 15 seconds." />
                    </Label>
                    <Input type="number" value={editForm.bidTimerSeconds as number || 15} onChange={e => setEditForm(f => ({ ...f, bidTimerSeconds: e.target.value }))} min={5} max={300} />
                    <p className="text-[10px] text-muted-foreground">Recommended: 15 seconds</p>
                  </div>
                </div>
                <div id="settings-field-bidExtension" className="space-y-2 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="flex items-center gap-1">
                      Bid Extension
                      <FieldTooltip text="When the timer is in its last few seconds and a new bid arrives, add extra seconds instead of only resetting to the full bid timer." />
                    </Label>
                    <Switch checked={editForm.bidExtensionEnabled === true} onCheckedChange={(v) => setEditForm(f => ({ ...f, bidExtensionEnabled: v }))} />
                  </div>
                  {editForm.bidExtensionEnabled ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Trigger threshold (sec)</Label>
                        <Input type="number" value={editForm.bidExtensionThresholdSeconds as string} onChange={e => setEditForm(f => ({ ...f, bidExtensionThresholdSeconds: e.target.value }))} min={1} max={60} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Extension duration (sec)</Label>
                        <Input type="number" value={editForm.bidExtensionSeconds as string} onChange={e => setEditForm(f => ({ ...f, bidExtensionSeconds: e.target.value }))} min={1} max={120} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Auction Flow"
                description="How players are drawn during the live auction."
                icon={<Clapperboard className="w-4 h-4 text-muted-foreground" />}
              >
                <div id="settings-field-playerOrder" className={`space-y-1.5 ${fieldWrapClass("playerOrder")}`}>
                  <Label className="flex items-center gap-1">
                    Player Order
                    <FieldTooltip text="Controls which player comes up next when the operator presses Next Player. Sequential = in the order you added them. Random = random draw each time (when 5 or fewer players remain, everyone gets a turn before repeats). Manual = operator picks from a list." />
                  </Label>
                  <Select value={editForm.playerSelectionMode as string || "sequential"} onValueChange={v => setEditForm(f => ({ ...f, playerSelectionMode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="dark">
                      <SelectItem value="sequential">In order — players come up one by one as added</SelectItem>
                      <SelectItem value="random">Random draw — recommended for most tournaments</SelectItem>
                      <SelectItem value="manual">Manual — operator picks from the queue list</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Team Rules"
                description="Minimum and maximum squad size per team. Set 0 to disable."
                icon={<ShieldAlert className="w-4 h-4 text-amber-400/70" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div id="settings-field-minSquad" className={`space-y-1.5 ${fieldWrapClass("minSquad", Number(editForm.minimumSquadSize) <= 0)}`}>
                    <Label className="text-xs flex items-center gap-1">
                      Minimum Players
                      <FieldTooltip text="Teams must reach this count — the system reserves budget for unfilled slots." />
                    </Label>
                    <Input type="number" min={0} max={100} value={editForm.minimumSquadSize as string ?? "0"} onChange={e => setEditForm(f => ({ ...f, minimumSquadSize: e.target.value }))} />
                  </div>
                  <div id="settings-field-maxSquad" className={`space-y-1.5 ${fieldWrapClass("maxSquad", Number(editForm.maximumSquadSize) <= 0)}`}>
                    <Label className="text-xs flex items-center gap-1">
                      Maximum Players
                      <FieldTooltip text="Teams cannot bid once they reach this count." />
                    </Label>
                    <Input type="number" min={0} max={100} value={editForm.maximumSquadSize as string ?? "0"} onChange={e => setEditForm(f => ({ ...f, maximumSquadSize: e.target.value }))} />
                  </div>
                </div>
              </SettingsCard>
            </div>

            <Collapsible open={showAdvancedAuction} onOpenChange={setShowAdvancedAuction}>
              <SettingsCard className="border-dashed" contentClassName="p-0">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex items-center gap-2 w-full text-left px-4 sm:px-5 py-4 hover:bg-muted/30 transition-colors rounded-xl">
                    {showAdvancedAuction ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Advanced Settings</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Contains tiered bid increments and advanced auction controls.</p>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-border/50 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-semibold flex items-center gap-1">
                        Tiered Bid Increase Rules
                        <FieldTooltip text="For advanced leagues: set different bid increments at different price points. For example, bids under ₹1L go up by ₹10K, bids over ₹1L go up by ₹25K. Most organisers don't need this — leave it as one tier." />
                      </Label>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBidTiers(t => [...t.slice(0, -1), { upTo: 0, increment: 0 }, { increment: t[t.length - 1]?.increment ?? 100000 }])}>
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
                              <Input type="number" value={tier.upTo ?? ""} onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, upTo: Number(e.target.value) || 0 } : x))} placeholder="e.g. 100000" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Raise by (₹)</Label>
                            <Input type="number" value={tier.increment || ""} onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, increment: Number(e.target.value) || 0 } : x))} placeholder="e.g. 25000" />
                          </div>
                          <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" disabled={bidTiers.length <= 1} onClick={() => setBidTiers(t => {
                            const next = t.filter((_, j) => j !== i);
                            if (next.length === 0) return t;
                            const last = { ...next[next.length - 1] };
                            delete last.upTo;
                            return [...next.slice(0, -1), last];
                          })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </SettingsCard>
            </Collapsible>
          </div>
        )}

        {/* ── BROADCAST ── */}
        {activeSection === "broadcast" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SettingsCard
              title="LED Display"
              description="Main banner, display mode, and colour theme for the big screen."
              icon={<Monitor className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs flex items-center gap-1.5"><Clapperboard className="w-3.5 h-3.5" /> Main Banner</Label>
                <Switch checked={editForm.mainBannerEnabled === true} onCheckedChange={(v) => setEditForm(f => ({ ...f, mainBannerEnabled: v }))} />
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-3">
                <input
                  ref={bannerFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleBannerFilePick}
                />
                {editForm.mainBannerUrl ? (
                  <div className="space-y-2">
                    <div className="relative rounded-md overflow-hidden border border-border/40">
                      <BannerFrame
                        url={editForm.mainBannerUrl as string}
                        fit={(editForm.mainBannerFit as string) || "cover"}
                      />
                      <button
                        type="button"
                        className="absolute top-1.5 right-1.5 h-7 w-7 bg-black/70 hover:bg-black/90 text-white/80 hover:text-white rounded flex items-center justify-center transition-colors z-10"
                        onClick={() => setEditForm(f => ({ ...f, mainBannerUrl: "" }))}
                        title="Remove banner"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      LED preview (16:9) — matches the big screen
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={openBannerAdjust}
                      >
                        <Crop className="w-3 h-3" />
                        Adjust crop &amp; zoom
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => bannerFileInputRef.current?.click()}
                      >
                        <Upload className="w-3 h-3" />
                        Replace image
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer block w-full text-left"
                    onClick={() => bannerFileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 py-7 transition-colors hover:bg-muted/10 bg-muted/5">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Click to upload banner image</span>
                      <span className="text-[10px] text-muted-foreground">JPG, PNG or WEBP — max 5 MB — crop for 16:9 LED</span>
                    </div>
                  </button>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Display mode</Label>
                    <div className="flex gap-1.5">
                      {(["cover", "contain"] as const).map(fit => (
                        <button key={fit} type="button" onClick={() => setEditForm(f => ({ ...f, mainBannerFit: fit }))} className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${editForm.mainBannerFit === fit ? "bg-amber-500/20 border border-amber-500/40 text-amber-300" : "bg-muted/20 border border-border/40 text-muted-foreground hover:text-foreground"}`}>
                          {fit === "cover" ? "Crop to Fill" : "Fit to Screen"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Use <span className="font-medium text-foreground/80">Adjust crop &amp; zoom</span> to frame the banner for the LED.
                    {" "}
                    {editForm.mainBannerFit === "contain"
                      ? "Fit to Screen keeps the full image visible with bars if needed."
                      : "Crop to Fill stretches edge-to-edge — best after cropping to 16:9."}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-border/50">
                <Label className="text-xs text-muted-foreground">Theme</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {DISPLAY_THEMES_LIST.map(t => (
                    <button key={t.id} title={t.label} onClick={() => handleDisplayThemeChange(t.id)} className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${displayTheme === t.id ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-300" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.dot }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Sponsors"
              description="Logos rotate on the LED display every 2 seconds."
              icon={<ImageIcon className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Logo required; name and type optional.</span>
                <span>{sponsorLogos.length} logo{sponsorLogos.length === 1 ? "" : "s"}</span>
              </div>
              <SponsorLogosEditor logos={sponsorLogos} onChange={setSponsorLogos} onUploadFile={handleSponsorLogoUpload} uploadingIdx={sponsorUploadingIdx} />
            </SettingsCard>

            <SettingsCard
              title="Audio Settings"
              description="Master audio toggle and volume for the LED display."
              icon={editForm.audioEnabled ? <Volume2 className="w-4 h-4 text-muted-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs">Broadcast Audio</Label>
                <Switch checked={editForm.audioEnabled === true} onCheckedChange={(v) => setEditForm(f => ({ ...f, audioEnabled: v }))} />
              </div>
              {editForm.audioEnabled === true ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Master Volume</Label>
                    <span className="text-xs font-medium tabular-nums">{editForm.masterVolume}%</span>
                  </div>
                  <Slider min={0} max={100} step={1} value={[Number(editForm.masterVolume)]} onValueChange={([v]) => setEditForm(f => ({ ...f, masterVolume: String(v) }))} />
                </div>
              ) : null}
            </SettingsCard>

            <SettingsCard
              title="Auction Sounds"
              description="Countdown, sold, and break-end sounds for the live auction."
              icon={<Megaphone className="w-4 h-4 text-muted-foreground" />}
              className="xl:col-span-2"
              contentClassName="space-y-3"
            >
              {editForm.audioEnabled !== true ? (
                <p className="text-xs text-muted-foreground">Enable Broadcast Audio above to configure individual sounds.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                </div>
              )}
            </SettingsCard>
          </div>
        )}

        {/* ── RECOVERY ── */}
        {activeSection === "recovery" && (
          <div className="max-w-3xl">
            <SettingsCard
              title="Danger Zone"
              description="Irreversible actions that reset live auction state."
              icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
              className="border-destructive/40 bg-destructive/5"
            >
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <RotateCcw className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">Auction Reset</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Clears all bids, returns sold players to the pool, and restores team purses. Teams and your player list are not deleted.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 border-destructive/40 text-destructive hover:bg-destructive/15 hover:text-destructive h-auto py-3"
                  onClick={() => navigate(auctionResetPath(tournamentId, settingsPath(tournamentId, "recovery")))}
                >
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-semibold">Open Auction Reset Page</span>
                    <span className="text-[11px] text-muted-foreground font-normal">Password-protected — requires organizer password and audit reason.</span>
                  </div>
                </Button>
              </div>
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Coming soon:</span> Auto-save snapshots, crash recovery, lock team bidding, and re-auction queue management.
                </p>
              </div>
            </SettingsCard>
          </div>
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
      <ImageEditorDialog
        open={bannerEditorOpen}
        onClose={closeBannerEditor}
        initialUrl={bannerEditorInitial}
        aspect={16 / 9}
        title="Main Banner — LED crop"
        exportMaxWidthOrHeight={1920}
        exportMaxSizeMB={4.5}
        exportHint="Drag to reposition, use the zoom slider to scale. Output is saved at 16:9 (up to 1920px) — the preview above matches the LED screen."
        onSave={url => setEditForm(f => ({ ...f, mainBannerUrl: url }))}
      />
      </div>
    </AppLayout>
  );
}
