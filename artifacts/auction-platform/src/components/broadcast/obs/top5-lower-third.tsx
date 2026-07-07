import { Fragment, memo } from "react";
import { motion } from "framer-motion";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
} from "@/lib/bidwar-broadcast-colors";
import type { Top5PlayerModel, Top5SceneModel } from "../director/context-resolver";

const GOLD = BIDWAR_BROADCAST_YELLOW;
const GOLD_BORDER = BIDWAR_BROADCAST_YELLOW_BORDER;
const GOLD_SOFT = "rgba(255, 196, 0, 0.12)";
/** Matches sponsor ribbon border for aligned OBS package */
const STRIP_BORDER = "rgba(201, 162, 39, 0.45)";
const HEX_CLIP = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
const PHOTO_SIZE = 44;
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const CARD_STAGGER_S = 0.035;
const CARD_ANIM_S = 0.22;

type RankAccent = {
  priceColor: string;
  priceFont: string;
  glow: string;
  columnWash: string | null;
  medalSize: number;
  rankLabelColor: string;
};

const RANK_ACCENT: Record<number, RankAccent> = {
  1: {
    priceColor: "#ffe566",
    priceFont: "clamp(15px, 1.02vw, 20px)",
    glow: "rgba(255, 215, 0, 0.32)",
    columnWash: "linear-gradient(180deg, rgba(255, 196, 0, 0.1) 0%, rgba(255, 196, 0, 0.02) 55%, transparent 100%)",
    medalSize: 20,
    rankLabelColor: GOLD,
  },
  2: {
    priceColor: "#e4e7ec",
    priceFont: "clamp(12px, 0.86vw, 16px)",
    glow: "rgba(192, 192, 192, 0.12)",
    columnWash: null,
    medalSize: 16,
    rankLabelColor: "rgba(255,255,255,0.75)",
  },
  3: {
    priceColor: "#e8a45c",
    priceFont: "clamp(12px, 0.86vw, 16px)",
    glow: "rgba(205, 127, 50, 0.1)",
    columnWash: null,
    medalSize: 16,
    rankLabelColor: "rgba(255,255,255,0.7)",
  },
  4: {
    priceColor: GOLD,
    priceFont: "clamp(12px, 0.84vw, 15px)",
    glow: "transparent",
    columnWash: null,
    medalSize: 0,
    rankLabelColor: "rgba(255,255,255,0.55)",
  },
  5: {
    priceColor: GOLD,
    priceFont: "clamp(12px, 0.84vw, 15px)",
    glow: "transparent",
    columnWash: null,
    medalSize: 0,
    rankLabelColor: "rgba(255,255,255,0.5)",
  },
};

type Top5LowerThirdProps = {
  model: Top5SceneModel;
  bottomOffset: number;
};

function StripDivider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        alignSelf: "stretch",
        flexShrink: 0,
        background:
          "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 18%, rgba(255,196,0,0.22) 50%, rgba(255,255,255,0.06) 82%, transparent 100%)",
        opacity: 0.9,
      }}
    />
  );
}

