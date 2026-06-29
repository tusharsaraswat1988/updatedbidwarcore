import { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImageFile } from "@/lib/cloudinary-upload";

interface CompactScreenshotUploadProps {
  value: string;
  onChange: (url: string, publicId?: string) => void;
  disabled?: boolean;
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

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
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const result = await uploadImageFile(file, file.name || "screenshot.png");
      onChange(result.url, result.publicId);
    } catch {
      setError("Upload failed. Please try again.");
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
    <div className="space-y-2">
      <p className="text-sm font-medium">Upload Payment Screenshot</p>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2">
          <div className="w-12 h-12 rounded-md overflow-hidden border border-border shrink-0">
            <img src={value} alt="Payment screenshot" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Screenshot uploaded</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            disabled={disabled || uploading}
            onClick={() => onChange("")}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative rounded-lg border border-dashed p-4 transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/10"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
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
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                Drag and drop on desktop, or choose from gallery / camera on mobile
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={disabled || uploading}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Uploading..." : "Choose from Gallery"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 sm:hidden"
                  disabled={disabled || uploading}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  {uploading ? "Uploading..." : "Take Photo"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
