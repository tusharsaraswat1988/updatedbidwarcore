import type { ScorerBanner } from "@workspace/badminton-core";
import { cn } from "@/lib/utils";

/** Soft “key moment” chips — important, not alarm. */
const BANNER_STYLES: Record<ScorerBanner["kind"], string> = {
  game_point: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  match_point: "border-rose-400/40 bg-rose-500/14 text-rose-100",
  interval_due: "border-violet-400/35 bg-violet-500/12 text-violet-100",
  court_change_required: "border-cyan-400/35 bg-cyan-500/12 text-cyan-100",
  game_completed: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
  match_completed: "border-amber-400/35 bg-amber-500/14 text-amber-50",
  match_paused: "border-amber-400/40 bg-amber-500/14 text-amber-50",
};

function splitBannerLabel(label: string): { title: string; detail: string | null } {
  const sep = " — ";
  const idx = label.indexOf(sep);
  if (idx === -1) return { title: label, detail: null };
  return { title: label.slice(0, idx), detail: label.slice(idx + sep.length) };
}

export function ScorerMatchBanners({ banners }: { banners: ScorerBanner[] }) {
  if (banners.length === 0) return null;

  return (
    <div className="shrink-0 space-y-1.5 px-3 pt-2">
      {banners.map((banner) => {
        const { title, detail } = splitBannerLabel(banner.label);
        return (
          <div
            key={`${banner.kind}-${banner.label}`}
            role="status"
            className={cn(
              "rounded-lg border px-3 py-1.5 min-w-0",
              BANNER_STYLES[banner.kind],
            )}
          >
            <div className="flex items-baseline justify-center gap-2 min-w-0">
              <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.14em]">
                {title}
              </span>
              {detail ? (
                <span
                  className="min-w-0 truncate text-xs font-semibold normal-case tracking-normal opacity-90"
                  title={detail}
                >
                  {detail}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
