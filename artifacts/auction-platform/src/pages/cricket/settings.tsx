/**
 * Cricket Tournament settings — identity, sponsors, venue music/banner + Import from Auction.
 * Route: /tournament/:id/score/settings
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  FormField,
  PageHeader,
  hubPanelClass,
  inputClass,
} from "@/components/scoring/cricket-page-chrome";
import { SponsorLogosEditor } from "@/components/settings/sponsor-logos-editor";
import { VenueMusicSettingsPanel } from "@/components/badminton/venue-music-settings-panel";
import { VenueBannerSettingsPanel } from "@/components/badminton/venue-banner-settings-panel";
import { FanLiveStreamEditor } from "@/components/scoring/fan-live-stream-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  getGetTournamentQueryKey,
  useGetTournament,
  useUpdateTournament,
} from "@workspace/api-client-react";
import { playerRegistrationShareUrl } from "@workspace/api-base/registration-url";
import {
  REGISTRATION_MANDATORY_FIELD_KEYS,
  REGISTRATION_OPTIONAL_FIELD_KEYS,
  REGISTRATION_OPTIONAL_FIELD_LABELS,
  serializeRegistrationFieldsConfig,
  type RegistrationOptionalFieldKey,
} from "@workspace/api-base/registration-fields";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  cricketBrandingQueryKey,
  getCricketBranding,
  importCricketTournamentBranding,
  patchCricketBranding,
  patchCricketBroadcastPresentation,
} from "@/lib/scoring-api";
import {
  getSponsorsByPriority,
  parseSponsorLogos,
  validateSponsorList,
  type SponsorLogo,
} from "@/lib/sponsor-logo";
import type { SportsBranding, ScoreBoardSponsor } from "@/lib/sports-branding-types";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Link2,
  Lock,
  MessageCircle,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

const ImageEditorDialog = lazy(() =>
  import("@/components/image-editor-dialog").then((m) => ({ default: m.ImageEditorDialog })),
);

const EMPTY_SCOREBOARD_SPONSOR: ScoreBoardSponsor = {
  logoUrl: null,
  name: null,
  title: null,
};

function hasScoreBoardSponsor(sponsor: ScoreBoardSponsor): boolean {
  return Boolean(
    sponsor.logoUrl?.trim() || sponsor.name?.trim() || sponsor.title?.trim(),
  );
}

type BrandingFormState = {
  displayName: string;
  logoUrl: string;
  logoPublicId: string;
  venue: string;
  organizerName: string;
  primaryColor: string;
  accentColor: string;
};

function brandingFromApi(branding: SportsBranding): {
  form: BrandingFormState;
  sponsorLogos: SponsorLogo[];
  scoreBoardSponsor: ScoreBoardSponsor;
} {
  return {
    form: {
      displayName: branding.displayName,
      logoUrl: branding.logoUrl ?? "",
      logoPublicId: "",
      venue: branding.venue ?? "",
      organizerName: branding.organizerName ?? "",
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
    },
    sponsorLogos: getSponsorsByPriority(parseSponsorLogos(branding.sponsorLogos)),
    scoreBoardSponsor: branding.scoreBoardSponsor ?? EMPTY_SCOREBOARD_SPONSOR,
  };
}

function scoreBoardSponsorPayload(sponsor: ScoreBoardSponsor): ScoreBoardSponsor | null {
  const logoUrl = sponsor.logoUrl?.trim() || null;
  const logoPublicId = sponsor.logoPublicId?.trim() || null;
  const name = sponsor.name?.trim() || null;
  const title = sponsor.title?.trim() || null;
  if (!logoUrl && !name && !title) return null;
  return { logoUrl, logoPublicId, name, title };
}

function buildBrandingPatchPayload(
  form: BrandingFormState,
  sponsorLogos: SponsorLogo[],
  scoreBoardSponsor: ScoreBoardSponsor,
) {
  return {
    displayName: form.displayName.trim(),
    logoUrl: form.logoUrl.trim() || null,
    logoPublicId: form.logoPublicId.trim() || null,
    sponsorLogos: JSON.stringify(
      sponsorLogos
        .filter((l) => l.url && l.url.trim())
        .map((l, idx) => ({
          url: l.url.trim(),
          publicId: l.publicId?.trim() || null,
          name: l.name?.trim() || "",
          type: l.type?.trim() || "",
          isTitleSponsor: Boolean(l.isTitleSponsor),
          isCoSponsor: Boolean(l.isCoSponsor),
          priorityType: l.priorityType || undefined,
          sponsorPriority: l.sponsorPriority ?? idx,
          priority: (l as unknown as { priority?: number }).priority ?? idx,
        })),
    ),
    venue: form.venue.trim() || null,
    organizerName: form.organizerName.trim() || null,
    primaryColor: form.primaryColor,
    accentColor: form.accentColor,
    scoreBoardSponsor: scoreBoardSponsorPayload(scoreBoardSponsor),
  };
}

function brandingPayloadSignature(
  form: BrandingFormState,
  sponsorLogos: SponsorLogo[],
  scoreBoardSponsor: ScoreBoardSponsor,
): string {
  return JSON.stringify(buildBrandingPatchPayload(form, sponsorLogos, scoreBoardSponsor));
}

function applyBrandingState(
  branding: SportsBranding,
  setters: {
    setForm: (form: BrandingFormState) => void;
    setSponsorLogos: (logos: SponsorLogo[]) => void;
    setScoreBoardSponsor: (sponsor: ScoreBoardSponsor) => void;
    lastSavedPayloadRef: MutableRefObject<string>;
  },
) {
  const next = brandingFromApi(branding);
  setters.setForm(next.form);
  setters.setSponsorLogos(next.sponsorLogos);
  setters.setScoreBoardSponsor(next.scoreBoardSponsor);
  setters.lastSavedPayloadRef.current = brandingPayloadSignature(
    next.form,
    next.sponsorLogos,
    next.scoreBoardSponsor,
  );
}

export default function CricketSettingsPage() {
  const [, params] = useRoute("/tournament/:id/score/settings");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();
  const brandingKey = cricketBrandingQueryKey(tournamentId);

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { data: branding, isLoading } = useQuery({
    queryKey: brandingKey,
    queryFn: () => getCricketBranding<SportsBranding>(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const [form, setForm] = useState<BrandingFormState>({
    displayName: "",
    logoUrl: "",
    logoPublicId: "",
    venue: "",
    organizerName: "",
    primaryColor: "#FFD700",
    accentColor: "#2A3566",
  });
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  const [scoreBoardSponsor, setScoreBoardSponsor] = useState<ScoreBoardSponsor>(EMPTY_SCOREBOARD_SPONSOR);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [scoreBoardLogoEditorOpen, setScoreBoardLogoEditorOpen] = useState(false);
  const [sponsorUploadIdx, setSponsorUploadIdx] = useState<number | "new" | null>(null);
  const [saveError, setSaveError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const hydratedTournamentRef = useRef(0);
  const autoSaveReadyRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifySaveToastRef = useRef(false);

  const updateTournament = useUpdateTournament();
  const [regForm, setRegForm] = useState({
    registrationDeadline: "",
    registrationLimit: "",
    enableRegistrationDeclaration: false,
    registrationDeclarationText: "",
  });
  const [registrationFieldsHidden, setRegistrationFieldsHidden] = useState<RegistrationOptionalFieldKey[]>([]);
  const [regSaving, setRegSaving] = useState(false);
  const [regSaved, setRegSaved] = useState(false);
  const [regCopied, setRegCopied] = useState(false);

  const regUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = tournament?.auctionCode;
    if (!code) return "";
    return playerRegistrationShareUrl(window.location.origin, code);
  }, [tournament?.auctionCode]);

  useEffect(() => {
    if (!tournament) return;
    setRegForm({
      registrationDeadline: tournament.registrationDeadline || "",
      registrationLimit: tournament.registrationLimit != null ? String(tournament.registrationLimit) : "",
      enableRegistrationDeclaration: tournament.enableRegistrationDeclaration === true,
      registrationDeclarationText: tournament.registrationDeclarationText || "",
    });
    const hidden = (tournament as { registrationFields?: { hidden?: RegistrationOptionalFieldKey[] } }).registrationFields?.hidden ?? [];
    setRegistrationFieldsHidden(hidden);
  }, [tournament]);

  const handleCopyLink = useCallback(async () => {
    if (!regUrl) return;
    try {
      await navigator.clipboard.writeText(regUrl);
      setRegCopied(true);
      toast({ title: "Registration link copied to clipboard" });
      setTimeout(() => setRegCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  }, [regUrl, toast]);

  async function handleSaveRegistration() {
    setRegSaving(true);
    try {
      await updateTournament.mutateAsync({
        tournamentId,
        data: {
          registrationDeadline: regForm.registrationDeadline ? regForm.registrationDeadline : null,
          registrationLimit: regForm.registrationLimit !== "" && regForm.registrationLimit != null ? Number(regForm.registrationLimit) || null : null,
          enableRegistrationDeclaration: regForm.enableRegistrationDeclaration === true,
          registrationDeclarationText: regForm.registrationDeclarationText.trim() || null,
          playerRegistrationMode: "scoring",
          registrationFields: serializeRegistrationFieldsConfig(registrationFieldsHidden),
          reason: "Tournament registration settings updated by organizer",
        } as unknown as import("@workspace/api-client-react").TournamentUpdate,
      });
      await qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      setRegSaved(true);
      toast({ title: "Registration settings saved" });
      setTimeout(() => setRegSaved(false), 2500);
    } catch (err) {
      toast({
        title: "Failed to save registration settings",
        description: err instanceof Error ? err.message : "Error saving",
        variant: "destructive",
      });
    } finally {
      setRegSaving(false);
    }
  }

  const importBrandingMutation = useMutation({
    mutationFn: () => importCricketTournamentBranding<SportsBranding>(tournamentId),
    onSuccess: (data) => {
      applyBrandingState(data, {
        setForm,
        setSponsorLogos,
        setScoreBoardSponsor,
        lastSavedPayloadRef,
      });
      hydratedTournamentRef.current = tournamentId;
      qc.setQueryData(brandingKey, data);
      setImportMessage(
        "Tournament branding imported. Edit cricket Sports sponsors below without changing Auction settings.",
      );
      setSaveError("");
      toast({ title: "Branding imported" });
    },
    onError: (e: Error) => setImportMessage(e.message),
  });

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    hydratedTournamentRef.current = 0;
    autoSaveReadyRef.current = false;
  }, [tournamentId]);

  useEffect(() => {
    if (!branding || !tournamentId) return;
    if (hydratedTournamentRef.current === tournamentId) return;
    applyBrandingState(branding, {
      setForm,
      setSponsorLogos,
      setScoreBoardSponsor,
      lastSavedPayloadRef,
    });
    hydratedTournamentRef.current = tournamentId;
    autoSaveReadyRef.current = false;
    const timer = window.setTimeout(() => {
      autoSaveReadyRef.current = true;
    }, 300);
    return () => window.clearTimeout(timer);
  }, [branding, tournamentId]);

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildBrandingPatchPayload>) =>
      patchCricketBranding<SportsBranding>(tournamentId, payload),
    onSuccess: (data, variables) => {
      qc.setQueryData(brandingKey, data);
      lastSavedPayloadRef.current = JSON.stringify(variables);
      setSaveError("");
      setJustSaved(true);
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
      savedFlashTimerRef.current = setTimeout(() => setJustSaved(false), 2500);
      if (notifySaveToastRef.current) {
        notifySaveToastRef.current = false;
        toast({ title: "Settings saved" });
      }
    },
    onError: (e: Error) => {
      notifySaveToastRef.current = false;
      setJustSaved(false);
      setSaveError(e.message);
    },
  });

  const saveMutationRef = useRef(saveMutation);
  saveMutationRef.current = saveMutation;

  const persistBranding = useCallback(
    (immediate = false) => {
      if (!tournamentId) return;
      if (!form.displayName.trim()) {
        setSaveError("Tournament name is required");
        return;
      }
      const filtered = sponsorLogos.filter((l) => l.url.trim());
      const sponsorValidation = validateSponsorList(filtered);
      if (!sponsorValidation.ok) {
        setSaveError(sponsorValidation.error);
        return;
      }
      const payload = buildBrandingPatchPayload(form, sponsorLogos, scoreBoardSponsor);
      const signature = JSON.stringify(payload);
      if (signature === lastSavedPayloadRef.current) {
        if (immediate) {
          setJustSaved(true);
          if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
          savedFlashTimerRef.current = setTimeout(() => setJustSaved(false), 2500);
          toast({ title: "Settings saved", description: "Already up to date." });
        }
        return;
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      notifySaveToastRef.current = immediate;
      const run = () => {
        lastSavedPayloadRef.current = signature;
        saveMutationRef.current.mutate(payload);
      };
      if (immediate) {
        run();
        return;
      }
      autoSaveTimerRef.current = setTimeout(run, 800);
    },
    [form, sponsorLogos, scoreBoardSponsor, toast, tournamentId],
  );

  useEffect(() => {
    if (!autoSaveReadyRef.current || !tournamentId || !scoringActive) return;
    persistBranding();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [form, sponsorLogos, scoreBoardSponsor, tournamentId, scoringActive]);

  async function handleSponsorUpload(file: File | File[], idx: number | "new") {
    const files = Array.isArray(file) ? file : [file];
    if (idx !== "new" && files.length !== 1) return;

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        toast({ title: "Upload blocked", description: "Each image must be under 5 MB", variant: "destructive" });
        return;
      }
      if (!f.type.startsWith("image/")) {
        toast({ title: "Upload blocked", description: "Please choose JPG, PNG, or WEBP images", variant: "destructive" });
        return;
      }
    }

    setSponsorUploadIdx(idx);
    try {
      const uploadOne = async (f: File) => {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
        if (!r.ok) throw new Error("Upload failed");
        const data = (await r.json()) as { url?: string };
        if (!data.url) throw new Error("Upload failed");
        return { url: data.url, name: "", type: "" };
      };

      if (idx === "new") {
        const results = await Promise.allSettled(files.map(uploadOne));
        const uploaded = results
          .filter((r): r is PromiseFulfilledResult<{ url: string; name: string; type: string }> => r.status === "fulfilled")
          .map((r) => r.value);
        if (uploaded.length > 0) {
          setSponsorLogos((prev) => [...prev, ...uploaded]);
          toast({
            title: uploaded.length === 1 ? "Sponsor logo uploaded" : `${uploaded.length} logos uploaded`,
          });
        }
        if (uploaded.length < files.length) {
          toast({
            title: "Upload incomplete",
            description:
              uploaded.length === 0
                ? "Sponsor logo upload failed"
                : `${uploaded.length} of ${files.length} logos uploaded. Some files failed.`,
            variant: "destructive",
          });
        }
      } else {
        const uploaded = await uploadOne(files[0]);
        setSponsorLogos((prev) => prev.map((l, i) => (i === idx ? { ...l, url: uploaded.url } : l)));
        toast({ title: "Sponsor logo updated" });
      }
    } catch (e) {
      toast({
        title: "Sponsor logo upload failed",
        description: e instanceof Error ? e.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setSponsorUploadIdx(null);
    }
  }

  if (tournament?.sport && tournament.sport !== "cricket") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Setup"
        title="Tournament settings"
        subtitle="Identity, sponsors, venue music & banner for Sports displays"
        actions={
          scoringActive ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <BtnSecondary
                  disabled={importBrandingMutation.isPending || isLoading}
                  onClick={() => importBrandingMutation.mutate()}
                  title="Copy Auction name, logo, venue, organizer, and sponsor logos into Sports settings"
                >
                  <Upload className="w-4 h-4" />
                  {importBrandingMutation.isPending ? "Importing…" : "Import from Auction"}
                </BtnSecondary>
                <BtnPrimary
                  onClick={() => persistBranding(true)}
                  disabled={saveMutation.isPending || isLoading || !form.displayName.trim()}
                >
                  {saveMutation.isPending ? "Saving…" : justSaved ? "Saved" : "Save Details"}
                </BtnPrimary>
              </div>
              <p
                className={cn(
                  "text-xs text-right max-w-sm",
                  saveError || importMessage.startsWith("Tournament branding")
                    ? saveError
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400"
                    : justSaved
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground",
                )}
              >
                {saveError
                  ? saveError
                  : importMessage
                    ? importMessage
                    : saveMutation.isPending
                      ? "Saving changes…"
                      : justSaved
                        ? "All changes saved"
                        : "Changes save automatically"}
              </p>
            </div>
          ) : undefined
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
        {tournamentLoading || (scoringActive && isLoading) ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : !scoringActive ? (
          <EmptyState
            icon={Settings}
            title="Scoring not Activated"
            desc="Contact BIDWAR for enabling sport scoring module."
          />
        ) : (
          <div className="space-y-6">
            <div className="max-w-3xl">
              <FanLiveStreamEditor tournamentId={tournamentId} />
            </div>

            {/* 1. Tournament identity & Rotating Sponsors */}
            <section className={cn(hubPanelClass, "space-y-6 max-w-3xl")}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <h2 className="text-foreground font-display font-bold text-lg">Tournament Identity &amp; Sponsors</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    Name, venue, colors, and rotating sponsor logos for LED screens, live streams, and match broadcasts.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => persistBranding(true)}
                  disabled={saveMutation.isPending || isLoading || !form.displayName.trim()}
                  className="shrink-0 gap-1.5"
                >
                  {saveMutation.isPending ? "Saving…" : justSaved ? "Saved" : "Save Details & Sponsors"}
                </Button>
              </div>

              <FormField label="Tournament Name" required htmlFor="cricket-branding-display-name">
                <input
                  id="cricket-branding-display-name"
                  required
                  value={form.displayName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, displayName: e.target.value }));
                    if (saveError === "Tournament name is required" && e.target.value.trim()) {
                      setSaveError("");
                    }
                  }}
                  placeholder="Box Cricket Cup 2026"
                  className={inputClass}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Venue">
                  <input
                    value={form.venue}
                    onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                    placeholder="City Sports Complex"
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Organizer Name">
                  <input
                    value={form.organizerName}
                    onChange={(e) => setForm((f) => ({ ...f, organizerName: e.target.value }))}
                    placeholder="ABC Sports Association"
                    className={inputClass}
                  />
                </FormField>
              </div>

              <FormField label="Tournament Logo">
                <div className="flex items-center gap-4">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt={form.displayName?.trim() ? `${form.displayName} logo` : "Tournament logo"}
                      className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs">
                      No logo
                    </div>
                  )}
                  <div className="flex gap-2">
                    <BtnSecondary type="button" onClick={() => setLogoEditorOpen(true)}>
                      {form.logoUrl ? "Change Logo" : "Upload Logo"}
                    </BtnSecondary>
                    {form.logoUrl ? (
                      <BtnSecondary
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, logoUrl: "", logoPublicId: "" }))}
                      >
                        Remove
                      </BtnSecondary>
                    ) : null}
                  </div>
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Primary Color">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    className="w-full h-10 rounded-xl cursor-pointer bg-transparent"
                  />
                </FormField>
                <FormField label="Accent Color">
                  <input
                    type="color"
                    value={form.accentColor}
                    onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                    className="w-full h-10 rounded-xl cursor-pointer bg-transparent"
                  />
                </FormField>
              </div>

              <div className="pt-2">
                <div className="mb-2">
                  <label className="text-foreground text-sm font-semibold block">Tournament Sponsor Logos</label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add brand logos below. Logos rotate on live LED screens and appear on stream headers, broadcast overlays, and reports.
                  </p>
                </div>
                <SponsorLogosEditor
                  logos={sponsorLogos}
                  onChange={setSponsorLogos}
                  onUploadFile={handleSponsorUpload}
                  uploadingIdx={sponsorUploadIdx}
                />
              </div>

              {saveError ? <p className="text-destructive text-sm font-medium">{saveError}</p> : null}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  {saveError
                    ? saveError
                    : saveMutation.isPending
                      ? "Saving changes…"
                      : justSaved
                        ? "✓ All changes saved"
                        : "Changes save automatically as you edit."}
                </p>
                <Button
                  type="button"
                  onClick={() => persistBranding(true)}
                  disabled={saveMutation.isPending || isLoading || !form.displayName.trim()}
                  className="w-full sm:w-auto"
                >
                  {saveMutation.isPending ? "Saving…" : justSaved ? "Saved" : "Save Details & Sponsors"}
                </Button>
              </div>
            </section>

            {/* 2. Standalone Scoreboard Sponsor Panel */}
            <section className={cn(hubPanelClass, "space-y-5 max-w-3xl border-primary/25")}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <h2 className="text-foreground font-display font-bold text-lg flex items-center gap-2">
                    Scoreboard Sponsor
                    <Badge variant="outline" className="text-[11px] font-normal border-amber-500/40 text-amber-300 bg-amber-500/10">
                      Match Overlays &amp; Scorebug
                    </Badge>
                  </h2>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    Optional fixed sponsor shown permanently on the live match scoreboard bar and OBS scorebug during cricket matches.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => persistBranding(true)}
                  disabled={saveMutation.isPending || isLoading}
                  className="shrink-0 gap-1.5"
                >
                  {saveMutation.isPending ? "Saving…" : justSaved ? "Saved" : "Save Scoreboard Sponsor"}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Partner Designation / Title">
                    <input
                      value={scoreBoardSponsor.title ?? ""}
                      onChange={(e) =>
                        setScoreBoardSponsor((s) => ({ ...s, title: e.target.value || null }))
                      }
                      placeholder="e.g. Official Scoreboard Partner"
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Sponsor / Brand Name">
                    <input
                      value={scoreBoardSponsor.name ?? ""}
                      onChange={(e) =>
                        setScoreBoardSponsor((s) => ({ ...s, name: e.target.value || null }))
                      }
                      placeholder="e.g. VNS LIVE STUDIO"
                      className={inputClass}
                    />
                  </FormField>
                </div>

                <FormField label="Scoreboard Sponsor Logo">
                  <div className="flex items-center gap-4">
                    {scoreBoardSponsor.logoUrl ? (
                      <img
                        src={scoreBoardSponsor.logoUrl}
                        alt={scoreBoardSponsor.name?.trim() || "Scoreboard sponsor logo"}
                        className="w-20 h-16 rounded-xl object-contain bg-white p-2 border border-amber-400/40 shadow-xs"
                      />
                    ) : (
                      <div className="w-20 h-16 rounded-xl bg-white/5 border border-dashed border-border/80 flex items-center justify-center text-muted-foreground text-xs">
                        No logo
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <BtnSecondary type="button" onClick={() => setScoreBoardLogoEditorOpen(true)}>
                        {scoreBoardSponsor.logoUrl ? "Change Logo" : "Upload Logo"}
                      </BtnSecondary>
                      {scoreBoardSponsor.logoUrl ? (
                        <BtnSecondary
                          type="button"
                          onClick={() =>
                            setScoreBoardSponsor((s) => ({
                              ...s,
                              logoUrl: null,
                              logoPublicId: null,
                            }))
                          }
                        >
                          Remove Logo
                        </BtnSecondary>
                      ) : null}
                      {hasScoreBoardSponsor(scoreBoardSponsor) ? (
                        <BtnSecondary
                          type="button"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setScoreBoardSponsor(EMPTY_SCOREBOARD_SPONSOR)}
                        >
                          Clear All
                        </BtnSecondary>
                      ) : null}
                    </div>
                  </div>
                </FormField>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  Scoreboard sponsor appears fixed in the match scorebug and overlay header.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => persistBranding(true)}
                  disabled={saveMutation.isPending || isLoading}
                  className="w-full sm:w-auto"
                >
                  {saveMutation.isPending ? "Saving…" : justSaved ? "Saved" : "Save Scoreboard Sponsor"}
                </Button>
              </div>
            </section>

            {/* Player Registration Settings Panel */}
            <section id="registration" className={cn(hubPanelClass, "space-y-5 max-w-3xl scroll-mt-20")}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <h2 className="text-foreground font-display font-bold text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Player Registration Settings
                  </h2>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    Configure link capacity, deadline dates, declaration, and field visibility for public player registration.
                  </p>
                </div>
                <Button
                  onClick={handleSaveRegistration}
                  disabled={regSaving}
                  className="shrink-0 gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {regSaving ? "Saving…" : regSaved ? "Saved" : "Save Registration"}
                </Button>
              </div>

              {/* Share Registration Link Card */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Public Registration Link</span>
                  </div>
                  {tournament?.auctionCode && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      Code: {tournament.auctionCode}
                    </Badge>
                  )}
                </div>
                {regUrl ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <p className="text-xs font-mono text-primary truncate flex-1 min-w-[200px] bg-background/60 border border-border/60 rounded-md px-3 py-2">
                      {regUrl}
                    </p>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9" onClick={() => void handleCopyLink()}>
                      {regCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {regCopied ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9" asChild>
                      <a href={`https://wa.me/?text=${encodeURIComponent(`Register for our cricket tournament: ${regUrl}`)}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9" onClick={() => window.open(regUrl, "_blank")}>
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Link is generated automatically from the tournament code.
                  </p>
                )}
              </div>

              {/* Deadlines & Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Registration Deadline">
                  <Input
                    type="date"
                    value={regForm.registrationDeadline}
                    onChange={(e) => setRegForm((f) => ({ ...f, registrationDeadline: e.target.value }))}
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank for open-ended registration.
                  </p>
                </FormField>

                <FormField label="Maximum Players Limit">
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 100"
                    value={regForm.registrationLimit}
                    onChange={(e) => setRegForm((f) => ({ ...f, registrationLimit: e.target.value }))}
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Registration automatically closes when capacity is reached.
                  </p>
                </FormField>
              </div>

              {/* Declaration & Consent */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Player Declaration &amp; Consent
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Require players to agree to tournament terms &amp; conditions during registration.
                    </p>
                  </div>
                  <Switch
                    checked={regForm.enableRegistrationDeclaration}
                    onCheckedChange={(checked) =>
                      setRegForm((f) => ({ ...f, enableRegistrationDeclaration: checked }))
                    }
                  />
                </div>

                {regForm.enableRegistrationDeclaration && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs text-muted-foreground">
                      Declaration Points (one per line)
                    </Label>
                    <Textarea
                      rows={4}
                      value={regForm.registrationDeclarationText}
                      onChange={(e) =>
                        setRegForm((f) => ({ ...f, registrationDeclarationText: e.target.value }))
                      }
                      placeholder="1. I agree to abide by the tournament rules and match timings.&#10;2. I confirm I am medically fit to play cricket.&#10;3. Organizers decision on match disputes is final."
                      className="text-sm bg-background/50 border-border/70"
                    />
                  </div>
                )}
              </div>

              {/* Optional Form Fields Toggle */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    Registration Form Fields
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Toggle optional fields shown on the public cricket registration form.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border/40">
                  <span className="text-[11px] font-medium text-muted-foreground mr-1">Always Required:</span>
                  {REGISTRATION_MANDATORY_FIELD_KEYS.map((key) => (
                    <Badge key={key} variant="secondary" className="text-[10px] h-5 px-2 font-normal bg-muted/60 text-foreground/80">
                      {key === "mobile" ? "Mobile" : key.replace(/([A-Z])/g, " $1").trim()}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {REGISTRATION_OPTIONAL_FIELD_KEYS.map((key) => {
                    const visible = !registrationFieldsHidden.includes(key);
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

              <div className="flex justify-end pt-3 border-t border-border/40">
                <Button
                  onClick={handleSaveRegistration}
                  disabled={regSaving}
                  className="gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {regSaving ? "Saving…" : regSaved ? "Saved" : "Save Registration Settings"}
                </Button>
              </div>
            </section>

            <VenueMusicSettingsPanel
              tournamentId={tournamentId}
              branding={branding}
              sportLabel="cricket"
              brandingQueryKey={brandingKey}
              patchPresentation={(body) =>
                patchCricketBroadcastPresentation<SportsBranding>(tournamentId, body)
              }
              auctionEnabled={tournament?.auctionEnabled}
              scoringEnabled={tournament?.scoringEnabled}
            />

            <VenueBannerSettingsPanel
              tournamentId={tournamentId}
              branding={branding}
              sportLabel="cricket"
              brandingQueryKey={brandingKey}
              patchPresentation={(body) =>
                patchCricketBroadcastPresentation<SportsBranding>(tournamentId, body)
              }
              auctionEnabled={tournament?.auctionEnabled}
              scoringEnabled={tournament?.scoringEnabled}
            />
          </div>
        )}
      </div>

      {logoEditorOpen ? (
        <Suspense fallback={null}>
          <ImageEditorDialog
            open={logoEditorOpen}
            onClose={() => setLogoEditorOpen(false)}
            initialUrl={form.logoUrl || undefined}
            aspect={1}
            title="Tournament Logo"
            onSave={(upload) => {
              setForm((f) => ({ ...f, logoUrl: upload.url, logoPublicId: upload.publicId }));
              setLogoEditorOpen(false);
            }}
          />
        </Suspense>
      ) : null}

      {scoreBoardLogoEditorOpen ? (
        <Suspense fallback={null}>
          <ImageEditorDialog
            open={scoreBoardLogoEditorOpen}
            onClose={() => setScoreBoardLogoEditorOpen(false)}
            initialUrl={scoreBoardSponsor.logoUrl || undefined}
            aspect={1}
            title="Scoreboard Sponsor Logo"
            onSave={(upload) => {
              setScoreBoardSponsor((s) => ({
                ...s,
                logoUrl: upload.url,
                logoPublicId: upload.publicId,
              }));
              setScoreBoardLogoEditorOpen(false);
            }}
          />
        </Suspense>
      ) : null}
    </CricketOrganizerPageShell>
  );
}
