/**
 * OperatorDockV2 — V2 Broadcast Director Control Dock
 *
 * Visual Design: NEW V2 Lovable Design System
 * - Obsidian chassis with gold/cyan accent indicators
 * - V2 button styling with broadcast-appropriate compact sizing
 * - All operator controls in a single docked panel
 *
 * Functional Behaviour: Preserved from cricket-obs-operator-dock.tsx
 * - Collapsed: small RED LIVE pill in bottom-right corner
 * - Expanded: horizontal bar centered at bottom
 * - Collapsible with MINIMIZE button
 * - Shows when ?dock=1 OR ?controls=1 in URL query
 *
 * Controls:
 * - SLATE OVERLAY selector (7 options: camera only, sponsors, standings, upcoming, scorecard, summary, match intro)
 * - ANIMATION TRIGGERS (10 flash types including NEW_BATSMAN)
 * - BROADCAST MESSAGE inline form (set name/details/active)
 *
 * Z-Index: operatorControls (90) — above everything
 *
 * NOTE: Operator dock is ONLY visible when ?dock=1 or ?controls=1 is in the URL.
 * It is never visible to the OBS Browser Source or audience.
 */

import { useState } from "react";
import type { CricketObsFlashKind, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import { OBS_V2 } from "./obs-v2-tokens";

export interface OperatorDockV2Props {
  currentOverlay: CricketObsMidOverlayKind;
  onSetOverlay: (overlay: CricketObsMidOverlayKind) => void;
  onTriggerFlash: (flash: CricketObsFlashKind, detail?: string) => void;
  onSetBroadcastMessage?: (name: string, details: string, active: boolean) => void;
  currentBroadcastMessage?: { name: string; details: string; active: boolean } | null;
}

export function OperatorDockV2({
  currentOverlay,
  onSetOverlay,
  onTriggerFlash,
  onSetBroadcastMessage,
  currentBroadcastMessage,
}: OperatorDockV2Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [msgName, setMsgName] = useState(currentBroadcastMessage?.name ?? "");
  const [msgDetails, setMsgDetails] = useState(currentBroadcastMessage?.details ?? "");

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto"
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
          zIndex: OBS_V2.layer.operatorControls,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          background: OBS_V2.color.carbon,
          border: `1px solid ${OBS_V2.color.brandBorder}`,
          color: OBS_V2.color.brand,
          fontFamily: OBS_V2.typography.family.body,
          fontSize: OBS_V2.typography.scale.label.fontSize,
          fontWeight: 700,
          letterSpacing: OBS_V2.typography.tracking.wider,
          textTransform: "uppercase",
          cursor: "pointer",
          backdropFilter: "blur(12px)",
        }}
        title="Open OBS Operator Director Dock"
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#ef4444",
            display: "inline-block",
            animation: "pulse 2s infinite",
          }}
        />
        OBS DIRECTOR
      </button>
    );
  }

  const overlayOptions: Array<{ id: CricketObsMidOverlayKind; label: string }> = [
    { id: "none", label: "CAMERA ONLY" },
    { id: "sponsors", label: "SPONSORS" },
    { id: "standings", label: "POINTS TABLE" },
    { id: "fixtures", label: "UPCOMING" },
    { id: "scorecard", label: "SCORECARD" },
    { id: "summary", label: "SUMMARY" },
    { id: "intro", label: "MATCH INTRO" },
  ];

  const flashOptions: Array<{ flash: CricketObsFlashKind; label: string; color: string }> = [
    { flash: "FOUR", label: "FOUR", color: OBS_V2.color.brand },
    { flash: "SIX", label: "SIX", color: "#a78bfa" },
    { flash: "SUPERBALL", label: "SUPERBALL", color: OBS_V2.color.warning },
    { flash: "WICKET", label: "WICKET", color: OBS_V2.color.danger },
    { flash: "FREE_HIT", label: "FREE HIT", color: OBS_V2.color.info },
    { flash: "NO_BALL", label: "NO BALL", color: "#fbbf24" },
    { flash: "WIDE", label: "WIDE", color: OBS_V2.color.neutral },
    { flash: "NEW_BATSMAN", label: "NEW BATTER", color: "#34d399" },
    { flash: "TOSS_WIN", label: "TOSS WIN", color: "#f59e0b" },
    { flash: "MATCH_WON", label: "MATCH WON", color: OBS_V2.color.success },
  ];

  const inputStyle: React.CSSProperties = {
    background: OBS_V2.color.panelInset,
    border: `1px solid ${OBS_V2.color.standard}`,
    color: OBS_V2.color.text,
    padding: "4px 8px",
    fontFamily: OBS_V2.typography.family.body,
    fontSize: 12,
    outline: "none",
    flex: 1,
  };

  const btnStyle = (active: boolean, accentColor?: string): React.CSSProperties => ({
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: OBS_V2.typography.family.body,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    background: active ? (accentColor ?? OBS_V2.color.brand) : OBS_V2.color.panelElevated,
    color: active ? (accentColor ? "#000" : OBS_V2.color.brandOn) : OBS_V2.color.textSecondary,
    border: `1px solid ${active ? (accentColor ?? OBS_V2.color.brand) : OBS_V2.color.standard}`,
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  return (
    <aside
      aria-label="V2 OBS broadcast director dock"
      style={{
        position: "fixed",
        bottom: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: OBS_V2.layer.operatorControls,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "rgba(5, 5, 7, 0.96)",
        border: `1px solid ${OBS_V2.color.strong}`,
        backdropFilter: "blur(16px)",
        padding: 12,
        boxShadow: OBS_V2.depth.shadow.hero,
        maxWidth: 1000,
        fontFamily: OBS_V2.typography.family.body,
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ borderBottom: `1px solid ${OBS_V2.color.divider}`, paddingBottom: 8 }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }}
          />
          <span
            style={{
              ...OBS_V2.typography.scale.label,
              color: OBS_V2.color.brand,
              letterSpacing: OBS_V2.typography.tracking.widest,
            }}
          >
            BIDWAR CRICKET V2 OBS DIRECTOR
          </span>
          <span style={{ fontSize: 10, color: OBS_V2.color.textMuted }}>· OPERATOR CONTROLS</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          style={{
            ...btnStyle(false),
            color: OBS_V2.color.textMuted,
          }}
        >
          MINIMIZE
        </button>
      </div>

      {/* Row 1: Overlay Slates */}
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 10, fontWeight: 700, color: OBS_V2.color.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginRight: 4 }}>
          SLATE:
        </span>
        {overlayOptions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSetOverlay(item.id)}
            style={btnStyle(currentOverlay === item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Row 2: Flash Triggers */}
      <div
        className="flex items-center gap-1.5 flex-wrap"
        style={{ borderTop: `1px solid ${OBS_V2.color.hairline}`, paddingTop: 8 }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: OBS_V2.color.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginRight: 4 }}>
          FLASH:
        </span>
        {flashOptions.map((item) => (
          <button
            key={item.flash}
            type="button"
            onClick={() => onTriggerFlash(item.flash)}
            style={{
              ...btnStyle(false),
              color: item.color,
              borderColor: `${item.color}60`,
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Row 3: Broadcast Message */}
      {onSetBroadcastMessage && (
        <div
          className="flex items-center gap-2 flex-wrap"
          style={{ borderTop: `1px solid ${OBS_V2.color.hairline}`, paddingTop: 8 }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: OBS_V2.color.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginRight: 4 }}>
            MSG:
          </span>
          <input
            type="text"
            placeholder="Name / Title"
            value={msgName}
            onChange={(e) => setMsgName(e.target.value)}
            style={{ ...inputStyle, maxWidth: 180 }}
          />
          <input
            type="text"
            placeholder="Details / Description"
            value={msgDetails}
            onChange={(e) => setMsgDetails(e.target.value)}
            style={{ ...inputStyle, maxWidth: 240 }}
          />
          <button
            type="button"
            onClick={() => onSetBroadcastMessage(msgName, msgDetails, true)}
            disabled={!msgName.trim()}
            style={{
              ...btnStyle(currentBroadcastMessage?.active ?? false, OBS_V2.color.info),
              opacity: msgName.trim() ? 1 : 0.4,
              color: OBS_V2.color.info,
              borderColor: OBS_V2.color.infoBorder,
            }}
          >
            SHOW
          </button>
          <button
            type="button"
            onClick={() => onSetBroadcastMessage("", "", false)}
            style={{ ...btnStyle(false, OBS_V2.color.danger), color: OBS_V2.color.danger, borderColor: OBS_V2.color.dangerBorder }}
          >
            HIDE
          </button>
        </div>
      )}
    </aside>
  );
}
