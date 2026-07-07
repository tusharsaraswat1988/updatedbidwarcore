import { memo, useMemo } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { BROADCAST_FONTS, BROADCAST_TYPO, themePalette } from "./tokens";
import { HammerAnimation } from "./hammer-animation";
import { PlayerCard } from "./player-card";
import type { BroadcastSettings, OutcomeSnapshot } from "./types";

type SoldSceneProps = {
  snapshot: OutcomeSnapshot;
  settings: BroadcastSettings;
  formatAmount: (n: number) => string;
  obsMode: boolean;
};

/** Lightweight confetti — CSS only, capped particle count for OBS CPU budget. */
function ConfettiBurst({ active, obsMode }: { active: boolean; obsMode: boolean }) {
  const particles = useMemo(() => {
    if (obsMode) return [];
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: `${(i * 17) % 100}%`,
      delay: `${(i % 8) * 0.05}s`,
      color: i % 3 === 0 ? "#FFC400" : i % 3 === 1 ? "#fff" : "#ef4444",
    }));
  }, [obsMode]);

  if (!active || !particles.length) return null;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.left,
            top: -8,
            width: 6,
            height: 10,
            background: p.color,
            animation: `confettiFall 1.8s ease-in ${p.delay} forwards`,
            opacity: 0.85,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export const SoldScene = memo(function SoldScene({
  snapshot,
  settings,
  formatAmount,
  obsMode,
}: SoldSceneProps) {
  const palette = themePalette(settings.theme);
  const teamColor = snapshot.teamColor;

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(145deg, #0a0a0a 0%, ${teamColor}22 50%, #0a0a0a 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,196,0,0.12)",
          animation: "goldFlash 0.6s ease-out forwards",
          pointerEvents: "none",
        }}
      />
      <ConfettiBurst active obsMode={obsMode} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          padding: 48,
          zIndex: 10,
          animation: "soldExpand 0.5s cubic-bezier(0.34, 1.2, 0.64, 1) forwards",
        }}
      >
        <div
          style={{
            fontFamily: BROADCAST_FONTS.display,
            fontSize: BROADCAST_TYPO.sceneTitle,
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: "#ef4444",
            textShadow: obsMode ? undefined : "0 0 60px rgba(239,68,68,0.8)",
            border: "6px solid #ef4444",
            padding: "12px 48px",
            borderRadius: 12,
            transform: "rotate(-3deg)",
          }}
        >
          SOLD
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <PlayerCard
            name={snapshot.playerName}
            photoUrl={snapshot.photoUrl}
            accentColor={teamColor}
            formatAmount={formatAmount}
            size="compact"
            obsMode={obsMode}
          />

          <div style={{ textAlign: "center" }}>
            <HammerAnimation active color={teamColor} />
            <div
              style={{
                marginTop: 16,
                fontFamily: BROADCAST_FONTS.display,
                fontSize: BROADCAST_TYPO.soldPrice,
                fontWeight: 900,
                fontVariantNumeric: "tabular-nums",
                color: palette.accent,
                lineHeight: 1,
              }}
            >
              {formatAmount(snapshot.amount ?? 0)}
            </div>
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
              {snapshot.teamLogoUrl && (
                <img
                  src={cldUrl(snapshot.teamLogoUrl, "teamLogo")}
                  alt=""
                  style={{ height: 56, objectFit: "contain" }}
                />
              )}
              <span
                style={{
                  fontFamily: BROADCAST_FONTS.display,
                  fontSize: 36,
                  letterSpacing: "0.06em",
                  color: "#fff",
                  textTransform: "uppercase",
                }}
              >
                {snapshot.teamName}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes goldFlash {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes soldExpand {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
});
