import { memo } from "react";
import { motion } from "framer-motion";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
} from "@/lib/bidwar-broadcast-colors";
import type { Top5PlayerModel, Top5SceneModel } from "../director/context-resolver";
import { OBS_LAB_FONTS } from "./obs-tokens";

const GOLD = BIDWAR_BROADCAST_YELLOW;
const GOLD_BORDER = BIDWAR_BROADCAST_YELLOW_BORDER;
const HEX_CLIP = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

/** Photo size scales slightly with how many slots are visible. */
function photoSizeForCount(count: number): number {
  if (count <= 2) return 88;
  if (count <= 3) return 76;
  if (count === 4) return 68;
  return 60;
}

const RANK_BADGE: Record<number, { bg: string; color: string }> = {
  1: { bg: "linear-gradient(135deg, #ffe566 0%, #d4af37 100%)", color: "#1a1400" },
  2: { bg: "linear-gradient(135deg, #e8ecf0 0%, #9aa3ad 100%)", color: "#1a1a1a" },
  3: { bg: "linear-gradient(135deg, #e8a45c 0%, #a65c28 100%)", color: "#1a0e00" },
  4: { bg: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.9)" },
  5: { bg: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" },
};

type Top5LowerThirdProps = {
  model: Top5SceneModel;
  bottomOffset: number;
};

function RankBadge({ rank, size }: { rank: number; size: number }) {
  const badge = RANK_BADGE[rank] ?? RANK_BADGE[5];
  const dim = Math.max(20, Math.round(size * 0.32));
  return (
    <div
      style={{
        position: "absolute",
        top: -4,
        left: -4,
        zIndex: 2,
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: badge.bg,
        color: badge.color,
        fontFamily: OBS_LAB_FONTS.display,
        fontSize: Math.round(dim * 0.62),
        display: "grid",
        placeItems: "center",
        lineHeight: 1,
        boxShadow: rank === 1 ? "0 0 12px rgba(255,215,0,0.5)" : "0 2px 8px rgba(0,0,0,0.45)",
      }}
    >
      {rank}
    </div>
  );
}

function PlayerHex({
  src,
  size,
  isLeader,
}: {
  src: string | null;
  size: number;
  isLeader: boolean;
}) {
  const accent = isLeader ? "rgba(255, 215, 0, 0.55)" : "rgba(255,255,255,0.22)";
  return (
    <div style={{ position: "relative", width: size, height: size * 1.08, flexShrink: 0 }}>
      {isLeader ? (
        <div
          style={{
            position: "absolute",
            inset: -5,
            clipPath: HEX_CLIP,
            background: accent,
            opacity: 0.4,
            filter: "blur(7px)",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: HEX_CLIP,
          background: "rgba(255,255,255,0.05)",
          boxShadow: `inset 0 0 0 2px ${accent}`,
          overflow: "hidden",
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.06)" }} />
        )}
      </div>
    </div>
  );
}

/**
 * Horizontal rectangle: large photo left, price + team right.
 * Equal flex share of full width; only as many boxes as sold (max 5).
 */
function Top5RectBox({
  player,
  index,
  count,
}: {
  player: Top5PlayerModel;
  index: number;
  count: number;
}) {
  const isLeader = player.rank === 1;
  const photoSize = photoSizeForCount(count);
  const teamAccent = player.teamAccentColor ?? "rgba(255,255,255,0.5)";
  const priceSize = count <= 2 ? 36 : count <= 3 ? 30 : count === 4 ? 26 : 22;
  const nameSize = count <= 2 ? 15 : count <= 3 ? 13 : 11;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.05, ease: "easeOut" }}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: count <= 3 ? 14 : 10,
        padding: count <= 3 ? "12px 14px" : "10px 10px",
        background: isLeader
          ? "linear-gradient(90deg, rgba(255,196,0,0.16) 0%, rgba(255,196,0,0.04) 55%, transparent 100%)"
          : "rgba(255,255,255,0.035)",
        border: isLeader ? `1px solid ${GOLD_BORDER}` : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4,
        boxShadow: isLeader ? "0 0 20px rgba(255,196,0,0.1)" : "none",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <RankBadge rank={player.rank} size={photoSize} />
        <PlayerHex src={player.photoSrc} size={photoSize} isLeader={isLeader} />
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: OBS_LAB_FONTS.display,
            fontSize: nameSize,
            fontWeight: 400,
            color: "rgba(255,255,255,0.88)",
            lineHeight: 1.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
          title={player.name}
        >
          {player.name}
        </div>

        <div
          style={{
            fontFamily: OBS_LAB_FONTS.display,
            fontSize: priceSize,
            fontWeight: 400,
            color: GOLD,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            letterSpacing: "0.01em",
            textShadow: isLeader ? "0 0 14px rgba(255,196,0,0.35)" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {player.priceLabel}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            marginTop: 2,
          }}
        >
          {player.teamLogoSrc ? (
            <img
              src={player.teamLogoSrc}
              alt=""
              style={{
                width: count <= 3 ? 18 : 14,
                height: count <= 3 ? 18 : 14,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: teamAccent,
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontFamily: OBS_LAB_FONTS.label,
              fontSize: count <= 3 ? 12 : 10,
              fontWeight: 700,
              color: teamAccent,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {player.teamName ?? "—"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * OBS Lab Top 5 — full-width row of horizontal rects (photo | price+team).
 * Shows only sold players (1–5); highest sold is leftmost.
 */
export const Top5LowerThird = memo(function Top5LowerThird({
  model,
  bottomOffset,
}: Top5LowerThirdProps) {
  // Director already ranks highest-first; keep left→right = rank 1…N
  const players = model.players.slice(0, 5);
  const count = players.length;

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
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: "linear-gradient(135deg, #ffe566, #d4af37)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow: "0 0 12px rgba(255,196,0,0.35)",
              }}
            >
              <span
                style={{
                  fontFamily: OBS_LAB_FONTS.display,
                  fontSize: 16,
                  color: "#1a1400",
                  lineHeight: 1,
                }}
              >
                ★
              </span>
            </div>
            <div
              style={{
                fontFamily: OBS_LAB_FONTS.display,
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: GOLD,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {model.title}
            </div>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 8px rgba(239,68,68,0.55)",
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
              Live Rankings
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

        {count === 0 ? (
          <div
            style={{
              padding: "20px 28px 22px",
              fontFamily: OBS_LAB_FONTS.label,
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            No sales recorded yet
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              width: "100%",
              gap: 10,
              padding: "12px 20px 14px",
              boxSizing: "border-box",
            }}
          >
            {players.map((player, index) => (
              <Top5RectBox
                key={`${player.rank}-${player.name}`}
                player={player}
                index={index}
                count={count}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});
