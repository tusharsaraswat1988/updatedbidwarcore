import { useState, useEffect } from "react";
import { useBroadcastCanvasPreviewOptional } from "./BroadcastCanvasProvider";
import type { CanvasScaleMode } from "@/lib/broadcast-canvas/preview-mode";
import { Maximize2, Minimize2, Sliders, RotateCcw, ChevronUp, ChevronDown, Check } from "lucide-react";

const PRESET_OPTIONS: { id: CanvasScaleMode; label: string; desc: string; icon: string }[] = [
  {
    id: "stretch",
    label: "Stretch to Fill (Edge-to-Edge)",
    desc: "100% full window width & height — no black bars",
    icon: "⚡",
  },
  {
    id: "8x4",
    label: "8ft × 4ft LED Preset (1:2)",
    desc: "Optimized for 8ft tall × 4ft wide vertical LED screens",
    icon: "🏏",
  },
  {
    id: "8x2",
    label: "8ft × 2ft LED Preset (1:4)",
    desc: "Optimized for 8ft tall × 2ft wide vertical LED totems",
    icon: "🏏",
  },
  {
    id: "fit",
    label: "Standard 9:16 (Contain)",
    desc: "Original aspect ratio (1080×1920)",
    icon: "📐",
  },
  {
    id: "fill-height",
    label: "100% Height Fill",
    desc: "Matches full window height",
    icon: "📏",
  },
];

/**
 * On-screen LED screen stretch & width adjustment controls for venue operators.
 * Available directly on the side LED display screen.
 */
export function SideLedStretchControls() {
  const ctx = useBroadcastCanvasPreviewOptional();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!ctx) return null;

  const { preview, setScaleMode, setStretchX, resetScale } = ctx;
  const currentMode = preview.scaleMode;
  const currentStretchX = preview.stretchX ?? 1;
  const stretchXPct = Math.round(currentStretchX * 100);

  // Keyboard shortcut: Press 'S' or 'F' to toggle stretch/fit, '[' / ']' for width
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setScaleMode(currentMode === "stretch" ? "fit" : "stretch");
      } else if (e.key === "[") {
        e.preventDefault();
        setStretchX(Math.max(0.4, currentStretchX - 0.05));
      } else if (e.key === "]") {
        e.preventDefault();
        setStretchX(Math.min(3.0, currentStretchX + 0.05));
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey || e.altKey)) {
        e.preventDefault();
        resetScale();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentMode, currentStretchX, setScaleMode, setStretchX, resetScale]);

  if (!open) {
    return (
      <aside
        aria-label="LED screen stretch controls"
        className="fixed bottom-4 left-4 z-[9999] pointer-events-auto transition-opacity duration-300 opacity-40 hover:opacity-100"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/85 px-3.5 py-2 font-mono text-[11px] font-semibold text-amber-300 shadow-2xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-amber-400 hover:text-black"
          title="Adjust LED Screen Stretch & Aspect Ratio (Shortcut: Press S)"
        >
          <span>↔️</span>
          <span>{currentMode === "stretch" ? "Screen: Stretched (Fill)" : currentMode === "8x4" ? "Screen: 8ft×4ft" : currentMode === "8x2" ? "Screen: 8ft×2ft" : "Screen Stretch"}</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/70">Press S</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="LED screen stretch controls panel"
      className="fixed bottom-4 left-4 z-[9999] pointer-events-auto w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-amber-500/30 bg-[#080d1a]/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">↔️</span>
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
              LED Screen Stretch Controls
            </h3>
            <p className="text-[10px] text-white/50">8ft × 2ft & Custom Video Wall Adjuster</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized(!minimized)}
            className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            title={minimized ? "Expand" : "Collapse"}
          >
            {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            title="Close Controls (Shortcut: S)"
          >
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="space-y-3.5">
          {/* Preset Buttons */}
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60">
              Screen Aspect / Fit Mode
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {PRESET_OPTIONS.map((opt) => {
                const isActive = currentMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScaleMode(opt.id)}
                    className={`flex items-start justify-between rounded-xl border p-2.5 text-left transition-all ${
                      isActive
                        ? "border-amber-400 bg-amber-400/15 text-white shadow-sm"
                        : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sm">{opt.icon}</span>
                      <div>
                        <div className="font-mono text-xs font-semibold">{opt.label}</div>
                        <div className="text-[10px] text-white/50">{opt.desc}</div>
                      </div>
                    </div>
                    {isActive && (
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-black">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Width Stretch (X-Axis) Slider */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/70">
                Left-to-Right Width Stretch
              </span>
              <span className="font-mono text-xs font-bold text-amber-300">
                {stretchXPct}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStretchX(Math.max(0.4, currentStretchX - 0.05))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 font-mono text-xs font-bold text-white hover:bg-white/15"
                title="Decrease Width (-5%)"
              >
                -
              </button>

              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.01"
                value={currentStretchX}
                onChange={(e) => setStretchX(parseFloat(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-400"
              />

              <button
                type="button"
                onClick={() => setStretchX(Math.min(3.0, currentStretchX + 0.05))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 font-mono text-xs font-bold text-white hover:bg-white/15"
                title="Increase Width (+5%)"
              >
                +
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex gap-1.5">
                {[1.0, 1.25, 1.5, 1.8, 2.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStretchX(val)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                      Math.abs(currentStretchX - val) < 0.02
                        ? "bg-amber-400 font-bold text-black"
                        : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {Math.round(val * 100)}%
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={resetScale}
                className="flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] text-white/50 hover:bg-white/10 hover:text-white"
                title="Reset to default"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>

          {/* Helper hint */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-200/90 leading-tight">
            💡 <strong>Tip for 8ft×2ft Screen:</strong> Select <strong>"Stretch to Fill"</strong> or <strong>"8ft × 2ft LED Preset"</strong>, then adjust the Width slider if needed until the picture fills the entire cabinet width. Settings save automatically.
          </div>
        </div>
      )}
    </aside>
  );
}
