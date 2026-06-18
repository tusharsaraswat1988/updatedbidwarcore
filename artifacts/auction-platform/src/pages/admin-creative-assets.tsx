/**
 * Admin — Creative Assets Manager
 *
 * Upload and manage the global Buzz Studio poster backgrounds.
 * One background per aspect ratio: 1:1, 4:5, 9:16, 16:9.
 * These backgrounds are used by all templates across all tournaments.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-auth";
import { AdminShell } from "@/components/admin-shell";
import {
  Upload,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Image,
  Layers,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

/** Flat map returned by GET /api/auth/admin/settings/buzz-studio-assets */
type BackgroundAssets = Record<AspectRatio, string | null>;

const RATIO_META: Record<AspectRatio, { label: string; dims: string; desc: string; cssAspect: string }> = {
  "1:1":  { label: "Square",    dims: "1080 × 1080",  desc: "Instagram feed, WhatsApp",          cssAspect: "1 / 1"    },
  "4:5":  { label: "Portrait",  dims: "1080 × 1350",  desc: "Instagram portrait post",            cssAspect: "4 / 5"    },
  "9:16": { label: "Story",     dims: "1080 × 1920",  desc: "Instagram / WhatsApp stories, Reels", cssAspect: "9 / 16"  },
  "16:9": { label: "Landscape", dims: "1920 × 1080",  desc: "YouTube thumbnails, Twitter cards",  cssAspect: "16 / 9"   },
};

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

// ─── BackgroundUploadCard ─────────────────────────────────────────────────────

function BackgroundUploadCard({
  ratio,
  url,
  onChange,
}: {
  ratio: AspectRatio;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const meta = RATIO_META[ratio];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const data = await r.json() as { url?: string; error?: string };
      if (data.url) {
        onChange(data.url);
      } else {
        setError(data.error ?? "Upload failed");
      }
    } catch {
      setError("Upload failed — check your connection");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/50 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm text-white">{meta.label}</span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5">{ratio}</Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.dims} · {meta.desc}</p>
        </div>
        {url && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(null)}
            title="Remove background"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Preview / drop zone */}
      <div
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/40 bg-black/40"
        style={{ aspectRatio: meta.cssAspect, maxHeight: "260px" }}
        onClick={() => fileRef.current?.click()}
      >
        {url ? (
          <img
            src={url}
            alt={`${ratio} background`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <Image className="h-8 w-8" />
            <p className="text-xs">No background uploaded</p>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <RefreshCw className="h-6 w-6 animate-spin text-white/80" />
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Upload className="h-6 w-6 text-white/90" />
              <span className="text-[11px] font-medium text-white/80">
                {url ? "Replace" : "Upload"} PNG or WEBP
              </span>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {error && (
        <p className="flex items-center gap-1 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}

      {url && (
        <p className="flex items-center gap-1 text-[10px] text-emerald-400/80">
          <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
          Background active
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminCreativeAssets() {
  const { isLoggedIn } = useAdminAuth();

  const [backgrounds, setBackgrounds] = useState<Record<AspectRatio, string | null>>({
    "1:1": null,
    "4:5": null,
    "9:16": null,
    "16:9": null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/auth/admin/settings/buzz-studio-assets", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BackgroundAssets | null) => {
        if (data) {
          setBackgrounds({
            "1:1":  data["1:1"]  ?? null,
            "4:5":  data["4:5"]  ?? null,
            "9:16": data["9:16"] ?? null,
            "16:9": data["16:9"] ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = useCallback((ratio: AspectRatio, url: string | null) => {
    setBackgrounds((prev) => ({ ...prev, [ratio]: url }));
    setDirty(true);
    setSaved(false);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch("/api/auth/admin/settings/buzz-studio-assets", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backgrounds),
      });
      if (!r.ok) {
        let message = `Save failed (${r.status})`;
        try {
          const d = await r.json() as { error?: string };
          if (d.error) message = d.error;
        } catch { /* non-JSON body */ }
        setSaveError(message);
      } else {
        setSaved(true);
        setDirty(false);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError("Save failed — check your connection");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoggedIn) return null;

  const uploadedCount = Object.values(backgrounds).filter(Boolean).length;

  return (
    <AdminShell
      title="Creative Assets Manager"
      eyebrow="Buzz Studio"
      actions={
        <div className="flex items-center gap-2">
          {saveError && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {saveError}
            </p>
          )}
          {saved && (
            <Badge className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="h-9 gap-2"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Info card */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <Layers className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-200">
              Global BidWar Poster Backgrounds
            </p>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              These backgrounds appear behind all Buzz Studio templates across every tournament.
              Upload one background per aspect ratio. Each background should be a full-bleed image
              (PNG or WebP) matching its target resolution — the renderer fills 100% of the canvas
              with <code className="rounded bg-black/30 px-1 font-mono text-[10px]">object-fit: cover</code>.
            </p>
            <p className="text-xs text-amber-200/50">
              {uploadedCount} of 4 backgrounds configured
            </p>
          </div>
        </div>

        {/* Spec table */}
        <div className="rounded-xl border border-border/50 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Recommended Specs
            </p>
          </div>
          <div className="divide-y divide-border/20">
            {ASPECT_RATIOS.map((ratio) => (
              <div key={ratio} className="flex items-center gap-4 px-4 py-2.5">
                <Badge variant="outline" className="w-12 justify-center font-mono text-[10px]">{ratio}</Badge>
                <span className="text-sm font-medium text-foreground w-24">{RATIO_META[ratio].label}</span>
                <span className="text-xs text-muted-foreground font-mono">{RATIO_META[ratio].dims}</span>
                <span className="text-xs text-muted-foreground/60 ml-auto">{RATIO_META[ratio].desc}</span>
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${backgrounds[ratio] ? "bg-emerald-500" : "bg-muted/40"}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Upload grid */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/30 py-16 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading current assets…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {ASPECT_RATIOS.map((ratio) => (
              <BackgroundUploadCard
                key={ratio}
                ratio={ratio}
                url={backgrounds[ratio]}
                onChange={(url) => handleChange(ratio, url)}
              />
            ))}
          </div>
        )}

        {/* Format hint */}
        <div className="rounded-xl border border-border/40 bg-muted/5 px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            File Requirements
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• Accepted formats: <span className="font-mono text-foreground/70">PNG</span>, <span className="font-mono text-foreground/70">WEBP</span></li>
            <li>• Backgrounds should be high-resolution and visually impactful — they fill the entire poster canvas.</li>
            <li>• Avoid placing important content near the edges — template text and branding layers render on top.</li>
            <li>• Dark backgrounds work best since template text is predominantly white and gold.</li>
          </ul>
        </div>

      </div>
    </AdminShell>
  );
}