function Top5HexPhoto({
  src,
  accent,
  prominent,
}: {
  src: string | null;
  accent: string;
  prominent?: boolean;
}) {
  const size = PHOTO_SIZE;
  return (
    <div style={{ position: "relative", width: size, height: size * 1.08, flexShrink: 0 }}>
      {prominent ? (
        <div
          style={{
            position: "absolute",
            inset: -3,
            clipPath: HEX_CLIP,
            background: accent,
            opacity: 0.4,
            filter: "blur(5px)",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: HEX_CLIP,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${accent}`,
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
          <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.05)" }} />
        )}
      </div>
    </div>
  );
}

function Top5StripEntry({ player, index }: { player: Top5PlayerModel; index: number }) {
  const accent = RANK_ACCENT[player.rank] ?? RANK_ACCENT[5];
  const teamAccent = player.teamAccentColor ?? "rgba(255,255,255,0.35)";
  const isLeader = player.rank === 1;
  const photoAccent = isLeader ? "rgba(255, 215, 0, 0.45)" : "rgba(255,255,255,0.18)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: CARD_ANIM_S,
        delay: index * CARD_STAGGER_S,
        ease: "easeOut",
      }}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 0,
        padding: "6px 8px 8px",
        background: accent.columnWash ?? "transparent",
        position: "relative",
      }}
    >
      <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {player.rank <= 3 ? (
          <span
            style={{
              fontSize: accent.medalSize,
              lineHeight: 1,
              filter: isLeader ? `drop-shadow(0 0 8px ${accent.glow})` : undefined,
            }}
            aria-hidden
          >
            {MEDAL[player.rank]}
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: accent.rankLabelColor,
              letterSpacing: "0.12em",
            }}
          >
            #{player.rank}
          </span>
        )}
      </div>

      <div style={{ marginTop: 4 }}>
        <Top5HexPhoto src={player.photoSrc} accent={photoAccent} prominent={isLeader} />
      </div>

      <div
        style={{
          marginTop: 6,
          width: "100%",
          fontSize: "clamp(8px, 0.52vw, 10px)",
          fontWeight: 700,
          color: "rgba(255,255,255,0.88)",
          textAlign: "center",
          lineHeight: 1.15,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {player.name}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: accent.priceFont,
          fontWeight: 900,
          color: accent.priceColor,
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum"',
          lineHeight: 1,
          letterSpacing: "-0.02em",
          textShadow: isLeader ? `0 0 14px ${accent.glow}` : "none",
        }}
      >
        {player.priceLabel}
      </div>

      <div
        style={{
          marginTop: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        {player.teamLogoSrc ? (
          <img
            src={player.teamLogoSrc}
            alt=""
            style={{
              width: 12,
              height: 12,
              objectFit: "contain",
              flexShrink: 0,
              opacity: 0.9,
            }}
          />
        ) : (
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: teamAccent,
              flexShrink: 0,
              opacity: 0.8,
            }}
          />
        )}
        <span
          style={{
            fontSize: "clamp(7px, 0.44vw, 8px)",
            fontWeight: 600,
            color: teamAccent,
            opacity: 0.85,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {player.teamName ?? "—"}
        </span>
      </div>
    </motion.div>
  );
}

export const Top5LowerThird = memo(function Top5LowerThird({
  model,
  bottomOffset,
}: Top5LowerThirdProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
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
          height: 12,
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.22))",
          pointerEvents: "none",
        }}
      />

      {/* Full-bleed strip — aligned with sponsor ticker width */}
      <div
        style={{
          width: "100%",
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: `2px solid ${STRIP_BORDER}`,
          boxShadow: `0 -2px 20px ${GOLD_SOFT}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "8px 20px 6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }} aria-hidden>
              🏆
            </span>
            <div
              style={{
                fontSize: "clamp(10px, 0.68vw, 13px)",
                fontWeight: 900,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: GOLD,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {model.title}
            </div>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#ff4d4d",
                boxShadow: "0 0 5px rgba(255, 77, 77, 0.4)",
                animation: "livePulse 2s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontSize: "clamp(7px, 0.45vw, 9px)",
                fontWeight: 800,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.75)",
                whiteSpace: "nowrap",
              }}
            >
              Live Rankings
            </span>
          </div>
        </div>

        <div
          style={{
            height: 2,
            margin: "0 12px 8px",
            borderRadius: 1,
            background: `linear-gradient(90deg, transparent 0%, ${GOLD_BORDER} 15%, ${GOLD} 50%, ${GOLD_BORDER} 85%, transparent 100%)`,
            boxShadow: `0 0 8px ${GOLD_SOFT}`,
          }}
        />

        {model.players.length === 0 ? (
          <div
            style={{
              padding: "4px 20px 12px",
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
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
              paddingBottom: 8,
            }}
          >
            {model.players.map((player, index) => (
              <Fragment key={`${player.rank}-${player.name}`}>
                {index > 0 ? <StripDivider /> : null}
                <Top5StripEntry player={player} index={index} />
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});
