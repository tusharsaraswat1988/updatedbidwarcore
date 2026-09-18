import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import {
  useGetTournament,
  useUpdateTournament,
  useListPlayers,
  getGetTournamentQueryKey,
  getGetRegistrationStatusQueryKey,
  getGetTeamPursesQueryKey,
  getListPlayersQueryKey,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { BannerFrame } from "@/components/display/banner-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { HintLabel } from "@/components/ui/hint-label";
import type { SettingsFocusField, SettingsTab } from "@/lib/settings-navigation";
import { resolveSettingsTabFromSearch, settingsPath } from "@/lib/settings-navigation";
import { auctionResetPath } from "@/lib/tournament-navigation";
import { AuctionAudioManager } from "@/lib/audio-manager";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Settings, UserPlus,
  Building2, Timer, Trash2, ArrowUp, ArrowDown,
  Gavel, Monitor, ShieldAlert, Image as ImageIcon, X, RotateCcw,
  Calendar as CalendarIcon, AlertTriangle, Upload, Pencil,
  Megaphone, Clapperboard, Loader2, Info, CalendarDays, Crop, IndianRupee, ClipboardList, Handshake,
  Play, Coffee,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { type SponsorLogo, normalizeSponsorLogos, validateSponsorList } from "@/lib/sponsor-logo";
import { SettingsCard, SettingsInsetBlock, SettingsTabPanel } from "@/components/settings/settings-card";
import { AutoSaveStatusPill, DEFAULT_SETTINGS_AUDIT_REASON, SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { SponsorLogosEditor, SponsorLogosToolbar } from "@/components/settings/sponsor-logos-editor";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SportSelect } from "@/components/sport-select";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { AUCTION_UNIT_OPTIONS, auctionUnitSymbol, bidIncrementFieldLabel, budgetFieldLabel, minValueFieldLabel, normalizeAuctionUnit } from "@/lib/format";
import type { AuctionUnit } from "@/lib/format";
import {
  MAX_AUCTION_TIMER_SECONDS,
  MIN_AUCTION_TIMER_SECONDS,
  parseAuctionTimerSeconds,
  validateAuctionTimerSeconds,
} from "@workspace/api-base/auction-timer";
import { parseRegistrationDeclarationPoints } from "@workspace/api-base/registration-declaration";
import {
  REGISTRATION_MANDATORY_FIELD_KEYS,
  REGISTRATION_OPTIONAL_FIELD_KEYS,
  REGISTRATION_OPTIONAL_FIELD_LABELS,
  parseRegistrationFieldsConfig,
  serializeRegistrationFieldsConfig,
  type RegistrationOptionalFieldKey,
} from "@workspace/api-base/registration-fields";
import {
  parsePlayerRegistrationMode,
  parseRegistrationCategoryMode,
  type PlayerRegistrationMode,
  type RegistrationCategoryMode,
} from "@workspace/api-base/player-registration-mode";
import { parseBidValueOptions, serializeBidValueOptions } from "@workspace/api-base/bid-value";
import { resolveBroadcastAudioUrl } from "@workspace/api-base/platform-audio";

/** Inline base64 URLs cannot be persisted; treat as unset (platform default). */
function sanitizePersistedMediaUrl(url: unknown): string | null {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed || trimmed.startsWith("data:")) return null;
  return trimmed;
}

function isPersistableMediaUrl(url: unknown): url is string {
  return sanitizePersistedMediaUrl(url) !== null;
}

