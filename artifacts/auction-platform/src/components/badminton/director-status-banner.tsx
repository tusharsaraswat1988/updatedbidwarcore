/**
 * Director status banner for OBS, scoreboard, and venue display.
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";
import { deriveDirectorStatusBanner } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

const BANNER_STYLES = {
  paused: "bg-amber-600/95 border-amber-300 text-white",
  retired: "bg-orange-700/95 border-orange-400 text-white",
  walkover: "bg-purple-700/95 border-purple-400 text-white",
  disqualified: "bg-red-800/95 border-red-400 text-white",
  completed: "bg-emerald-700/95 border-emerald-400 text-white",
  abandoned: "bg-slate-700/95 border-slate-400 text-white",
} as const;

export function DirectorStatusBanner({ state }: { state: BadmintonMatchState }) {
  const banner = deriveDirectorStatusBanner(state);
  if (!banner) return null;

  return (
    <div
      className={cn(
        "rounded-xl border-2 px-6 py-4 text-center shadow-2xl",
        BANNER_STYLES[banner.kind],
      )}
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      <p className="text-xl sm:text-2xl font-black tracking-widest uppercase">
        {banner.title}
      </p>
      {banner.subtitle ? (
        <p className="text-sm sm:text-base font-semibold mt-1 opacity-90">
          {banner.subtitle}
        </p>
      ) : null}
    </div>
  );
}
