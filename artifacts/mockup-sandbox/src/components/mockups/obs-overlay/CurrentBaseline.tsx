/**
 * OBS Overlay — Current baseline (faithful to obs-overlay.tsx audit snapshot).
 * Inter typography, cyan base value, top-center brand, red LIVE pill.
 */
import { FONTS, SAMPLE } from "./_tokens";
import { CameraBackdrop, HexPhoto, SponsorRibbon, TeamTicker } from "./_primitives";

export function CurrentBaseline() {
  const bidColor = SAMPLE.teamColor;

  return (
    <CameraBackdrop>
      <div
        style={{
          position: "absolute",
          inset: 0,
          fontFamily: FONTS.current,
          pointerEvents: "none",
        }}
      >
        {/* Brand — top center */}
        <div
          style={{
            position: "absolute",
            top: 32,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span style={{ fontWeight: 900, fontSize: 14, color: "#fff", letterSpacing: "0.2em" }}>
            BIDWAR
          </span>
        </div>

        {/* Tournament logo — top left */}
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 40,
            padding: "8px 14px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div
            style={{
              height: 60,
              width: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 18,
              color: "#f59e0b",
            }}
          >
            IPL
          </div>
        </div>

        {/* LIVE + sponsor — top right */}
        <div style={{ position: "absolute", top: 36, right: 40, display: "flex", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(239,68,68,0.9)",
              borderRadius: 8,
              padding: "6px 14px",
              boxShadow: "0 0 20px rgba(239,68,68,0.5)",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.2em" }}>LIVE</span>
          </div>
          <div
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.75)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 13,
              fontWeight: 700,
              color: "#ef4444",
            }}
          >
            Dream11
          </div>
        </div>

        {/* Lower third */}
        <div style={{ position: "absolute", bottom: 118, left: 0, right: 0, zIndex: 30 }}>
          <div
            style={{
              height: 48,
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))",
            }}
          />
          <div
            style={{
              background: "rgba(0,0,0,0.94)",
              borderTop: `3px solid ${bidColor}`,
              boxShadow: `0 -4px 40px ${bidColor}33`,
              padding: "18px 48px",
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
          >
            <HexPhoto size={110} color={bidColor} glow />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", letterSpacing: "0.25em" }}>
                  LIVE AUCTION
                </span>
              </div>
              <div
                style={{
                  fontSize: 54,
                  fontWeight: 900,
                  color: "#fff",
                  lineHeight: 1.05,
                  textTransform: "uppercase",
                  textShadow: "0 2px 8px rgba(0,0,0,0.9)",
                }}
              >
                {SAMPLE.player}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  marginTop: 8,
                  padding: "4px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  background: "rgba(168,85,247,0.2)",
                  border: "1.5px solid rgba(168,85,247,0.5)",
                  color: "#c084fc",
                }}
              >
                {SAMPLE.tag}
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 5 }}>
                {SAMPLE.role} · {SAMPLE.city}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(0,212,255,0.12)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  borderRadius: 6,
                  padding: "4px 14px",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff" }} />
                <span style={{ fontSize: 11, color: "#00d4ff", fontWeight: 700, letterSpacing: "0.15em" }}>
                  BASE VALUE
                </span>
                <span style={{ fontSize: 14, color: "#fff", fontWeight: 800, fontFamily: "monospace" }}>
                  {SAMPLE.base}
                </span>
              </div>
            </div>

            <div style={{ width: 1, height: 90, background: "rgba(255,255,255,0.08)" }} />

            <div style={{ textAlign: "right", minWidth: 280 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", letterSpacing: "0.15em", marginBottom: 2 }}>
                LEADING BID
              </div>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 900,
                  color: bidColor,
                  lineHeight: 1,
                  filter: `drop-shadow(0 0 12px ${bidColor}88)`,
                }}
              >
                {SAMPLE.bid}
              </div>
              <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
                {SAMPLE.team}
              </div>
            </div>

            <div style={{ width: 1, height: 90, background: "rgba(255,255,255,0.08)" }} />

            {/* Timer ring */}
            <div style={{ position: "relative", width: 68, height: 68 }}>
              <svg width={68} height={68} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={34} cy={34} r={28} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
                <circle
                  cx={34}
                  cy={34}
                  r={28}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={4}
                  strokeDasharray="120 176"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#22c55e",
                }}
              >
                {SAMPLE.timer}
              </div>
            </div>
          </div>
        </div>

        <TeamTicker />
        <SponsorRibbon gold={false} />
      </div>
    </CameraBackdrop>
  );
}

export default function Preview() {
  return (
    <div style={{ width: "100vw", minHeight: "100vh", background: "#050505", display: "grid", placeItems: "center" }}>
      <div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
        <CurrentBaseline />
      </div>
    </div>
  );
}
