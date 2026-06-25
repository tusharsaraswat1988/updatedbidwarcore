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
      <p className="font-['Bebas_Neue'] text-4xl md:text-6xl tracking-[0.12em] uppercase text-white/90">
        {tournamentName}
      </p>

      {entries.length > 0 ? (
        <div className="mt-6 flex w-full max-w-2xl flex-col items-center">
          <p
            className="font-mono uppercase tracking-[0.35em] text-xs md:text-sm"
            style={{ color: "var(--accent)" }}
          >
            Please Welcome Our Sponsors
          </p>

          {/* Fixed slot — welcome line stays put; only inner content fades */}
          <div className="relative mt-4 h-[17rem] w-full md:h-[18rem]">
            <div
              className="absolute inset-0 flex flex-col items-center gap-3 transition-opacity ease-in-out"
              style={{
                opacity: visible ? 1 : 0,
                transitionDuration: `${FADE_MS}ms`,
              }}
            >
              <div className="flex h-36 w-full max-w-md items-center justify-center rounded-lg bg-white/95 px-8 py-4 shadow-[0_0_40px_rgba(255,255,255,0.08)]">
                {current.logoUrl ? (
                  <img
                    src={current.logoUrl}
                    alt={current.name || "Sponsor"}
                    className="max-h-full w-auto max-w-full object-contain"
                  />
                ) : null}
              </div>

              <p className="flex h-10 items-center justify-center font-['Bebas_Neue'] text-2xl md:text-4xl tracking-[0.2em] uppercase text-white/95">
                {current.name.trim() || "\u00a0"}
              </p>
              <p className="flex h-5 items-center justify-center font-mono uppercase tracking-[0.35em] text-[10px] md:text-xs text-white/45">
                {current.type.trim() || "\u00a0"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 font-mono uppercase tracking-[0.35em] text-xs text-white/45">
          Waiting For Operator to start
        </p>
      )}
    </div>
  );
});
