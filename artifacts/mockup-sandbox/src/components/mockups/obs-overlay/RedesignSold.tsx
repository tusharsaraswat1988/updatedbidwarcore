/**
 * OBS Overlay — Redesign: SOLD moment (hex photo retained, Bebas headline).
 */
import { FONTS, SAMPLE, YELLOW, YELLOW_BORDER } from "./_tokens";
import { CameraBackdrop, GrainOverlay, HexPhoto, SponsorRibbon, TeamTicker } from "./_primitives";

export function RedesignSold() {
  const accent = SAMPLE.teamColor;

  return (
    <CameraBackdrop>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Dimmed lower third underneath */}
        <div style={{ position: "absolute", bottom: 118, left: 0, right: 0, opacity: 0.25, filter: "blur(1px)" }}>
          <div style={{ height: 140, background: "rgba(0,0,0,0.94)", borderTop: `3px solid ${accent}` }} />
        </div>

        {/* SOLD banner — slides up full width */}
        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 0,
            right: 0,
            zIndex: 40,
            borderTop: `5px solid ${accent}`,
            boxShadow: `0 -12px 80px ${accent}55`,
            background: `linear-gradient(135deg, rgba(0,0,0,0.98) 0%, ${accent}22 55%, rgba(0,0,0,0.96) 100%)`,
            padding: "32px 48px",
            display: "flex",
            alignItems: "center",
            gap: 40,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 88,
              color: accent,
              letterSpacing: "0.06em",
              textShadow: `0 0 50px ${accent}`,
              flexShrink: 0,
              lineHeight: 0.9,
            }}
          >
            SOLD
          </div>

          <HexPhoto size={140} color={accent} glow />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 700,
                color: accent,
                letterSpacing: "0.35em",
                marginBottom: 6,
              }}
            >
              AUCTION RESULT
            </div>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 64,
                color: "#fff",
                lineHeight: 0.95,
                letterSpacing: "0.02em",
              }}
            >
              {SAMPLE.player}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: FONTS.body,
                fontSize: 18,
                fontWeight: 600,
                color: "rgba(255,255,255,0.65)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Acquired by {SAMPLE.team}
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.28em",
                marginBottom: 6,
              }}
            >
              SOLD FOR
            </div>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 88,
                lineHeight: 0.9,
                color: accent,
                textShadow: `0 0 40px ${accent}88`,
              }}
            >
              {SAMPLE.bid}
            </div>
            <div
              style={{
                marginTop: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${YELLOW_BORDER}`,
                background: "rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: accent,
                  fontFamily: FONTS.display,
                  fontSize: 12,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                MW
              </div>
              <span style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 700, color: YELLOW }}>
                {SAMPLE.team}
              </span>
            </div>
          </div>
        </div>

        {/* Top-left brand (persistent) */}
        <div style={{ position: "absolute", top: 32, left: 40, zIndex: 35 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.72)",
              border: `1px solid ${YELLOW_BORDER}`,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: YELLOW,
                display: "grid",
                placeItems: "center",
                fontFamily: FONTS.display,
                fontSize: 14,
                color: "#0a0a0a",
                fontStyle: "italic",
              }}
            >
              BW
            </div>
            <span style={{ fontFamily: FONTS.display, fontSize: 22, letterSpacing: "0.18em", color: "#fff" }}>
              BIDWAR
            </span>
          </div>
        </div>

        <TeamTicker redesign />
        <SponsorRibbon gold />
        <GrainOverlay />
      </div>
    </CameraBackdrop>
  );
}

export default function Preview() {
  return (
    <div style={{ width: "100vw", minHeight: "100vh", background: "#050505", display: "grid", placeItems: "center" }}>
      <div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
        <RedesignSold />
      </div>
    </div>
  );
}
