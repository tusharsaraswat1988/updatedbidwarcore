import { memo } from "react";
import { BROADCAST_FONTS, BROADCAST_TYPO } from "./tokens";
import { PlayerCard } from "./player-card";
import type { BroadcastSettings, OutcomeSnapshot } from "./types";

type UnsoldSceneProps = {
  snapshot: OutcomeSnapshot;
  settings: BroadcastSettings;
  formatAmount: (n: number) => string;
  obsMode: boolean;
};

export const UnsoldScene = memo(function UnsoldScene({
  snapshot,
  formatAmount,
  obsMode,
}: UnsoldSceneProps) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(145deg, #0a0404 0%, #1a0808 45%, #0d0606 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.15) 0%, transparent 60%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          padding: 48,
        }}
      >
        <div
          style={{
            fontFamily: BROADCAST_FONTS.display,
            fontSize: BROADCAST_TYPO.sceneTitle,
            fontWeight: 900,
            letterSpacing: "0.15em",
            color: "#ef4444",
            border: "6px solid #ef4444",
            padding: "12px 56px",
            borderRadius: 12,
            transform: "rotate(-2deg)",
            boxShadow: obsMode ? undefined : "0 0 48px rgba(239,68,68,0.5)",
          }}
        >
          UNSOLD
        </div>

        <PlayerCard
          name={snapshot.playerName}
          photoUrl={snapshot.photoUrl}
          accentColor="#ef4444"
          formatAmount={formatAmount}
          size="hero"
          obsMode={obsMode}
        />

        {snapshot.reason && (
          <div
            style={{
              fontSize: 16,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {snapshot.reason}
          </div>
        )}
      </div>
    </>
  );
});
