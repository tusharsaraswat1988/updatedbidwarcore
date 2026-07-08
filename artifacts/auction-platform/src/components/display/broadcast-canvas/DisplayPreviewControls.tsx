import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  CanvasDisplayMode,
  CanvasGuideOverlay,
  CanvasScaleMode,
} from "@/lib/broadcast-canvas/preview-mode";
import { useBroadcastCanvasPreviewOptional } from "./BroadcastCanvasProvider";

const SCALE_OPTIONS: { id: CanvasScaleMode; label: string }[] = [
  { id: "fit", label: "Fit Screen" },
  { id: "actual", label: "Actual Size" },
  { id: "75", label: "75%" },
  { id: "50", label: "50%" },
];

const DISPLAY_OPTIONS: { id: CanvasDisplayMode; label: string }[] = [
  { id: "desktop", label: "Desktop Preview" },
  { id: "led-vertical", label: "LED Vertical (1080×1920)" },
  { id: "led-horizontal", label: "LED Horizontal" },
  { id: "mobile", label: "Mobile Preview" },
];

const GUIDE_OPTIONS: { id: CanvasGuideOverlay; label: string }[] = [
  { id: "safe", label: "Safe Area" },
  { id: "center", label: "Center Guides" },
  { id: "grid", label: "Pixel Grid" },
];

/**
 * Preview controls for broadcast canvas QA — lives outside scaled canvas.
 * Visible in dev or when ?previewControls=1 is set.
 */
export function DisplayPreviewControls() {
  const ctx = useBroadcastCanvasPreviewOptional();
  const [open, setOpen] = useState(false);

  if (!ctx?.preview.showPreviewControls) return null;

  const { preview, setScaleMode, setDisplayMode, toggleGuide } = ctx;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[10000] pointer-events-auto rounded-lg border border-white/15 bg-black/85 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white"
        aria-label="Open display preview controls"
      >
        Preview
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[10000] pointer-events-auto w-72 rounded-xl border border-white/10 bg-black/92 p-3 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/55">
          Developer Mode
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-1 text-xs text-white/60 hover:text-white"
          aria-label="Close preview controls"
        >
          ✕
        </button>
      </div>

      <SectionLabel>Display Mode</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {DISPLAY_OPTIONS.map((opt) => (
          <PreviewButton
            key={opt.id}
            active={preview.displayMode === opt.id}
            onClick={() => setDisplayMode(opt.id)}
          >
            {opt.label}
          </PreviewButton>
        ))}
      </div>

      <SectionLabel>Scale</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {SCALE_OPTIONS.map((opt) => (
          <PreviewButton
            key={opt.id}
            active={preview.scaleMode === opt.id}
            onClick={() => setScaleMode(opt.id)}
          >
            {opt.label}
          </PreviewButton>
        ))}
      </div>

      <SectionLabel>Guides</SectionLabel>
      <div className="grid grid-cols-1 gap-1.5">
        {GUIDE_OPTIONS.map((opt) => (
          <PreviewButton
            key={opt.id}
            active={preview.guides.has(opt.id)}
            onClick={() => toggleGuide(opt.id)}
          >
            {opt.label}
          </PreviewButton>
        ))}
      </div>

      <p className="mt-3 font-mono text-[9px] leading-relaxed text-white/35">
        Fixed 1080×1920 canvas — layout never reflows, only scales.
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
      {children}
    </p>
  );
}

function PreviewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-white/35 bg-white/10 text-white/90"
          : "border-white/10 bg-white/[0.02] text-white/55 hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}
