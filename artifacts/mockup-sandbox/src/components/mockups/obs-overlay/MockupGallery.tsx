/**
 * OBS Overlay — Full mockup gallery: current vs redesign (live + sold).
 * Open via mockup sandbox: /preview/obs-overlay/MockupGallery
 */
import { FONTS, YELLOW } from "./_tokens";
import { MockupFrame } from "./_primitives";
import { CurrentBaseline } from "./CurrentBaseline";
import { RedesignLive } from "./RedesignLive";
import { RedesignSold } from "./RedesignSold";

const CALLOUTS = [
  { title: "Typography", current: "Inter body + weight-900 numbers", next: "Barlow Condensed labels + Bebas Neue bids" },
  { title: "Brand color", current: "Cyan base value, red LIVE pill", next: "BidWar yellow (#FFC400) anchors chrome" },
  { title: "Brand mark", current: "Top-center, competes with face cam", next: "Top-left stack with tournament name" },
  { title: "Player photo", current: "Hex live · rounded rect on SOLD", next: "Hex retained across all states" },
  { title: "Atmosphere", current: "Flat rgba panels", next: "Grain, diagonal slash, ambient team glow" },
] as const;

export function MockupGallery() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(165deg, #08080a 0%, #0f0e0c 40%, #08080a 100%)",
        color: "#fff",
        fontFamily: FONTS.body,
        padding: "48px 40px 80px",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;600;700;900&display=swap"
      />

      {/* Header */}
      <header style={{ maxWidth: 1100, marginBottom: 48 }}>
        <p
          style={{
            margin: 0,
            fontFamily: FONTS.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.35em",
            color: YELLOW,
            textTransform: "uppercase",
          }}
        >
          BidWar Broadcast Overlay
        </p>
        <h1
          style={{
            margin: "12px 0 16px",
            fontFamily: FONTS.display,
            fontSize: 56,
            fontWeight: 400,
            letterSpacing: "0.04em",
            lineHeight: 0.95,
          }}
        >
          OBS AUCTION SCREEN — VISUAL MOCKUPS
        </h1>
        <p style={{ margin: 0, fontSize: 18, color: "rgba(255,255,255,0.55)", maxWidth: 720, lineHeight: 1.5 }}>
          Industrial sports broadcast direction aligned with LED display typography (Barlow + Bebas).
          Camera-safe 1920×1080 frames — transparent center preserved for stream compositing.
        </p>
      </header>

      {/* Side-by-side: Current vs Redesign Live */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontFamily: FONTS.display,
            fontSize: 28,
            letterSpacing: "0.12em",
            color: YELLOW,
            marginBottom: 24,
          }}
        >
          01 — LIVE BIDDING
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))",
            gap: 40,
            alignItems: "start",
          }}
        >
          <MockupFrame label="Current production" badge="Current" sublabel="obs-overlay.tsx today">
            <CurrentBaseline />
          </MockupFrame>
          <MockupFrame label="Proposed redesign" badge="Proposed" sublabel="P0–P4 from design audit">
            <RedesignLive />
          </MockupFrame>
        </div>
      </section>

      {/* Sold state */}
      <section style={{ marginBottom: 56 }}>
        <h2
          style={{
            fontFamily: FONTS.display,
            fontSize: 28,
            letterSpacing: "0.12em",
            color: YELLOW,
            marginBottom: 24,
          }}
        >
          02 — SOLD MOMENT
        </h2>
        <MockupFrame
          label="Proposed SOLD banner"
          badge="Proposed"
          sublabel="Hex photo + Bebas headline + team-color wash"
          scale={0.62}
        >
          <RedesignSold />
        </MockupFrame>
      </section>

      {/* Change summary */}
      <section
        style={{
          maxWidth: 900,
          padding: "32px 36px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h2
          style={{
            fontFamily: FONTS.display,
            fontSize: 24,
            letterSpacing: "0.1em",
            marginTop: 0,
            marginBottom: 20,
          }}
        >
          DESIGN DELTA
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {CALLOUTS.map((row) => (
            <div
              key={row.title}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 1fr",
                gap: 16,
                alignItems: "baseline",
                paddingBottom: 14,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontWeight: 700, color: YELLOW, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {row.title}
              </span>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>{row.current}</span>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)" }}>{row.next}</span>
            </div>
          ))}
        </div>
      </section>

      <p style={{ marginTop: 40, fontSize: 13, color: "rgba(255,255,255,0.3)", fontFamily: FONTS.mono }}>
        Individual previews: /preview/obs-overlay/CurrentBaseline · RedesignLive · RedesignSold
      </p>
    </div>
  );
}

export default MockupGallery;
