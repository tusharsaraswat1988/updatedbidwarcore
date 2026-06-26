import type { CSSProperties, ReactNode } from "react";
import { BH, BW, FONTS, YELLOW, YELLOW_BORDER, YELLOW_SOFT } from "./_tokens";

const HEX = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

/** Simulated camera feed behind transparent overlay chrome. */
export function CameraBackdrop({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: BW,
        height: BH,
        position: "relative",
        overflow: "hidden",
        background: "#0a0a0a",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 55% at 50% 42%, rgba(60,80,120,0.35) 0%, transparent 65%),
            linear-gradient(180deg, #1a2030 0%, #0d1118 45%, #15100a 100%)
          `,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          transform: "translate(-50%, -50%)",
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,220,180,0.18) 0%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}

export function HexPhoto({
  size = 110,
  color = YELLOW,
  initials = "VK",
  glow = true,
}: {
  size?: number;
  color?: string;
  initials?: string;
  glow?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: size, height: size * 1.08, flexShrink: 0 }}>
      {glow ? (
        <div
          style={{
            position: "absolute",
            inset: -3,
            clipPath: HEX,
            background: color,
            filter: "blur(8px)",
            opacity: 0.75,
          }}
        />
      ) : null}
      <div style={{ position: "absolute", inset: -2, clipPath: HEX, background: color, opacity: 0.9 }} />
      <div
        style={{
          position: "absolute",
          inset: 3,
          clipPath: HEX,
          background: `linear-gradient(135deg, #0d0d0d 0%, ${color}22 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONTS.display,
          fontSize: size * 0.38,
          color,
          letterSpacing: "0.05em",
        }}
      >
        {initials}
      </div>
    </div>
  );
}

export function SponsorRibbon({ gold = true }: { gold?: boolean }) {
  const border = gold ? YELLOW_BORDER : "rgba(255,255,255,0.08)";
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: "rgba(0,0,0,0.72)",
        borderTop: `2px solid ${border}`,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        zIndex: 25,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 48,
          paddingLeft: 48,
          whiteSpace: "nowrap",
          fontFamily: FONTS.body,
          fontSize: 18,
          fontWeight: 700,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: "0.04em",
        }}
      >
        {["Dream11", "Powered by BidWar", "Jio", "Powered by BidWar", "CEAT"].map((s, i) => (
          <span key={i} style={{ color: s.includes("BidWar") ? YELLOW_MUTED : undefined }}>
            {s}
            <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: 48 }}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const YELLOW_MUTED = "rgba(255, 196, 0, 0.75)";

export function TeamTicker({ redesign }: { redesign?: boolean }) {
  const teams = [
    { name: "Mumbai Warriors", taken: 8, due: 4, color: "#3b82f6" },
    { name: "Delhi Strikers", taken: 6, due: 6, color: "#ef4444" },
    { name: "Chennai Kings", taken: 9, due: 3, color: "#fbbf24" },
    { name: "Royal Challengers", taken: 5, due: 7, color: "#8b5cf6" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: 0,
        right: 0,
        height: 46,
        background: redesign ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.82)",
        borderTop: `1px solid ${redesign ? YELLOW_BORDER : "rgba(255,255,255,0.08)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        zIndex: 22,
        fontFamily: redesign ? FONTS.mono : FONTS.current,
      }}
    >
      {teams.map((t) => (
        <div
          key={t.name}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "0 28px",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.name}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: redesign ? YELLOW : t.color }}>
            {t.taken} taken
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>· {t.due} due</span>
        </div>
      ))}
    </div>
  );
}

export function MockupFrame({
  label,
  sublabel,
  badge,
  scale = 0.52,
  children,
}: {
  label: string;
  sublabel?: string;
  badge?: string;
  scale?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3
          style={{
            margin: 0,
            fontFamily: FONTS.body,
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </h3>
        {badge ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 6,
              background: badge === "Current" ? "rgba(255,255,255,0.08)" : YELLOW_SOFT,
              color: badge === "Current" ? "rgba(255,255,255,0.55)" : YELLOW,
              border: `1px solid ${badge === "Current" ? "rgba(255,255,255,0.12)" : YELLOW_BORDER}`,
            }}
          >
            {badge}
          </span>
        ) : null}
        {sublabel ? (
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: FONTS.body }}>
            {sublabel}
          </span>
        ) : null}
      </div>
      <div
        style={{
          width: BW * scale,
          height: BH * scale,
          overflow: "hidden",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: BW, height: BH }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function GrainOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: 0.055,
        zIndex: 40,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

export function panelStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: "rgba(0,0,0,0.94)",
    ...extra,
  };
}
