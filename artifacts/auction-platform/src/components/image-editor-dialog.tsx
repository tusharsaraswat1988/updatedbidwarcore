import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import imageCompression from "browser-image-compression";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Upload, Crop as CropIcon, Wand2, Scissors, RotateCw, X, Loader2, Check,
  Image as ImageIcon, AlertTriangle,
} from "lucide-react";

// Module-level flag: true once the AI model has finished downloading in this
// browser session. After the first successful run the model is in the browser
// cache, so we skip the "25 MB download" confirmation on subsequent presses.
let bgModelCached = false;

type Props = {
  open: boolean;
  onClose: () => void;
  initialUrl?: string;
  aspect?: number;
  title?: string;
  onSave: (url: string) => void;
};

// Crop a source image (URL or data URL) to the given pixel area, optionally
// rotating it first. Returns a JPEG/PNG Blob suitable for further processing.
async function getCroppedBlob(
  src: string,
  area: Area,
  rotation: number,
  mime: string = "image/png",
): Promise<Blob> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bBoxWidth = img.width * cos + img.height * sin;
  const bBoxHeight = img.width * sin + img.height * cos;

  // Draw rotated image into an intermediate canvas first.
  const interCanvas = document.createElement("canvas");
  interCanvas.width = bBoxWidth;
  interCanvas.height = bBoxHeight;
  const interCtx = interCanvas.getContext("2d");
  if (!interCtx) throw new Error("Canvas context not available");
  interCtx.translate(bBoxWidth / 2, bBoxHeight / 2);
  interCtx.rotate(rad);
  interCtx.drawImage(img, -img.width / 2, -img.height / 2);

  // Then crop the requested area.
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(area.width));
  out.height = Math.max(1, Math.round(area.height));
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas context not available");
  outCtx.drawImage(
    interCanvas,
    area.x, area.y, area.width, area.height,
    0, 0, out.width, out.height,
  );
  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), mime, 0.95);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

// Apply a small auto-enhance pass: contrast bump + slight saturation boost.
async function autoEnhance(src: string): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");
  ctx.filter = "contrast(1.12) saturate(1.18) brightness(1.04)";
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 0.95);
  });
}


