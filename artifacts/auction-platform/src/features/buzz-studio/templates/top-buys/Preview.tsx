/**
 * Top Buys — Developer Preview
 *
 * FOR DEVELOPMENT / MANUAL TESTING ONLY.
 * - Not routed anywhere
 * - Not exported from the feature barrel
 * - Not used in production
 *
 * Mount this component in a scratch page or Storybook story to validate
 * the three entry-count scenarios (Top 3, Top 5, Top 10) and all
 * design-system fallback paths.
 */

import React, { useState } from "react";
import { TopBuys } from "./TopBuys";
import { demoTop3, demoTop5, demoTop10, ALL_DEMO_SCENARIOS } from "./demo-data";
import {
  BUZZ_EXPORT_DIMENSIONS,
  type BuzzAspectRatio,
} from "../../rendering/buzz-render-context";

const ASPECT_RATIO_OPTIONS: BuzzAspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

export function TopBuysPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<BuzzAspectRatio>("4:5");

  const activeScenario = ALL_DEMO_SCENARIOS[activeIndex];
  const dims = BUZZ_EXPORT_DIMENSIONS[aspectRatio];
  const renderProps = {
    renderMode: "preview" as const,
    aspectRatio,
    renderWidth: dims.width,
    renderHeight: dims.height,
  };

  return (
    <div style={previewStyles.root}>
      <h2 style={previewStyles.heading}>Top Buys — Developer Preview</h2>

      {/* ── Aspect ratio tabs ─────────────────────────────────────────── */}
      <div style={previewStyles.tabRow}>
        {ASPECT_RATIO_OPTIONS.map((ratio) => (
          <button
            key={ratio}
            onClick={() => setAspectRatio(ratio)}
            style={{
              ...previewStyles.tab,
              ...(ratio === aspectRatio ? previewStyles.tabActive : {}),
            }}
          >
            {ratio}
          </button>
        ))}
      </div>

      {/* ── Scenario tabs ───────────────────────────────────────────────── */}
      <div style={previewStyles.tabRow}>
        {ALL_DEMO_SCENARIOS.map((scenario, idx) => (
          <button
            key={scenario.label}
            onClick={() => setActiveIndex(idx)}
            style={{
              ...previewStyles.tab,
              ...(idx === activeIndex ? previewStyles.tabActive : {}),
            }}
          >
            {scenario.label}
          </button>
        ))}
      </div>

      {/* ── Active render ─────────────────────────────────────────────── */}
      <div style={previewStyles.canvasWrapper}>
        <div
          style={{
            ...previewStyles.canvas,
            maxWidth: aspectRatio === "16:9" ? 640 : 420,
          }}
        >
          <TopBuys {...activeScenario.data} {...renderProps} />
        </div>
        <p style={previewStyles.scenarioLabel}>
          Rendering: <strong style={{ color: "#FBBF24" }}>{activeScenario.label}</strong>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <span style={{ color: "rgba(255,255,255,0.4)" }}>
            {activeScenario.data.entries.length} entries
          </span>
        </p>
      </div>

      {/* ── Grid view: all three scenarios side-by-side ──────────────── */}
      <h3 style={previewStyles.sectionHeading}>All Scenarios</h3>
      <div style={previewStyles.grid}>
        {ALL_DEMO_SCENARIOS.map((scenario) => (
          <div key={scenario.label} style={previewStyles.gridItem}>
            <p style={previewStyles.gridLabel}>{scenario.label}</p>
            <div style={previewStyles.gridCanvas}>
              <TopBuys {...scenario.data} {...renderProps} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Preview-only inline styles ─────────────────────────────────────────── */

const previewStyles: Record<string, React.CSSProperties> = {
  root: {
    background: "#030303",
    minHeight: "100vh",
    padding: "32px 24px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#FFFFFF",
  },

  heading: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#FBBF24",
    marginBottom: "20px",
    letterSpacing: "0.04em",
  },

  tabRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },

  tab: {
    padding: "7px 16px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "rgba(255,255,255,0.5)",
    fontSize: "0.8125rem",
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.04em",
    transition: "all 0.15s ease",
  },

  tabActive: {
    background: "rgba(251,191,36,0.12)",
    border: "1px solid rgba(251,191,36,0.35)",
    color: "#FBBF24",
  },

  canvasWrapper: {
    marginBottom: "40px",
  },

  canvas: {
    maxWidth: "420px",
    margin: "0 auto",
  },

  scenarioLabel: {
    textAlign: "center",
    fontSize: "0.75rem",
    color: "rgba(255,255,255,0.35)",
    marginTop: "10px",
    letterSpacing: "0.04em",
  },

  sectionHeading: {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
    marginBottom: "16px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "24px",
  },

  gridItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  gridLabel: {
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    margin: 0,
  },

  gridCanvas: {
    width: "100%",
  },
};
