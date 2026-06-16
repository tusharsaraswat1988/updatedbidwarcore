/**
 * Badminton Branding & Import
 * Route: /tournament/:id/badminton/branding
 *
 * Scorer-only tournaments can set logos, sponsors, and colors without running an auction.
 * Import branding and players from another tournament when available.
 */

import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { FormField, inputClass, PageHeader, HubPageShell, BtnPrimary, DarkSelect } from "@/components/badminton/page-chrome";
import { ScoreBoardSponsorPanel, hasScoreBoardSponsor } from "@/components/badminton/score-board-sponsor-panel";
import { badmintonFetch } from "@/lib/badminton-api";
import { parseSponsorLogos, type SponsorLogo } from "@/lib/sponsor-logo";
import { cn } from "@/lib/utils";
import { apiFetch } from "@workspace/api-base";
import type { BadmintonBranding, ScoreBoardSponsor } from "@/hooks/use-badminton-branding";

const EMPTY_SCOREBOARD_SPONSOR: ScoreBoardSponsor = {
  logoUrl: null,
  name: null,
  title: null,
};

function scoreBoardSponsorPayload(sponsor: ScoreBoardSponsor): ScoreBoardSponsor | null {
  const logoUrl = sponsor.logoUrl?.trim() || null;
  const name = sponsor.name?.trim() || null;
  const title = sponsor.title?.trim() || null;
  if (!logoUrl && !name && !title) return null;
  return { logoUrl, name, title };
}

interface ImportSource {
  id: number;
  name: string;
  sport: string;
}