export function ImageEditorDialog({ open, onClose, initialUrl, aspect = 1, title = "Edit Image", onSave }: Props) {
  // Image source loaded into the cropper. Either an object URL from a chosen
  // file, the original initialUrl, or a data URL produced by an effect.
  const [src, setSrc] = useState<string | undefined>(undefined);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When true we show an inline "~25 MB download" confirmation strip before
  // kicking off background removal for the first time.
  const [confirmBgRemove, setConfirmBgRemove] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track object URLs we created so we can revoke them on unmount/replace.
  const objectUrlRef = useRef<string | null>(null);

  // (Re)load when the dialog opens or initialUrl changes. Revoke any object
  // URL we created during a prior session so we don't leak Blobs across opens.
  useEffect(() => {
    if (!open) {
      revokeCurrentObjectUrl();
      return;
    }
    revokeCurrentObjectUrl();
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setSrc(initialUrl || undefined);
  }, [open, initialUrl]);

  // Cleanup object URL on unmount.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  function revokeCurrentObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function setSrcFromBlob(blob: Blob) {
    revokeCurrentObjectUrl();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onPickFile(file);
  }

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, WebP).");
      return;
    }
    setError(null);
    setSrcFromBlob(file);
  }

  async function handleAutoEnhance() {
    if (!src) return;
    setError(null);
    setProcessing("Enhancing...");
    try {
      const blob = await autoEnhance(src);
      setSrcFromBlob(blob);
    } catch (e) {
      setError("Could not enhance this image (it may be cross-origin). Try uploading a fresh file.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleRemoveBackground() {
    if (!src) return;
    // First use in this session — confirm before pulling the AI model.
    if (!bgModelCached) {
      setConfirmBgRemove(true);
      return;
    }
    await runRemoveBackground();
  }

  async function runRemoveBackground() {
    if (!src) return;
    setConfirmBgRemove(false);
    setError(null);
    setProcessing(bgModelCached ? "Removing background..." : "Downloading AI model (~25 MB) and removing background — please wait...");
    try {
      const mod = await import("@imgly/background-removal");
      const blob = await mod.removeBackground(src);
      bgModelCached = true;
      setSrcFromBlob(blob);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Background removal failed: ${e.message}`
          : "Background removal failed. The image may be cross-origin or the model could not load."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function handleSave() {
    if (!src) return;
    setError(null);
    setProcessing("Preparing image...");
    try {
      // 1. Crop (with rotation) using current crop area, or full image if no
      // crop was completed yet.
      let blob: Blob;
      if (croppedAreaPixels) {
        blob = await getCroppedBlob(src, croppedAreaPixels, rotation, "image/png");
      } else {
        const img = await loadImage(src);
        blob = await getCroppedBlob(
          src,
          { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
          rotation,
          "image/png",
        );
      }
      // 2. Compress + cap dimensions for broadcast use.
      const compressed = await imageCompression(
        new File([blob], "image.png", { type: blob.type || "image/png" }),
        { maxSizeMB: 0.4, maxWidthOrHeight: 800, useWebWorker: true, fileType: blob.type || "image/png" },
      );
      // 3. Upload via API → Cloudinary. The server returns a secure HTTPS URL.
      setProcessing("Uploading to cloud storage...");
      const formData = new FormData();
      formData.append("file", compressed, "image.png");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      const { url } = await res.json() as { url: string };
      onSave(url);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? `Save failed: ${e.message}`
          : "Save failed. Please try again."
      );
    } finally {
      setProcessing(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl dark p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border bg-card/50 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CropIcon className="w-5 h-5 text-primary" /> {title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Crop, rotate, enhance or remove the background — image is compressed and uploaded to cloud storage.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 py-5 space-y-4">
            {/* Cropper or empty state */}
            <div
              className={`relative w-full h-[320px] rounded-lg border overflow-hidden transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border bg-black/40"}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {src ? (
                <Cropper
                  image={src}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                  showGrid={true}
                  objectFit="contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 opacity-30" />
                  <p className="text-sm">Drag an image here, or click Upload Photo to begin.</p>
                </div>
              )}
              {processing && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-center max-w-md px-4">{processing}</p>
                </div>
              )}
            </div>

            {/* Sliders — only shown when an image is loaded */}
            {src && (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Zoom</Label>
                    <span className="text-xs font-mono text-muted-foreground">{zoom.toFixed(2)}×</span>
                  </div>
                  <Slider min={1} max={5} step={0.01} value={[zoom]} onValueChange={v => setZoom(v[0] ?? 1)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><RotateCw className="w-3 h-3" /> Rotation</Label>
                    <span className="text-xs font-mono text-muted-foreground">{rotation}°</span>
                  </div>
                  <Slider min={0} max={360} step={1} value={[rotation]} onValueChange={v => setRotation(v[0] ?? 0)} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => onPickFile(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!processing}
              >
                <Upload className="w-4 h-4" /> {src ? "Replace Photo" : "Upload Photo"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleAutoEnhance}
                disabled={!src || !!processing}
              >
                <Wand2 className="w-4 h-4" /> Auto Enhance
              </Button>
              {confirmBgRemove ? (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 flex-1">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                  <span className="flex-1">First use downloads the ~25 MB AI model (cached after that). Proceed?</span>
                  <Button size="sm" variant="outline" className="h-7 px-3 border-amber-500/50 text-amber-300 hover:bg-amber-500/20" onClick={runRemoveBackground}>Yes, download</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-3" onClick={() => setConfirmBgRemove(false)}>Cancel</Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleRemoveBackground}
                  disabled={!src || !!processing}
                >
                  <Scissors className="w-4 h-4" /> Remove Background
                </Button>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Tip: drag inside the frame to reposition the crop. Output is capped at 800px and ~400 KB so the LED display stays smooth.
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-border bg-card/50 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => { revokeCurrentObjectUrl(); setSrc(undefined); setError(null); }}
            disabled={!src || !!processing}
          >
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} disabled={!!processing}>Cancel</Button>
          <Button onClick={handleSave} disabled={!src || !!processing} className="min-w-[140px] gap-2">
            <Check className="w-4 h-4" /> {processing ? "Working..." : "Save Image"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
