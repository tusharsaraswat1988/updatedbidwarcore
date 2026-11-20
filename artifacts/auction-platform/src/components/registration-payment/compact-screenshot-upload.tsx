import { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2, Camera, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImageFile } from "@/lib/cloudinary-upload";
import { RegLabel } from "@/components/registration/registration-chrome";

interface CompactScreenshotUploadProps {
  value: string;
  onChange: (url: string, publicId?: string) => void;
  disabled?: boolean;
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_BYTES = 8 * 1024 * 1024;

export function CompactScreenshotUpload({ value, onChange, disabled }: CompactScreenshotUploadProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 8 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const result = await uploadImageFile(file, file.name || "screenshot.png");
      onChange(result.url, result.publicId);
    } catch {
      setError("Upload failed. Please try again. Your other details are still here.");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="reg-field">
      <RegLabel marker="required">Payment receipt screenshot</RegLabel>
      <input
        ref={galleryInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        disabled={disabled || uploading}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3 shadow-2xs">
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0 bg-muted/40">
            <img src={value} alt="Uploaded payment receipt" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Receipt attached</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Ready for organizer verification
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs font-medium cursor-pointer"
                disabled={disabled || uploading}
                onClick={() => galleryInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-medium text-destructive hover:text-destructive cursor-pointer"
                disabled={disabled || uploading}
                onClick={() => onChange("")}
              >
                <X className="w-3.5 h-3.5 mr-1.5" /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-xl border border-dashed p-3.5 sm:p-4 transition-colors ${
            dragOver ? "border-primary bg-primary/10" : "border-border/80 bg-muted/20 hover:bg-muted/35"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-lg bg-card border border-border/80 flex items-center justify-center shrink-0 shadow-2xs">
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  {uploading ? "Uploading receipt…" : "Upload payment screenshot or receipt"}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  JPG, PNG, WEBP, or HEIC up to 8 MB
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 px-3.5 text-xs font-medium cursor-pointer"
                  disabled={disabled || uploading}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {uploading ? "Uploading…" : "Choose from gallery"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 px-3.5 text-xs font-medium sm:hidden cursor-pointer"
                  disabled={disabled || uploading}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  Take photo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {error ? <p className="text-xs text-destructive mt-1.5" role="alert">{error}</p> : null}
    </div>
  );
}