export default function TournamentSettings() {
  const [, params] = useRoute("/tournament/:id/settings");
  const [, navigate] = useLocation();
  const search = useSearch();
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const { toast } = useToast();

  const [initialized, setInitialized] = useState(false);
  const activeSection = resolveSettingsTabFromSearch(search);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  const audioPreviewRef = useRef<AuctionAudioManager | null>(null);
  const [countdownFileName, setCountdownFileName] = useState("");
  const [soldFileName, setSoldFileName] = useState("");
  const [breakEndFileName, setBreakEndFileName] = useState("");
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  const [bidTiers, setBidTiers] = useState<Array<{ upTo?: number; increment: number }>>([
    { increment: 0 },
  ]);
  const [bidValueOptions, setBidValueOptions] = useState<number[]>([]);
  const [registrationFieldsHidden, setRegistrationFieldsHidden] = useState<RegistrationOptionalFieldKey[]>([]);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [datePickerVal, setDatePickerVal] = useState("");
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [bannerEditorInitial, setBannerEditorInitial] = useState<string | undefined>();
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const [sponsorUploadingIdx, setSponsorUploadingIdx] = useState<number | "new" | null>(null);
  const [audioUploadingField, setAudioUploadingField] = useState<
    "countdownSoundUrl" | "soldSoundUrl" | "breakEndMusicUrl" | null
  >(null);
  const [highlightField, setHighlightField] = useState<SettingsFocusField | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState("");

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 30_000,
    },
  });
  const { data: players = [] } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId, staleTime: 30_000 },
  });
  const updateTournament = useUpdateTournament();
  const sportLocked = players.length > 0;

  const notifySportLocked = useCallback(() => {
    toast({
      title: "Sport is locked",
      description: "Players already exist in this tournament. Remove all players from the pool before changing the sport.",
    });
  }, [toast]);

  const handleSportChange = useCallback((value: string) => {
    if (sportLocked) {
      notifySportLocked();
      return;
    }
    setEditForm((f) => ({ ...f, sport: value }));
  }, [notifySportLocked, sportLocked]);

  const buildSnapshot = useCallback((
    form: Record<string, string | number | boolean>,
    tiers: Array<{ upTo?: number; increment: number }>,
    logos: SponsorLogo[],
    bidOptions: number[],
    hiddenRegistrationFields: RegistrationOptionalFieldKey[],
  ) => JSON.stringify({ form, tiers, logos: logos.filter(l => l.url.trim()), bidOptions, hiddenRegistrationFields }), []);

  const hydrateFromTournament = useCallback((t: NonNullable<typeof tournament>) => {
    const initialForm = {
      name: t.name,
      sport: t.sport,
      city: t.city || "",
      venue: t.venue || "",
      auctionDate: t.auctionDate || "",
      auctionTime: t.auctionTime || "",
      logoUrl: t.logoUrl && !t.logoUrl.startsWith("data:") ? t.logoUrl : "",
      logoPublicId: (t as { logoPublicId?: string | null }).logoPublicId ?? "",
      auctionUnit: normalizeAuctionUnit((t as { auctionUnit?: string }).auctionUnit),
      basePurse: t.basePurse ? String(t.basePurse) : "",
      minBid: t.minBid ? String(t.minBid) : "",
      timerSeconds: String(t.timerSeconds ?? "30"),
      bidTimerSeconds: String(t.bidTimerSeconds ?? "15"),
      bidExtensionEnabled: t.bidExtensionEnabled ?? false,
      bidExtensionThresholdSeconds: String(t.bidExtensionThresholdSeconds ?? "3"),
      bidExtensionSeconds: String(t.bidExtensionSeconds ?? "5"),
      playerSelectionMode: t.playerSelectionMode || "sequential",
      registrationDeadline: t.registrationDeadline || "",
      registrationLimit: t.registrationLimit != null ? String(t.registrationLimit) : "",
      enableRegistrationPayment: t.enableRegistrationPayment ?? false,
      registrationFee: t.registrationFee != null ? String(t.registrationFee) : "",
      upiId: t.upiId || "",
      paymentVerificationMethod: t.paymentVerificationMethod || "utr",
      enableRegistrationDeclaration: t.enableRegistrationDeclaration ?? false,
      registrationDeclarationText: t.registrationDeclarationText || "",
      bidValueMode: (t as { bidValueMode?: string }).bidValueMode || "system",
      playerRegistrationMode: parsePlayerRegistrationMode(
        (t as { playerRegistrationMode?: string }).playerRegistrationMode,
      ),
      registrationCategoryMode: parseRegistrationCategoryMode(
        (t as { registrationCategoryMode?: string }).registrationCategoryMode,
      ),
      minimumSquadSize: String(t.minimumSquadSize ?? 0),
      maximumSquadSize: String(t.maximumSquadSize ?? 0),
      audioEnabled:
        (t.countdownSoundEnabled ?? true)
        || (t.soldSoundEnabled ?? true)
        || (t.breakEndMusicEnabled ?? false),
      masterVolume: "100",
      countdownSoundEnabled: t.countdownSoundEnabled ?? true,
      countdownSoundUrl: isPersistableMediaUrl(t.countdownSoundUrl) ? t.countdownSoundUrl : "",
      countdownSoundVolume: String(t.countdownSoundVolume ?? 70),
      soldSoundEnabled: t.soldSoundEnabled ?? true,
      soldSoundUrl: isPersistableMediaUrl(t.soldSoundUrl) ? t.soldSoundUrl : "",
      soldSoundVolume: String(t.soldSoundVolume ?? 80),
      breakEndMusicEnabled: t.breakEndMusicEnabled ?? false,
      breakEndMusicUrl: isPersistableMediaUrl(t.breakEndMusicUrl) ? String(t.breakEndMusicUrl) : "",
      breakEndMusicVolume: String(t.breakEndMusicVolume ?? 80),
      mainBannerUrl: t.mainBannerUrl ?? "",
      mainBannerPublicId: (t as { mainBannerPublicId?: string | null }).mainBannerPublicId ?? "",
      mainBannerEnabled: t.mainBannerEnabled ?? false,
      mainBannerFit: t.mainBannerFit ?? "cover",
      matchDates: t.matchDates ?? "",
    };
    setEditForm(initialForm);

    setCountdownFileName(
      isPersistableMediaUrl(t.countdownSoundUrl)
        ? "Custom file uploaded"
        : (t as { platformAudioDefaults?: { countdownSoundUrl?: string | null } }).platformAudioDefaults?.countdownSoundUrl
          ? "Platform default"
          : "",
    );
    setSoldFileName(
      isPersistableMediaUrl(t.soldSoundUrl)
        ? "Custom file uploaded"
        : (t as { platformAudioDefaults?: { soldSoundUrl?: string | null } }).platformAudioDefaults?.soldSoundUrl
          ? "Platform default"
          : "",
    );
    setBreakEndFileName(
      isPersistableMediaUrl(t.breakEndMusicUrl)
        ? "Custom file uploaded"
        : (t as { platformAudioDefaults?: { breakEndMusicUrl?: string | null } }).platformAudioDefaults?.breakEndMusicUrl
          ? "Platform default"
          : "",
    );

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

    const rawBidOptions = (t as { bidValueOptions?: number[] | string | null }).bidValueOptions;
    const initialBidOptions = Array.isArray(rawBidOptions)
      ? [...new Set(rawBidOptions.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b)
      : parseBidValueOptions(rawBidOptions as string | null);
    setBidValueOptions(initialBidOptions);

    let initialSponsors: SponsorLogo[];
    try {
      const parsed = t.sponsorLogos ? JSON.parse(t.sponsorLogos) : [];
      initialSponsors = normalizeSponsorLogos(parsed);
    } catch { initialSponsors = []; }
    setSponsorLogos(initialSponsors);
    const initialHidden = parseRegistrationFieldsConfig(
      (t as { registrationFields?: { hidden?: RegistrationOptionalFieldKey[] } }).registrationFields,
    ).hidden ?? [];
    setRegistrationFieldsHidden(initialHidden);
    setBaselineSnapshot(buildSnapshot(initialForm, initialTiers, initialSponsors, initialBidOptions, initialHidden));
  }, [buildSnapshot]);

  useEffect(() => {
    if (!tournament || initialized) return;
    hydrateFromTournament(tournament);
    setInitialized(true);
  }, [tournament, initialized, hydrateFromTournament]);

  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(search);
    const focus = params.get("focus") as SettingsFocusField | null;
    if (!focus) return;
    setHighlightField(focus);
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`settings-field-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    const clearTimer = window.setTimeout(() => setHighlightField(null), 4500);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [initialized, search]);

  function fieldWrapClass(field: SettingsFocusField, needsAttention = false) {
    const highlight = highlightField === field ? "ring-2 ring-primary/50 rounded-lg p-1 -m-1" : "";
    const pulse = needsAttention ? "ring-2 ring-amber-500/50 animate-pulse rounded-lg p-1 -m-1" : "";
    return highlight || pulse;
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

  async function handleSponsorLogoUpload(file: File | File[], idx: number | "new") {
    const files = Array.isArray(file) ? file : [file];
    if (idx !== "new" && files.length !== 1) return;

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        alert("Each image must be under 5 MB");
        return;
      }
      if (!f.type.startsWith("image/")) {
        alert("Please choose JPG, PNG, or WEBP images");
        return;
      }
    }

    setSponsorUploadingIdx(idx);
    try {
      const uploadOne = async (f: File) => {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (!r.ok) throw new Error("Upload failed");
        const data = await r.json() as { url?: string; publicId?: string };
        if (!data.url) throw new Error("Upload failed");
        return { url: data.url, publicId: data.publicId };
      };

      if (idx === "new") {
        const results = await Promise.allSettled(files.map(uploadOne));
        const uploaded = results
          .filter((r): r is PromiseFulfilledResult<{ url: string; publicId: string | undefined }> => r.status === "fulfilled")
          .map(r => r.value);
        if (uploaded.length > 0) {
          setSponsorLogos(prev => [...prev, ...uploaded.map(u => ({ ...u, name: "", type: "" }))]);
        }
        if (uploaded.length < files.length) {
          alert(
            uploaded.length === 0
              ? "Sponsor logo upload failed. Please try again."
              : `${uploaded.length} of ${files.length} logos uploaded. Some files failed — check size/format and retry.`,
          );
        }
      } else {
        const uploaded = await uploadOne(files[0]);
        setSponsorLogos(prev =>
          prev.map((l, i) => (i === idx ? { ...l, url: uploaded.url, publicId: uploaded.publicId } : l)),
        );
      }
    } catch {
      alert("Sponsor logo upload failed. Please try again.");
    } finally {
      setSponsorUploadingIdx(null);
    }
  }

  async function handleAudioUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "countdownSoundUrl" | "soldSoundUrl" | "breakEndMusicUrl",
    setFileName: (n: string) => void,
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Audio file must be under 8 MB", variant: "destructive" });
      return;
    }
    setAudioUploadingField(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload/audio", { method: "POST", credentials: "include", body: fd });
      const data = await r.json() as { url?: string; error?: string };
      if (!r.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed");
      }
      setFileName(file.name);
      setEditForm(f => ({ ...f, [field]: data.url! }));
    } catch (err) {
      toast({
        title: "Audio upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAudioUploadingField(null);
    }
  }

  function clearAudioField(
    field: "countdownSoundUrl" | "soldSoundUrl" | "breakEndMusicUrl",
    setFileName: (n: string) => void,
    platformKey: "countdownSoundUrl" | "soldSoundUrl" | "breakEndMusicUrl",
  ) {
    setEditForm((f) => ({ ...f, [field]: "" }));
    const platform = (tournament as { platformAudioDefaults?: Record<string, string | null> } | undefined)
      ?.platformAudioDefaults?.[platformKey];
    setFileName(platform ? "Platform default" : "");
  }

  async function previewCountdownSound() {
    if (!audioPreviewRef.current) audioPreviewRef.current = new AuctionAudioManager();
    const mgr = audioPreviewRef.current;
    await mgr.unlock();
    const platform = (tournament as { platformAudioDefaults?: { countdownSoundUrl?: string | null } } | undefined)
      ?.platformAudioDefaults?.countdownSoundUrl ?? null;
    mgr.setSettings({
      audioEnabled: true, masterVolume: 100,
      countdownSoundEnabled: true,
      countdownSoundUrl: resolveBroadcastAudioUrl((editForm.countdownSoundUrl as string).trim() || null, platform),
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
    const platform = (tournament as { platformAudioDefaults?: { soldSoundUrl?: string | null } } | undefined)
      ?.platformAudioDefaults?.soldSoundUrl ?? null;
    mgr.setSettings({
      audioEnabled: true, masterVolume: 100,
      countdownSoundEnabled: false, countdownSoundUrl: null, countdownSoundVolume: 0,
      soldSoundEnabled: true,
      soldSoundUrl: resolveBroadcastAudioUrl((editForm.soldSoundUrl as string).trim() || null, platform),
      soldSoundVolume: Number(editForm.soldSoundVolume) || 80,
      breakEndMusicEnabled: false, breakEndMusicUrl: null, breakEndMusicVolume: 80,
    });
    mgr.previewSold();
  }

  async function previewBreakMusic() {
    if (!audioPreviewRef.current) audioPreviewRef.current = new AuctionAudioManager();
    const mgr = audioPreviewRef.current;
    await mgr.unlock();
    const platform = (tournament as { platformAudioDefaults?: { breakEndMusicUrl?: string | null } } | undefined)
      ?.platformAudioDefaults?.breakEndMusicUrl ?? null;
    mgr.setSettings({
      audioEnabled: true, masterVolume: 100,
      countdownSoundEnabled: false, countdownSoundUrl: null, countdownSoundVolume: 0,
      soldSoundEnabled: false, soldSoundUrl: null, soldSoundVolume: 0,
      breakEndMusicEnabled: true,
      breakEndMusicUrl: resolveBroadcastAudioUrl((editForm.breakEndMusicUrl as string).trim() || null, platform),
      breakEndMusicVolume: Number(editForm.breakEndMusicVolume) || 80,
    });
    mgr.previewBreakMusic();
  }

  const isDirty = useMemo(
    () => baselineSnapshot !== "" && buildSnapshot(editForm, bidTiers, sponsorLogos, bidValueOptions, registrationFieldsHidden) !== baselineSnapshot,
    [baselineSnapshot, buildSnapshot, editForm, bidTiers, sponsorLogos, bidValueOptions, registrationFieldsHidden],
  );

  const saveKey = useMemo(
    () => buildSnapshot(editForm, bidTiers, sponsorLogos, bidValueOptions, registrationFieldsHidden),
    [buildSnapshot, editForm, bidTiers, sponsorLogos, bidValueOptions, registrationFieldsHidden],
  );

  const squadSizeError = useMemo(() => {
    const min = Number(editForm.minimumSquadSize) || 0;
    const max = Number(editForm.maximumSquadSize) || 0;
    if (min > 0 && max > 0 && max < min) {
      return "Maximum players cannot be less than minimum players.";
    }
    return null;
  }, [editForm.minimumSquadSize, editForm.maximumSquadSize]);

  const openingTimerParsed = parseAuctionTimerSeconds(String(editForm.timerSeconds));
  const bidTimerParsed = parseAuctionTimerSeconds(String(editForm.bidTimerSeconds));
  const openingTimerError = validateAuctionTimerSeconds(openingTimerParsed, "Opening Timer");
  const bidTimerError = validateAuctionTimerSeconds(bidTimerParsed, "Bid Timer");

  const getSaveBlockReason = useCallback((): string | null => {
    if (!(editForm.name as string)?.trim()) {
      return "Tournament name is required";
    }
    if (!(editForm.city as string)?.trim()) {
      return "City is required";
    }
    if (!Number(editForm.basePurse) || Number(editForm.basePurse) <= 0) {
      return "Team budget is required";
    }
    if (!Number(editForm.minBid) || Number(editForm.minBid) <= 0) {
      return "Minimum player value is required";
    }
    if (!bidTiers.some(t => t.increment > 0)) {
      return "Bid increase amount is required";
    }
    if (openingTimerError) {
      return openingTimerError;
    }
    if (bidTimerError) {
      return bidTimerError;
    }
    if (squadSizeError) {
      return squadSizeError;
    }
    if (sportLocked && tournament && (editForm.sport as string) !== tournament.sport) {
      return "Sport cannot be changed while players exist in the pool.";
    }
    if (audioUploadingField) {
      return "Wait for audio upload to finish";
    }
    if (editForm.enableRegistrationPayment === true && editForm.playerRegistrationMode !== "scoring") {
      const fee = editForm.registrationFee !== "" ? Number(editForm.registrationFee) : NaN;
      const upi = (editForm.upiId as string).trim();
      if (!Number.isFinite(fee) || fee <= 0) {
        return "Complete registration fee to save";
      }
      if (!upi) {
        return "Enter UPI ID to save payment settings";
      }
      if (!editForm.paymentVerificationMethod) {
        return "Choose a verification method to save";
      }
    }
    if (editForm.enableRegistrationDeclaration === true) {
      const points = parseRegistrationDeclarationPoints(editForm.registrationDeclarationText as string);
      if (points.length === 0) {
        return "Add at least one declaration point or turn off the declaration";
      }
    }
    if (
      editForm.playerRegistrationMode !== "scoring"
      && editForm.bidValueMode === "player"
      && bidValueOptions.filter((n) => n > 0).length === 0
    ) {
      return "Add at least one allowed bid value for Player Selected mode";
    }
    const sponsorValidation = validateSponsorList(sponsorLogos.filter((l) => l.url.trim()));
    if (!sponsorValidation.ok) {
      return sponsorValidation.error;
    }
    return null;
  }, [editForm, bidTiers, bidValueOptions, squadSizeError, sportLocked, tournament, sponsorLogos, audioUploadingField, openingTimerError, bidTimerError]);

  const performSave = useCallback(async (options?: { notify?: boolean }): Promise<boolean> => {
    const blockReason = getSaveBlockReason();
    if (blockReason) {
      if (options?.notify) {
        toast({ title: "Cannot save yet", description: blockReason, variant: "destructive" });
      }
      return false;
    }

    const filteredLogos = sponsorLogos.filter(l => l.url.trim());
    try {
      const saved = await updateTournament.mutateAsync({
        tournamentId,
        data: {
          reason: DEFAULT_SETTINGS_AUDIT_REASON,
          name: editForm.name as string,
          sport: editForm.sport as string,
          city: (editForm.city as string).trim() || undefined,
          venue: editForm.venue as string || undefined,
          auctionDate: editForm.auctionDate as string || undefined,
          auctionTime: editForm.auctionTime as string || undefined,
          logoUrl: editForm.logoUrl as string || undefined,
          logoPublicId: (editForm.logoPublicId as string) || undefined,
          sponsorLogos: JSON.stringify(filteredLogos),
          auctionUnit: normalizeAuctionUnit(editForm.auctionUnit as string),
          basePurse: Number(editForm.basePurse) || undefined,
          minBid: Number(editForm.minBid) || undefined,
          bidTiers: JSON.stringify(bidTiers.filter(t => t.increment > 0)),
          timerSeconds: openingTimerParsed!,
          bidTimerSeconds: bidTimerParsed!,
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
          enableRegistrationPayment: editForm.enableRegistrationPayment === true,
          registrationFee:
            editForm.enableRegistrationPayment === true && editForm.registrationFee !== ""
              ? Number(editForm.registrationFee)
              : null,
          upiId: editForm.enableRegistrationPayment === true ? ((editForm.upiId as string).trim() || null) : null,
          paymentVerificationMethod: editForm.enableRegistrationPayment === true
            ? (editForm.paymentVerificationMethod as import("@workspace/api-client-react").TournamentUpdatePaymentVerificationMethod)
            : null,
          paymentCollectionMode: "manual_verification",
          enableRegistrationDeclaration: editForm.enableRegistrationDeclaration === true,
          registrationDeclarationText: ((editForm.registrationDeclarationText as string).trim() || null),
          bidValueMode: (editForm.bidValueMode as "system" | "player") || "system",
          bidValueOptions: bidValueOptions.filter((n) => n > 0),
          playerRegistrationMode: parsePlayerRegistrationMode(editForm.playerRegistrationMode as string),
          registrationCategoryMode: parseRegistrationCategoryMode(editForm.registrationCategoryMode as string),
          audioEnabled:
            editForm.countdownSoundEnabled === true
            || editForm.soldSoundEnabled === true
            || editForm.breakEndMusicEnabled === true,
          masterVolume: 100,
          countdownSoundEnabled: editForm.countdownSoundEnabled === true,
          countdownSoundUrl: sanitizePersistedMediaUrl(editForm.countdownSoundUrl),
          countdownSoundVolume: Number(editForm.countdownSoundVolume) || 70,
          soldSoundEnabled: editForm.soldSoundEnabled === true,
          soldSoundUrl: sanitizePersistedMediaUrl(editForm.soldSoundUrl),
          soldSoundVolume: Number(editForm.soldSoundVolume) || 80,
          breakEndMusicEnabled: editForm.breakEndMusicEnabled === true,
          breakEndMusicUrl: sanitizePersistedMediaUrl(editForm.breakEndMusicUrl),
          breakEndMusicVolume: Number(editForm.breakEndMusicVolume) || 80,
          mainBannerUrl: sanitizePersistedMediaUrl(editForm.mainBannerUrl),
          mainBannerPublicId: (editForm.mainBannerPublicId as string) || null,
          mainBannerEnabled: editForm.mainBannerEnabled === true,
          mainBannerFit: ((editForm.mainBannerFit as string) || "cover") as "cover" | "contain",
          matchDates: (editForm.matchDates as string).trim() || null,
          registrationFields: serializeRegistrationFieldsConfig(registrationFieldsHidden),
        } as import("@workspace/api-client-react").TournamentUpdate & {
          reason: string;
          logoPublicId?: string;
          mainBannerPublicId?: string | null;
        },
      });
      qc.setQueryData(getGetTournamentQueryKey(tournamentId), saved);
      qc.invalidateQueries({ queryKey: getGetRegistrationStatusQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
      setBaselineSnapshot(buildSnapshot(editForm, bidTiers, filteredLogos, bidValueOptions.filter((n) => n > 0), registrationFieldsHidden));
      if (options?.notify) {
        toast({ title: "Settings saved", description: "Your auction rules have been updated." });
      }
      return true;
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Could not save settings. Please try again.";
      if (options?.notify) {
        toast({ title: "Save failed", description: msg, variant: "destructive" });
      }
      return false;
    }
  }, [
    bidTiers,
    bidValueOptions,
    buildSnapshot,
    editForm,
    getSaveBlockReason,
    qc,
    sponsorLogos,
    registrationFieldsHidden,
    toast,
    tournamentId,
    updateTournament,
  ]);

  const saveBlockReason = getSaveBlockReason();

  const { phase: autoSavePhase, saveNow } = useDebouncedAutoSave({
    isDirty,
    saveKey,
    enabled: initialized,
    canSave: getSaveBlockReason,
    onSave: () => performSave(),
    onSaved: () => {
      toast({ title: "Saved", description: "Settings updated automatically." });
    },
    onError: (message) => {
      toast({ title: "Save failed", description: message, variant: "destructive" });
    },
  });

  function handleDiscard() {
    if (!tournament) return;
    hydrateFromTournament(tournament);
    toast({ title: "Changes discarded", description: "Settings restored to last saved state." });
  }

  function handleSave() {
    void saveNow().then((ok) => {
      if (!ok && saveBlockReason) {
        toast({ title: "Cannot save yet", description: saveBlockReason, variant: "destructive" });
      } else if (ok) {
        toast({ title: "Settings saved", description: "Your auction rules have been updated." });
      }
    });
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "identity", label: "Basic Info", icon: Building2 },
    { id: "playerRegistration", label: "Player Registration", icon: UserPlus },
    { id: "auction", label: "Auction Rules", icon: Gavel },
    { id: "sponsors", label: "Sponsors", icon: Handshake },
    { id: "broadcast", label: "Screen & Sound", icon: Megaphone },
    { id: "recovery", label: "Reset", icon: ShieldAlert },
  ];

  const showInitialLoading = !initialized || (loadingTournament && !tournament);

  if (showInitialLoading) {
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
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground flex-shrink-0 h-9 px-2.5 sm:px-3"
            onClick={() => navigate(`/tournament/${tournamentId}`)}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 truncate">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              Tournament Settings
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {tournament?.name} — changes save automatically.
            </p>
          </div>
        </div>
        <SettingsSaveBar
          isDirty={isDirty}
          isSaving={updateTournament.isPending}
          onSave={handleSave}
          onDiscard={handleDiscard}
          autoSave
          autoSavePhase={autoSavePhase}
          blockReason={saveBlockReason}
        />
      </div>

      <AutoSaveStatusPill
        phase={autoSavePhase}
        isDirty={isDirty}
        isSaving={updateTournament.isPending}
        blockReason={saveBlockReason}
      />

      {/* Sticky tab strip — horizontally scrollable on mobile */}
      <div className="sticky top-0 z-20 mb-4 sm:mb-5 rounded-xl border border-border/70 bg-card p-1 shadow-sm shadow-black/15">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(settingsPath(tournamentId, tab.id), { replace: true })}
              className={`flex-shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all rounded-lg min-w-0 touch-target ${
                active
                  ? "text-primary bg-secondary shadow-sm ring-1 ring-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
        </div>
      </div>

      {/* Tab content */}
      <div className="space-y-4 pb-10">

        {/* ── IDENTITY ── */}
        {activeSection === "identity" && (
          <SettingsTabPanel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Tournament Information */}
              <SettingsCard
                title="Tournament Information"
                description="Logo, name, and sport shown across your tournament hub and LED display."
                icon={<ImageIcon className="w-4 h-4 text-primary" />}
              >
                {/* Logo & Photo Section */}
                <div className="flex items-center gap-4 pb-1">
                  <div className="w-16 h-16 rounded-xl border border-border/70 bg-muted/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
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
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs font-medium"
                        onClick={() => setLogoEditorOpen(true)}
                      >
                        {editForm.logoUrl ? (
                          <><Pencil className="w-3.5 h-3.5" /> Change Photo</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5" /> Upload Photo</>
                        )}
                      </Button>
                      {editForm.logoUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                          onClick={() => setEditForm(f => ({ ...f, logoUrl: "" }))}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Square 1:1 ratio recommended (JPG, PNG, WebP)
                    </p>
                  </div>
                </div>

                {/* Name & Sport */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/90">
                      Tournament Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={editForm.name as string || ""}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Premier League 2026"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-foreground/90">
                        Sport <span className="text-destructive">*</span>
                      </Label>
                      {sportLocked ? (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground bg-muted/60">
                          Locked (Pool Active)
                        </Badge>
                      ) : null}
                    </div>
                    <div className="relative">
                      {sportLocked ? (
                        <button
                          type="button"
                          className="absolute inset-0 z-10 cursor-not-allowed rounded-md"
                          aria-label="Sport locked while players exist in the pool"
                          onClick={notifySportLocked}
                        />
                      ) : null}
                      <SportSelect
                        value={(editForm.sport as string) || "cricket"}
                        currentSlug={tournament?.sport}
                        disabled={sportLocked}
                        onValueChange={handleSportChange}
                      />
                    </div>
                    {sportLocked ? (
                      <p className="text-[10px] text-muted-foreground">
                        Locked while players exist in the tournament pool.
                      </p>
                    ) : null}
                  </div>
                </div>
              </SettingsCard>

              {/* Event Details */}
              <SettingsCard
                title="Event Details"
                description="City, venue, and auction schedule for your live event."
                icon={<Building2 className="w-4 h-4 text-primary" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/90">
                      City <span className="text-destructive">*</span>
                    </Label>
                    <CityAutocomplete
                      value={editForm.city as string || ""}
                      onChange={city => setEditForm(f => ({ ...f, city }))}
                      placeholder="Start typing city name"
                      minChars={3}
                    />
                    <p className="text-[10px] text-muted-foreground">Type at least 3 letters for suggestions</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/90">Venue</Label>
                    <Input
                      value={editForm.venue as string || ""}
                      onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))}
                      placeholder="Stadium or ground name"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/90">Auction Date</Label>
                    <DatePicker
                      value={editForm.auctionDate as string || ""}
                      onChange={auctionDate => setEditForm(f => ({ ...f, auctionDate }))}
                      placeholder="Select auction date"
                      disablePastDates
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/90">Auction Time</Label>
                    <TimePicker
                      value={editForm.auctionTime as string || ""}
                      onChange={auctionTime => setEditForm(f => ({ ...f, auctionTime }))}
                      placeholder="Select time"
                    />
                    <p className="text-[10px] text-muted-foreground">Used for 24h WhatsApp consent blast scheduling.</p>
                  </div>
                </div>
              </SettingsCard>

              {/* Match Schedule */}
              <SettingsCard
                title="Match Schedule & Playing Dates"
                description="Configure tournament match days to enable per-day availability checkboxes on public player registration."
                icon={<CalendarDays className="w-4 h-4 text-amber-400" />}
                className="lg:col-span-2"
                headerAction={
                  <Badge variant="outline" className="text-xs font-normal border-amber-500/30 text-amber-400 bg-amber-500/10">
                    Optional
                  </Badge>
                }
              >
                {(() => {
                  const settingsMatchDates = (editForm.matchDates as string || "").split(",").filter(Boolean);
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      <div className="lg:col-span-5 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground/90">Add Playing Date</Label>
                          <div className="flex gap-2">
                            <DatePicker
                              value={datePickerVal}
                              onChange={setDatePickerVal}
                              placeholder="Select match date"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 px-3.5 gap-1.5 shrink-0"
                              disabled={!datePickerVal || settingsMatchDates.includes(datePickerVal)}
                              onClick={() => {
                                if (!datePickerVal || settingsMatchDates.includes(datePickerVal)) return;
                                setEditForm(f => ({
                                  ...f,
                                  matchDates: [...settingsMatchDates, datePickerVal].sort().join(","),
                                }));
                                setDatePickerVal("");
                              }}
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                              Add Date
                            </Button>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Leave empty if you do not require per-day match availability fields during player registration.
                        </p>
                      </div>

                      <div className="lg:col-span-7">
                        <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5 space-y-2.5 min-h-[96px]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                              Configured Match Dates
                            </span>
                            {settingsMatchDates.length > 0 ? (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                {settingsMatchDates.length} {settingsMatchDates.length === 1 ? "day" : "days"}
                              </Badge>
                            ) : null}
                          </div>

                          {settingsMatchDates.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              {settingsMatchDates.map(d => {
                                const label = new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                });
                                return (
                                  <div
                                    key={d}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-card border border-border/80 text-foreground shadow-xs"
                                  >
                                    <span>{label}</span>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                                      title="Remove date"
                                      onClick={() =>
                                        setEditForm(f => ({
                                          ...f,
                                          matchDates: settingsMatchDates.filter(x => x !== d).join(","),
                                        }))
                                      }
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground/70 italic py-2">
                              No match dates added yet. Per-day availability checkboxes are currently disabled.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </SettingsCard>

              {/* Footer Note */}
              <div className="lg:col-span-2 flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border/50 bg-muted/20 text-xs text-muted-foreground">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>Organizer account, login password, and contact details are managed by the platform support team.</span>
              </div>
            </div>
          </SettingsTabPanel>
        )}

        {/* ── PLAYER REGISTRATION ── */}
        {activeSection === "playerRegistration" && (
          <SettingsTabPanel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Card 1: Registration Mode & Limits */}
              <SettingsCard
                title="Registration Mode & Limits"
                description="Choose player pool type and set optional registration limits."
                icon={<UserPlus className="w-4 h-4 text-primary" />}
                className={fieldWrapClass("registration")}
              >
                <div className="space-y-4">
                  {/* Mode Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground/90">Registration Type</Label>
                    <RadioGroup
                      value={(editForm.playerRegistrationMode as string) || "auction"}
                      onValueChange={(v) => setEditForm((f) => ({
                        ...f,
                        playerRegistrationMode: parsePlayerRegistrationMode(v) as PlayerRegistrationMode,
                      }))}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    >
                      <label className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-all ${
                        (editForm.playerRegistrationMode || "auction") === "auction"
                          ? "border-primary/50 bg-primary/5 text-foreground ring-1 ring-primary/20"
                          : "border-border/60 bg-muted/10 hover:bg-muted/20 text-muted-foreground"
                      }`}>
                        <RadioGroupItem value="auction" className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-foreground">Auction Pool</span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                            Players enter bidding pool with base prices &amp; purse tracking.
                          </span>
                        </div>
                      </label>
                      <label className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-all ${
                        editForm.playerRegistrationMode === "scoring"
                          ? "border-primary/50 bg-primary/5 text-foreground ring-1 ring-primary/20"
                          : "border-border/60 bg-muted/10 hover:bg-muted/20 text-muted-foreground"
                      }`}>
                        <RadioGroupItem value="scoring" className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-foreground">Scoring Only</span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                            Direct match registration for fixtures (no live bidding).
                          </span>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  {/* If Scoring Mode: Categories */}
                  {editForm.playerRegistrationMode === "scoring" ? (
                    <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-muted/15">
                      <Label className="text-xs font-medium">Divisions / Category Policy</Label>
                      <Select
                        value={(editForm.registrationCategoryMode as string) || "hidden"}
                        onValueChange={(v) => setEditForm((f) => ({
                          ...f,
                          registrationCategoryMode: parseRegistrationCategoryMode(v) as RegistrationCategoryMode,
                        }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="dark">
                          <SelectItem value="hidden">Disabled — hide category on form</SelectItem>
                          <SelectItem value="player_select">Player selects category (optional)</SelectItem>
                          <SelectItem value="organizer_assign">Organizer assigns category later</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {/* Registration Limits */}
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        Form Deadlines &amp; Capacity
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">Optional</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground/80">Last Date to Register</Label>
                        <Input
                          type="date"
                          value={editForm.registrationDeadline as string || ""}
                          onChange={e => setEditForm(f => ({ ...f, registrationDeadline: e.target.value }))}
                          className="h-9 text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">Auto-closes after this date.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground/80">Max Registrations</Label>
                        <Input
                          type="number"
                          min={1}
                          value={editForm.registrationLimit as string || ""}
                          onChange={e => setEditForm(f => ({ ...f, registrationLimit: e.target.value }))}
                          placeholder="e.g. 100"
                          className="h-9 text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">Auto-closes when limit reached.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsCard>

              {/* Card 2: Registration Fee & Payments */}
              <SettingsCard
                title="Registration Fee & UPI"
                description="Collect entry fees from players with manual UPI payment verification."
                icon={<IndianRupee className="w-4 h-4 text-emerald-400" />}
                className={fieldWrapClass("registration")}
                headerAction={
                  <Badge variant="outline" className="text-xs font-normal border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    Optional
                  </Badge>
                }
              >
                <div id="settings-field-registration-payments" className="space-y-3.5">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 p-3 cursor-pointer hover:bg-muted/25 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Collect Registration Fee</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Players submit UPI screenshot / UTR during registration.</p>
                    </div>
                    <Switch
                      checked={editForm.enableRegistrationPayment === true}
                      onCheckedChange={v => setEditForm(f => ({ ...f, enableRegistrationPayment: v }))}
                    />
                  </label>

                  <Collapsible open={editForm.enableRegistrationPayment === true}>
                    <CollapsibleContent className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground/90">
                            Fee Amount (₹) <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={editForm.registrationFee as string || ""}
                            onChange={e => setEditForm(f => ({ ...f, registrationFee: e.target.value }))}
                            placeholder="e.g. 500"
                            className="h-9 text-xs"
                          />
                          <IndianAmountHint value={editForm.registrationFee as string} className="text-[10px]" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground/90">
                            UPI ID <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={editForm.upiId as string || ""}
                            onChange={e => setEditForm(f => ({ ...f, upiId: e.target.value }))}
                            placeholder="yourname@upi"
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs font-medium text-foreground/90">
                            Verification Method <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={(editForm.paymentVerificationMethod as string) || "utr"}
                            onValueChange={v => setEditForm(f => ({ ...f, paymentVerificationMethod: v }))}
                          >
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="dark">
                              <SelectItem value="utr">UTR Number only</SelectItem>
                              <SelectItem value="screenshot">Payment screenshot only</SelectItem>
                              <SelectItem value="utr_and_screenshot">UTR + Screenshot</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Payment gateway integration coming soon. Manual verification is currently active.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </SettingsCard>

              {/* Card 3: Form Fields Configuration */}
              <SettingsCard
                title="Registration Form Fields"
                description="Toggle optional fields on the public player registration form."
                icon={<ClipboardList className="w-4 h-4 text-primary" />}
              >
                <div className="space-y-3.5">
                  {/* Always Required Fields Strip */}
                  <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border/40">
                    <span className="text-[11px] font-medium text-muted-foreground mr-1">Required:</span>
                    {REGISTRATION_MANDATORY_FIELD_KEYS.map((key) => (
                      <Badge key={key} variant="secondary" className="text-[10px] h-5 px-2 font-normal bg-muted/60 text-foreground/80">
                        {key === "mobile" ? "Mobile" : key.replace(/([A-Z])/g, " $1").trim()}
                      </Badge>
                    ))}
                  </div>

                  {/* Optional Field Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {REGISTRATION_OPTIONAL_FIELD_KEYS.map((key) => {
                      const visible = !registrationFieldsHidden.includes(key);
                      const sport = (editForm.sport as string) || tournament?.sport || "cricket";
                      if (key === "cricheroUrl" && sport !== "cricket") return null;
                      if (key === "matchAvailability" && !(editForm.matchDates as string)?.trim() && !tournament?.matchDates) {
                        return null;
                      }
                      return (
                        <label
                          key={key}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            visible
                              ? "border-border/70 bg-card hover:bg-muted/20"
                              : "border-border/40 bg-muted/10 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <span className="font-medium truncate">{REGISTRATION_OPTIONAL_FIELD_LABELS[key]}</span>
                          <Switch
                            checked={visible}
                            onCheckedChange={(checked) => {
                              setRegistrationFieldsHidden((prev) => {
                                if (checked) return prev.filter((item) => item !== key);
                                return prev.includes(key) ? prev : [...prev, key];
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </SettingsCard>

              {/* Card 4: Bid Value Mode (Auction Mode Only) */}
              {editForm.playerRegistrationMode !== "scoring" ? (
                <SettingsCard
                  title="Player Base Price Mode"
                  description="System-wide minimum bid or custom player-selected base price options."
                  icon={<IndianRupee className="w-4 h-4 text-amber-400" />}
                >
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground/90">Assignment Mode</Label>
                      <Select
                        value={(editForm.bidValueMode as string) || "system"}
                        onValueChange={(v) => setEditForm(f => ({ ...f, bidValueMode: v }))}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="dark">
                          <SelectItem value="system">System Default (Tournament Min Bid)</SelectItem>
                          <SelectItem value="player">Player Selected (Choice of Base Values)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        {editForm.bidValueMode === "player"
                          ? "Players choose their base price from allowed values during registration."
                          : "Every player starts at tournament minimum bid price."}
                      </p>
                    </div>

                    {editForm.bidValueMode === "player" ? (
                      <div className="space-y-2.5 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground">Allowed Base Values (₹)</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 gap-1"
                            onClick={() => setBidValueOptions((opts) => [...opts, 0])}
                          >
                            + Add Value
                          </Button>
                        </div>
                        {bidValueOptions.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-1">Add at least one value for players to choose from.</p>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {bidValueOptions.map((value, i) => (
                              <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg border border-border/60 bg-muted/15">
                                <span className="text-[11px] font-medium text-muted-foreground w-6 shrink-0 text-center">
                                  #{i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={value || ""}
                                    onChange={(e) => {
                                      const next = Number(e.target.value) || 0;
                                      setBidValueOptions((opts) => opts.map((v, j) => (j === i ? next : v)));
                                    }}
                                    placeholder="e.g. 5000"
                                    className="h-8 text-xs font-mono"
                                  />
                                </div>
                                <IndianAmountHint value={value} className="text-[10px] hidden sm:inline shrink-0" />
                                <div className="flex items-center shrink-0">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    disabled={i === 0}
                                    onClick={() => setBidValueOptions((opts) => {
                                      if (i === 0) return opts;
                                      const next = [...opts];
                                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                      return next;
                                    })}
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    disabled={i === bidValueOptions.length - 1}
                                    onClick={() => setBidValueOptions((opts) => {
                                      if (i >= opts.length - 1) return opts;
                                      const next = [...opts];
                                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                                      return next;
                                    })}
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setBidValueOptions((opts) => opts.filter((_, j) => j !== i))}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </SettingsCard>
              ) : null}

              {/* Card 5: Declaration & Consent (Full Width) */}
              <SettingsCard
                title="Declaration & Player Consent"
                description="Point-wise rules and consent terms required before registration submission."
                icon={<ClipboardList className="w-4 h-4 text-primary" />}
                className="lg:col-span-2"
                headerAction={
                  <Badge variant="outline" className="text-xs font-normal border-blue-500/30 text-blue-400 bg-blue-500/10">
                    Optional
                  </Badge>
                }
              >
                <div className="space-y-4">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 p-3 cursor-pointer hover:bg-muted/25 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Require Declaration Acceptance</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Players must agree to your terms before submitting the form.</p>
                    </div>
                    <Switch
                      checked={editForm.enableRegistrationDeclaration === true}
                      onCheckedChange={v => setEditForm(f => ({ ...f, enableRegistrationDeclaration: v }))}
                    />
                  </label>

                  <Collapsible open={editForm.enableRegistrationDeclaration === true}>
                    <CollapsibleContent className="pt-1">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Editor column */}
                        <div className="lg:col-span-6 space-y-2">
                          <Label className="text-xs font-medium text-foreground/90">Declaration Points (1 per line)</Label>
                          <Textarea
                            value={editForm.registrationDeclarationText as string || ""}
                            onChange={e => setEditForm(f => ({ ...f, registrationDeclarationText: e.target.value }))}
                            placeholder={"I consent to be present for all scheduled matches.\nI agree to abide by the league's rules and code of conduct.\nI declare that I am physically fit to participate."}
                            rows={6}
                            className="text-xs font-normal leading-relaxed resize-y min-h-[140px]"
                          />
                          <p className="text-[10px] text-muted-foreground">Each new line is formatted as a numbered point on the public form.</p>
                        </div>

                        {/* Live Preview column */}
                        <div className="lg:col-span-6">
                          <div className="rounded-lg border border-border/60 bg-muted/15 p-3.5 space-y-2 min-h-[140px]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">Public Form Preview</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                {parseRegistrationDeclarationPoints(editForm.registrationDeclarationText as string).length} Points
                              </Badge>
                            </div>
                            {parseRegistrationDeclarationPoints(editForm.registrationDeclarationText as string).length > 0 ? (
                              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground max-h-48 overflow-y-auto pr-1">
                                {parseRegistrationDeclarationPoints(editForm.registrationDeclarationText as string).map((point, i) => (
                                  <li key={i} className="leading-relaxed">{point}</li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 italic py-4">No points entered yet. Type points on the left to see live preview.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </SettingsCard>
            </div>
          </SettingsTabPanel>
        )}

        {/* ── AUCTION RULES ── */}
        {activeSection === "auction" && (
          <SettingsTabPanel>
            {(() => {
              const currentUnit = normalizeAuctionUnit(editForm.auctionUnit as string);
              const unitSymbol = auctionUnitSymbol(currentUnit);

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  {/* Column 1: Budget, Min Bid & Bid Increments */}
                  <SettingsCard
                    title="Budget & Bid Pricing"
                    description="Team purse, minimum player valuation, and tiered raise increments."
                    icon={<Gavel className="w-4 h-4 text-primary" />}
                    className="lg:col-span-1"
                  >
                    <div className="space-y-4">
                      {/* Units Selector */}
                      <div className="space-y-1.5 pb-3 border-b border-border/50">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                            Auction Units <span className="text-destructive">*</span>
                            <FieldTooltip text="Rupees (₹) displays standard currency across live auction and broadcasts. Points (Pt.) is used for corporate or fantasy leagues with point budgets." />
                          </Label>
                          <span className="text-[10px] text-muted-foreground">Applies to LED, OBS &amp; Apps</span>
                        </div>
                        <Select
                          value={currentUnit}
                          onValueChange={(value) => setEditForm((f) => ({ ...f, auctionUnit: value }))}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent className="dark">
                            {AUCTION_UNIT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Team Budget & Minimum Player Value */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                            {budgetFieldLabel(currentUnit)} <span className="text-destructive">*</span>
                            <FieldTooltip text={`Total spending limit allocated to each team at the start of the auction.`} />
                          </Label>
                          <Input
                            type="number"
                            value={editForm.basePurse as string || ""}
                            onChange={e => setEditForm(f => ({ ...f, basePurse: e.target.value }))}
                            placeholder="e.g. 10000000"
                            className="h-9 text-xs font-mono"
                          />
                          <IndianAmountHint value={editForm.basePurse as string} unit={currentUnit} className="text-[10px]" />
                        </div>
                        <div id="settings-field-minBid" className={`space-y-1.5 ${fieldWrapClass("minBid", Number(editForm.minBid) <= 0)}`}>
                          <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                            {minValueFieldLabel(currentUnit)} <span className="text-destructive">*</span>
                            <FieldTooltip text="The lowest possible winning bid for any player in the pool." />
                          </Label>
                          <Input
                            type="number"
                            value={editForm.minBid as string || ""}
                            onChange={e => setEditForm(f => ({ ...f, minBid: e.target.value }))}
                            placeholder="e.g. 10000"
                            className="h-9 text-xs font-mono"
                          />
                          <IndianAmountHint value={editForm.minBid as string} unit={currentUnit} className="text-[10px]" />
                        </div>
                      </div>

                      {/* Bid Increase Amount / Tiers */}
                      <div id="settings-field-bidTiers" className={`space-y-2.5 pt-3 border-t border-border/50 ${fieldWrapClass("bidTiers", !bidTiers.some(t => t.increment > 0))}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                            {bidIncrementFieldLabel(currentUnit)} <span className="text-destructive">*</span>
                            <FieldTooltip text="Minimum amount a team must raise when clicking the Bid button." />
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 gap-1"
                            onClick={() => setBidTiers(t => [
                              ...t.slice(0, -1),
                              { upTo: 0, increment: 0 },
                              { increment: t[t.length - 1]?.increment ?? 100000 },
                            ])}
                          >
                            + Add Tier
                          </Button>
                        </div>

                        {bidTiers.length === 1 ? (
                          <div className="flex items-center gap-2.5 pt-1">
                            <div className="flex-1 max-w-[220px]">
                              <Input
                                type="number"
                                className="h-9 text-xs font-mono"
                                value={bidTiers[0]?.increment || ""}
                                onChange={e => setBidTiers([{ increment: Number(e.target.value) || 0 }])}
                                placeholder="e.g. 10000"
                              />
                            </div>
                            <IndianAmountHint value={bidTiers[0]?.increment} unit={currentUnit} className="text-xs shrink-0" />
                            <span className="text-xs text-muted-foreground">per raise</span>
                          </div>
                        ) : (
                          <div className="space-y-2.5 pt-1">
                            <p className="text-[11px] text-muted-foreground">
                              Tiered raise rules — set higher increment steps at higher price brackets.
                            </p>
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                              {bidTiers.map((tier, i) => {
                                const isLast = i === bidTiers.length - 1;
                                return (
                                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 p-2 rounded-lg border border-border/60 bg-muted/15 items-end">
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground font-medium">
                                        {isLast ? `Above threshold (${unitSymbol})` : `Up to (${unitSymbol}) — Tier ${i + 1}`}
                                      </Label>
                                      {isLast ? (
                                        <div className="h-8 flex items-center px-2.5 rounded-md border border-border/50 bg-muted/20 text-muted-foreground text-xs font-medium">
                                          No upper limit
                                        </div>
                                      ) : (
                                        <>
                                          <Input
                                            type="number"
                                            value={tier.upTo ?? ""}
                                            onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, upTo: Number(e.target.value) || 0 } : x))}
                                            placeholder="e.g. 100000"
                                            className="h-8 text-xs font-mono"
                                          />
                                          <IndianAmountHint value={tier.upTo} unit={currentUnit} className="text-[10px]" />
                                        </>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground font-medium">
                                        Raise by ({unitSymbol})
                                      </Label>
                                      <Input
                                        type="number"
                                        value={tier.increment || ""}
                                        onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, increment: Number(e.target.value) || 0 } : x))}
                                        placeholder="e.g. 25000"
                                        className="h-8 text-xs font-mono"
                                      />
                                      <IndianAmountHint value={tier.increment} unit={currentUnit} className="text-[10px]" />
                                    </div>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
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
                          </div>
                        )}
                      </div>
                    </div>
                  </SettingsCard>

                  {/* Column 2: Timers & Squad/Draw Rules */}
                  <div className="space-y-5 lg:col-span-1">
                    {/* Card 2: Timers & Anti-Sniping */}
                    <SettingsCard
                      title="Auction Timers & Anti-Sniping"
                      description="Countdown timers for new players, per-bid reset, and last-second extensions."
                      icon={<Timer className="w-4 h-4 text-primary" />}
                    >
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div id="settings-field-openingTimer" className={`space-y-1.5 ${fieldWrapClass("openingTimer", !!openingTimerError)}`}>
                            <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                              Opening Timer (sec) <span className="text-destructive">*</span>
                              <FieldTooltip text="Countdown when a player first appears on screen. If no bid is placed in time, the player passes unsold." />
                            </Label>
                            <Input
                              type="number"
                              value={editForm.timerSeconds as string}
                              onChange={e => setEditForm(f => ({ ...f, timerSeconds: e.target.value }))}
                              min={MIN_AUCTION_TIMER_SECONDS}
                              max={MAX_AUCTION_TIMER_SECONDS}
                              aria-invalid={!!openingTimerError}
                              className="h-9 text-xs font-mono"
                            />
                            {openingTimerError ? (
                              <p className="text-[10px] text-destructive">{openingTimerError}</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">Recommended: 30s (min {MIN_AUCTION_TIMER_SECONDS}s)</p>
                            )}
                          </div>

                          <div id="settings-field-bidTimer" className={`space-y-1.5 ${fieldWrapClass("bidTimer", !!bidTimerError)}`}>
                            <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                              Bid Reset Timer (sec) <span className="text-destructive">*</span>
                              <FieldTooltip text="Timer resets to this after every new bid. When it reaches 0, player is sold to the highest bidder." />
                            </Label>
                            <Input
                              type="number"
                              value={editForm.bidTimerSeconds as string}
                              onChange={e => setEditForm(f => ({ ...f, bidTimerSeconds: e.target.value }))}
                              min={MIN_AUCTION_TIMER_SECONDS}
                              max={MAX_AUCTION_TIMER_SECONDS}
                              aria-invalid={!!bidTimerError}
                              className="h-9 text-xs font-mono"
                            />
                            {bidTimerError ? (
                              <p className="text-[10px] text-destructive">{bidTimerError}</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">Recommended: 15s (min {MIN_AUCTION_TIMER_SECONDS}s)</p>
                            )}
                          </div>
                        </div>

                        {/* Bid Extension / Anti-Sniping Toggle */}
                        <div id="settings-field-bidExtension" className="space-y-2.5 pt-2 border-t border-border/50">
                          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 p-3 cursor-pointer hover:bg-muted/25 transition-colors">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground">Anti-Sniping Bid Extension</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Adds extra seconds if a bid arrives in the final seconds of the timer.
                              </p>
                            </div>
                            <Switch
                              checked={editForm.bidExtensionEnabled === true}
                              onCheckedChange={(v) => setEditForm(f => ({ ...f, bidExtensionEnabled: v }))}
                            />
                          </label>

                          {editForm.bidExtensionEnabled ? (
                            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/60 bg-muted/10">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-medium">Trigger in last (sec)</Label>
                                <Input
                                  type="number"
                                  value={editForm.bidExtensionThresholdSeconds as string}
                                  onChange={e => setEditForm(f => ({ ...f, bidExtensionThresholdSeconds: e.target.value }))}
                                  min={1}
                                  max={60}
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-medium">Extension added (sec)</Label>
                                <Input
                                  type="number"
                                  value={editForm.bidExtensionSeconds as string}
                                  onChange={e => setEditForm(f => ({ ...f, bidExtensionSeconds: e.target.value }))}
                                  min={1}
                                  max={120}
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </SettingsCard>

                    {/* Card 3: Squad Limits & Player Draw Order */}
                    <SettingsCard
                      title="Squad Limits & Player Draw"
                      description="Team roster constraints and player sequence during live auction."
                      icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
                    >
                      <div className="space-y-3.5">
                        {/* Squad Limits */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div id="settings-field-minSquad" className={`space-y-1.5 ${fieldWrapClass("minSquad", Number(editForm.minimumSquadSize) <= 0)}`}>
                            <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                              Minimum Players / Team
                              <FieldTooltip text="Teams must buy at least this many players. Budget is reserved automatically for unfilled mandatory slots." />
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={editForm.minimumSquadSize as string ?? "0"}
                              onChange={e => setEditForm(f => ({ ...f, minimumSquadSize: e.target.value }))}
                              className="h-9 text-xs font-mono"
                            />
                            <p className="text-[10px] text-muted-foreground">Set 0 if no minimum requirement.</p>
                          </div>

                          <div id="settings-field-maxSquad" className={`space-y-1.5 ${fieldWrapClass("maxSquad", !!squadSizeError)}`}>
                            <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                              Maximum Players / Team
                              <FieldTooltip text="Teams cannot place bids once they reach this roster cap. Set 0 for unlimited squad size." />
                            </Label>
                            <Input
                              type="number"
                              min={Number(editForm.minimumSquadSize) > 0 ? Number(editForm.minimumSquadSize) : 0}
                              max={100}
                              value={editForm.maximumSquadSize as string ?? "0"}
                              onChange={e => setEditForm(f => ({ ...f, maximumSquadSize: e.target.value }))}
                              className="h-9 text-xs font-mono"
                            />
                            {squadSizeError ? (
                              <p className="text-[10px] text-destructive">{squadSizeError}</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">Set 0 for unlimited squad cap.</p>
                            )}
                          </div>
                        </div>

                        {/* Player Draw Flow */}
                        <div id="settings-field-playerOrder" className={`space-y-1.5 pt-2 border-t border-border/50 ${fieldWrapClass("playerOrder")}`}>
                          <Label className="text-xs font-medium text-foreground/90 flex items-center gap-1">
                            Player Draw Sequence
                            <FieldTooltip text="Controls which player is brought up when the operator clicks Next Player during the live auction." />
                          </Label>
                          <Select
                            value={editForm.playerSelectionMode as string || "sequential"}
                            onValueChange={v => setEditForm(f => ({ ...f, playerSelectionMode: v }))}
                          >
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="dark">
                              <SelectItem value="random">🎲 Random draw — recommended for balanced auctions</SelectItem>
                              <SelectItem value="sequential">📋 In order — players appear in sequence as added</SelectItem>
                              <SelectItem value="manual">👆 Manual pick — operator chooses from active queue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </SettingsCard>
                  </div>
                </div>
              );
            })()}
          </SettingsTabPanel>
        )}

        {/* ── SPONSORS ── */}
        {activeSection === "sponsors" && (
          <SettingsTabPanel>
            <SettingsCard
              title="Sponsor Logos"
              description="Logos appear on the LED display, side screens, and stream overlay. They rotate every 4 seconds on the big screen. (Logo required; name and type optional. Up to 5 logos at once.)"
              icon={<Handshake className="w-4 h-4 text-muted-foreground" />}
              headerAction={
                <SponsorLogosToolbar
                  logos={sponsorLogos}
                  onUploadFile={handleSponsorLogoUpload}
                  uploadingIdx={sponsorUploadingIdx}
                />
              }
            >
              <SponsorLogosEditor
                logos={sponsorLogos}
                onChange={setSponsorLogos}
                onUploadFile={handleSponsorLogoUpload}
                uploadingIdx={sponsorUploadingIdx}
                showToolbar={false}
              />
            </SettingsCard>
          </SettingsTabPanel>
        )}

        {/* ── BROADCAST ── */}
        {activeSection === "broadcast" && (
          <SettingsTabPanel>
            <div className="space-y-4">
              {/* LED Marquee Banner Card */}
              <SettingsCard
                title="LED Display Marquee Banner"
                description="Custom tournament banner for the big-screen projector and intermission backdrop."
                icon={<Monitor className="w-4 h-4 text-sky-400" />}
                headerAction={
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="main-banner-toggle"
                      className="text-xs text-muted-foreground cursor-pointer font-normal"
                    >
                      {editForm.mainBannerEnabled ? "Banner Active" : "Banner Disabled"}
                    </Label>
                    <Switch
                      id="main-banner-toggle"
                      checked={editForm.mainBannerEnabled === true}
                      onCheckedChange={(v) => setEditForm(f => ({ ...f, mainBannerEnabled: v }))}
                    />
                  </div>
                }
              >
                <input
                  ref={bannerFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleBannerFilePick}
                />

                {editForm.mainBannerUrl ? (
                  <div className={`space-y-2.5 ${editForm.mainBannerEnabled === false ? "opacity-60" : ""}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-muted/10 border border-border/50 rounded-lg p-3">
                      {/* Compact 16:9 Thumbnail Preview */}
                      <div className="relative w-48 sm:w-56 shrink-0 rounded-md overflow-hidden border border-border/70 shadow-sm bg-stage aspect-video group">
                        <BannerFrame
                          url={editForm.mainBannerUrl as string}
                          fit={(editForm.mainBannerFit as string) || "cover"}
                        />
                        <div className="absolute top-1.5 left-1.5">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[9px] font-mono border border-border/40 py-0 px-1.5">
                            16:9 LED
                          </Badge>
                        </div>
                      </div>

                      {/* Display Mode & Controls */}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs font-semibold text-foreground/90">Display Mode</Label>
                              <span className="text-[10px] text-muted-foreground">
                                {editForm.mainBannerFit === "contain" ? "• Letterboxed" : "• Edge-to-Edge"}
                              </span>
                            </div>
                            <div className="inline-flex rounded-md border border-border/60 bg-muted/20 p-0.5">
                              {(["cover", "contain"] as const).map(fit => (
                                <button
                                  key={fit}
                                  type="button"
                                  onClick={() => setEditForm(f => ({ ...f, mainBannerFit: fit }))}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                                    editForm.mainBannerFit === fit
                                      ? "bg-amber-500/20 text-amber-300 shadow-sm font-semibold"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {fit === "cover" ? "Crop to Fill (16:9)" : "Fit to Screen"}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={openBannerAdjust}
                            >
                              <Crop className="w-3 h-3" />
                              Crop &amp; Zoom
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => bannerFileInputRef.current?.click()}
                            >
                              <Upload className="w-3 h-3" />
                              Replace
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setEditForm(f => ({ ...f, mainBannerUrl: "", mainBannerPublicId: "" }))}
                              title="Remove banner"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          Recommended: <span className="font-medium text-foreground/80">1920 × 1080 (16:9)</span> JPG, PNG or WEBP (Max 5 MB).
                        </p>
                      </div>
                    </div>

                    {editForm.mainBannerEnabled === false && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300/90 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        <span>Banner is disabled. Turn toggle on to display on the live big screen.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="cursor-pointer block w-full text-left group"
                    onClick={() => bannerFileInputRef.current?.click()}
                  >
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-border/70 hover:border-amber-500/50 px-4 py-3.5 transition-colors bg-muted/5 hover:bg-muted/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-muted/20 flex items-center justify-center text-muted-foreground group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground/90">Upload LED Marquee Banner</div>
                          <div className="text-[10px] text-muted-foreground">JPG, PNG, WEBP (Max 5 MB) • 16:9 widescreen format</div>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-amber-400 group-hover:underline">Choose Image →</span>
                    </div>
                  </button>
                )}
              </SettingsCard>

              {/* Auction Sound Effects Card */}
              <SettingsCard
                title="Auction Sound Effects & Audio Cues"
                description="Countdown ticks, sold gavels, and intermission music for live projection and streams."
                icon={<Megaphone className="w-4 h-4 text-emerald-400" />}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Countdown Sound */}
                  <div className={`rounded-lg border p-3 space-y-2.5 transition-all ${editForm.countdownSoundEnabled ? "border-border/70 bg-card/40" : "border-border/30 bg-muted/5 opacity-70"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <Timer className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground/95">Countdown Tick</div>
                          <div className="text-[10px] text-muted-foreground">Last 5s of timer</div>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.countdownSoundEnabled === true}
                        onCheckedChange={(v) => setEditForm(f => ({ ...f, countdownSoundEnabled: v }))}
                      />
                    </div>

                    {editForm.countdownSoundEnabled === true && (
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <label className={`flex-1 min-w-0 ${audioUploadingField === "countdownSoundUrl" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                            <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-input bg-background/80 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                              {audioUploadingField === "countdownSoundUrl"
                                ? <Loader2 className="w-3 h-3 shrink-0 animate-spin text-amber-400" />
                                : <Upload className="w-3 h-3 shrink-0 text-muted-foreground" />}
                              <span className="truncate text-[11px]">{countdownFileName || "Default Tick (.mp3)"}</span>
                            </div>
                            <input type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac" className="hidden"
                              onChange={(e) => handleAudioUpload(e, "countdownSoundUrl", setCountdownFileName)} />
                          </label>
                          {editForm.countdownSoundUrl && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => clearAudioField("countdownSoundUrl", setCountdownFileName, "countdownSoundUrl")}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2">
                            <Slider min={0} max={100} step={1}
                              className="flex-1"
                              value={[Number(editForm.countdownSoundVolume)]}
                              onValueChange={([v]) => setEditForm(f => ({ ...f, countdownSoundVolume: String(v) }))} />
                            <span className="text-[10px] font-semibold tabular-nums w-7 text-right text-foreground/80">{editForm.countdownSoundVolume}%</span>
                          </div>
                          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1 shrink-0 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/40" onClick={previewCountdownSound}>
                            <Play className="w-2.5 h-2.5" /> Test
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sold Sound */}
                  <div className={`rounded-lg border p-3 space-y-2.5 transition-all ${editForm.soldSoundEnabled ? "border-border/70 bg-card/40" : "border-border/30 bg-muted/5 opacity-70"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <Gavel className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground/95">Sold Gavel</div>
                          <div className="text-[10px] text-muted-foreground">On player sold</div>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.soldSoundEnabled === true}
                        onCheckedChange={(v) => setEditForm(f => ({ ...f, soldSoundEnabled: v }))}
                      />
                    </div>

                    {editForm.soldSoundEnabled === true && (
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <label className={`flex-1 min-w-0 ${audioUploadingField === "soldSoundUrl" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                            <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-input bg-background/80 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                              {audioUploadingField === "soldSoundUrl"
                                ? <Loader2 className="w-3 h-3 shrink-0 animate-spin text-emerald-400" />
                                : <Upload className="w-3 h-3 shrink-0 text-muted-foreground" />}
                              <span className="truncate text-[11px]">{soldFileName || "Default Fanfare (.mp3)"}</span>
                            </div>
                            <input type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac" className="hidden"
                              onChange={(e) => handleAudioUpload(e, "soldSoundUrl", setSoldFileName)} />
                          </label>
                          {editForm.soldSoundUrl && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => clearAudioField("soldSoundUrl", setSoldFileName, "soldSoundUrl")}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2">
                            <Slider min={0} max={100} step={1}
                              className="flex-1"
                              value={[Number(editForm.soldSoundVolume)]}
                              onValueChange={([v]) => setEditForm(f => ({ ...f, soldSoundVolume: String(v) }))} />
                            <span className="text-[10px] font-semibold tabular-nums w-7 text-right text-foreground/80">{editForm.soldSoundVolume}%</span>
                          </div>
                          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1 shrink-0 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/40" onClick={previewSoldSound}>
                            <Play className="w-2.5 h-2.5" /> Test
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Break Music */}
                  <div className={`rounded-lg border p-3 space-y-2.5 transition-all ${editForm.breakEndMusicEnabled ? "border-border/70 bg-card/40" : "border-border/30 bg-muted/5 opacity-70"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <Coffee className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground/95">Intermission Music</div>
                          <div className="text-[10px] text-muted-foreground">Loop during pause</div>
                        </div>
                      </div>
                      <Switch
                        checked={editForm.breakEndMusicEnabled === true}
                        onCheckedChange={(v) => setEditForm(f => ({ ...f, breakEndMusicEnabled: v }))}
                      />
                    </div>

                    {editForm.breakEndMusicEnabled === true && (
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <label className={`flex-1 min-w-0 ${audioUploadingField === "breakEndMusicUrl" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                            <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-input bg-background/80 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                              {audioUploadingField === "breakEndMusicUrl"
                                ? <Loader2 className="w-3 h-3 shrink-0 animate-spin text-indigo-400" />
                                : <Upload className="w-3 h-3 shrink-0 text-muted-foreground" />}
                              <span className="truncate text-[11px]">{breakEndFileName || "Default Chime (.mp3)"}</span>
                            </div>
                            <input type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac" className="hidden"
                              onChange={(e) => handleAudioUpload(e, "breakEndMusicUrl", setBreakEndFileName)} />
                          </label>
                          {editForm.breakEndMusicUrl && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => clearAudioField("breakEndMusicUrl", setBreakEndFileName, "breakEndMusicUrl")}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2">
                            <Slider min={0} max={100} step={1}
                              className="flex-1"
                              value={[Number(editForm.breakEndMusicVolume)]}
                              onValueChange={([v]) => setEditForm(f => ({ ...f, breakEndMusicVolume: String(v) }))} />
                            <span className="text-[10px] font-semibold tabular-nums w-7 text-right text-foreground/80">{editForm.breakEndMusicVolume}%</span>
                          </div>
                          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1 shrink-0 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/40" onClick={previewBreakMusic}>
                            <Play className="w-2.5 h-2.5" /> Test
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SettingsCard>
            </div>
          </SettingsTabPanel>
        )}

        {/* ── RECOVERY ── */}
        {activeSection === "recovery" && (
          <SettingsTabPanel className="max-w-3xl">
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
                  className="w-full justify-start gap-2 border-destructive/40 text-destructive hover:bg-destructive/15 hover:text-destructive h-auto py-3 disabled:opacity-50 disabled:pointer-events-none"
                  disabled={tournament?.status === "completed"}
                  onClick={() => navigate(auctionResetPath(tournamentId, settingsPath(tournamentId, "recovery")))}
                >
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-semibold">Open Auction Reset Page</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {tournament?.status === "completed"
                        ? "Unavailable after the tournament is marked completed."
                        : "Requires an active organizer session."}
                    </span>
                  </div>
                </Button>
              </div>
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Coming soon:</span> Crash recovery snapshots, lock team bidding, and re-auction queue management.
                </p>
              </div>
            </SettingsCard>
          </SettingsTabPanel>
        )}
      </div>

      <ImageEditorDialog
        open={logoEditorOpen}
        onClose={() => setLogoEditorOpen(false)}
        initialUrl={editForm.logoUrl as string || undefined}
        aspect={1}
        title="Tournament Logo"
        onSave={upload => setEditForm(f => ({ ...f, logoUrl: upload.url, logoPublicId: upload.publicId }))}
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
        onSave={upload => setEditForm(f => ({ ...f, mainBannerUrl: upload.url, mainBannerPublicId: upload.publicId }))}
      />
      </div>
    </AppLayout>
  );
}
