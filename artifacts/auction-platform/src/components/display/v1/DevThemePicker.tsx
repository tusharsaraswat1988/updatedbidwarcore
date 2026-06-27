import { useState } from "react";
import { cn } from "@/lib/utils";
import { useStageTheme } from "./StageThemeProvider";

function ThemePickerPanel({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  const { presets, themeId, setThemeId, customAccent, setCustomAccent } = useStageTheme();

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md shadow-2xl w-64 pointer-events-auto",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/55">
          Stage Theme
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/60 hover:text-white text-xs px-1"
          aria-label="Collapse theme picker"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {presets.map((p) => {
          const active = themeId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setThemeId(p.id)}
              className={`flex items-center gap-2 px-2 py-2 rounded border text-left transition-colors ${
                active
                  ? "bg-white/10 border-white/40"
                  : "bg-white/[0.02] border-white/10 hover:bg-white/5"
              }`}
            >
              <span
                className="size-5 rounded shrink-0 border border-white/20"
                style={{ background: p.vars["--accent"] }}
              />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/90 truncate">
                {p.name}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setThemeId("custom")}
          className={`flex items-center gap-2 px-2 py-2 rounded border text-left transition-colors col-span-2 ${
            themeId === "custom"
              ? "bg-white/10 border-white/40"
              : "bg-white/[0.02] border-white/10 hover:bg-white/5"
          }`}
        >
          <input
            type="color"
            value={customAccent}
            onChange={(e) => {
              setCustomAccent(e.target.value);
              setThemeId("custom");
            }}
            onClick={(e) => e.stopPropagation()}
            className="size-5 rounded shrink-0 border border-white/20 bg-transparent cursor-pointer"
            aria-label="Custom accent color"
          />
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">
            Custom Accent
          </span>
          <span className="ml-auto font-mono text-[10px] text-white/50">{customAccent}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Live LED theme picker — preset grid + custom accent color.
 * `inline` sits in the top strip; `floating` stays on the stage corner.
 */
export function DevThemePicker({
  anchor = "viewport",
  placement = "floating",
}: {
  /** viewport = fixed to browser window; stage = absolute on LED canvas */
  anchor?: "viewport" | "stage";
  /** inline = top-strip slot; floating = corner chip on stage/viewport */
  placement?: "floating" | "inline";
}) {
  const { theme } = useStageTheme();
  const [open, setOpen] = useState(false);

  const floatingPositionClass =
    anchor === "stage"
      ? "absolute top-3 right-3 z-[200]"
      : "fixed top-3 right-3 z-[100]";

  if (placement === "inline") {
    return (
      <div className="relative z-30 shrink-0 pointer-events-auto">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-8 h-8 rounded-full bg-black/80 border border-white/20 backdrop-blur-md hover:bg-black hover:border-white/35 shadow-lg flex items-center justify-center"
          title="Stage theme"
          aria-label="Open theme picker"
          aria-expanded={open}
        >
          <span
            className="w-4 h-4 rounded-full border-2 border-white/40 shadow-inner"
            style={{ background: theme.vars["--accent"] }}
          />
        </button>
        {open ? (
          <ThemePickerPanel
            onClose={() => setOpen(false)}
            className="absolute right-0 top-[calc(100%+0.35rem)] z-[250]"
          />
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          floatingPositionClass,
          "w-10 h-10 rounded-full bg-black/80 border border-white/20 backdrop-blur-md hover:bg-black hover:border-white/35 shadow-lg flex items-center justify-center pointer-events-auto",
        )}
        title="Stage theme"
        aria-label="Open theme picker"
      >
        <span
          className="w-5 h-5 rounded-full border-2 border-white/40 shadow-inner"
          style={{ background: theme.vars["--accent"] }}
        />
      </button>
    );
  }

  return (
    <ThemePickerPanel
      onClose={() => setOpen(false)}
      className={floatingPositionClass}
    />
  );
}
