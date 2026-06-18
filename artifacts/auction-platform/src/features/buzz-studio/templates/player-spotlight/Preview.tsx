/**
 * Player Spotlight — Developer Preview
 *
 * FOR DEVELOPMENT / MANUAL TESTING ONLY.
 * - Not routed anywhere
 * - Not exported from the feature barrel
 * - Not used in production
 *
 * Mount this component in a scratch page or Storybook story to visually
 * validate all six acceptance-criteria scenarios.
 */

import React, { useState } from "react";
import { PlayerSpotlight } from "./PlayerSpotlight";
import {
  DEMO_NO_IMAGE,
  DEMO_WITH_PLAYER_IMAGE,
  DEMO_FULL_IMAGES,
  DEMO_NAME_ONLY,
  DEMO_KABADDI,
  DEMO_VOLLEYBALL,
  ALL_DEMO_SCENARIOS,
} from "./demo-data";
import type { PlayerSpotlightData } from "./PlayerSpotlight.types";

/* ─── Scenario definitions ───────────────────────────────────────────────── */

const SCENARIOS: { label: string; data: PlayerSpotlightData }[] = [
  { label: "Case 1 — No images (monograms)", data: DEMO_NO_IMAGE },
  { label: "Case 2 — Player image, no team logo", data: DEMO_WITH_PLAYER_IMAGE },
  { label: "Case 3 — Both images", data: DEMO_FULL_IMAGES },
  { label: "Case 4 — Name only", data: DEMO_NAME_ONLY },
  { label: "Case 5 — Kabaddi", data: DEMO_KABADDI },
  { label: "Case 6 — Volleyball", data: DEMO_VOLLEYBALL },
];

/* ─── Preview component ──────────────────────────────────────────────────── */

export function PlayerSpotlightPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = SCENARIOS[activeIndex];

  return (
    <div style={ps.shell}>
      <header style={ps.header}>
        <h2 style={ps.heading}>Player Spotlight — Dev Preview</h2>
        <p style={ps.subheading}>Not a production route. For manual testing only.</p>
      </header>

      {/* Scenario tabs */}
      <div style={ps.tabBar} role="tablist">
        {SCENARIOS.map((s, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === activeIndex}
            onClick={() => setActiveIndex(i)}
            style={{
              ...ps.tab,
              ...(i === activeIndex ? ps.tabActive : {}),
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Single card preview */}
      <div style={ps.singlePreview}>
        <div style={ps.cardWrapper}>
          <PlayerSpotlight {...active.data} />
        </div>
        <pre style={ps.dataInspector}>
          {JSON.stringify(active.data, null, 2)}
        </pre>
      </div>

      {/* Grid: all six scenarios at once */}
      <section style={ps.gridSection}>
        <h3 style={ps.gridHeading}>All Scenarios</h3>
        <div style={ps.grid}>
          {ALL_DEMO_SCENARIOS.map((data, i) => (
            <div key={i} style={ps.gridItem}>
              <p style={ps.gridLabel}>{SCENARIOS[i]?.label ?? `Case ${i + 1}`}</p>
              <PlayerSpotlight {...data} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Preview styles (standalone, not using BuzzTheme) ──────────────────── */

const ps: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "system-ui, sans-serif",
    padding: "24px",
    boxSizing: "border-box",
  },

  header: {
    marginBottom: "24px",
  },

  heading: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#FBBF24",
  },

  subheading: {
    margin: "4px 0 0",
    fontSize: "0.75rem",
    color: "rgba(255,255,255,0.4)",
  },

  tabBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "28px",
  },

  tab: {
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "rgba(255,255,255,0.55)",
    fontSize: "0.75rem",
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    transition: "all 0.15s",
  },

  tabActive: {
    border: "1px solid #FBBF24",
    color: "#FBBF24",
    background: "rgba(251,191,36,0.08)",
  },

  singlePreview: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    marginBottom: "48px",
    alignItems: "start",
  },

  cardWrapper: {
    maxWidth: "420px",
    width: "100%",
  },

  dataInspector: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "0.6875rem",
    color: "rgba(255,255,255,0.55)",
    overflowX: "auto",
    margin: 0,
    lineHeight: 1.6,
  },

  gridSection: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    paddingTop: "32px",
  },

  gridHeading: {
    margin: "0 0 20px",
    fontSize: "1rem",
    fontWeight: 600,
    color: "rgba(255,255,255,0.6)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },

  gridItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  gridLabel: {
    margin: 0,
    fontSize: "0.6875rem",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.04em",
  },
};
