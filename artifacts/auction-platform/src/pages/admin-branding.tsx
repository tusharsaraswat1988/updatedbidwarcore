import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-auth";
import { FullscreenLayout } from "@/components/layout";
import { useLocation } from "wouter";
import {
  ArrowLeft, Save, RefreshCw, Upload, X, Palette, Type,
  Image, Shield, Play, Eye, Zap, Globe, FileText,
  Monitor, Smartphone, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandingForm {
  brandName: string;
  tagline: string;
  poweredByText: string;
  miniBrandText: string;
  mainLogoUrl: string;
  miniLogoUrl: string;
  appIconUrl: string;
  splashScreenUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  successColor: string;
  dangerColor: string;
  headingFont: string;
  bodyFont: string;
  showPoweredByViewer: boolean;
  showPoweredByOwnerApp: boolean;
  showBrandingPdf: boolean;
  showBrandingPublicLinks: boolean;
  showBrandingAuction: boolean;
  enableWatermark: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkPosition: string;
  logoAnimationUrl: string;
}

const DEFAULTS: BrandingForm = {
  brandName: "BidWar",
  tagline: "Powered by Intelligent Bidding",
  poweredByText: "Powered by BidWar",
  miniBrandText: "BW",
  mainLogoUrl: "",
  miniLogoUrl: "",
  appIconUrl: "",
  splashScreenUrl: "",
  primaryColor: "#F59E0B",
  secondaryColor: "#1E293B",
  accentColor: "#3B82F6",
  backgroundColor: "#080A0F",
  successColor: "#22C55E",
  dangerColor: "#EF4444",
  headingFont: "Space Grotesk",
  bodyFont: "Inter",
  showPoweredByViewer: true,
  showPoweredByOwnerApp: true,
  showBrandingPdf: true,
  showBrandingPublicLinks: true,
  showBrandingAuction: true,
  enableWatermark: false,
  watermarkText: "Powered by BidWar",
  watermarkOpacity: 0.15,
  watermarkPosition: "bottom-right",
  logoAnimationUrl: "",
};

const HEADING_FONTS = ["Space Grotesk", "Inter", "Roboto", "Poppins", "Montserrat", "Raleway", "Oswald", "Bebas Neue"];
const BODY_FONTS = ["Inter", "Space Grotesk", "Roboto", "Open Sans", "Lato", "Source Sans Pro", "Nunito"];

// ─── Helper components ────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div>
        <h3 className="font-display font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    </div>
  );
}

function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-lg border border-border/60 overflow-hidden">
          <input
            type="color"
            value={hex}
            onChange={e => onChange(e.target.value)}
            className="w-12 h-12 -translate-x-1 -translate-y-1 cursor-pointer border-0"
            style={{ padding: 0 }}
          />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/90">{label}</p>
        <p className="text-[10px] font-mono text-muted-foreground">{value.toUpperCase()}</p>
      </div>
      <Input
        value={value}
        onChange={e => {
          const v = e.target.value;
          if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v.startsWith("#") ? v : `#${v}`);
        }}
        className="w-28 h-8 text-xs font-mono"
        maxLength={7}
      />
    </div>
  );
}

function SwitchRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AssetUpload({ label, value, onChange, accept, hint, aspectHint, mediaMode }: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  hint?: string;
  aspectHint?: string;
  mediaMode?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isVideo = value && (value.includes(".mp4") || value.includes(".webm") || value.includes(".gif") || value.includes("video"));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const endpoint = mediaMode || file.type.startsWith("video/") ? "/api/upload/media" : "/api/upload";
      const r = await fetch(endpoint, { method: "POST", credentials: "include", body: fd });
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {aspectHint && <span className="text-[10px] text-muted-foreground/60">{aspectHint}</span>}
      </div>
      <div className="relative group rounded-xl border border-border/50 bg-muted/5 overflow-hidden min-h-[120px] flex items-center justify-center">
        {value ? (
          isVideo ? (
            <video src={value} className="max-h-32 max-w-full object-contain p-2" muted loop playsInline />
          ) : (
            <img src={value} className="max-h-32 max-w-full object-contain p-4" alt={label} />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/40 py-6">
            {mediaMode ? <Play className="w-8 h-8" /> : <Image className="w-8 h-8" />}
            <p className="text-xs">No asset uploaded</p>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading</>
              : <><Upload className="w-3.5 h-3.5" /> {value ? "Replace" : "Upload"}</>
            }
          </Button>
          {value && (
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => onChange("")}>
              <X className="w-3.5 h-3.5" /> Remove
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={accept ?? "image/*"} className="hidden" onChange={handleFile} />
      </div>
      {error && (
        <p className="text-[11px] text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />{error}
        </p>
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Live Preview Frames ──────────────────────────────────────────────────────

function PreviewLoginHeader({ form }: { form: BrandingForm }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <div className="text-[10px] text-muted-foreground/60 px-3 py-1.5 border-b border-border/30 bg-muted/10">
        Login page header
      </div>
      <div
        className="px-6 py-5 flex items-center gap-3"
        style={{ backgroundColor: form.backgroundColor }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: form.primaryColor + "22", color: form.primaryColor, fontFamily: form.headingFont }}
        >
          {form.miniLogoUrl
            ? <img src={form.miniLogoUrl} className="w-6 h-6 object-contain" />
            : form.miniBrandText
          }
        </div>
        <div>
          <p className="font-bold text-sm text-white" style={{ fontFamily: form.headingFont }}>{form.brandName}</p>
          {form.tagline && <p className="text-[10px]" style={{ color: form.primaryColor }}>{form.tagline}</p>}
        </div>
      </div>
    </div>
  );
}

function PreviewAuctionBar({ form }: { form: BrandingForm }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <div className="text-[10px] text-muted-foreground/60 px-3 py-1.5 border-b border-border/30 bg-muted/10">
        Auction room topbar
      </div>
      <div
        className="px-4 py-3 flex items-center gap-2 justify-between"
        style={{ backgroundColor: form.backgroundColor }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: form.primaryColor + "20", color: form.primaryColor, fontFamily: form.headingFont }}
          >
            {form.miniBrandText.slice(0, 2)}
          </div>
          <span className="text-xs font-semibold text-white" style={{ fontFamily: form.headingFont }}>Live Auction</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-bold"
            style={{ backgroundColor: form.successColor + "25", color: form.successColor }}
          >LIVE</span>
        </div>
        {form.showBrandingAuction && (
          <span className="text-[10px] text-white/40" style={{ fontFamily: form.bodyFont }}>{form.poweredByText}</span>
        )}
      </div>
    </div>
  );
}

function PreviewViewerBar({ form }: { form: BrandingForm }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <div className="text-[10px] text-muted-foreground/60 px-3 py-1.5 border-b border-border/30 bg-muted/10">
        Viewer screen
      </div>
      <div
        className="px-4 py-4 flex flex-col items-center gap-1"
        style={{ backgroundColor: form.backgroundColor }}
      >
        {form.mainLogoUrl
          ? <img src={form.mainLogoUrl} className="h-8 object-contain" />
          : <p className="text-lg font-black" style={{ color: form.primaryColor, fontFamily: form.headingFont }}>{form.brandName}</p>
        }
        {form.showPoweredByViewer && (
          <span className="text-[10px] text-white/40" style={{ fontFamily: form.bodyFont }}>{form.poweredByText}</span>
        )}
      </div>
    </div>
  );
}

function PreviewOwnerApp({ form }: { form: BrandingForm }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <div className="text-[10px] text-muted-foreground/60 px-3 py-1.5 border-b border-border/30 bg-muted/10">
        Owner app header
      </div>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: form.backgroundColor }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: form.accentColor + "25", color: form.accentColor, fontFamily: form.headingFont }}
          >
            T
          </div>
          <span className="text-xs font-medium text-white" style={{ fontFamily: form.headingFont }}>Team Name</span>
        </div>
        {form.showPoweredByOwnerApp && (
          <span className="text-[10px] text-white/40" style={{ fontFamily: form.bodyFont }}>{form.poweredByText}</span>
        )}
      </div>
    </div>
  );
}

