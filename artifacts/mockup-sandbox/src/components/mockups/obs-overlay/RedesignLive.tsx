/**
 * OBS Overlay — Redesign: Live bidding (audit P0–P4).
 * Barlow + Bebas, BidWar yellow anchor, top-left brand, diagonal accent, grain.
 */
import { FONTS, SAMPLE, YELLOW, YELLOW_BORDER, YELLOW_SOFT } from "./_tokens";
import { CameraBackdrop, GrainOverlay, HexPhoto, SponsorRibbon, TeamTicker } from "./_primitives";

export function RedesignLive() {
  const bidColor = SAMPLE.teamColor;

  return (
    <CameraBackdrop>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top-left brand stack */}
        <div style={{ position: "absolute", top: 32, left: 40, zIndex: 35, display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(12px)",
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
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: 22,
                letterSpacing: "0.18em",
                color: "#fff",
              }}
            >
              BIDWAR
            </span>
          </div>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: FONTS.body,
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              maxWidth: 220,
            }}
          >
            {SAMPLE.tournament}
          </div>
        </div>

        {/* Sponsors — top right only */}
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 40,
            display: "flex",
            gap: 10,
            padding: "8px 14px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.7)",
            border: `1px solid ${YELLOW_BORDER}`,
          }}
        >
          {["Dream11", "Jio", "CEAT"].map((s) => (
            <span
              key={s}
              style={{
                fontFamily: FONTS.display,
                fontSize: 16,
                letterSpacing: "0.12em",
                color: s === "Dream11" ? "#ef4444" : "rgba(255,255,255,0.85)",
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Lower third — redesigned */}
        <div style={{ position: "absolute", bottom: 118, left: 0, right: 0, zIndex: 30 }}>
          <div
            style={{
              height: 64,
              background: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.65))`,
            }}
          />

          <div
            style={{
              position: "relative",
              background: "linear-gradient(180deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.92) 100%)",
              borderTop: `4px solid ${YELLOW}`,
              boxShadow: `0 -8px 48px ${YELLOW_SOFT}, 0 -2px 0 ${bidColor}88 inset`,
              padding: "20px 48px 22px",
              display: "flex",
              alignItems: "center",
              gap: 36,
              overflow: "hidden",
            }}
          >
            {/* Diagonal gold slash */}
            <div
              style={{
                position: "absolute",
                left: 180,
                top: -20,
                bottom: -20,
                width: 6,
                background: `linear-gradient(180deg, transparent, ${YELLOW}, transparent)`,
                transform: "skewX(-12deg)",
                opacity: 0.55,
              }}
            />
            {/* Ambient team glow */}
            <div
              style={{
                position: "absolute",
                right: 120,
                top: 0,
                bottom: 0,
                width: 420,
                background: `radial-gradient(ellipse at 80% 50%, ${bidColor}18 0%, transparent 70%)`,
                pointerEvents: "none",
              }}
            />

            <HexPhoto size={128} color={YELLOW} glow />

            <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: YELLOW,
                    boxShadow: `0 0 10px ${YELLOW}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    color: YELLOW,
                    letterSpacing: "0.35em",
                  }}
                >
                  LIVE AUCTION
                </span>
              </div>

              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 72,
                  color: "#fff",
                  lineHeight: 0.95,
                  letterSpacing: "0.02em",
                  textShadow: "0 4px 24px rgba(0,0,0,0.9)",
                }}
              >
                {SAMPLE.player}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontFamily: FONTS.display,
                    fontSize: 14,
                    letterSpacing: "0.14em",
                    background: YELLOW,
                    color: "#0a0a0a",
                  }}
                >
                  {SAMPLE.tag}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 16,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.75)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {SAMPLE.role} · {SAMPLE.city}
                </span>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 14px",
                  borderLeft: `3px solid ${YELLOW}`,
                  background: YELLOW_SOFT,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    color: YELLOW,
                    letterSpacing: "0.2em",
                  }}
                >
                  BASE
                </span>
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 22,
                    color: "#fff",
                    letterSpacing: "0.04em",
                  }}
                >
                  {SAMPLE.base}
                </span>
              </div>
            </div>

            <div
              style={{
                width: 2,
                height: 100,
                background: `linear-gradient(180deg, transparent, ${YELLOW_BORDER}, transparent)`,
                flexShrink: 0,
              }}
            />

            <div style={{ textAlign: "right", flexShrink: 0, position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  color: YELLOW_MUTED,
                  letterSpacing: "0.28em",
                  marginBottom: 4,
                }}
              >
                LEADING BID
              </div>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 96,
                  lineHeight: 0.9,
                  color: "#fff",
                  letterSpacing: "0.01em",
                  textShadow: `0 0 40px ${bidColor}66, 0 4px 0 ${bidColor}`,
                }}
              >
                {SAMPLE.bid}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 14px",
                  borderRadius: 6,
                  borderLeft: `4px solid ${bidColor}`,
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: bidColor,
                    fontFamily: FONTS.display,
                    fontSize: 11,
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  MW
                </div>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.9)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {SAMPLE.team}
                </span>
              </div>
            </div>

            <div
              style={{
                width: 2,
                height: 100,
                background: `linear-gradient(180deg, transparent, ${YELLOW_BORDER}, transparent)`,
                flexShrink: 0,
              }}
            />

            {/* Timer — larger, yellow-accented */}
            <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
              <svg width={88} height={88} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={44} cy={44} r={36} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
                <circle
                  cx={44}
                  cy={44}
                  r={36}
                  fill="none"
                  stroke={YELLOW}
                  strokeWidth={5}
                  strokeDasharray="150 226"
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 8px ${YELLOW})` }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 36,
                    color: YELLOW,
                    lineHeight: 1,
                  }}
                >
                  {SAMPLE.timer}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 8,
                    color: "rgba(255,255,255,0.4)",
                    letterSpacing: "0.2em",
                  }}
                >
                  SEC
                </span>
              </div>
            </div>
          </div>
        </div>

        <TeamTicker redesign />
        <SponsorRibbon gold />
        <GrainOverlay />
      </div>
    </CameraBackdrop>
  );
}

const YELLOW_MUTED = "rgba(255, 196, 0, 0.75)";

export default function Preview() {
  return (
    <div style={{ width: "100vw", minHeight: "100vh", background: "#050505", display: "grid", placeItems: "center" }}>
      <div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
        <RedesignLive />
      </div>
    </div>
  );
}
