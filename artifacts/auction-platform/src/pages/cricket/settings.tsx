/**
 * Cricket Tournament settings — identity, sponsors, venue music/banner + Import from Auction.
 * Route: /tournament/:id/score/settings
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
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
} from "@/components/badminton/page-chrome";
import { SponsorLogosEditor } from "@/components/settings/sponsor-logos-editor";
import { VenueMusicSettingsPanel } from "@/components/badminton/venue-music-settings-panel";
import { VenueBannerSettingsPanel } from "@/components/badminton/venue-banner-settings-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  getGetTournamentQueryKey,
  useGetTournament,
} from "@workspace/api-client-react";
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
import type { BadmintonBranding, ScoreBoardSponsor } from "@/hooks/use-badminton-branding";
import { cn } from "@/lib/utils";
import { Settings, Upload } from "lucide-react";

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

function brandingFromApi(branding: BadmintonBranding): {
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
    sponsorLogos: JSON.stringify(sponsorLogos.filter((l) => l.url.trim())),
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
  branding: BadmintonBranding,
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
    queryFn: () => getCricketBranding<BadmintonBranding>(tournamentId),
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
  const [scoreBoardExpanded, setScoreBoardExpanded] = useState(false);
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

  const importBrandingMutation = useMutation({
    mutationFn: () => importCricketTournamentBranding<BadmintonBranding>(tournamentId),
    onSuccess: (data) => {
      applyBrandingState(data, {
        setForm,
        setSponsorLogos,
        setScoreBoardSponsor,
        lastSavedPayloadRef,
      });
      setScoreBoardExpanded(hasScoreBoardSponsor(data.scoreBoardSponsor ?? EMPTY_SCOREBOARD_SPONSOR));
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
    setScoreBoardExpanded(hasScoreBoardSponsor(branding.scoreBoardSponsor ?? EMPTY_SCOREBOARD_SPONSOR));
    hydratedTournamentRef.current = tournamentId;
    autoSaveReadyRef.current = false;
    const timer = window.setTimeout(() => {
      autoSaveReadyRef.current = true;
    }, 150);
    return () => window.clearTimeout(timer);
  }, [branding, tournamentId]);

  const saveMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildBrandingPatchPayload>) =>
      patchCricketBranding<BadmintonBranding>(tournamentId, payload),
    onSuccess: (data) => {
      qc.setQueryData(brandingKey, data);
      const synced = brandingFromApi(data);
      lastSavedPayloadRef.current = brandingPayloadSignature(
        synced.form,
        synced.sponsorLogos,
        synced.scoreBoardSponsor,
      );
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
      const signature = brandingPayloadSignature(form, sponsorLogos, scoreBoardSponsor);
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
      const run = () => saveMutation.mutate(payload);
      if (immediate) {
        run();
        return;
      }
      autoSaveTimerRef.current = setTimeout(run, 600);
    },
    [form, sponsorLogos, scoreBoardSponsor, saveMutation, toast, tournamentId],
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
  }, [form, sponsorLogos, scoreBoardSponsor, tournamentId, scoringActive, persistBranding]);

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
            <section className={cn(hubPanelClass, "space-y-5 max-w-3xl")}>
              <div>
                <h2 className="text-foreground font-display font-bold text-lg">Tournament identity</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Name, venue, and organizer used on scoreboards and broadcasts.
                </p>
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

              <FormField label="Sponsor Logos">
                <SponsorLogosEditor
                  logos={sponsorLogos}
                  onChange={setSponsorLogos}
                  onUploadFile={handleSponsorUpload}
                  uploadingIdx={sponsorUploadIdx}
                />
                <p className="text-muted-foreground text-xs mt-2">
                  Used on cricket Sports displays — changes here do not affect Auction panel sponsors.
                </p>
              </FormField>

              {/* Compact optional scoreboard sponsor — expands only when chosen */}
              <div
                className={cn(
                  "rounded-lg border border-border/50 bg-muted/10",
                  scoreBoardExpanded ? "p-4 space-y-4" : "px-3 py-2.5",
                )}
              >
                <div className="flex items-center justify-between gap-3 min-h-9">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Scoreboard sponsor</p>
                    {!scoreBoardExpanded ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {hasScoreBoardSponsor(scoreBoardSponsor)
                          ? ([scoreBoardSponsor.title, scoreBoardSponsor.name].filter(Boolean).join(" · ")
                            || "Configured")
                          : "Optional — add for live scoreboard / OBS"}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Shown on live scoreboard / OBS chrome, separate from rotating logos.
                      </p>
                    )}
                  </div>
                  {!scoreBoardExpanded ? (
                    <BtnSecondary
                      type="button"
                      className="shrink-0 h-8"
                      onClick={() => setScoreBoardExpanded(true)}
                    >
                      {hasScoreBoardSponsor(scoreBoardSponsor) ? "Edit" : "Add"}
                    </BtnSecondary>
                  ) : null}
                </div>

                {scoreBoardExpanded ? (
                  <div className="space-y-4">
                    <FormField label="Title (e.g. Official Scoreboard Partner)">
                      <input
                        value={scoreBoardSponsor.title ?? ""}
                        onChange={(e) =>
                          setScoreBoardSponsor((s) => ({ ...s, title: e.target.value || null }))
                        }
                        placeholder="Official Scoreboard Partner"
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="Sponsor Name">
                      <input
                        value={scoreBoardSponsor.name ?? ""}
                        onChange={(e) =>
                          setScoreBoardSponsor((s) => ({ ...s, name: e.target.value || null }))
                        }
                        placeholder="Acme Sports Ltd."
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="Sponsor Logo">
                      <div className="flex items-center gap-4">
                        {scoreBoardSponsor.logoUrl ? (
                          <img
                            src={scoreBoardSponsor.logoUrl}
                            alt={scoreBoardSponsor.name?.trim() || "Scoreboard sponsor logo"}
                            className="w-16 h-16 rounded-xl object-contain bg-white p-2 border border-[#ffd700]/30"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-white/5 border border-dashed border-[#ffd700]/25 flex items-center justify-center text-white/30 text-xs">
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
                              Remove
                            </BtnSecondary>
                          ) : null}
                        </div>
                      </div>
                    </FormField>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setScoreBoardExpanded(false)}
                        className="text-muted-foreground hover:text-foreground text-xs underline"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScoreBoardSponsor(EMPTY_SCOREBOARD_SPONSOR);
                          setScoreBoardExpanded(false);
                        }}
                        className="text-white/40 hover:text-white/60 text-xs underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {saveError ? <p className="text-red-400 text-sm">{saveError}</p> : null}
            </section>

            <VenueMusicSettingsPanel
              tournamentId={tournamentId}
              branding={branding}
              sportLabel="cricket"
              brandingQueryKey={brandingKey}
              patchPresentation={(body) =>
                patchCricketBroadcastPresentation<BadmintonBranding>(tournamentId, body)
              }
            />

            <VenueBannerSettingsPanel
              tournamentId={tournamentId}
              branding={branding}
              sportLabel="cricket"
              brandingQueryKey={brandingKey}
              patchPresentation={(body) =>
                patchCricketBroadcastPresentation<BadmintonBranding>(tournamentId, body)
              }
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