function PreviewPdf({ form }: { form: BrandingForm }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <div className="text-[10px] text-muted-foreground/60 px-3 py-1.5 border-b border-border/30 bg-muted/10">
        PDF / Report header
      </div>
      <div className="px-4 py-3 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          {form.mainLogoUrl
            ? <img src={form.mainLogoUrl} className="h-6 object-contain" />
            : <span className="text-sm font-black" style={{ color: form.primaryColor, fontFamily: form.headingFont }}>{form.brandName}</span>
          }
        </div>
        {form.showBrandingPdf && (
          <span className="text-[10px] text-gray-400" style={{ fontFamily: form.bodyFont }}>{form.poweredByText}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminBranding() {
  const { isLoggedIn } = useAdminAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState<BrandingForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const set = useCallback(<K extends keyof BrandingForm>(key: K, val: BrandingForm[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth/admin/branding", { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then((data: Partial<BrandingForm> | null) => {
        if (data) {
          setForm({
            ...DEFAULTS,
            ...Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, v === null || v === undefined ? DEFAULTS[k as keyof BrandingForm] : v])
            ),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch("/api/auth/admin/branding", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          mainLogoUrl: form.mainLogoUrl || null,
          miniLogoUrl: form.miniLogoUrl || null,
          appIconUrl: form.appIconUrl || null,
          splashScreenUrl: form.splashScreenUrl || null,
          logoAnimationUrl: form.logoAnimationUrl || null,
          tagline: form.tagline || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setSaveError(d.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError("Save failed — check your connection");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoggedIn) return null;

  return (
    <FullscreenLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl text-white">Branding Center</h1>
              <p className="text-xs text-muted-foreground">Manage global BidWar brand identity and visual assets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />{saveError}
              </p>
            )}
            {saved && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </Badge>
            )}
            <Button onClick={handleSave} disabled={saving || loading} className="gap-2 h-9">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Branding
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="identity" className="h-full flex flex-col">
            <div className="px-6 pt-4 border-b border-border/30 flex-shrink-0">
              <TabsList className="h-9 gap-1">
                <TabsTrigger value="identity" className="h-7 gap-1.5 text-xs">
                  <Shield className="w-3.5 h-3.5" /> Brand Identity
                </TabsTrigger>
                <TabsTrigger value="assets" className="h-7 gap-1.5 text-xs">
                  <Image className="w-3.5 h-3.5" /> Visual Assets
                </TabsTrigger>
                <TabsTrigger value="colors" className="h-7 gap-1.5 text-xs">
                  <Palette className="w-3.5 h-3.5" /> Colors & Fonts
                </TabsTrigger>
                <TabsTrigger value="public" className="h-7 gap-1.5 text-xs">
                  <Globe className="w-3.5 h-3.5" /> Public Branding
                </TabsTrigger>
                <TabsTrigger value="animation" className="h-7 gap-1.5 text-xs">
                  <Play className="w-3.5 h-3.5" /> Logo Animation
                </TabsTrigger>
                <TabsTrigger value="preview" className="h-7 gap-1.5 text-xs">
                  <Eye className="w-3.5 h-3.5" /> Live Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* ── Brand Identity ───────────────────────── */}
              <TabsContent value="identity" className="mt-0 p-6">
                <SectionHeader
                  icon={Shield}
                  title="Brand Identity"
                  description="Core brand text used across all BidWar surfaces — admin panel, viewer screens, PDFs, and public links."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <TextField
                    label="Brand Name"
                    value={form.brandName}
                    onChange={v => set("brandName", v)}
                    placeholder="BidWar"
                  />
                  <TextField
                    label="Mini Brand Text"
                    value={form.miniBrandText}
                    onChange={v => set("miniBrandText", v)}
                    placeholder="BW"
                  />
                  <div className="md:col-span-2">
                    <TextField
                      label="Tagline"
                      value={form.tagline}
                      onChange={v => set("tagline", v)}
                      placeholder="Powered by Intelligent Bidding"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <TextField
                      label="Powered By Text"
                      value={form.poweredByText}
                      onChange={v => set("poweredByText", v)}
                      placeholder="Powered by BidWar"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Shown on viewer screens, owner app, auction room, and PDFs (controlled per-surface in Public Branding tab).
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* ── Visual Assets ────────────────────────── */}
              <TabsContent value="assets" className="mt-0 p-6">
                <SectionHeader
                  icon={Image}
                  title="Visual Assets"
                  description="Upload logos and icons used across the platform. Transparent backgrounds (PNG/SVG/WebP) are preferred."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl">
                  <AssetUpload
                    label="Main Brand Logo"
                    value={form.mainLogoUrl}
                    onChange={v => set("mainLogoUrl", v)}
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    aspectHint="Any ratio"
                    hint="Used on viewer screens, login page, and PDFs. Transparent background preferred."
                  />
                  <AssetUpload
                    label="Mini Logo"
                    value={form.miniLogoUrl}
                    onChange={v => set("miniLogoUrl", v)}
                    accept="image/png,image/svg+xml,image/webp"
                    aspectHint="Square"
                    hint="Used in sidebar, mobile topbar, and compact areas."
                  />
                  <AssetUpload
                    label="App Icon"
                    value={form.appIconUrl}
                    onChange={v => set("appIconUrl", v)}
                    accept="image/png,image/webp"
                    aspectHint="512×512 px"
                    hint="For PWA, browser icon, and future mobile app."
                  />
                  <AssetUpload
                    label="Splash Screen"
                    value={form.splashScreenUrl}
                    onChange={v => set("splashScreenUrl", v)}
                    accept="image/png,image/webp,image/jpeg"
                    aspectHint="16:9 or 9:16"
                    hint="Loading screen for mobile / PWA / Electron app."
                  />
                </div>
                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 max-w-lg">
                  <p className="text-xs text-amber-400 font-semibold">Upload requires Cloudinary</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in environment secrets to enable asset uploads.
                  </p>
                </div>
              </TabsContent>

              {/* ── Colors & Typography ──────────────────── */}
              <TabsContent value="colors" className="mt-0 p-6">
                <SectionHeader
                  icon={Palette}
                  title="Colors & Typography"
                  description="System colors and fonts auto-loaded from current theme. Changes apply only after saving."
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</p>
                    <ColorField label="Primary" value={form.primaryColor} onChange={v => set("primaryColor", v)} />
                    <ColorField label="Secondary" value={form.secondaryColor} onChange={v => set("secondaryColor", v)} />
                    <ColorField label="Accent" value={form.accentColor} onChange={v => set("accentColor", v)} />
                    <ColorField label="Background" value={form.backgroundColor} onChange={v => set("backgroundColor", v)} />
                    <ColorField label="Success" value={form.successColor} onChange={v => set("successColor", v)} />
                    <ColorField label="Danger" value={form.dangerColor} onChange={v => set("dangerColor", v)} />
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typography</p>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Heading Font</Label>
                        <Select value={form.headingFont} onValueChange={v => set("headingFont", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent className="dark">
                            {HEADING_FONTS.map(f => (
                              <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">Used for titles, display text, and auction headings.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Body Font</Label>
                        <Select value={form.bodyFont} onValueChange={v => set("bodyFont", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent className="dark">
                            {BODY_FONTS.map(f => (
                              <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">Used for paragraphs, labels, and body copy.</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-border/50 bg-muted/5 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preview</p>
                      <p
                        className="text-xl font-bold"
                        style={{ color: form.primaryColor, fontFamily: form.headingFont }}
                      >
                        {form.brandName}
                      </p>
                      <p className="text-sm" style={{ fontFamily: form.bodyFont, color: "#94a3b8" }}>
                        {form.tagline || "Your tagline goes here"}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Public Branding ──────────────────────── */}
              <TabsContent value="public" className="mt-0 p-6">
                <SectionHeader
                  icon={Globe}
                  title="Public Branding"
                  description="Control where 'Powered by BidWar' and branding elements appear across all surfaces."
                />
                <div className="space-y-3 max-w-lg">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Visibility</p>
                  <SwitchRow
                    label="Show Powered By on Viewer Screen"
                    description="Displayed at the top of the live viewer screen during auction."
                    checked={form.showPoweredByViewer}
                    onChange={v => set("showPoweredByViewer", v)}
                  />
                  <SwitchRow
                    label="Show Powered By on Team Owner App"
                    description="Shown in the owner's bid interface header."
                    checked={form.showPoweredByOwnerApp}
                    onChange={v => set("showPoweredByOwnerApp", v)}
                  />
                  <SwitchRow
                    label="Show Branding on Auction Screens"
                    description="Shown in the operator panel and LED display."
                    checked={form.showBrandingAuction}
                    onChange={v => set("showBrandingAuction", v)}
                  />
                  <SwitchRow
                    label="Show Branding on PDFs & Reports"
                    description="Footer branding on exported PDF reports."
                    checked={form.showBrandingPdf}
                    onChange={v => set("showBrandingPdf", v)}
                  />
                  <SwitchRow
                    label="Show Branding on Public Share Links"
                    description="Shown on public registration and viewer pages."
                    checked={form.showBrandingPublicLinks}
                    onChange={v => set("showBrandingPublicLinks", v)}
                  />

                  <div className="pt-2 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Watermark</p>
                    <SwitchRow
                      label="Enable Watermark"
                      description="Overlay a subtle watermark on screens and exported content."
                      checked={form.enableWatermark}
                      onChange={v => set("enableWatermark", v)}
                    />
                    {form.enableWatermark && (
                      <div className="space-y-4 pl-4 border-l border-border/40">
                        <TextField
                          label="Watermark Text"
                          value={form.watermarkText}
                          onChange={v => set("watermarkText", v)}
                          placeholder="Powered by BidWar"
                        />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Opacity</Label>
                            <span className="text-xs font-mono text-muted-foreground">{Math.round(form.watermarkOpacity * 100)}%</span>
                          </div>
                          <Slider
                            min={0.05}
                            max={0.5}
                            step={0.01}
                            value={[form.watermarkOpacity]}
                            onValueChange={([v]) => set("watermarkOpacity", v)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Position</Label>
                          <Select value={form.watermarkPosition} onValueChange={v => set("watermarkPosition", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent className="dark">
                              <SelectItem value="top-left">Top Left</SelectItem>
                              <SelectItem value="top-right">Top Right</SelectItem>
                              <SelectItem value="center">Center</SelectItem>
                              <SelectItem value="bottom-left">Bottom Left</SelectItem>
                              <SelectItem value="bottom-right">Bottom Right</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ── Logo Animation ───────────────────────── */}
              <TabsContent value="animation" className="mt-0 p-6">
                <SectionHeader
                  icon={Play}
                  title="Logo Animation"
                  description="Upload an animated logo for splash screens, loading states, and future app intro sequences."
                />
                <div className="max-w-sm space-y-5">
                  <AssetUpload
                    label="Animated Logo"
                    value={form.logoAnimationUrl}
                    onChange={v => set("logoAnimationUrl", v)}
                    accept="video/mp4,video/webm,image/gif"
                    aspectHint="Any ratio"
                    hint="MP4, WEBM, or GIF — max 20 MB. Used for splash screens, loading animations, and future mobile app intro."
                    mediaMode
                  />
                  {form.logoAnimationUrl && (
                    <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-2">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Preview</p>
                      <div className="flex items-center justify-center py-4 bg-muted/5 rounded-lg">
                        <video
                          src={form.logoAnimationUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="max-h-40 object-contain"
                        />
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl border border-border/50 bg-muted/5 p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> Future use
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      This animation is stored for future use in the mobile app splash screen, PWA loading state, and Electron app intro. It is not currently displayed on any live screens.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* ── Live Preview ─────────────────────────── */}
              <TabsContent value="preview" className="mt-0 p-6">
                <SectionHeader
                  icon={Eye}
                  title="Live Preview"
                  description="See how your branding looks across different BidWar surfaces. Updates instantly as you change settings."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5" /> Desktop
                    </p>
                    <PreviewLoginHeader form={form} />
                    <PreviewAuctionBar form={form} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" /> Mobile & Documents
                    </p>
                    <PreviewViewerBar form={form} />
                    <PreviewOwnerApp form={form} />
                    <PreviewPdf form={form} />
                  </div>
                </div>
                {form.enableWatermark && (
                  <div className="mt-4 max-w-3xl rounded-xl border border-border/50 bg-card/30 p-4 relative overflow-hidden">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Watermark Preview</p>
                    <div className="h-20 bg-muted/10 rounded-lg relative flex items-center justify-center">
                      <p className="text-sm text-muted-foreground/40">Screen content area</p>
                      <div
                        className={`absolute text-xs font-mono select-none pointer-events-none ${
                          form.watermarkPosition === "top-left" ? "top-2 left-3" :
                          form.watermarkPosition === "top-right" ? "top-2 right-3" :
                          form.watermarkPosition === "center" ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" :
                          form.watermarkPosition === "bottom-left" ? "bottom-2 left-3" :
                          "bottom-2 right-3"
                        }`}
                        style={{ opacity: form.watermarkOpacity, color: form.primaryColor }}
                      >
                        {form.watermarkText}
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-4 rounded-xl border border-border/50 bg-muted/5 px-4 py-3 max-w-3xl">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Previews update in real time. Save branding to apply changes globally across all BidWar surfaces.
                  </p>
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </FullscreenLayout>
  );
}
