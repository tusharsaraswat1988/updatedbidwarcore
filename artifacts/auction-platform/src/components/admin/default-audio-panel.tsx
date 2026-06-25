import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuctionAudioManager } from "@/lib/audio-manager";
import type { PlatformAudioDefaults } from "@workspace/api-base/platform-audio";
import {
  Coffee, Gavel, Loader2, Play, RefreshCw, Save, Timer, Upload, Volume2, X,
} from "lucide-react";

const EMPTY_DEFAULTS: PlatformAudioDefaults = {
  countdownSoundUrl: null,
  soldSoundUrl: null,
  breakEndMusicUrl: null,
};

type AudioField = keyof PlatformAudioDefaults;

const FIELD_META: Record<AudioField, { label: string; hint: string; icon: typeof Timer }> = {
  countdownSoundUrl: {
    label: "Countdown Sound",
    hint: "Last 5 seconds of bidding",
    icon: Timer,
  },
  soldSoundUrl: {
    label: "Sold Sound",
    hint: "When a player is sold",
    icon: Gavel,
  },
  breakEndMusicUrl: {
    label: "Break End Sound",
    hint: "When a break timer expires",
    icon: Coffee,
  },
};

function fileLabel(url: string | null): string {
  if (!url) return "No file — built-in sound will play";
  if (url.startsWith("data:")) return "Custom audio loaded";
  try {
    const name = new URL(url).pathname.split("/").pop();
    return name ? decodeURIComponent(name) : "Platform default loaded";
  } catch {
    return "Platform default loaded";
  }
}

async function uploadAudioFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload/audio", { method: "POST", credentials: "include", body: fd });
  const data = await r.json() as { url?: string; error?: string };
  if (!data.url) throw new Error(data.error ?? "Upload failed");
  return data.url;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function DefaultAudioSettingsPanel() {
  const [form, setForm] = useState<PlatformAudioDefaults>(EMPTY_DEFAULTS);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<AudioField | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const audioPreviewRef = useRef<AuctionAudioManager | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/admin/settings/default-audio", { credentials: "include" });
      const data = await r.json() as PlatformAudioDefaults & { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to load defaults");
      setForm({
        countdownSoundUrl: data.countdownSoundUrl ?? null,
        soldSoundUrl: data.soldSoundUrl ?? null,
        breakEndMusicUrl: data.breakEndMusicUrl ?? null,
      });
      setBaseline(JSON.stringify(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isDirty = JSON.stringify(form) !== baseline;

  async function handleUpload(field: AudioField, file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setError("Audio file must be under 8 MB");
      return;
    }
    setUploadingField(field);
    setError("");
    try {
      let url: string;
      try {
        url = await uploadAudioFile(file);
      } catch {
        url = await readFileAsDataUrl(file);
      }
      setForm((prev) => ({ ...prev, [field]: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingField(null);
    }
  }

  async function preview(field: AudioField) {
    if (!audioPreviewRef.current) audioPreviewRef.current = new AuctionAudioManager();
    const mgr = audioPreviewRef.current;
    await mgr.unlock();
    const url = form[field];
    mgr.setSettings({
      audioEnabled: true,
      masterVolume: 80,
      countdownSoundEnabled: field === "countdownSoundUrl",
      countdownSoundUrl: field === "countdownSoundUrl" ? url : null,
      countdownSoundVolume: 70,
      soldSoundEnabled: field === "soldSoundUrl",
      soldSoundUrl: field === "soldSoundUrl" ? url : null,
      soldSoundVolume: 80,
      breakEndMusicEnabled: field === "breakEndMusicUrl",
      breakEndMusicUrl: field === "breakEndMusicUrl" ? url : null,
      breakEndMusicVolume: 80,
    });
    if (field === "countdownSoundUrl") mgr.previewCountdown();
    else if (field === "soldSoundUrl") mgr.previewSold();
    else mgr.previewBreakEnd();
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch("/api/auth/admin/settings/default-audio", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json() as PlatformAudioDefaults & { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Save failed");
      setForm(data);
      setBaseline(JSON.stringify(data));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading platform audio defaults…
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Default Broadcast Audio</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Set platform-wide defaults for countdown, sold, and break-end sounds. Every tournament uses these
            until an organiser uploads their own custom file.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()} disabled={saving}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => void save()} disabled={!isDirty || saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save defaults
          </Button>
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-green-500">Platform defaults saved. All tournaments without custom audio will use these files.</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(FIELD_META) as AudioField[]).map((field) => {
          const meta = FIELD_META[field];
          const Icon = meta.icon;
          const url = form[field];
          return (
            <div key={field} className="rounded-lg border border-border/60 bg-muted/5 p-3 space-y-3">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  {meta.label}
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">{meta.hint}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Default audio file</Label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 h-7 px-2.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                      {uploadingField === field
                        ? <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                        : <Upload className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{fileLabel(url)}</span>
                    </div>
                    <input
                      type="file"
                      accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,.mp3,.ogg,.wav,.aac"
                      className="hidden"
                      disabled={uploadingField === field}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(field, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setForm((prev) => ({ ...prev, [field]: null }))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  ) : null}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {url ? "Used as default in all tournaments" : "No file — tournaments fall back to built-in sound"}
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs w-full"
                onClick={() => void preview(field)}
              >
                <Play className="w-3 h-3" /> Preview
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
