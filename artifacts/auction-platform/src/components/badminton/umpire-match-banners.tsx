import type { UmpireBanner } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

const BANNER_STYLES: Record<UmpireBanner["kind"], string> = {
  game_point: "bg-orange-600/90 border-orange-400 text-white",
  match_point: "bg-red-700/95 border-red-400 text-white animate-pulse",
  interval_due: "bg-purple-700/90 border-purple-400 text-white",
  court_change_required: "bg-cyan-700/90 border-cyan-300 text-white",
  game_completed: "bg-emerald-700/90 border-emerald-400 text-white",
  match_completed: "bg-amber-600/95 border-amber-300 text-white",
};

export function UmpireMatchBanners({ banners }: { banners: UmpireBanner[] }) {
  if (banners.length === 0) return null;

  return (
    <div className="shrink-0 space-y-2 px-3 pt-3">
      {banners.map((banner) => (
        <div
          key={`${banner.kind}-${banner.label}`}
          className={cn(
            "rounded-xl border-2 px-4 py-3 text-center shadow-lg",
            BANNER_STYLES[banner.kind],
          )}
        >
          <p className="text-lg sm:text-xl font-black tracking-wide uppercase">
            {banner.emoji} {banner.label}
          </p>
        </div>
      ))}
    </div>
  );
}
