import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import {
  useGetTournament,
  useUpdateTournament,
  useListPlayers,
  getGetTournamentQueryKey,
  getGetRegistrationStatusQueryKey,
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
import { SponsorLogosEditor } from "@/components/settings/sponsor-logos-editor";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SportSelect } from "@/components/sport-select";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { AUCTION_UNIT_OPTIONS, bidIncrementFieldLabel, budgetFieldLabel, minValueFieldLabel, normalizeAuctionUnit } from "@/lib/format";
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
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: players = [] } = useListPlayers(tournamentId, {
    query: { enabled: !!tournamentId, staleTime: 30_000 },
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

  async function handleSponsorLogoUpload(file: File, idx: number | "new") {
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5 MB"); return; }
    setSponsorUploadingIdx(idx);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload failed");
      const data = await r.json() as { url?: string; publicId?: string };
      if (data.url) {
        const url = data.url as string;
        const publicId = data.publicId ?? undefined;
        if (idx === "new") {
          setSponsorLogos(prev => [...prev, { url, publicId, name: "", type: "" }]);
        } else {
          setSponsorLogos(prev => prev.map((l, i) => i === idx ? { ...l, url, publicId } : l));
        }
      }
    } catch { alert("Sponsor logo upload failed. Please try again."); }
    finally { setSponsorUploadingIdx(null); }
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

  const openingTimerParsed = parseAuctionTimerSeconds(editForm.timerSeconds);
  const bidTimerParsed = parseAuctionTimerSeconds(editForm.bidTimerSeconds);
  const openingTimerError = validateAuctionTimerSeconds(openingTimerParsed, "Opening Timer");
  const bidTimerError = validateAuctionTimerSeconds(bidTimerParsed, "Bid Timer");

  const getSaveBlockReason = useCallback((): string | null => {
    if (!(editForm.name as string)?.trim()) {
      return "Tournament name is required";
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
    if (editForm.enableRegistrationPayment === true) {
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
    if (editForm.bidValueMode === "player" && bidValueOptions.filter((n) => n > 0).length === 0) {
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
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getGetRegistrationStatusQueryKey(tournamentId) });
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

      {/* Sticky tab strip */}
      <div className="sticky top-0 z-20 mb-5 rounded-xl border border-border/70 bg-[hsl(240,10%,8%)] p-1 shadow-sm shadow-black/15">
        <div className="flex overflow-x-auto scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(settingsPath(tournamentId, tab.id), { replace: true })}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold transition-all rounded-lg ${
                active
                  ? "text-primary bg-[hsl(240,10%,14%)] shadow-sm ring-1 ring-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
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
                      Locked while players exist in the pool.
                    </p>
                  ) : null}
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
                      <DatePicker
                        value={datePickerVal}
                        onChange={setDatePickerVal}
                        placeholder="Select match date"
                        className="w-auto min-w-[11rem]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!datePickerVal || settingsMatchDates.includes(datePickerVal)}
                        onClick={() => {
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
          </SettingsTabPanel>
        )}

        {/* ── PLAYER REGISTRATION ── */}
        {activeSection === "playerRegistration" && (
          <SettingsTabPanel className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-[hsl(240,10%,9%)] px-3 py-2">
              <Badge variant="outline" className="text-xs font-normal">All settings optional</Badge>
              <p className="text-[11px] text-muted-foreground">
                Configure the public player registration link. Changes save automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard
                title="Registration Form Fields"
                description="Choose which optional fields appear on the public registration link. Required fields cannot be turned off."
                icon={<ClipboardList className="w-4 h-4 text-muted-foreground" />}
                className="lg:col-span-2"
              >
                <div className="space-y-4">
                  <SettingsInsetBlock title="Always required">
                    <div className="flex flex-wrap gap-2">
                      {REGISTRATION_MANDATORY_FIELD_KEYS.map((key) => (
                        <Badge key={key} variant="secondary" className="text-xs capitalize bg-muted/60">
                          {key === "mobile" ? "Mobile" : key.replace(/([A-Z])/g, " $1").trim()}
                        </Badge>
                      ))}
                      <Badge variant="secondary" className="text-xs bg-muted/60">Required player settings</Badge>
                    </div>
                  </SettingsInsetBlock>

                  <SettingsInsetBlock
                    title="Optional fields"
                    description="Turn off a field to hide it from players. Payment, declaration, and bid-value fields follow their own settings below."
                  >
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
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-[hsl(240,10%,8%)] px-3 py-2.5 hover:bg-[hsl(240,10%,10%)] transition-colors"
                          >
                            <span className="text-sm">{REGISTRATION_OPTIONAL_FIELD_LABELS[key]}</span>
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
                  </SettingsInsetBlock>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Registration Limits"
                description="Close the form after a date or player count. Leave blank for no limit."
                icon={<CalendarIcon className="w-4 h-4 text-muted-foreground" />}
                className={fieldWrapClass("registration")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-normal">Optional</Badge>
                </div>
                <div id="settings-field-registration" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" /> Last date to register
                    </Label>
                    <Input
                      type="date"
                      value={editForm.registrationDeadline as string || ""}
                      onChange={e => setEditForm(f => ({ ...f, registrationDeadline: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground">After this date the form auto-closes.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max registrations</Label>
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
              </SettingsCard>

              <SettingsCard
                title="Bid Value Mode"
                description="Choose whether base values are set by the organizer or selected by players during registration."
                icon={<IndianRupee className="w-4 h-4 text-amber-400" />}
                className="lg:col-span-2"
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Assignment mode</Label>
                    <Select
                      value={(editForm.bidValueMode as string) || "system"}
                      onValueChange={(v) => setEditForm(f => ({ ...f, bidValueMode: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="dark">
                        <SelectItem value="system">System Assigned (default)</SelectItem>
                        <SelectItem value="player">Player Selected</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      System Assigned uses your tournament minimum player value. Player Selected shows a dropdown of allowed values on the registration form.
                    </p>
                  </div>

                  {editForm.bidValueMode === "player" && (
                    <div className="space-y-2 pt-1 border-t border-border/50">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Allowed bid values (₹)</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setBidValueOptions((opts) => [...opts, 0])}
                        >
                          + Add value
                        </Button>
                      </div>
                      {bidValueOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Add at least one value players can choose from.</p>
                      ) : (
                        <div className="space-y-2">
                          {bidValueOptions.map((value, i) => (
                            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Value {i + 1}</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={value || ""}
                                  onChange={(e) => {
                                    const next = Number(e.target.value) || 0;
                                    setBidValueOptions((opts) => opts.map((v, j) => (j === i ? next : v)));
                                  }}
                                  placeholder="e.g. 1500"
                                />
                                <IndianAmountHint value={value} className="text-[10px]" />
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9"
                                disabled={i === 0}
                                onClick={() => setBidValueOptions((opts) => {
                                  if (i === 0) return opts;
                                  const next = [...opts];
                                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                  return next;
                                })}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9"
                                disabled={i === bidValueOptions.length - 1}
                                onClick={() => setBidValueOptions((opts) => {
                                  if (i >= opts.length - 1) return opts;
                                  const next = [...opts];
                                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                                  return next;
                                })}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                onClick={() => setBidValueOptions((opts) => opts.filter((_, j) => j !== i))}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Registration Payments"
                description="Collect a registration fee with manual UPI payment verification."
                icon={<IndianRupee className="w-4 h-4 text-emerald-400" />}
                className={fieldWrapClass("registration")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-normal">Optional</Badge>
                </div>
                <div id="settings-field-registration-payments" className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Collect Registration Fee</p>
                      <p className="text-[10px] text-muted-foreground">Players pay via UPI and submit proof during registration.</p>
                    </div>
                    <Switch
                      checked={editForm.enableRegistrationPayment === true}
                      onCheckedChange={v => setEditForm(f => ({ ...f, enableRegistrationPayment: v }))}
                    />
                  </div>

                  <Collapsible open={editForm.enableRegistrationPayment === true}>
                    <CollapsibleContent className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Registration Fee (₹) <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            min={1}
                            value={editForm.registrationFee as string || ""}
                            onChange={e => setEditForm(f => ({ ...f, registrationFee: e.target.value }))}
                            placeholder="e.g. 500"
                          />
                          <IndianAmountHint value={editForm.registrationFee as string} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">UPI ID <span className="text-destructive">*</span></Label>
                          <Input
                            value={editForm.upiId as string || ""}
                            onChange={e => setEditForm(f => ({ ...f, upiId: e.target.value }))}
                            placeholder="yourname@upi"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">Verification Method <span className="text-destructive">*</span></Label>
                          <Select
                            value={(editForm.paymentVerificationMethod as string) || "utr"}
                            onValueChange={v => setEditForm(f => ({ ...f, paymentVerificationMethod: v }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent className="dark">
                              <SelectItem value="utr">UTR Number only</SelectItem>
                              <SelectItem value="screenshot">Payment screenshot only</SelectItem>
                              <SelectItem value="utr_and_screenshot">UTR + Screenshot</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Payment gateway integration (Cashfree, Razorpay) coming soon. Manual verification is active.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Declaration & Consent"
                description="Point-wise declaration shown on the registration form. Players must accept before submitting."
                icon={<ClipboardList className="w-4 h-4 text-muted-foreground" />}
                className="lg:col-span-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-normal">Optional</Badge>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3 text-blue-400" /> Enter one declaration point per line.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">Require declaration acceptance</p>
                      <p className="text-[10px] text-muted-foreground">Players must accept your declaration before the form can be submitted.</p>
                    </div>
                    <Switch
                      checked={editForm.enableRegistrationDeclaration === true}
                      onCheckedChange={v => setEditForm(f => ({ ...f, enableRegistrationDeclaration: v }))}
                    />
                  </div>

                  <Collapsible open={editForm.enableRegistrationDeclaration === true}>
                    <CollapsibleContent className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Declaration points</Label>
                        <Textarea
                          value={editForm.registrationDeclarationText as string || ""}
                          onChange={e => setEditForm(f => ({ ...f, registrationDeclarationText: e.target.value }))}
                          placeholder={"I consent to be present for all the matches on 4 & 5 July 2026.\nI agree to abide by the league's rules, regulations, and code of conduct.\nI declare that I am physically and medically fit to participate in the league."}
                          rows={12}
                          className="text-sm font-normal leading-relaxed"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Each line becomes a numbered point on the registration form. Add as many points as your tournament requires.
                        </p>
                      </div>
                      {parseRegistrationDeclarationPoints(editForm.registrationDeclarationText as string).length > 0 ? (
                        <div className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
                          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                            {parseRegistrationDeclarationPoints(editForm.registrationDeclarationText as string).map((point, i) => (
                              <li key={i} className="leading-relaxed">{point}</li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </SettingsCard>
            </div>
          </SettingsTabPanel>
        )}

        {/* ── AUCTION RULES ── */}
        {activeSection === "auction" && (
          <SettingsTabPanel className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SettingsCard
                title="Budget & Pricing"
                description="Team purse, minimum player value, bid increment, and optional tiered raise rules."
                icon={<Gavel className="w-4 h-4 text-muted-foreground" />}
              >
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 pb-3 border-b border-border/50">
                  <div className="space-y-1.5 sm:w-44 shrink-0">
                    <Label className="flex items-center gap-1">
                      Units *
                      <FieldTooltip text="Rupee shows ₹ everywhere (IPL-style auctions). Points shows Pt. for fantasy/corporate leagues that use a points budget instead of money." />
                    </Label>
                    <Select
                      value={normalizeAuctionUnit(editForm.auctionUnit as string)}
                      onValueChange={(value) => setEditForm((f) => ({ ...f, auctionUnit: value }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="dark">
                        {AUCTION_UNIT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed sm:pb-2">
                    Applies to LED, OBS, owner app, and reports.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      {budgetFieldLabel(normalizeAuctionUnit(editForm.auctionUnit as string))} *
                      <FieldTooltip text={`How much each team can spend in total. Every team starts with this amount. Example: ${normalizeAuctionUnit(editForm.auctionUnit as string) === "points" ? "10,000 Pt." : "₹1,00,00,000"} for IPL-style.`} />
                    </Label>
                    <Input type="number" value={editForm.basePurse as string || ""} onChange={e => setEditForm(f => ({ ...f, basePurse: e.target.value }))} placeholder="e.g. 10000000" />
                    <IndianAmountHint value={editForm.basePurse as string} unit={normalizeAuctionUnit(editForm.auctionUnit as string)} />
                  </div>
                  <div id="settings-field-minBid" className={`space-y-1.5 ${fieldWrapClass("minBid", Number(editForm.minBid) <= 0)}`}>
                    <Label className="flex items-center gap-1">
                      {minValueFieldLabel(normalizeAuctionUnit(editForm.auctionUnit as string))} *
                      <FieldTooltip text="The lowest amount any player can be sold for. Bidding for a player starts at this value unless the player's category overrides it." />
                    </Label>
                    <Input type="number" value={editForm.minBid as string || ""} onChange={e => setEditForm(f => ({ ...f, minBid: e.target.value }))} placeholder="e.g. 10000" />
                    <IndianAmountHint value={editForm.minBid as string} unit={normalizeAuctionUnit(editForm.auctionUnit as string)} />
                  </div>
                </div>
                <div id="settings-field-bidTiers" className={`space-y-2 pt-1 border-t border-border/50 ${fieldWrapClass("bidTiers", !bidTiers.some(t => t.increment > 0))}`}>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1">
                      {bidIncrementFieldLabel(normalizeAuctionUnit(editForm.auctionUnit as string))} *
                      <FieldTooltip text={`How much the bid goes up each time a team raises. Use + Add Tier for different increments at higher price points.`} />
                    </Label>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setBidTiers(t => [...t.slice(0, -1), { upTo: 0, increment: 0 }, { increment: t[t.length - 1]?.increment ?? 100000 }])}>
                      + Add Tier
                    </Button>
                  </div>
                  {bidTiers.length === 1 ? (
                    <div className="flex items-center gap-3">
                      <Input type="number" className="max-w-[200px]" value={bidTiers[0]?.increment || ""} onChange={e => setBidTiers([{ increment: Number(e.target.value) || 0 }])} placeholder="e.g. 10000" />
                      <IndianAmountHint value={bidTiers[0]?.increment} />
                      <span className="text-xs text-muted-foreground">per raise</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Tiered bid increase rules — set different raise amounts at different price points.
                      </p>
                      {bidTiers.map((tier, i) => {
                        const isLast = i === bidTiers.length - 1;
                        return (
                          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">{isLast ? "Any amount above — Raise by (₹)" : `Up to (₹) — Tier ${i + 1}`}</Label>
                              {isLast ? (
                                <div className="h-9 flex items-center px-3 rounded-md border border-border/50 bg-muted/20 text-muted-foreground text-sm">No upper limit</div>
                              ) : (
                                <>
                                  <Input type="number" value={tier.upTo ?? ""} onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, upTo: Number(e.target.value) || 0 } : x))} placeholder="e.g. 100000" />
                                  <IndianAmountHint value={tier.upTo} className="text-[10px]" />
                                </>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Raise by (₹)</Label>
                              <Input type="number" value={tier.increment || ""} onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, increment: Number(e.target.value) || 0 } : x))} placeholder="e.g. 25000" />
                              <IndianAmountHint value={tier.increment} className="text-[10px]" />
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
                  )}
                </div>
              </SettingsCard>

              <SettingsCard
                title="Timers"
                description="Opening countdown, bid timer, and late-bid extension."
                icon={<Timer className="w-4 h-4 text-muted-foreground" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div id="settings-field-openingTimer" className={`space-y-1.5 ${fieldWrapClass("openingTimer", !!openingTimerError)}`}>
                    <Label className="flex items-center gap-1">
                      <HintLabel hint="Naya player aane par kitni der wait karein">Opening Timer (sec)</HintLabel>
                      <FieldTooltip text="Countdown shown when a new player appears on screen before anyone bids. If no one bids in time, the player is passed." />
                    </Label>
                    <Input
                      type="number"
                      value={editForm.timerSeconds as string}
                      onChange={e => setEditForm(f => ({ ...f, timerSeconds: e.target.value }))}
                      min={MIN_AUCTION_TIMER_SECONDS}
                      max={MAX_AUCTION_TIMER_SECONDS}
                      aria-invalid={!!openingTimerError}
                    />
                    {openingTimerError ? (
                      <p className="text-[10px] text-destructive">{openingTimerError}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Recommended: 30 seconds (minimum {MIN_AUCTION_TIMER_SECONDS})</p>
                    )}
                  </div>
                  <div id="settings-field-bidTimer" className={`space-y-1.5 ${fieldWrapClass("bidTimer", !!bidTimerError)}`}>
                    <Label className="flex items-center gap-1">
                      <HintLabel hint="Har bid ke baad kitni der">Bid Timer (sec)</HintLabel>
                      <FieldTooltip text="After each bid, this timer resets. When it runs out, the highest bidder wins the player. Shorter timers create more urgency — recommended: 15 seconds." />
                    </Label>
                    <Input
                      type="number"
                      value={editForm.bidTimerSeconds as string}
                      onChange={e => setEditForm(f => ({ ...f, bidTimerSeconds: e.target.value }))}
                      min={MIN_AUCTION_TIMER_SECONDS}
                      max={MAX_AUCTION_TIMER_SECONDS}
                      aria-invalid={!!bidTimerError}
                    />
                    {bidTimerError ? (
                      <p className="text-[10px] text-destructive">{bidTimerError}</p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Recommended: 15 seconds (minimum {MIN_AUCTION_TIMER_SECONDS})</p>
                    )}
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
                  <div id="settings-field-maxSquad" className={`space-y-1.5 ${fieldWrapClass("maxSquad", !!squadSizeError)}`}>
                    <Label className="text-xs flex items-center gap-1">
                      Maximum Players
                      <FieldTooltip text="Teams cannot bid once they reach this count." />
                    </Label>
                    <Input
                      type="number"
                      min={Number(editForm.minimumSquadSize) > 0 ? Number(editForm.minimumSquadSize) : 0}
                      max={100}
                      value={editForm.maximumSquadSize as string ?? "0"}
                      onChange={e => setEditForm(f => ({ ...f, maximumSquadSize: e.target.value }))}
                    />
                    {squadSizeError ? (
                      <p className="text-[11px] text-destructive">{squadSizeError}</p>
                    ) : null}
                  </div>
                </div>
              </SettingsCard>
            </div>
          </SettingsTabPanel>
        )}

        {/* ── SPONSORS ── */}
        {activeSection === "sponsors" && (
          <SettingsTabPanel className="max-w-3xl">
            <SettingsCard
              title="Sponsor Logos"
              description="Logos appear on the LED display, side screens, and stream overlay. They rotate every 4 seconds on the big screen."
              icon={<Handshake className="w-4 h-4 text-muted-foreground" />}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Logo required; name and type optional.</span>
                <span>{sponsorLogos.length} logo{sponsorLogos.length === 1 ? "" : "s"}</span>
              </div>
              <SponsorLogosEditor logos={sponsorLogos} onChange={setSponsorLogos} onUploadFile={handleSponsorLogoUpload} uploadingIdx={sponsorUploadingIdx} />
            </SettingsCard>
          </SettingsTabPanel>
        )}

        {/* ── BROADCAST ── */}
        {activeSection === "broadcast" && (
          <SettingsTabPanel>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SettingsCard
              title="LED Display"
              description="Main banner and display mode for the big screen. Pick the LED colour theme on the live display."
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
                        onClick={() => setEditForm(f => ({ ...f, mainBannerUrl: "", mainBannerPublicId: "" }))}
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
            </SettingsCard>

            <SettingsCard
              title="Auction Sounds"
              description="Countdown, sold, and break music — each plays at its own moment during the auction."
              icon={<Megaphone className="w-4 h-4 text-muted-foreground" />}
              className="xl:col-span-2"
              contentClassName="space-y-3"
            >
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
                            <label className={`flex-1 ${audioUploadingField === "countdownSoundUrl" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                              <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                {audioUploadingField === "countdownSoundUrl"
                                  ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                                  : <Upload className="w-3 h-3 shrink-0" />}
                                <span className="truncate">{countdownFileName || "Upload .mp3 / .ogg / .wav"}</span>
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
                          <p className="text-[10px] text-muted-foreground">
                            {editForm.countdownSoundUrl
                              ? "Custom file loaded — overrides platform default"
                              : countdownFileName === "Platform default"
                                ? "Using platform default — upload to override for this tournament"
                                : "No file selected — built-in digital tick will play"}
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
                            <label className={`flex-1 ${audioUploadingField === "soldSoundUrl" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                              <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                {audioUploadingField === "soldSoundUrl"
                                  ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                                  : <Upload className="w-3 h-3 shrink-0" />}
                                <span className="truncate">{soldFileName || "Upload .mp3 / .ogg / .wav"}</span>
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
                          <p className="text-[10px] text-muted-foreground">
                            {editForm.soldSoundUrl
                              ? "Custom file loaded — overrides platform default"
                              : soldFileName === "Platform default"
                                ? "Using platform default — upload to override for this tournament"
                                : "No file selected — built-in fanfare will play"}
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

                  {/* Break Music */}
                  <div className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Coffee className="w-3.5 h-3.5 text-muted-foreground" />
                        Break Music
                        <span className="text-[10px] text-muted-foreground font-normal">loops on LED during break</span>
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
                            <label className={`flex-1 ${audioUploadingField === "breakEndMusicUrl" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
                              <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                                {audioUploadingField === "breakEndMusicUrl"
                                  ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                                  : <Upload className="w-3 h-3 shrink-0" />}
                                <span className="truncate">{breakEndFileName || "Upload .mp3 / .ogg / .wav"}</span>
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
                          <p className="text-[10px] text-muted-foreground">
                            {editForm.breakEndMusicUrl
                              ? "Custom file loaded — overrides platform default"
                              : breakEndFileName === "Platform default"
                                ? "Using platform default — upload to override for this tournament"
                                : "No file selected — built-in chime will play"}
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
                          <Button type="button" size="sm" variant="outline" className="gap-1.5 h-7 text-xs shrink-0" onClick={previewBreakMusic}>
                            <Play className="w-3 h-3" /> Preview
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
