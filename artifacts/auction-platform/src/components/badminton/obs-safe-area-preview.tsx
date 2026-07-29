/**
 * Broadcast Console — 16:9 safe-area guide so operators see action-safe inset
 * vs slim OBS chrome without opening OBS.
 */

import {
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_SAFE_INSET_X,
  BROADCAST_OVERLAY_SAFE_INSET_Y,
  BROADCAST_OVERLAY_WIDTH,
} from "@/lib/broadcast-overlay";

const PREVIEW_W = 360;
const SCALE = PREVIEW_W / BROADCAST_OVERLAY_WIDTH;
const PREVIEW_H = BROADCAST_OVERLAY_HEIGHT * SCALE;
const INSET_X = BROADCAST_OVERLAY_SAFE_INSET_X * SCALE;
const INSET_Y = BROADCAST_OVERLAY_SAFE_INSET_Y * SCALE;

export function ObsSafeAreaPreview() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
        OBS safe area (1920×1080)
      </p>
      <div
        className="relative mx-auto rounded-md border border-white/15 bg-[#0a0a0c] overflow-hidden"
        style={{ width: PREVIEW_W, height: PREVIEW_H }}
        aria-label="OBS overlay safe-area preview"
      >
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.03)_0_6px,transparent_6px_12px)]" />

        <div className="absolute top-0 left-0 right-0 h-[8%] bg-black/55 border-b border-white/10 flex items-center justify-between px-2">
          <span className="text-[8px] text-white/70 font-semibold truncate">Tournament · LIVE</span>
          <span className="text-[7px] text-red-300 font-bold tracking-wider">LIVE</span>
        </div>

        <div
          className="absolute border border-dashed border-amber-400/55 pointer-events-none"
          style={{
            left: INSET_X,
            top: INSET_Y,
            right: INSET_X,
            bottom: INSET_Y,
          }}
        />
        <span
          className="absolute text-[7px] font-mono text-amber-200/80 bg-black/60 px-1 rounded"
          style={{ left: INSET_X + 2, top: INSET_Y + 2 }}
        >
          5% safe
        </span>

        {/* Lower-third score bug — wide, readable */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-md bg-[#050507] border border-white/20 overflow-hidden"
          style={{ bottom: "9%", width: "88%", height: "14%" }}
        >
          <div className="h-[28%] bg-black border-b border-white/10 flex items-center px-1.5 gap-1">
            <span className="size-1 rounded-full bg-red-500" />
            <span className="text-[6px] text-red-300 font-bold">LIVE</span>
            <span className="text-[6px] text-white/60 font-bold">GAME 2</span>
          </div>
          <div className="h-[72%] grid grid-cols-[1fr_auto_1fr] items-center px-1">
            <div className="flex items-center justify-between gap-1 px-1">
              <span className="text-[8px] text-white font-black truncate">Player A</span>
              <span className="text-[12px] text-white font-black tabular-nums bg-black px-1 rounded">
                21
              </span>
            </div>
            <span className="text-[7px] text-[#ffd700] font-black px-1">2</span>
            <div className="flex items-center justify-between gap-1 px-1 flex-row-reverse">
              <span className="text-[8px] text-white font-black truncate">Player B</span>
              <span className="text-[12px] text-white font-black tabular-nums bg-black px-1 rounded">
                19
              </span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[7%] bg-black/60 border-t border-white/10 flex items-center">
          <div className="h-full px-1.5 flex items-center bg-[#ffd700] text-[7px] font-bold text-black">
            Sponsors
          </div>
          <span className="text-[7px] text-white/50 px-2 truncate">Partner ticker…</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[360px] mx-auto">
        Keep rally action inside the dashed box. Score sits as a wide lower-third above
        the sponsor chyron — large opaque digits for stream readability.
      </p>
    </div>
  );
}
