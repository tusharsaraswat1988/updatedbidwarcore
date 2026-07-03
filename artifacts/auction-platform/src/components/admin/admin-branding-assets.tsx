import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Upload, X, RefreshCw, Image, AlertTriangle, FileImage,
  ChevronDown, ChevronUp, Info, CheckCircle2, Clock, ShieldCheck, Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BRANDING_ASSET_CATEGORIES,
  BRANDING_ASSET_META,
  type BrandingAssetRecord,
  type BrandingAssetType,
  type BrandingAssetValidationWarning,
} from "@workspace/api-base/branding-assets";
import {
  ASSET_ENGINE_CONNECTED,
  ASSET_USAGE_LOCATIONS,
  computeHealthSummary,
  formatAssetDate,
  formatFaviconPipelineStatus,
  formatFileSize,
  formatWarningMessage,
  faviconGeneratedSizeLabels,
  getAssetWarnings,
  getFaviconPipeline,
  inferAssetStatus,
  loadSectionExpandedState,
  mimeToFormat,
  saveSectionExpandedState,
  sourceFileLabel,
  type AssetStatus,
} from "./branding-assets-ui";
import { isFaviconPipelineComplete } from "@workspace/api-base/branding-assets";

function readImageMeta(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

function StatusBadge({ status }: { status: AssetStatus }) {
  if (status === "configured") {
    return (
      <Badge className="text-[10px] h-5 bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/15">
        Configured
      </Badge>
    );
  }
  if (status === "legacy") {
    return (
      <Badge className="text-[10px] h-5 bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15">
        Legacy Asset
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] h-5 text-muted-foreground">
      Not Uploaded
    </Badge>
  );
}

function WarningBanner({
  warnings,
  asset,
  assetType,
}: {
  warnings: BrandingAssetValidationWarning[];
  asset: BrandingAssetRecord;
  assetType: BrandingAssetType;
}) {
  if (!warnings.length) return null;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 space-y-1">
      {warnings.map(w => (
        <p key={w.code} className="text-[11px] text-amber-300 flex items-start gap-1.5 leading-snug">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>{formatWarningMessage(w, asset, assetType)}</span>
        </p>
      ))}
    </div>
  );
}

function FaviconPipelineNote({ asset }: { asset: BrandingAssetRecord | null }) {
  const pipeline = getFaviconPipeline(asset);
  const statusLabel = formatFaviconPipelineStatus(pipeline);
  const complete = isFaviconPipelineComplete(pipeline, asset?.version);
  const failed = pipeline?.status === "failed";
  const processing = pipeline?.status === "processing" || pipeline?.status === "pending";

  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
        <Clock className="w-3 h-3" /> Favicon Pipeline
      </p>
      <p className="text-[11px] text-muted-foreground">
        {complete
          ? "Browser-ready favicon sizes generated from your upload."
          : failed
            ? "Favicon generation failed. Re-upload the source image or check server logs."
            : "Generating optimized favicon sizes from your upload."}
      </p>
      <dl className="text-[11px] space-y-1">
        <div className="flex gap-2">
          <dt className="text-muted-foreground/70 shrink-0">Source asset:</dt>
          <dd className="font-mono truncate">{sourceFileLabel(asset)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground/70 shrink-0">Generated sizes:</dt>
          <dd>{faviconGeneratedSizeLabels(pipeline, asset?.version)}</dd>
        </div>
        {complete && pipeline?.completedAt && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground/70 shrink-0">Completed:</dt>
            <dd>{formatAssetDate(pipeline.completedAt)}</dd>
          </div>
        )}
        {failed && pipeline?.error && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground/70 shrink-0">Error:</dt>
            <dd className="text-red-400">{pipeline.error}</dd>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <dt className="text-muted-foreground/70 shrink-0">Status:</dt>
          <dd className={`flex items-center gap-1 ${
            complete
              ? "text-green-400"
              : failed
                ? "text-red-400"
                : "text-amber-400"
          }`}>
            {complete
              ? <CheckCircle2 className="w-3 h-3" />
              : processing
                ? <RefreshCw className="w-3 h-3 animate-spin" />
                : failed
                  ? <AlertTriangle className="w-3 h-3" />
                  : <Clock className="w-3 h-3" />}
            {statusLabel}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function PdfIntegrationBadge({ asset }: { asset: BrandingAssetRecord | null }) {
  const status = inferAssetStatus(asset);
  const connected = ASSET_ENGINE_CONNECTED.PDF_WATERMARK === true;

  if (status === "missing") return null;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> PDF Engine Integration
      </p>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Status:</span>
        <Badge variant="outline" className="text-[10px] h-5">Configured</Badge>
      </div>
      <p className={`text-[11px] flex items-start gap-1.5 ${connected ? "text-green-400" : "text-amber-400"}`}>
        {connected ? (
          <><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Active in PDF Engine</>
        ) : (
          <><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Configured but not connected to PDF Engine</>
        )}
      </p>
    </div>
  );
}

function ObsOverlayIntegrationBadge({ asset }: { asset: BrandingAssetRecord | null }) {
  const status = inferAssetStatus(asset);
  if (status === "missing") return null;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
        <Monitor className="w-3 h-3" /> Broadcast Overlay
      </p>
      <p className="text-[11px] text-green-400 flex items-start gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Shown full-size at top center on every tournament /obs overlay.
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Upload one finished PNG (crest + logo). No cropping or resizing beyond max display size.
      </p>
    </div>
  );
}

