import { memo, useEffect, useMemo, useState } from "react";
import type { LedView, LiveSponsorDTO } from "@/lib/led-view/types";

const HOLD_MS = 5000;
const FADE_MS = 900;

function useSponsorCarousel(sponsors: LiveSponsorDTO[]) {
  const entries = useMemo(
    () => sponsors.filter((s) => s.logoUrl.trim() || s.name.trim()),
    [sponsors],
  );
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [entries.length]);

  useEffect(() => {
    if (entries.length <= 1) return undefined;

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      setVisible(false);
      fadeTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % entries.length);
        setVisible(true);
      }, FADE_MS);
    };

    const interval = setInterval(step, HOLD_MS + FADE_MS);
    return () => {
      clearInterval(interval);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [entries.length]);

  return { entries, index, visible };
}

/**
 * Professional sponsor showcase for side LED panels (portrait or landscape).
 */
export const SideSponsorPanel = memo(function SideSponsorPanel({
  view,
}: {
  view: LedView;
}) {
  const { tournament, sponsors, branding } = view;
  const { entries, index, visible } = useSponsorCarousel(sponsors);
  const current = entries[index];
  const brandName = branding?.brandName ?? "BIDWAR";

  return (
    <div className="flex h-full w-full flex-col">
      <header className="shrink-0 border-b border-white/10 bg-black/50 px-[5%] py-[3%]">
        <div className="flex items-center justify-between gap-3">
          <div
            className="px-3 py-1.5"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <span
              className="font-['Bebas_Neue'] text-lg tracking-[0.2em]"
              style={{ color: "var(--accent-on)" }}
            >
              {brandName}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
            Official Partners
          </span>
        </div>
        <h1 className="mt-3 font-['Bebas_Neue'] text-[clamp(1.75rem,5vw,3rem)] leading-none tracking-[0.08em] uppercase text-white/95">
          {tournament.name}
        </h1>
        {tournament.venue ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
            {tournament.venue}
          </p>
        ) : null}
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-[6%] py-[4%] text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 40%, color-mix(in oklab, var(--accent) 35%, transparent), transparent 70%)",
          }}
        />

        {entries.length > 0 ? (
          <>
            <p
              className="relative font-mono text-xs uppercase tracking-[0.45em] md:text-sm"
              style={{ color: "var(--accent)" }}
            >
              Proudly Supported By
            </p>

            <div className="relative mt-[5%] flex w-full max-w-md flex-1 flex-col items-center justify-center">
              <div
                className="flex w-full flex-col items-center gap-4 transition-opacity ease-in-out"
                style={{
                  opacity: visible ? 1 : 0,
                  transitionDuration: `${FADE_MS}ms`,
                }}
              >
                <div className="flex aspect-[4/3] w-full max-w-sm items-center justify-center rounded-xl border border-white/10 bg-white/[0.97] px-8 py-6 shadow-[0_0_60px_rgba(255,255,255,0.08)]">
                  {current.logoUrl ? (
                    <img
                      src={current.logoUrl}
                      alt={current.name || "Sponsor"}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="font-['Bebas_Neue'] text-4xl tracking-widest text-black/80">
                      {current.name}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="font-['Bebas_Neue'] text-3xl tracking-[0.15em] uppercase text-white md:text-4xl">
                    {current.name.trim() || "\u00a0"}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/45 md:text-xs">
                    {current.type.trim() || "Partner"}
                  </p>
                </div>
              </div>

              {entries.length > 1 ? (
                <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2">
                  {entries.map((s, i) => (
                    <div
                      key={`${s.name}-${i}`}
                      className="flex h-12 w-12 items-center justify-center rounded-md border bg-white/90 p-1"
                      style={{
                        borderColor: i === index ? "var(--accent)" : "rgba(255,255,255,0.15)",
                        opacity: i === index ? 1 : 0.55,
                      }}
                    >
                      {s.logoUrl ? (
                        <img src={s.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="font-['Bebas_Neue'] text-[10px] text-black/70">
                          {s.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="relative space-y-3">
            <p className="font-['Bebas_Neue'] text-5xl tracking-widest text-white/20">
              SPONSORS
            </p>
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/40">
              Partner logos will appear here
            </p>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-white/10 bg-black/60 px-[5%] py-[2.5%]">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.45em] text-white/45">
          {branding?.poweredByText ?? "Powered by BidWar"}
        </p>
      </footer>
    </div>
  );
});
