import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { useSeamlessTicker } from "@/lib/chyron-ticker";
import { TEAM_TICKER_HEIGHT_PX } from "./obs-tokens";

export type TeamTickerRow = {
  name: string;
  shortCode: string;
  color: string | null;
  logoUrl?: string | null;
  playersBought: number;
  playersDue: number | null;
};

const TEAM_TICKER_PX_PER_SEC = 50;

function TeamTickerItem({ t }: { t: TeamTickerRow }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "0 28px",
        height: "100%",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    >
      {t.logoUrl ? (
        <img
          src={cldUrl(t.logoUrl, "teamLogo")}
          alt=""
          style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: t.color || "#666",
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
        {t.name}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: t.color || "#F59E0B",
          fontFamily: "monospace",
        }}
      >
        {t.playersBought} taken
      </span>
      {t.playersDue !== null && (
        <>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>·</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.55)",
              fontFamily: "monospace",
            }}
          >
            {t.playersDue > 0 ? `${t.playersDue} due` : "full"}
          </span>
        </>
      )}
    </div>
  );
}

export const TeamTicker = memo(function TeamTicker({ teams }: { teams: TeamTickerRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  const contentKey = useMemo(
    () =>
      teams
        .map((t) => `${t.shortCode}:${t.name}:${t.playersBought}:${t.playersDue ?? ""}`)
        .join("|"),
    [teams],
  );

  const { measureRef, trackRef, ready } = useSeamlessTicker(contentKey, {
    enabled: needsScroll && teams.length > 0,
    pxPerSec: TEAM_TICKER_PX_PER_SEC,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      setNeedsScroll(measure.scrollWidth > container.clientWidth + 2);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [teams, measureRef]);

  return (
    <div
      ref={containerRef}
      style={{
        height: TEAM_TICKER_HEIGHT_PX,
        background: "rgba(0,0,0,0.82)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          width: needsScroll ? undefined : "100%",
          justifyContent: needsScroll ? undefined : "center",
          whiteSpace: "nowrap",
          opacity: needsScroll ? (ready ? 1 : 0) : 1,
          willChange: needsScroll ? "transform" : undefined,
        }}
      >
        <div
          ref={measureRef}
          style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
        >
          {teams.map((t, i) => (
            <TeamTickerItem key={`copy-a-${i}`} t={t} />
          ))}
        </div>
        {needsScroll ? (
          <div aria-hidden style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
            {teams.map((t, i) => (
              <TeamTickerItem key={`copy-b-${i}`} t={t} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});
