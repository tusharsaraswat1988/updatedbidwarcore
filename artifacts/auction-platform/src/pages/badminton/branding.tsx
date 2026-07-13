/**
 * Badminton Branding
 * Route: /tournament/:id/badminton/branding
 *
 * Scoreboard look: logos, sponsors, colors. Player import lives on the Players page.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { FormField, inputClass, HubPageShell, BtnPrimary, BtnSecondary, hubCardClass, hubPanelClass } from "@/components/badminton/page-chrome";
import { BadmintonSetupWizardChrome } from "@/components/badminton/setup-wizard-chrome";
import { SetupTerm } from "@/components/badminton/setup-guide-panel";
import { ScoreBoardSponsorPanel, hasScoreBoardSponsor } from "@/components/badminton/score-board-sponsor-panel";
import { badmintonFetch } from "@/lib/badminton-api";
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { getSponsorsByPriority, parseSponsorLogos, validateSponsorList, type SponsorLogo } from "@/lib/sponsor-logo";
import { SponsorLogosEditor } from "@/components/settings/sponsor-logos-editor";
import { cn } from "@/lib/utils";
import type { BadmintonBranding, ScoreBoardSponsor } from "@/hooks/use-badminton-branding";

const EMPTY_SCOREBOARD_SPONSOR: ScoreBoardSponsor = {
  logoUrl: null,
  name: null,
  title: null,
};

function scoreBoardSponsorPayload(sponsor: ScoreBoardSponsor): ScoreBoardSponsor | null {
  const logoUrl = sponsor.logoUrl?.trim() || null;
  const logoPublicId = sponsor.logoPublicId?.trim() || null;
  const name = sponsor.name?.trim() || null;
  const title = sponsor.title?.trim() || null;
  if (!logoUrl && !name && !title) return null;
  return { logoUrl, logoPublicId, name, title };
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

export default function BadmintonBrandingPage() {
  const [, params] = useRoute("/tournament/:id/badminton/branding");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();

  const { data: branding, isLoading } = useQuery<BadmintonBranding>({
    queryKey: ["badminton-branding", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/branding`),
    enabled: !!tournamentId,
  });

  const [form, setForm] = useState({
    displayName: "",
    logoUrl: "",
    logoPublicId: "",
    venue: "",
    organizerName: "",
    primaryColor: "#F59E0B",
    accentColor: "#3B82F6",
  });
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  const [scoreBoardSponsor, setScoreBoardSponsor] = useState<ScoreBoardSponsor>(EMPTY_SCOREBOARD_SPONSOR);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [scoreBoardLogoEditorOpen, setScoreBoardLogoEditorOpen] = useState(false);
  const [sponsorUploadIdx, setSponsorUploadIdx] = useState<number | "new" | null>(null);
  const [saveError, setSaveError] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const hydratedTournamentRef = useRef(0);
  const autoSaveReadyRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const importAuctionMutation = useMutation({
    mutationFn: () =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/import-auction-branding`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      applyBrandingState(data, {
        setForm,
        setSponsorLogos,
        setScoreBoardSponsor,
        lastSavedPayloadRef,
      });
      hydratedTournamentRef.current = tournamentId;
      qc.setQueryData(["badminton-branding", tournamentId], data);
      setImportMessage("Auction branding imported. Edit badminton sponsors below without changing auction settings.");
      setSaveError("");
    },
    onError: (e: Error) => setImportMessage(e.message),
  });

  useEffect(() => {
    hydratedTournamentRef.current = 0;
    autoSaveReadyRef.current = false;
  }, [tournamentId]);

  useEffect(() => {
    if (!branding || !tournamentId) return;
    if (hydratedTournamentRef.current === tournamentId) return;

    const next = brandingFromApi(branding);
    setForm(next.form);
    setSponsorLogos(next.sponsorLogos);
    setScoreBoardSponsor(next.scoreBoardSponsor);
    lastSavedPayloadRef.current = brandingPayloadSignature(
      next.form,
      next.sponsorLogos,
      next.scoreBoardSponsor,
    );
    hydratedTournamentRef.current = tournamentId;
    autoSaveReadyRef.current = false;
    const timer = window.setTimeout(() => {
      autoSaveReadyRef.current = true;
    }, 150);
    return () => window.clearTimeout(timer);
  }, [branding, tournamentId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildBrandingPatchPayload>) => {
      return badmintonFetch<BadmintonBranding>(tournamentId, `/branding`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
      const synced = brandingFromApi(data);
      lastSavedPayloadRef.current = brandingPayloadSignature(
        synced.form,
        synced.sponsorLogos,
        synced.scoreBoardSponsor,
      );
      setSaveError("");
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const persistBranding = useCallback(
    (immediate = false) => {
      if (!tournamentId) return;
      const filtered = sponsorLogos.filter((l) => l.url.trim());
      const sponsorValidation = validateSponsorList(filtered);
      if (!sponsorValidation.ok) {
        setSaveError(sponsorValidation.error);
        return;
      }
      const payload = buildBrandingPatchPayload(form, sponsorLogos, scoreBoardSponsor);
      const signature = brandingPayloadSignature(form, sponsorLogos, scoreBoardSponsor);
      if (signature === lastSavedPayloadRef.current) return;

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      const run = () => saveMutation.mutate(payload);
      if (immediate) {
        run();
        return;
      }
      autoSaveTimerRef.current = setTimeout(run, 600);
    },
    [form, sponsorLogos, scoreBoardSponsor, saveMutation, tournamentId],
  );

  useEffect(() => {
    if (!autoSaveReadyRef.current || !tournamentId) return;
    persistBranding();
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [form, sponsorLogos, scoreBoardSponsor, tournamentId, persistBranding]);

  async function handleSponsorUpload(file: File | File[], idx: number | "new") {
    const files = Array.isArray(file) ? file : [file];
    if (idx !== "new" && files.length !== 1) return;

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        toastError("Each image must be under 5 MB", "Upload blocked");
        return;
      }
      if (!f.type.startsWith("image/")) {
        toastError("Please choose JPG, PNG, or WEBP images", "Upload blocked");
        return;
      }
    }

    setSponsorUploadIdx(idx);
    try {
      const uploadOne = async (f: File) => {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (!r.ok) throw new Error("Upload failed");
        const data = (await r.json()) as { url?: string };
        if (!data.url) throw new Error("Upload failed");
        return { url: data.url, name: "", type: "" };
      };

      if (idx === "new") {
        const results = await Promise.allSettled(files.map(uploadOne));
        const uploaded = results
          .filter((r): r is PromiseFulfilledResult<{ url: string; name: string; type: string }> => r.status === "fulfilled")
          .map(r => r.value);
        if (uploaded.length > 0) {
          setSponsorLogos(prev => [...prev, ...uploaded]);
          toastSuccess(
            uploaded.length === 1 ? "Sponsor logo uploaded" : `${uploaded.length} logos uploaded`,
          );
        }
        if (uploaded.length < files.length) {
          toastError(
            uploaded.length === 0
              ? "Sponsor logo upload failed"
              : `${uploaded.length} of ${files.length} logos uploaded. Some files failed.`,
            "Upload incomplete",
          );
        }
      } else {
        const uploaded = await uploadOne(files[0]);
        setSponsorLogos(prev => prev.map((l, i) => (i === idx ? { ...l, url: uploaded.url } : l)));
        toastSuccess("Sponsor logo updated");
      }
    } catch (e) {
      toastError(e, "Sponsor logo upload failed");
    } finally {
      setSponsorUploadIdx(null);
    }
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <BadmintonSetupWizardChrome
        tournamentId={tournamentId}
        stepId="branding"
        headerActions={
          <div className="flex flex-col items-end gap-1">
            <BtnPrimary
              onClick={() => persistBranding(true)}
              disabled={saveMutation.isPending || isLoading}
            >
              {saveMutation.isPending ? "Saving…" : "Save Details"}
            </BtnPrimary>
            <p className="text-muted-foreground text-xs">
              {saveError
                ? saveError
                : saveMutation.isPending
                  ? "Saving changes…"
                  : "Changes save automatically"}
            </p>
          </div>
        }
      >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {isLoading ? (
          <div className="h-80 rounded-xl bg-muted animate-pulse" />
        ) : (
          <>
            {/* Visual-first live preview */}
            <section className={cn(hubCardClass, "overflow-hidden")}>
              <div className="px-6 py-3 border-b border-border bg-primary/5">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Live Scoreboard Preview</p>
              </div>
              {hasScoreBoardSponsor(scoreBoardSponsorPayload(scoreBoardSponsor)) && (
                <div className="px-6 pt-4 pb-2 border-b border-border flex justify-end bg-background/50">
                  <ScoreBoardSponsorPanel
                    sponsor={scoreBoardSponsorPayload(scoreBoardSponsor)!}
                    variant="bar"
                    className="max-w-[360px]"
                  />
                </div>
              )}
              <div
                className="px-8 py-10 flex items-center justify-between gap-6 min-h-[180px]"
                style={{
                  background: `linear-gradient(135deg, ${form.primaryColor}18 0%, hsl(var(--background)) 50%, ${form.accentColor}10 100%)`,
                  borderBottom: `1px solid ${form.primaryColor}33`,
                }}
              >
                <div className="flex items-center gap-5 min-w-0">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt={form.displayName?.trim() ? `${form.displayName} logo` : "Tournament logo"}
                      className="w-20 h-20 rounded-xl object-contain bg-card border border-border p-1"
                      style={{ boxShadow: `0 0 32px ${form.primaryColor}33` }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground text-xs">
                      Logo
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-display font-bold text-3xl truncate text-foreground">
                      {form.displayName || "Tournament Name"}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1 truncate font-mono">
                      {[form.venue, form.organizerName].filter(Boolean).join(" · ") || "Venue · Organizer"}
                    </p>
                  </div>
                </div>
                {sponsorLogos.length > 0 && (
                  <div className="flex items-center gap-4 flex-none">
                    {sponsorLogos.slice(0, 2).map((l, i) => (
                      <div key={i} className="text-right">
                        {l.type?.trim() ? (
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {l.type}
                          </p>
                        ) : null}
                        <img src={l.url} alt="" className="h-8 max-w-[72px] object-contain opacity-90 ml-auto" />
                        {l.name?.trim() ? (
                          <p className="text-[10px] font-semibold text-foreground truncate max-w-[96px]">
                            {l.name}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-card/50 grid grid-cols-3 gap-4 border-t border-border">
                <div className="text-center">
                  <p className="text-primary font-display font-bold text-4xl tabular-nums">21</p>
                  <p className="text-muted-foreground text-xs mt-1 uppercase tracking-wider">Player A</p>
                </div>
                <div className="text-center flex flex-col justify-center">
                  <p className="text-muted-foreground text-xs font-mono">Game 1</p>
                  <p className="text-foreground font-display font-bold text-lg">0 – 0</p>
                </div>
                <div className="text-center">
                  <p className="text-red-400 font-display font-bold text-4xl tabular-nums">18</p>
                  <p className="text-muted-foreground text-xs mt-1 uppercase tracking-wider">Player B</p>
                </div>
              </div>
              <p className="px-6 py-3 text-muted-foreground text-xs border-t border-border bg-background/30">
                Preview updates as you edit — sponsor appears top-right on display and OBS overlays
              </p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Branding form */}
            <section className={cn(hubPanelClass, "space-y-5")}>
              <div>
                <h2 className="text-foreground font-display font-bold text-lg">Tournament identity</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Name, venue, and organizer used on scoreboards and broadcasts.
                </p>
              </div>

              <FormField label="Tournament Name">
                <input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Summer Open 2026"
                  className={inputClass}
                />
              </FormField>
              <SetupTerm
                term="Tournament Name"
                meaning="shown on scoreboards, displays, and broadcasts."
              />

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
                    <img src={form.logoUrl} alt={form.displayName?.trim() ? `${form.displayName} logo` : "Tournament logo"} className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-white/10" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs">
                      No logo
                    </div>
                  )}
                  <div className="flex gap-2">
                    <BtnPrimary type="button" onClick={() => setLogoEditorOpen(true)}>
                      {form.logoUrl ? "Change Logo" : "Upload Logo"}
                    </BtnPrimary>
                    {form.logoUrl && (
                      <BtnSecondary type="button" onClick={() => setForm((f) => ({ ...f, logoUrl: "", logoPublicId: "" }))}>
                        Remove
                      </BtnSecondary>
                    )}
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
                  Used on badminton LED and OBS only — changes here do not affect auction panel sponsors.
                </p>
              </FormField>

              {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
            </section>

            {/* Scoreboard sponsor — optional, separate from rotating sponsors */}
            <section className={cn(hubPanelClass, "space-y-5 border-primary/20")}>
              <div>
                <h2 className="text-foreground font-display font-bold text-lg">Scoreboard Sponsor</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Optional — shown at the top-right on the live scoreboard and OBS overlays, separate from bottom sponsor logos.
                </p>
              </div>

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
                      alt=""
                      className="w-20 h-20 rounded-xl object-contain bg-white p-2 border border-[#ffd700]/30"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-white/5 border border-dashed border-[#ffd700]/25 flex items-center justify-center text-white/30 text-xs">
                      No logo
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <BtnPrimary type="button" onClick={() => setScoreBoardLogoEditorOpen(true)}>
                      {scoreBoardSponsor.logoUrl ? "Change Logo" : "Upload Logo"}
                    </BtnPrimary>
                    {scoreBoardSponsor.logoUrl && (
                      <BtnSecondary type="button" onClick={() => setScoreBoardSponsor((s) => ({ ...s, logoUrl: null, logoPublicId: null }))}>
                        Remove
                      </BtnSecondary>
                    )}
                  </div>
                </div>
              </FormField>

              <button
                type="button"
                onClick={() => setScoreBoardSponsor(EMPTY_SCOREBOARD_SPONSOR)}
                className="text-white/40 hover:text-white/60 text-xs underline"
              >
                Clear scoreboard sponsor
              </button>
            </section>

            {/* Import auction branding into badminton display */}
            <section className={cn(hubPanelClass, "space-y-5 lg:col-span-2")}>
              <div>
                <h2 className="text-foreground font-display font-bold text-lg">Import tournament branding</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Pull this tournament&apos;s logo, venue, organizer, and sponsor logos into LED/OBS branding.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <BtnPrimary
                  type="button"
                  onClick={() => {
                    setImportMessage("");
                    importAuctionMutation.mutate();
                  }}
                  disabled={importAuctionMutation.isPending || isLoading}
                >
                  {importAuctionMutation.isPending ? "Importing…" : "Import branding"}
                </BtnPrimary>
              </div>

              <p className="text-muted-foreground text-xs leading-relaxed">
                Uses this tournament only — not another event. Sponsor logos copy into badminton storage; existing panel sponsors stay unchanged.
              </p>

              {importMessage && (
                <p className={cn(
                  "text-sm",
                  importMessage.toLowerCase().includes("fail") ||
                    importMessage.toLowerCase().includes("error") ||
                    importMessage.toLowerCase().includes("invalid")
                    ? "text-amber-400"
                    : "text-green-400",
                )}>
                  {importMessage}
                </p>
              )}
            </section>
            </div>
          </>
        )}
      </div>

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
      <ImageEditorDialog
        open={scoreBoardLogoEditorOpen}
        onClose={() => setScoreBoardLogoEditorOpen(false)}
        initialUrl={scoreBoardSponsor.logoUrl ?? undefined}
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
      </BadmintonSetupWizardChrome>
    </HubPageShell>
  );
}
