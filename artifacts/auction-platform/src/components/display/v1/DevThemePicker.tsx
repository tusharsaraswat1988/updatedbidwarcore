import { useState } from "react";
import { useStageTheme } from "./StageThemeProvider";

/**
 * Live LED theme picker — bottom-left floating chip + preset grid.
 * Stadium Gold / Sapphire / Emerald / Crimson + custom accent color.
 */
export function DevThemePicker() {
  const { presets, themeId, setThemeId, customAccent, setCustomAccent, theme } = useStageTheme();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-[100] w-9 h-9 rounded-full bg-black/70 border border-white/15 backdrop-blur-md hover:bg-black shadow-lg flex items-center justify-center pointer-events-auto"
        title="Stage theme"
        aria-label="Open theme picker"
      >
        <span
          className="w-4 h-4 rounded-full border border-white/30"
          style={{ background: theme.vars["--accent"] }}
        />
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-[100] flex flex-col gap-2 p-3 rounded-xl border border-white/10 bg-black/85 backdrop-blur-md shadow-2xl w-64 pointer-events-auto">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/55">
          Stage Theme
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
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
