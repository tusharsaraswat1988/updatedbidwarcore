import { memo, useMemo } from "react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { BIDWAR_BROADCAST_YELLOW } from "@/lib/bidwar-broadcast-colors";
import { buildTickerSegments } from "@/components/display/sponsor-ticker";
import { useSeamlessTicker } from "@/lib/chyron-ticker";
import { getSponsorTickerNameStyle, getSponsorTickerTypeStyle } from "@/lib/sponsor-broadcast-priority-styles";
import { LAB_SPONSOR_RIBBON_HEIGHT_PX, OBS_LAB_FONTS } from "./obs-tokens";

const PX_PER_SEC = 72;
const GOLD_BORDER = "rgba(201, 162, 39, 0.45)";

/**
 * Compact sponsor ribbon for OBS Lab — shorter than production to free camera space.
 */
export const LabSponsorTicker = memo(function LabSponsorTicker({
  logos,
  includePoweredByBidWar,
}: {
  logos: SponsorLogo[];
  includePoweredByBidWar?: boolean;
}) {
  const segments = useMemo(
    () => buildTickerSegments(logos, includePoweredByBidWar, true),
    [logos, includePoweredByBidWar],
  );
  const contentKey = useMemo(
    () =>
      segments
        .map((seg) =>
          seg.kind === "bidwar" ? `b:${seg.text}` : `s:${seg.name}:${seg.typeLabel ?? ""}`,
        )
        .join("|"),
    [segments],
  );
  const { measureRef, trackRef, ready } = useSeamlessTicker(contentKey, {
    pxPerSec: PX_PER_SEC,
  });

  if (!segments.length) return null;

  return (
    <div className="relative z-20 w-full flex-shrink-0">
      <div
        className="w-full overflow-hidden bg-black/75"
        style={{ borderTop: `2px solid ${GOLD_BORDER}` }}
      >
        <div
          className="relative flex items-center overflow-hidden"
          style={{ height: LAB_SPONSOR_RIBBON_HEIGHT_PX }}
        >
          <div
            ref={trackRef}
            className="flex w-max will-change-transform"
            style={{ opacity: ready ? 1 : 0 }}
          >
            <div ref={measureRef} className="shrink-0">
              <LabTickerCopy segments={segments} />
            </div>
            <div className="shrink-0" aria-hidden>
              <LabTickerCopy segments={segments} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function LabTickerCopy({
  segments,
}: {
  segments: ReturnType<typeof buildTickerSegments>;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center text-white/85"
      style={{
        fontFamily: OBS_LAB_FONTS.label,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      {segments.map((seg, i) => (
        <span key={i} className="inline-flex items-baseline">
          {seg.kind === "bidwar" ? (
            <span style={{ color: "rgba(212,175,55,0.75)" }}>
              Powered by{" "}
              <span style={{ color: BIDWAR_BROADCAST_YELLOW, fontWeight: 800 }}>BidWar</span>
            </span>
          ) : (
            <>
              <span style={getSponsorTickerNameStyle(seg.tier, true)}>{seg.name}</span>
              {seg.typeLabel ? (
                <span style={{ marginLeft: 6, ...getSponsorTickerTypeStyle(seg.tier, true) }}>
                  ({seg.typeLabel})
                </span>
              ) : null}
            </>
          )}
          <span className="text-white/45" style={{ margin: "0 18px" }}>
            •
          </span>
        </span>
      ))}
    </span>
  );
}