function AssetCardDetails({
  assetType,
  asset,
  meta,
  warnings,
}: {
  assetType: BrandingAssetType;
  asset: BrandingAssetRecord | null;
  meta: (typeof BRANDING_ASSET_META)[BrandingAssetType];
  warnings: BrandingAssetValidationWarning[];
}) {
  const locations = ASSET_USAGE_LOCATIONS[assetType];

  return (
    <div className="space-y-3 pt-2 border-t border-border/30">
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Usage</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{meta.usage}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Used In</p>
        <ul className="text-[11px] text-muted-foreground space-y-0.5">
          {locations.map(loc => (
            <li key={loc} className="flex items-center gap-1.5">
              <span className="text-primary/60">•</span>{loc}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Recommended</p>
        <p className="text-[11px] text-muted-foreground">{meta.recommendedDimensions}</p>
      </div>

      {asset && warnings.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Validation Notes</p>
          <WarningBanner warnings={warnings} asset={asset} assetType={assetType} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-muted-foreground/70">Updated By</p>
          <p className="text-muted-foreground mt-0.5">Unknown</p>
        </div>
        <div>
          <p className="text-muted-foreground/70">Updated On</p>
          <p className="text-muted-foreground mt-0.5">{formatAssetDate(asset?.updatedAt)}</p>
        </div>
        {asset?.fileName && (
          <div className="col-span-2">
            <p className="text-muted-foreground/70">File Name</p>
            <p className="text-muted-foreground mt-0.5 font-mono truncate">{asset.fileName}</p>
          </div>
        )}
      </div>

      {assetType === "FAVICON" && <FaviconPipelineNote asset={asset} />}
      {assetType === "PDF_WATERMARK" && <PdfIntegrationBadge asset={asset} />}
      {assetType === "OBS_WATERMARK" && <ObsOverlayIntegrationBadge asset={asset} />}
    </div>
  );
}

function AssetCard({
  assetType,
  asset,
  onUpdated,
}: {
  assetType: BrandingAssetType;
  asset: BrandingAssetRecord | null;
  onUpdated: () => void;
}) {
  const meta = BRANDING_ASSET_META[assetType];
  const status = inferAssetStatus(asset);
  const persistedWarnings = useMemo(() => getAssetWarnings(assetType, asset), [assetType, asset]);
  const [uploadWarnings, setUploadWarnings] = useState<BrandingAssetValidationWarning[]>([]);
  const warnings = uploadWarnings.length ? uploadWarnings : persistedWarnings;

  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploadWarnings([]);
    setUploading(true);

    try {
      let width: number | null = null;
      let height: number | null = null;
      if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
        try {
          const dims = await readImageMeta(file);
          width = dims.width;
          height = dims.height;
        } catch { /* non-fatal */ }
      }

      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const uploadData = await uploadRes.json() as { url?: string; publicId?: string; error?: string };
      if (!uploadData.url) {
        setError(uploadData.error ?? "Upload failed");
        return;
      }

      const saveRes = await fetch(`/api/auth/admin/branding/assets/${assetType}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: uploadData.url,
          filePublicId: uploadData.publicId ?? null,
          fileName: file.name,
          mimeType: file.type,
          width,
          height,
          fileSize: file.size,
        }),
      });

      const saveData = await saveRes.json() as {
        warnings?: BrandingAssetValidationWarning[];
        error?: string;
      };

      if (!saveRes.ok) {
        setError(saveData.error ?? "Save failed");
        return;
      }

      if (saveData.warnings?.length) setUploadWarnings(saveData.warnings);
      onUpdated();
    } catch {
      setError("Upload failed — check your connection");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError("");
    setUploadWarnings([]);
    setRemoving(true);
    try {
      const r = await fetch(`/api/auth/admin/branding/assets/${assetType}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? "Remove failed");
        return;
      }
      onUpdated();
    } catch {
      setError("Remove failed — check your connection");
    } finally {
      setRemoving(false);
    }
  }

  const pipeline = assetType === "FAVICON" ? getFaviconPipeline(asset) : null;
  const previewUrl =
    assetType === "FAVICON" && isFaviconPipelineComplete(pipeline, asset?.version)
      ? pipeline!.generated!["32"]?.url ?? asset?.fileUrl
      : asset?.fileUrl;
  const dimLabel =
    assetType === "FAVICON" && isFaviconPipelineComplete(pipeline, asset?.version)
      ? `${pipeline!.generated!["32"]!.width}×${pipeline!.generated!["32"]!.height} (gen.)`
      : asset?.width && asset?.height
        ? `${asset.width}×${asset.height}`
        : "—";

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden flex flex-col">
      {/* Compact preview */}
      <div className="relative h-[72px] flex items-center justify-center bg-muted/5 border-b border-border/30">
        {previewUrl ? (
          <img src={previewUrl} className="max-h-14 max-w-[85%] object-contain" alt={meta.name} />
        ) : (
          <Image className="w-6 h-6 text-muted-foreground/25" />
        )}
      </div>

      <div className="p-3 space-y-2.5 flex-1 flex flex-col">
        {/* Header: name + badges */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight">{meta.name}</h4>
          <div className="flex items-center gap-1 shrink-0">
            <StatusBadge status={status} />
            {asset?.version ? (
              <Badge variant="outline" className="text-[10px] h-5 font-mono">v{asset.version}</Badge>
            ) : null}
          </div>
        </div>

        {/* Compact stats */}
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="rounded-md bg-muted/10 px-2 py-1">
            <p className="text-muted-foreground/60 uppercase tracking-wide font-semibold">Dims</p>
            <p className="font-mono text-muted-foreground mt-0.5 truncate">{dimLabel}</p>
          </div>
          <div className="rounded-md bg-muted/10 px-2 py-1">
            <p className="text-muted-foreground/60 uppercase tracking-wide font-semibold">Format</p>
            <p className="text-muted-foreground mt-0.5 truncate">{mimeToFormat(asset?.mimeType)}</p>
          </div>
          <div className="rounded-md bg-muted/10 px-2 py-1">
            <p className="text-muted-foreground/60 uppercase tracking-wide font-semibold">Size</p>
            <p className="text-muted-foreground mt-0.5 truncate">{formatFileSize(asset?.fileSize)}</p>
          </div>
        </div>

        {/* Visible warnings — directly below dimensions */}
        {asset && warnings.length > 0 && (
          <WarningBanner warnings={warnings} asset={asset} assetType={assetType} />
        )}

        {error && (
          <p className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />{error}
          </p>
        )}

        {/* Actions — always visible */}
        <div className="flex gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 flex-1 gap-1 text-xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || removing}
          >
            {uploading
              ? <><RefreshCw className="w-3 h-3 animate-spin" /> Uploading</>
              : <><Upload className="w-3 h-3" /> {previewUrl ? "Replace" : "Upload"}</>
            }
          </Button>
          {previewUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
              disabled={uploading || removing}
            >
              {removing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={meta.accept} className="hidden" onChange={handleFile} />

        {/* Expandable details */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full justify-center pt-1"
            >
              <Info className="w-3 h-3" />
              {expanded ? "Hide Details" : "View Details"}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AssetCardDetails
              assetType={assetType}
              asset={asset}
              meta={meta}
              warnings={warnings}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function BrandingHealthSummary({
  assets,
}: {
  assets: Partial<Record<BrandingAssetType, BrandingAssetRecord>>;
}) {
  const health = useMemo(() => computeHealthSummary(assets), [assets]);

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm">Branding Health</h3>
            <p className="text-[11px] text-muted-foreground">Platform asset completion overview</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{health.completionPct}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completion</p>
        </div>
      </div>

      <Progress value={health.completionPct} className="h-1.5" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
          <p className="text-lg font-bold tabular-nums text-green-400">{health.configured}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Configured</p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-lg font-bold tabular-nums text-amber-400">{health.legacy}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Legacy</p>
        </div>
        <div className="rounded-lg bg-muted/20 border border-border/40 px-3 py-2">
          <p className="text-lg font-bold tabular-nums text-muted-foreground">{health.missing}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Missing</p>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-lg font-bold tabular-nums text-amber-400">{health.warnings}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Warnings</p>
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  categoryId,
  title,
  description,
  types,
  assets,
  expanded,
  onToggle,
  onUpdated,
}: {
  categoryId: string;
  title: string;
  description: string;
  types: BrandingAssetType[];
  assets: Partial<Record<BrandingAssetType, BrandingAssetRecord>>;
  expanded: boolean;
  onToggle: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const categoryHealth = useMemo(() => {
    let ok = 0;
    for (const t of types) {
      if (inferAssetStatus(assets[t]) !== "missing") ok++;
    }
    return { ok, total: types.length };
  }, [types, assets]);

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="rounded-xl border border-border/50 bg-card/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/10 transition-colors text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</h4>
                <Badge variant="outline" className="text-[10px] h-5">
                  {categoryHealth.ok}/{categoryHealth.total}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{description}</p>
            </div>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            }
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={`grid gap-3 p-3 pt-0 ${
            types.length === 1
              ? "grid-cols-1 max-w-xs"
              : types.length <= 3
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          }`}>
            {types.map(type => (
              <AssetCard
                key={type}
                assetType={type}
                asset={assets[type] ?? null}
                onUpdated={onUpdated}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function AdminBrandingAssets() {
  const [assets, setAssets] = useState<Partial<Record<BrandingAssetType, BrandingAssetRecord>>>({});
  const [loading, setLoading] = useState(true);
  const [sectionsExpanded, setSectionsExpanded] = useState(loadSectionExpandedState);

  const loadAssets = useCallback(() => {
    fetch("/api/auth/admin/branding/assets", { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { assets?: Partial<Record<BrandingAssetType, BrandingAssetRecord>> } | null) => {
        if (data?.assets) setAssets(data.assets);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const handleSectionToggle = useCallback((categoryId: string, open: boolean) => {
    setSectionsExpanded(prev => {
      const next = { ...prev, [categoryId]: open };
      saveSectionExpandedState(next);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading brand assets…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <FileImage className="w-4.5 h-4.5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-sm">Platform Brand Assets</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Centralized BidWar branding. Upload warnings are advisory and never block uploads.
          </p>
        </div>
      </div>

      <BrandingHealthSummary assets={assets} />

      <div className="space-y-3">
        {BRANDING_ASSET_CATEGORIES.map(category => (
          <CategorySection
            key={category.id}
            categoryId={category.id}
            title={category.title}
            description={category.description}
            types={category.types}
            assets={assets}
            expanded={sectionsExpanded[category.id] ?? true}
            onToggle={open => handleSectionToggle(category.id, open)}
            onUpdated={loadAssets}
          />
        ))}
      </div>
    </div>
  );
}
