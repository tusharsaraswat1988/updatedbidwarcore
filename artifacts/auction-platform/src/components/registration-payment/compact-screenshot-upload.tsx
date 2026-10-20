import { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
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
      <RegLabel marker="required">Payment receipt</RegLabel>
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
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <div className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
            <img src={value} alt="Uploaded payment receipt" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm text-foreground">Receipt uploaded. You can replace it before submitting.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={disabled || uploading}
                onClick={() => galleryInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-destructive hover:text-destructive"
                disabled={disabled || uploading}
                onClick={() => onChange("")}
              >
                <X className="w-4 h-4" /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-xl border border-dashed p-4 transition-colors ${
            dragOver ? "border-primary bg-primary/10" : "border-border bg-muted/30"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <p className="reg-hint">JPG, PNG, WEBP, or HEIC, up to 8 MB. Drag a file here on desktop.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={disabled || uploading}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading…" : "Choose from gallery"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:hidden"
                  disabled={disabled || uploading}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Take photo"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
