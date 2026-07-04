import { memo, useMemo, type HTMLAttributes } from "react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  getSponsorsByPriority,
  resolveSponsorPriorityType,
  SponsorPriorityType,
} from "@/lib/sponsor-logo";
import { BIDWAR_TICKER_CREDIT } from "@/lib/broadcast-overlay";
import { BIDWAR_BROADCAST_YELLOW, BIDWAR_BROADCAST_YELLOW_MUTED } from "@/lib/bidwar-broadcast-colors";
import {
  getSponsorTickerNameStyle,
  getSponsorTickerTypeStyle,
  sponsorBroadcastTier,
  type SponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import { BROADCAST_SAFE_X } from "@/lib/display-broadcast-layout";
import { useSeamlessTicker } from "@/lib/chyron-ticker";

/** Ribbon content height (px) — used by Broadcast Overlay stacking. */
export const SPONSOR_RIBBON_HEIGHT_PX = 44;
/** Bottom inset above TV safe area (px) — LED / mobile viewer only. */
export const SPONSOR_RIBBON_SAFE_INSET_PX = 12;
export const SPONSOR_RIBBON_TOTAL_HEIGHT_PX = SPONSOR_RIBBON_HEIGHT_PX + SPONSOR_RIBBON_SAFE_INSET_PX;
/** Broadcast overlay — flush to canvas edges, no safe-area padding. */
export const SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX = SPONSOR_RIBBON_HEIGHT_PX;

const GOLD_BORDER = "rgba(201, 162, 39, 0.45)";
/** Bottom ribbon — slightly faster than LED chyron for readable sponsor names. */
const SPONSOR_RIBBON_PX_PER_SEC = 72;

function buildTickerContentKey(segments: TickerSegment[]): string {
  return segments
    .map((seg) =>
      seg.kind === "bidwar"
        ? `b:${seg.text}`
        : `s:${seg.name}:${seg.typeLabel ?? ""}:${seg.tier}`,
    )
    .join("|");
}

export type TickerSegment =
  | { kind: "sponsor"; name: string; typeLabel?: string; tier: SponsorBroadcastTier }
  | { kind: "bidwar"; text: string };

function resolveSponsorTypeLabel(logo: SponsorLogo): string | undefined {
  const priorityType = resolveSponsorPriorityType(logo);
  if (priorityType === SponsorPriorityType.TITLE) return "Title Sponsor";
  if (priorityType === SponsorPriorityType.CO_SPONSOR) return "Co Sponsor";
  const custom = logo.type?.trim();
  return custom || undefined;
}

function BidWarTickerCredit() {
  return (
    <span style={{ color: BIDWAR_BROADCAST_YELLOW_MUTED }}>
      Powered by{" "}
      <span style={{ color: BIDWAR_BROADCAST_YELLOW, fontWeight: 800 }}>BidWar</span>
    </span>
  );
}

function TickerCopy({
  segments,
  overlay,
  ...rest
}: { segments: TickerSegment[]; overlay?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  const segmentGap = overlay ? 22 : 18;

  return (
    <span
      className={
        overlay
          ? "inline-flex shrink-0 items-center text-lg font-bold tracking-wide text-white/85"
          : "inline-flex shrink-0 items-center text-base md:text-lg lg:text-xl font-bold tracking-wide text-white/85"
      }
      {...rest}
    >
      {segments.map((seg, i) => (
        <span key={i} className="inline-flex items-baseline">
          {seg.kind === "bidwar" ? (
            <BidWarTickerCredit />
          ) : (
            <>
              <span style={getSponsorTickerNameStyle(seg.tier, !!overlay)}>{seg.name}</span>
              {seg.typeLabel ? (
                <span
                  style={{
                    marginLeft: 6,
                    ...getSponsorTickerTypeStyle(seg.tier, !!overlay),
                  }}
                >
                  ({seg.typeLabel})
                </span>
              ) : null}
            </>
          )}
          <span className="text-white/45" style={{ margin: `0 ${segmentGap}px` }}>
            •
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Bottom sponsor ribbon — readable at distance, secondary to player/bid focus.
 * Names only; top-right logo carousel remains the primary sponsor showcase.
 */
/** All sponsors once, then Powered by BidWar — repeats as a block. */
export function buildTickerSegments(
  logos: SponsorLogo[],
  includePoweredByBidWar?: boolean,
): TickerSegment[] {
  const sponsorSegments: TickerSegment[] = getSponsorsByPriority(logos).flatMap((logo) => {
    const name = logo.name?.trim();
    if (!name) return [];
    const typeLabel = resolveSponsorTypeLabel(logo);
    const tier = sponsorBroadcastTier(resolveSponsorPriorityType(logo));
    return [{ kind: "sponsor" as const, name, typeLabel, tier }];
  });

  if (!includePoweredByBidWar) return sponsorSegments;
  if (!sponsorSegments.length) return [{ kind: "bidwar", text: BIDWAR_TICKER_CREDIT }];
  return [...sponsorSegments, { kind: "bidwar", text: BIDWAR_TICKER_CREDIT }];
}

export const SponsorTicker = memo(function SponsorTicker({
  logos,
  includePoweredByBidWar,
  overlay = false,
}: {
  logos: SponsorLogo[];
  /** Kept for API compatibility. */
  themeAccent?: string;
  /** Broadcast Overlay — appends one BidWar credit after all sponsors per cycle. */
  includePoweredByBidWar?: boolean;
  /** 1920×1080 overlay — full-bleed ribbon, no safe-area gutters. */
  overlay?: boolean;
}) {
  const segments = useMemo(
    () => buildTickerSegments(logos, includePoweredByBidWar),
    [logos, includePoweredByBidWar],
  );
  const contentKey = useMemo(() => buildTickerContentKey(segments), [segments]);
  const { measureRef, trackRef, ready } = useSeamlessTicker(contentKey, {
    pxPerSec: SPONSOR_RIBBON_PX_PER_SEC,
  });

  if (!segments.length) return null;

  return (
    <div
      className={`relative z-20 flex-shrink-0 w-full led-display-tv ${overlay ? "" : BROADCAST_SAFE_X}`}
      style={
        overlay
          ? undefined
          : { paddingBottom: `max(${SPONSOR_RIBBON_SAFE_INSET_PX}px, env(safe-area-inset-bottom, 0px))` }
      }
    >
      <div
        className="w-full overflow-hidden bg-black/70 backdrop-blur-sm"
        style={{ borderTop: `2px solid ${GOLD_BORDER}` }}
      >
        <div
          className="relative flex items-center overflow-hidden"
          style={{ height: SPONSOR_RIBBON_HEIGHT_PX }}
        >
          <div
            ref={trackRef}
            className="flex w-max will-change-transform"
            style={{ opacity: ready ? 1 : 0 }}
          >
            <div ref={measureRef} className="shrink-0">
              <TickerCopy segments={segments} overlay={overlay} />
            </div>
            <div className="shrink-0" aria-hidden>
              <TickerCopy segments={segments} overlay={overlay} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
