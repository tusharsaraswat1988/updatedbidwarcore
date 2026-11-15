import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ZoomIn, ZoomOut, ExternalLink, Loader2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImagePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
  altText?: string;
}

export function ImagePreviewModal({
  open,
  onOpenChange,
  imageUrl,
  title = "Image Preview",
  subtitle,
  altText,
}: ImagePreviewModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (open) {
      setIsZoomed(false);
      setLoading(true);
      setHasError(false);
    }
  }, [open, imageUrl]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          aria-label={title}
          className="fixed left-[50%] top-[50%] z-50 flex h-auto max-h-[92vh] w-[95vw] max-w-4xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl duration-150 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60">
            <div className="min-w-0 pr-4">
              <DialogPrimitive.Title className="text-sm font-semibold text-slate-100 truncate">
                {title}
              </DialogPrimitive.Title>
              {subtitle ? (
                <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {imageUrl && !hasError && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    title={isZoomed ? "Reset zoom" : "Zoom in"}
                    aria-label={isZoomed ? "Reset zoom" : "Zoom in"}
                    onClick={() => setIsZoomed((z) => !z)}
                  >
                    {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                  </Button>
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                    title="Open full image in new tab"
                    aria-label="Open full image in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </>
              )}
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                  aria-label="Close image preview"
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Main viewing area */}
          <div
            className={cn(
              "relative flex flex-1 items-center justify-center overflow-auto p-4 bg-slate-950/80 min-h-[300px] max-h-[calc(92vh-4rem)]",
              isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
            )}
            onClick={() => {
              if (!hasError && imageUrl) setIsZoomed((z) => !z);
            }}
          >
            {loading && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10">
                <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
              </div>
            )}

            {hasError || !imageUrl ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                <ImageOff className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-medium">Image could not be loaded</p>
                <p className="text-xs text-slate-500 mt-1">The image URL may be invalid or expired.</p>
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={altText || title}
                className={cn(
                  "rounded transition-all duration-200 select-none",
                  isZoomed
                    ? "max-w-none w-auto h-auto scale-125 my-auto"
                    : "max-h-[calc(90vh-6rem)] max-w-full w-auto h-auto object-contain",
                )}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setHasError(true);
                }}
              />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
