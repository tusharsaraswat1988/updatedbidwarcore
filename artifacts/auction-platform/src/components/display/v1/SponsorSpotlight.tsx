import { memo, useEffect, useMemo, useState } from "react";
import type { LiveSponsorDTO } from "@/lib/led-view/types";

const HOLD_MS = 4500;
const FADE_MS = 800;

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

export const SponsorSpotlight = memo(function SponsorSpotlight({
  tournamentName,
  sponsors,
}: {
  tournamentName: string;
  sponsors: LiveSponsorDTO[];
}) {
  const { entries, index, visible } = useSponsorCarousel(sponsors);
  const current = entries[index];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center px-[6%]">
      <p
        className="font-['Bebas_Neue',sans-serif] text-5xl md:text-7xl lg:text-8xl tracking-[0.04em] uppercase text-white font-black leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
        style={{
          WebkitTextStroke: "1.2px rgba(255, 255, 255, 0.6)",
          textShadow: "0 2px 14px rgba(0, 0, 0, 0.95), 0 0 2px rgba(255, 255, 255, 0.6)",
        }}
      >
        {tournamentName}
      </p>

      {entries.length > 0 ? (
        <div className="mt-6 flex w-full max-w-2xl flex-col items-center">
          <p
            className="font-['Space_Grotesk'] uppercase tracking-[0.08em] led-label text-[clamp(0.95rem,1.3cqw,1.45rem)] font-extrabold"
            style={{ color: "var(--accent)" }}
          >
            Please Welcome Our Sponsors
          </p>

          {/* Fixed slot — welcome line stays put; only inner content fades */}
          <div className="relative mt-4 h-[19rem] w-full md:h-[21rem]">
            <div
              className="absolute inset-0 flex flex-col items-center gap-3 transition-opacity ease-in-out"
              style={{
                opacity: visible ? 1 : 0,
                transitionDuration: `${FADE_MS}ms`,
              }}
            >
              <div className="flex h-44 md:h-48 w-full max-w-xl items-center justify-center">
                {current.logoUrl ? (
                  <img
                    src={current.logoUrl}
                    alt={current.name || "Sponsor"}
                    className="max-h-full w-auto max-w-full object-contain"
                  />
                ) : null}
              </div>

              <p className="flex h-10 items-center justify-center font-['Bebas_Neue'] text-3xl md:text-5xl tracking-[0.06em] uppercase text-white/95 led-value">
                {current.name.trim() || "\u00a0"}
              </p>
              <p className="flex h-5 items-center justify-center font-['Space_Grotesk'] uppercase tracking-[0.06em] led-caption text-[clamp(0.85rem,1.1cqw,1.25rem)] text-white/80 font-bold">
                {current.type.trim() || "\u00a0"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 font-['Space_Grotesk'] uppercase tracking-[0.06em] led-status text-[clamp(0.95rem,1.3cqw,1.45rem)] text-white/80 font-extrabold">
          Waiting For Operator to start
        </p>
      )}
    </div>
  );
});