export default function BadmintonBrandingPage() {
  const [, params] = useRoute("/tournament/:id/badminton/branding");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();
  const hubHref = `/tournament/${tournamentId}/badminton`;

  const { data: branding, isLoading } = useQuery<BadmintonBranding>({
    queryKey: ["badminton-branding", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/branding`),
    enabled: !!tournamentId,
  });

  const { data: settings } = useQuery<{ linkedAuctionTournamentId?: number }>({
    queryKey: ["badminton-settings", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/settings`),
    enabled: !!tournamentId,
  });

  const { data: account } = useQuery<{ loggedIn?: boolean; tournaments?: ImportSource[] }>({
    queryKey: ["organizer-account-me"],
    queryFn: async () => {
      const res = await apiFetch("/auth/organizer-account/me");
      if (!res.ok) return { loggedIn: false, tournaments: [] };
      return res.json();
    },
  });

  const importSources = (account?.tournaments ?? []).filter((t) => t.id !== tournamentId);

  const [form, setForm] = useState({
    displayName: "",
    logoUrl: "",
    venue: "",
    organizerName: "",
    primaryColor: "#0070f3",
    accentColor: "#4fc3f7",
  });
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  const [scoreBoardSponsor, setScoreBoardSponsor] = useState<ScoreBoardSponsor>(EMPTY_SCOREBOARD_SPONSOR);
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [scoreBoardLogoEditorOpen, setScoreBoardLogoEditorOpen] = useState(false);
  const [sponsorUploadIdx, setSponsorUploadIdx] = useState<number | "new" | null>(null);
  const [saveError, setSaveError] = useState("");
  const [importSourceId, setImportSourceId] = useState("");
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    if (!branding) return;
    setForm({
      displayName: branding.displayName,
      logoUrl: branding.logoUrl ?? "",
      venue: branding.venue ?? "",
      organizerName: branding.organizerName ?? "",
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
    });
    setSponsorLogos(parseSponsorLogos(branding.sponsorLogos));
    setScoreBoardSponsor(branding.scoreBoardSponsor ?? EMPTY_SCOREBOARD_SPONSOR);
  }, [branding]);

  useEffect(() => {
    if (settings?.linkedAuctionTournamentId && !importSourceId) {
      setImportSourceId(String(settings.linkedAuctionTournamentId));
    }
  }, [settings?.linkedAuctionTournamentId, importSourceId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return badmintonFetch<BadmintonBranding>(tournamentId, `/branding`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          logoUrl: form.logoUrl.trim() || null,
          sponsorLogos: JSON.stringify(sponsorLogos.filter((l) => l.url.trim())),
          venue: form.venue.trim() || null,
          organizerName: form.organizerName.trim() || null,
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          scoreBoardSponsor: scoreBoardSponsorPayload(scoreBoardSponsor),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badminton-branding", tournamentId] });
      setSaveError("");
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  async function handleSponsorUpload(file: File, idx: number | "new") {
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB");
      return;
    }
    setSponsorUploadIdx(idx);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload failed");
      const data = (await r.json()) as { url?: string };
      if (data.url) {
        if (idx === "new") {
          setSponsorLogos((prev) => [...prev, { url: data.url!, name: "", type: "" }]);
        } else {
          setSponsorLogos((prev) => prev.map((l, i) => (i === idx ? { ...l, url: data.url! } : l)));
        }
      }
    } catch {
      alert("Sponsor logo upload failed");
    } finally {
      setSponsorUploadIdx(null);
    }
  }

  async function runImport(type: "branding" | "players") {
    const sourceId = parseInt(importSourceId, 10);
    if (!sourceId) {
      setImportMessage("Select a source tournament first");
      return;
    }
    setImportMessage("");
    try {
      if (type === "branding") {
        await badmintonFetch(tournamentId, `/import-branding`, {
          method: "POST",
          body: JSON.stringify({ sourceTournamentId: sourceId }),
        });
        qc.invalidateQueries({ queryKey: ["badminton-branding", tournamentId] });
        setImportMessage("Branding imported successfully");
      } else {
        const result = await badmintonFetch<{ imported: number; skipped: number; mode: string }>(
          tournamentId,
          `/import-from-tournament`,
          {
            method: "POST",
            body: JSON.stringify({ sourceTournamentId: sourceId }),
          },
        );
        qc.invalidateQueries({ queryKey: ["badminton-players", tournamentId] });
        qc.invalidateQueries({ queryKey: ["badminton-settings", tournamentId] });
        setImportMessage(
          `Imported ${result.imported} player${result.imported !== 1 ? "s" : ""} (${result.mode} roster)${result.skipped ? `, ${result.skipped} skipped` : ""}`,
        );
      }
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <HubPageShell>
      <PageHeader
        title="Branding & Import"
        subtitle="Scoreboard look and data from other tournaments"
        backHref={hubHref}
        actions={
          <BtnPrimary onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending ? "Saving…" : "Save Branding"}
          </BtnPrimary>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
        {isLoading ? (
          <div className="h-64 rounded-2xl bg-white/4 animate-pulse" />
        ) : (
          <>
            {/* Preview */}
            <section className="rounded-2xl border border-white/8 overflow-hidden">
              {hasScoreBoardSponsor(scoreBoardSponsorPayload(scoreBoardSponsor)) && (
                <div className="px-6 pt-4 pb-2 border-b border-white/5 flex justify-end">
                  <ScoreBoardSponsorPanel
                    sponsor={scoreBoardSponsorPayload(scoreBoardSponsor)!}
                    variant="bar"
                    className="max-w-[360px]"
                  />
                </div>
              )}
              <div
                className="px-6 py-4 flex items-center justify-between gap-4"
                style={{
                  background: `linear-gradient(90deg, ${form.primaryColor}22, ${form.accentColor}11)`,
                  borderBottom: `1px solid ${form.accentColor}33`,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain bg-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/30 text-xs">
                      Logo
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-black text-lg truncate">{form.displayName || "Tournament Name"}</p>
                    <p className="text-white/40 text-xs truncate">
                      {[form.venue, form.organizerName].filter(Boolean).join(" · ") || "Venue · Organizer"}
                    </p>
                  </div>
                </div>
                {sponsorLogos.length > 0 && (
                  <div className="flex items-center gap-2 flex-none">
                    {sponsorLogos.slice(0, 3).map((l, i) => (
                      <img key={i} src={l.url} alt="" className="h-8 w-12 object-contain opacity-80" />
                    ))}
                  </div>
                )}
              </div>
              <p className="px-6 py-3 text-white/30 text-xs border-t border-white/5">
                Live preview — scoreboard sponsor appears top-right on display and OBS
              </p>
            </section>

            {/* Branding form */}
            <section className="rounded-2xl bg-[#0d1529] border border-white/8 p-6 space-y-5">
              <h2 className="text-white font-bold text-lg">Tournament Branding</h2>
              <p className="text-white/40 text-sm -mt-2">
                No auction needed — set how your tournament appears on court-side displays.
              </p>

              <FormField label="Display Name">
                <input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Summer Open 2026"
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
                    <img src={form.logoUrl} alt="" className="w-16 h-16 rounded-xl object-contain bg-white/5 border border-white/10" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs">
                      No logo
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLogoEditorOpen(true)}
                      className="h-10 px-4 rounded-xl bg-white/8 hover:bg-white/12 text-white/80 text-sm font-semibold"
                    >
                      {form.logoUrl ? "Change Logo" : "Upload Logo"}
                    </button>
                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                        className="h-10 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm font-semibold"
                      >
                        Remove
                      </button>
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
                <SponsorList
                  logos={sponsorLogos}
                  onChange={setSponsorLogos}
                  onUpload={handleSponsorUpload}
                  uploadingIdx={sponsorUploadIdx}
                />
              </FormField>

              {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
            </section>

            {/* Scoreboard sponsor — optional, separate from rotating sponsors */}
            <section className="rounded-2xl bg-[#0d1529] border border-[#ffd700]/20 p-6 space-y-5">
              <div>
                <h2 className="text-white font-bold text-lg">Scoreboard Sponsor</h2>
                <p className="text-white/40 text-sm mt-1">
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
                    <button
                      type="button"
                      onClick={() => setScoreBoardLogoEditorOpen(true)}
                      className="h-10 px-4 rounded-xl bg-[#ffd700]/15 hover:bg-[#ffd700]/25 border border-[#ffd700]/30 text-[#ffd700] text-sm font-semibold"
                    >
                      {scoreBoardSponsor.logoUrl ? "Change Logo" : "Upload Logo"}
                    </button>
                    {scoreBoardSponsor.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setScoreBoardSponsor((s) => ({ ...s, logoUrl: null }))}
                        className="h-10 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm font-semibold"
                      >
                        Remove
                      </button>
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

            {/* Import */}
            <section className="rounded-2xl bg-[#0d1529] border border-white/8 p-6 space-y-5">
              <h2 className="text-white font-bold text-lg">Import From Another Tournament</h2>
              <p className="text-white/40 text-sm -mt-2">
                Copy players or branding from an auction or badminton tournament you already run.
              </p>

              <FormField label="Source Tournament">
                {importSources.length > 0 ? (
                  <DarkSelect
                    value={importSourceId || "none"}
                    onValueChange={(v) => setImportSourceId(v === "none" ? "" : v)}
                    placeholder="Select tournament…"
                    options={[
                      { value: "none", label: "Select tournament…" },
                      ...importSources.map((t) => ({
                        value: String(t.id),
                        label: `#${t.id} — ${t.name} (${t.sport})`,
                      })),
                    ]}
                  />
                ) : (
                  <input
                    type="number"
                    value={importSourceId}
                    onChange={(e) => setImportSourceId(e.target.value)}
                    placeholder="Enter tournament ID"
                    className={inputClass}
                  />
                )}
              </FormField>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => runImport("branding")}
                  className="h-11 px-5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-sm font-semibold transition-colors"
                >
                  Import Branding
                </button>
                <button
                  type="button"
                  onClick={() => runImport("players")}
                  className="h-11 px-5 rounded-xl bg-[#0070f3]/20 hover:bg-[#0070f3]/30 text-[#4fc3f7] text-sm font-semibold transition-colors"
                >
                  Import Players
                </button>
              </div>

              <p className="text-white/30 text-xs leading-relaxed">
                <strong className="text-white/50">Import Players</strong> copies badminton entries if the source
                is a badminton tournament, or syncs auction roster players otherwise.
                <br />
                <strong className="text-white/50">Import Branding</strong> copies logo, sponsors, venue, organizer,
                and display colors.
              </p>

              {importMessage && (
                <p className={cn(
                  "text-sm",
                  importMessage.includes("failed") || importMessage.includes("Select")
                    ? "text-amber-300"
                    : "text-green-400",
                )}>
                  {importMessage}
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <ImageEditorDialog
        open={logoEditorOpen}
        onClose={() => setLogoEditorOpen(false)}
        initialUrl={form.logoUrl || undefined}
        aspect={1}
        title="Tournament Logo"
        onSave={(url) => {
          setForm((f) => ({ ...f, logoUrl: url }));
          setLogoEditorOpen(false);
        }}
      />
      <ImageEditorDialog
        open={scoreBoardLogoEditorOpen}
        onClose={() => setScoreBoardLogoEditorOpen(false)}
        initialUrl={scoreBoardSponsor.logoUrl ?? undefined}
        aspect={1}
        title="Scoreboard Sponsor Logo"
        onSave={(url) => {
          setScoreBoardSponsor((s) => ({ ...s, logoUrl: url }));
          setScoreBoardLogoEditorOpen(false);
        }}
      />
    </HubPageShell>
  );
}

function SponsorList({
  logos,
  onChange,
  onUpload,
  uploadingIdx,
}: {
  logos: SponsorLogo[];
  onChange: (logos: SponsorLogo[]) => void;
  onUpload: (file: File, idx: number | "new") => void;
  uploadingIdx: number | "new" | null;
}) {
  return (
    <div className="space-y-2">
      {logos.map((logo, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8"
        >
          <label className="cursor-pointer flex-none">
            <div className="w-14 h-10 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
              {uploadingIdx === i ? (
                <span className="text-white/30 text-xs">…</span>
              ) : logo.url ? (
                <img src={logo.url} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-white/30 text-xs">+</span>
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f, i);
                e.target.value = "";
              }}
              disabled={uploadingIdx !== null}
            />
          </label>
          <input
            value={logo.name ?? ""}
            onChange={(e) => {
              const next = [...logos];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
            placeholder="Sponsor name"
            className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(logos.filter((_, j) => j !== i))}
            className="text-red-300/70 hover:text-red-300 text-sm px-2"
          >
            Remove
          </button>
        </div>
      ))}

      <label className="block cursor-pointer">
        <div className={cn(
          "h-10 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-white/40 text-sm hover:bg-white/5 transition-colors",
          uploadingIdx === "new" && "opacity-50",
        )}>
          {uploadingIdx === "new" ? "Uploading…" : "+ Add Sponsor Logo"}
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f, "new");
            e.target.value = "";
          }}
          disabled={uploadingIdx !== null}
        />
      </label>
    </div>
  );
}
