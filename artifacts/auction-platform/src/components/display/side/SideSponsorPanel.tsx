import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { LedView, LiveSponsorDTO } from "@/lib/led-view/types";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, getObsBroadcastLogoSrc } from "@/lib/brand-assets";
import {
  getSponsorChyronNameStyle,
  getSponsorChyronTypeStyle,
  getSponsorLogoFilter,
  type SponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import {
  preloadImageUrls,
  readSideSponsorCache,
  sponsorListSignature,
  writeSideSponsorCache,
} from "@/lib/side-sponsor-cache";

const HOLD_MS = 5000;
const FADE_MS = 900;
const SIDE_HEADER_LOGO_MAX_HEIGHT_PX = 30;
const SIDE_HEADER_LOGO_MAX_WIDTH_PX = 150;

function sponsorTier(sponsor: LiveSponsorDTO): SponsorBroadcastTier {
  return sponsor.tier ?? "normal";
}

function sideLogoBehindGlowLayers(tier: SponsorBroadcastTier):
  | { core: CSSProperties; spread: CSSProperties }
  | undefined {
  if (tier === "title") {
    return {
      core: {
        background:
          "radial-gradient(ellipse 90% 90% at 50% 50%, rgba(255, 236, 170, 0.95) 0%, rgba(247, 223, 138, 0.55) 38%, transparent 68%)",
      },
      spread: {
        background:
          "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(247, 223, 138, 0.5) 0%, rgba(201, 162, 39, 0.18) 50%, transparent 72%)",
      },
    };
  }
  if (tier === "co_sponsor") {
    return {
      core: {
        background:
          "radial-gradient(ellipse 90% 90% at 50% 50%, rgba(230, 238, 250, 0.9) 0%, rgba(180, 200, 220, 0.45) 38%, transparent 68%)",
      },
      spread: {
        background:
          "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(200, 215, 235, 0.42) 0%, rgba(160, 180, 210, 0.14) 50%, transparent 72%)",
      },
    };
  }
  return undefined;
}

function sideLogoImageFilter(tier: SponsorBroadcastTier): string {
  if (tier === "title" || tier === "co_sponsor") {
    return "drop-shadow(0 2px 8px rgba(0,0,0,0.32))";
  }
  return getSponsorLogoFilter(tier);
}

function sideLogoFrameStyle(tier: SponsorBroadcastTier) {
  if (tier === "title") {
    return { border: "1px solid rgba(247, 223, 138, 0.45)" };
  }
  if (tier === "co_sponsor") {
    return { border: "1px solid rgba(180, 200, 220, 0.38)" };
  }
  return { border: "1px solid rgba(255,255,255,0.12)" };
}

/** LED spotlight / chyron typography — strip sizes so Tailwind matches main stage. */
function sideLedNameStyle(tier: SponsorBroadcastTier): CSSProperties {
  const { fontSize: _f, letterSpacing: _l, ...rest } = getSponsorChyronNameStyle(tier);
  if (tier === "normal") {
    return { color: "rgba(255,255,255,0.95)" };
  }
  return rest;
}

function sideLedTypeStyle(tier: SponsorBroadcastTier): CSSProperties {
  const { fontSize: _f, letterSpacing: _l, ...rest } = getSponsorChyronTypeStyle(tier);
  if (tier === "title" || tier === "co_sponsor") {
    return { ...rest, fontWeight: 700 };
  }
  return rest;
}

function sideLedTypeClassName(tier: SponsorBroadcastTier): string {
  if (tier === "title" || tier === "co_sponsor") {
    return "font-mono uppercase tracking-[0.35em] text-xs md:text-sm";
  }
  return "font-mono uppercase tracking-[0.35em] text-[10px] md:text-xs";
}

function useCachedSponsors(tournamentId: number, liveSponsors: LiveSponsorDTO[]) {
  const [sponsors, setSponsors] = useState<LiveSponsorDTO[]>(() => {
    const cached = readSideSponsorCache(tournamentId);
    if (cached?.length) return cached;
    return liveSponsors;
  });

  useEffect(() => {
    if (liveSponsors.length === 0) return;

    const cached = readSideSponsorCache(tournamentId);
    if (cached && sponsorListSignature(cached) === sponsorListSignature(liveSponsors)) {
      setSponsors(cached);
      return;
    }

    writeSideSponsorCache(tournamentId, liveSponsors);
    setSponsors(liveSponsors);
  }, [liveSponsors, tournamentId]);

  return sponsors;
}

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

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const scheduleHold = () => {
      holdTimer = setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        fadeTimer = setTimeout(() => {
          if (cancelled) return;
          setIndex((i) => (i + 1) % entries.length);
          setVisible(true);
          scheduleHold();
        }, FADE_MS);
      }, HOLD_MS);
    };

    scheduleHold();

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
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
  tournamentId,
}: {
  view: LedView;
  tournamentId: number;
}) {
  const { tournament, branding } = view;
  const { logos, brandName, iconVersion } = useBranding();
  const sponsors = useCachedSponsors(tournamentId, view.sponsors ?? []);
  const { entries, index, visible } = useSponsorCarousel(sponsors);
  const current = entries[index];
  const logoSrc = getObsBroadcastLogoSrc(logos, iconVersion);
  const logoAlt = getBrandLogoAlt(brandName);
  const tier = current ? sponsorTier(current) : "normal";
  const logoGlow = sideLogoBehindGlowLayers(tier);

  useEffect(() => {
    preloadImageUrls([logoSrc, ...entries.map((s) => s.logoUrl)]);
  }, [logoSrc, entries]);

  return (
    <div className="flex h-full w-full flex-col">
      <header className="shrink-0 border-b border-white/10 bg-black/50 px-[5%] pb-[3%] pt-0">
        {logoSrc ? (
          <div className="flex items-start justify-center">
            <img
              src={logoSrc}
              alt={logoAlt}
              className="block w-auto shrink-0 object-contain object-top"
              style={{
                maxHeight: SIDE_HEADER_LOGO_MAX_HEIGHT_PX,
                maxWidth: SIDE_HEADER_LOGO_MAX_WIDTH_PX,
                filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.55))",
              }}
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}
        <h1
          className={`text-center font-['Bebas_Neue'] text-4xl md:text-5xl leading-none tracking-[0.12em] uppercase text-white/90 ${logoSrc ? "mt-10" : "mt-4"}`}
        >
          {tournament.name}
        </h1>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-[6%] py-[4%] text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 40%, color-mix(in oklab, var(--accent) 35%, transparent), transparent 70%)",
          }}
        />

        {entries.length > 0 && current ? (
          <>
            <p
              className="relative mt-[11%] font-mono text-xs uppercase tracking-[0.35em] md:text-sm"
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
                  willChange: "opacity",
                }}
              >
                <div className="relative isolate inline-flex max-w-full items-center justify-center overflow-visible [transform:translateZ(0)]">
                  {logoGlow ? (
                    <>
                      <div
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-40 w-[min(85vw,320px)] -translate-x-1/2 -translate-y-1/2 blur-3xl md:h-44"
                        style={logoGlow.spread}
                      />
                      <div
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-32 w-[min(70vw,260px)] -translate-x-1/2 -translate-y-1/2 blur-2xl md:h-36"
                        style={logoGlow.core}
                      />
                    </>
                  ) : null}
                  <div
                    className="relative z-10 inline-flex max-w-full items-center justify-center overflow-visible rounded-lg bg-white/[0.97] px-2 py-1"
                    style={sideLogoFrameStyle(tier)}
                  >
                    {current.logoUrl ? (
                      <img
                        src={current.logoUrl}
                        alt={current.name || "Sponsor"}
                        className="relative block max-h-36 w-auto max-w-[min(75vw,280px)] object-contain"
                        style={{ filter: sideLogoImageFilter(tier) }}
                      />
                    ) : (
                      <span className="relative px-2 font-['Bebas_Neue'] text-4xl tracking-widest text-black/80">
                        {current.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p
                    className="font-['Bebas_Neue'] text-2xl uppercase tracking-[0.2em] text-white/95 md:text-4xl"
                    style={sideLedNameStyle(tier)}
                  >
                    {current.name.trim() || "\u00a0"}
                  </p>
                  <p
                    className={sideLedTypeClassName(tier)}
                    style={sideLedTypeStyle(tier)}
                  >
                    {current.type.trim() || "Partner"}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="relative space-y-3">
            <p className="font-['Bebas_Neue'] text-5xl tracking-widest text-white/20">
              SPONSORS
            </p>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-white/40">
              Partner logos will appear here
            </p>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-white/10 bg-black/60 px-[5%] py-[2.5%]">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
          {branding?.poweredByText ?? "Powered by BidWar"}
        </p>
      </footer>
    </div>
  );
});
