import { memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BROADCAST_OVERLAY_PANEL_PADDING_X } from "@/lib/broadcast-overlay";
import type { TeamOverviewModel } from "../director/context-resolver";
import { OBS_BID_PANEL } from "./obs-tokens";

const TEAM_CYCLE_MS = 4500;

type TeamLowerThirdProps = {
  model: TeamOverviewModel;
  bottomOffset: number;
  teamIndexById: Map<number, number>;
  teamModelsById: Map<number, TeamOverviewModel>;
};

export const TeamLowerThird = memo(function TeamLowerThird({
  model,
  bottomOffset,
  teamIndexById,
  teamModelsById,
}: TeamLowerThirdProps) {
  const [cycleIndex, setCycleIndex] = useState(() => teamIndexById.get(model.teamId) ?? 0);

  useEffect(() => {
    if (!model.cycleTeams || model.teamIds.length <= 1) return;
    const timer = window.setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % model.teamIds.length);
    }, TEAM_CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [model.cycleTeams, model.teamIds.length]);

  useEffect(() => {
    if (!model.cycleTeams) {
      setCycleIndex(teamIndexById.get(model.teamId) ?? 0);
    }
  }, [model.cycleTeams, model.teamId, teamIndexById]);

  const activeTeamId = model.cycleTeams
    ? model.teamIds[cycleIndex % model.teamIds.length]
    : model.teamId;
  const active = teamModelsById.get(activeTeamId) ?? model;
  const accent = active.accentColor;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={active.teamId}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "absolute",
          bottom: bottomOffset,
          left: 0,
          right: 0,
          zIndex: 30,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 24,
            background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            background: "rgba(0,0,0,0.94)",
            borderTop: `3px solid ${accent}`,
            boxShadow: `0 -4px 36px ${accent}33`,
            padding: `${OBS_BID_PANEL.paddingY}px ${BROADCAST_OVERLAY_PANEL_PADDING_X}px`,
            display: "flex",
            alignItems: "center",
            gap: OBS_BID_PANEL.contentGap,
          }}
        >
          <div
            style={{
              width: OBS_BID_PANEL.hexSize,
              height: OBS_BID_PANEL.hexSize,
              borderRadius: 12,
              background: `${accent}18`,
              border: `2px solid ${accent}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {active.logoSrc ? (
              <img
                src={active.logoSrc}
                alt=""
                style={{ width: "72%", height: "72%", objectFit: "contain" }}
              />
            ) : (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: accent,
                  fontFamily: "monospace",
                }}
              >
                {active.shortCode.slice(0, 3)}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: OBS_BID_PANEL.statusFont,
                fontWeight: 700,
                letterSpacing: "0.28em",
                color: accent,
                marginBottom: 4,
              }}
            >
              TEAM OVERVIEW
            </div>
            <div
              style={{
                fontSize: OBS_BID_PANEL.nameFont,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textTransform: "uppercase",
              }}
            >
              {active.name}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 18px",
                fontSize: OBS_BID_PANEL.metaFont,
                color: "rgba(255,255,255,0.78)",
              }}
            >
              <Stat label="Remaining Purse" value={active.remainingPurseLabel} accent={accent} />
              <Stat label="Players Bought" value={active.playersBoughtLabel} accent={accent} />
              {active.captainName ? (
                <Stat label="Captain" value={active.captainName} accent={accent} />
              ) : null}
              {active.coachName ? (
                <Stat label="Coach" value={active.coachName} accent={accent} />
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.42)",
        }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export function useTeamOverviewMaps(models: TeamOverviewModel[]) {
  return useMemo(() => {
    const teamModelsById = new Map(models.map((m) => [m.teamId, m]));
    const teamIndexById = new Map(models.map((m, idx) => [m.teamId, idx]));
    return { teamModelsById, teamIndexById };
  }, [models]);
}
