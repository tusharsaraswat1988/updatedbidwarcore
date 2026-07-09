import { memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
} from "@/lib/bidwar-broadcast-colors";
import type { TeamOverviewModel } from "../director/context-resolver";
import { OBS_LAB_FONTS } from "./obs-tokens";

/** Max teams visible in one strip page. */
export const TEAM_STRIP_PAGE_SIZE = 6;
/** Minimum hold per page of up to 6 teams. */
export const TEAM_STRIP_PAGE_MS = 8000;

const GOLD = BIDWAR_BROADCAST_YELLOW;
const GOLD_BORDER = BIDWAR_BROADCAST_YELLOW_BORDER;

type TeamLowerThirdProps = {
  model: TeamOverviewModel;
  bottomOffset: number;
  teamIndexById: Map<number, number>;
  teamModelsById: Map<number, TeamOverviewModel>;
};

function pageScale(count: number) {
  if (count <= 3) {
    return { logo: 56, name: 20, purse: 22, meta: 13, pad: "12px 14px", gap: 12 };
  }
  if (count <= 4) {
    return { logo: 48, name: 17, purse: 19, meta: 12, pad: "10px 12px", gap: 10 };
  }
  if (count === 5) {
    return { logo: 44, name: 15, purse: 17, meta: 11, pad: "10px 10px", gap: 8 };
  }
  return { logo: 40, name: 14, purse: 16, meta: 11, pad: "9px 8px", gap: 8 };
}

function TeamStripCard({
  team,
  count,
}: {
  team: TeamOverviewModel;
  count: number;
}) {
  const s = pageScale(count);
  const accent = team.accentColor;

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: s.gap,
        padding: s.pad,
        background: `linear-gradient(90deg, ${accent}18 0%, rgba(255,255,255,0.03) 55%, transparent 100%)`,
        border: `1px solid ${accent}44`,
        borderRadius: 4,
      }}
    >
      <div
        style={{
          width: s.logo,
          height: s.logo,
          borderRadius: 10,
          background: `${accent}22`,
          border: `2px solid ${accent}77`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {team.logoSrc ? (
          <img
            src={team.logoSrc}
            alt=""
            style={{ width: "72%", height: "72%", objectFit: "contain" }}
          />
        ) : (
          <span
            style={{
              fontFamily: OBS_LAB_FONTS.display,
              fontSize: Math.round(s.logo * 0.38),
              color: accent,
              lineHeight: 1,
            }}
          >
            {team.shortCode.slice(0, 3)}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{
            fontFamily: OBS_LAB_FONTS.display,
            fontSize: s.name,
            fontWeight: 400,
            color: "#fff",
            lineHeight: 1.05,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
          title={team.name}
        >
          {team.name}
        </div>

        <div
          style={{
            fontFamily: OBS_LAB_FONTS.display,
            fontSize: s.purse,
            fontWeight: 400,
            color: accent,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {team.remainingPurseLabel}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2px 10px",
            fontFamily: OBS_LAB_FONTS.label,
            fontSize: s.meta,
            fontWeight: 600,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          <span>
            <span style={{ color: "rgba(255,255,255,0.4)", marginRight: 4 }}>SQUAD</span>
            {team.playersBoughtLabel}
          </span>
          {team.captainName ? (
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.4)", marginRight: 4 }}>C</span>
              {team.captainName}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * OBS Lab team overview — up to 6 teams per strip page; pages advance every 8s.
 * Single selected team (non-cycle) still renders as one readable card.
 */
export const TeamLowerThird = memo(function TeamLowerThird({
  model,
  bottomOffset,
  teamModelsById,
}: TeamLowerThirdProps) {
  const orderedTeams = useMemo(() => {
    if (!model.cycleTeams) {
      return [teamModelsById.get(model.teamId) ?? model];
    }
    return model.teamIds
      .map((id) => teamModelsById.get(id))
      .filter((t): t is TeamOverviewModel => t != null);
  }, [model, teamModelsById]);

  const pageCount = Math.max(1, Math.ceil(orderedTeams.length / TEAM_STRIP_PAGE_SIZE));
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [model.cycleTeams, model.teamIds.join(","), model.teamId]);

  useEffect(() => {
    if (pageCount <= 1) return;
    const timer = window.setInterval(() => {
      setPage((prev) => (prev + 1) % pageCount);
    }, TEAM_STRIP_PAGE_MS);
    return () => window.clearInterval(timer);
  }, [pageCount, orderedTeams.length]);

  const pageTeams = useMemo(() => {
    const start = (page % pageCount) * TEAM_STRIP_PAGE_SIZE;
    return orderedTeams.slice(start, start + TEAM_STRIP_PAGE_SIZE);
  }, [orderedTeams, page, pageCount]);

  const count = pageTeams.length;
  const pageLabel =
    pageCount > 1 ? ` · ${((page % pageCount) + 1)}/${pageCount}` : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 72, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 56, scale: 0.985 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 0,
        right: 0,
        zIndex: 30,
        overflow: "hidden",
        transformOrigin: "50% 100%",
      }}
    >
      <div
        style={{
          height: 16,
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.45))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          background: "rgba(0,0,0,0.92)",
          borderTop: `3px solid ${GOLD}`,
          boxShadow: "0 -6px 32px rgba(0,0,0,0.55), 0 -2px 24px rgba(255,196,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "10px 24px 8px",
          }}
        >
          <div
            style={{
              fontFamily: OBS_LAB_FONTS.display,
              fontSize: 22,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: GOLD,
              lineHeight: 1,
            }}
          >
            Team Overview{pageLabel}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 8px rgba(34,197,94,0.5)",
                animation: "livePulse 1.6s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: OBS_LAB_FONTS.label,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {model.cycleTeams ? "All Teams" : "Selected"}
            </span>
          </div>
        </div>

        <div
          style={{
            height: 1,
            margin: "0 24px",
            background: `linear-gradient(90deg, transparent, ${GOLD_BORDER}, transparent)`,
          }}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={`team-page-${page % pageCount}`}
            initial={{ opacity: 0, x: 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: "flex",
              alignItems: "stretch",
              width: "100%",
              gap: 10,
              padding: "12px 20px 14px",
              boxSizing: "border-box",
            }}
          >
            {pageTeams.map((team) => (
              <TeamStripCard key={team.teamId} team={team} count={count} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export function useTeamOverviewMaps(models: TeamOverviewModel[]) {
  return useMemo(() => {
    const teamModelsById = new Map(models.map((m) => [m.teamId, m]));
    const teamIndexById = new Map(models.map((m, idx) => [m.teamId, idx]));
    return { teamModelsById, teamIndexById };
  }, [models]);
}
