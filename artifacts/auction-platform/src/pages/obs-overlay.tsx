import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  getGetAuctionStateQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { motion, AnimatePresence } from "framer-motion";
import { formatIndianRupee } from "@/lib/format";
import { User } from "lucide-react";

type SoldSnap = { playerName: string; photoUrl?: string | null; amount: number; teamName: string; teamColor: string };

export default function ObsOverlay() {
  const [, params] = useRoute("/tournament/:id/obs");
  const tournamentId = parseInt(params?.id || "0");

  useAuctionSocket(tournamentId);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 1000,
    },
  });

  const [soldSnap, setSoldSnap] = useState<SoldSnap | null>(null);
  const [showSold, setShowSold] = useState(false);
  const lastActionRef = useRef<string | null>(null);
  const lastKnownRef = useRef<SoldSnap | null>(null);
  const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track last known player for sold snap
  useEffect(() => {
    if (state?.currentPlayer && state.currentBidTeamId) {
      lastKnownRef.current = {
        playerName: state.currentPlayer.name,
        photoUrl: state.currentPlayer.photoUrl,
        amount: state.currentBid ?? 0,
        teamName: state.currentBidTeamName ?? "",
        teamColor: state.currentBidTeamColor ?? "#F59E0B",
      };
    }
  }, [state?.currentPlayer?.id, state?.currentBidTeamId, state?.currentBid]);

  useEffect(() => {
    if (state?.lastAction && state.lastAction.startsWith("SOLD:") && state.lastAction !== lastActionRef.current) {
      lastActionRef.current = state.lastAction;
      const snap = state.currentPlayer
        ? { playerName: state.currentPlayer.name, photoUrl: state.currentPlayer.photoUrl, amount: state.currentBid ?? 0, teamName: state.currentBidTeamName ?? "", teamColor: state.currentBidTeamColor ?? "#F59E0B" }
        : lastKnownRef.current;
      if (snap) setSoldSnap(snap);
      setShowSold(true);
      if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
      soldTimerRef.current = setTimeout(() => setShowSold(false), 6000);
    }
  }, [state?.lastAction]);

  useEffect(() => {
    if (state?.currentPlayer?.id) setShowSold(false);
  }, [state?.currentPlayer?.id]);

  const hasPlayer = !!state?.currentPlayer;
  const color = state?.currentBidTeamColor || "#F59E0B";
  const isActive = state?.status === "active";

  return (
    <div
      style={{ background: "transparent", width: "1920px", height: "1080px", position: "relative", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}
    >
      {/* SOLD overlay banner */}
      <AnimatePresence>
        {showSold && soldSnap && (
          <motion.div
            key="sold"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: `linear-gradient(135deg, #09090b 0%, ${soldSnap.teamColor}22 100%)`,
              borderTop: `4px solid ${soldSnap.teamColor}`,
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "20px 40px",
              backdropFilter: "blur(20px)",
            }}
          >
            {soldSnap.photoUrl ? (
              <img src={soldSnap.photoUrl} alt={soldSnap.playerName} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, border: `3px solid ${soldSnap.teamColor}` }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: 12, background: `${soldSnap.teamColor}22`, border: `3px solid ${soldSnap.teamColor}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User style={{ width: 40, height: 40, color: soldSnap.teamColor }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: soldSnap.teamColor, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 4 }}>SOLD</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{soldSnap.playerName}</div>
              <div style={{ fontSize: 16, color: "#a1a1aa", marginTop: 4 }}>{soldSnap.teamName}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "#a1a1aa", letterSpacing: "0.1em", marginBottom: 4 }}>SOLD FOR</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: soldSnap.teamColor, lineHeight: 1 }}>{formatIndianRupee(soldSnap.amount)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live bidding lower-third */}
      <AnimatePresence>
        {hasPlayer && !showSold && isActive && (
          <motion.div
            key="live"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(180deg, transparent 0%, rgba(9,9,11,0.95) 30%)",
              display: "flex",
              alignItems: "flex-end",
              gap: 28,
              padding: "40px 40px 24px",
            }}
          >
            {state?.currentPlayer?.photoUrl ? (
              <img
                src={state.currentPlayer.photoUrl}
                alt={state.currentPlayer.name}
                style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 12, border: `3px solid ${color}`, flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: 12, background: `${color}22`, border: `3px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <User style={{ width: 36, height: 36, color }} />
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#22c55e", animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", letterSpacing: "0.2em", textTransform: "uppercase" }}>LIVE AUCTION</span>
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1.05 }}>{state?.currentPlayer?.name}</div>
              <div style={{ fontSize: 14, color: "#71717a", marginTop: 4 }}>
                {[state?.currentPlayer?.role, state?.currentPlayer?.city].filter(Boolean).join(" · ")}
              </div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {state?.currentBidTeamName ? (
                <>
                  <div style={{ fontSize: 11, color: "#71717a", letterSpacing: "0.1em", marginBottom: 2 }}>LEADING BID</div>
                  <div style={{ fontSize: 42, fontWeight: 900, color, lineHeight: 1 }}>{formatIndianRupee(state.currentBid ?? 0)}</div>
                  <div style={{ fontSize: 15, color: "#a1a1aa", marginTop: 3 }}>{state.currentBidTeamName}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: "#71717a", letterSpacing: "0.1em", marginBottom: 2 }}>BASE PRICE</div>
                  <div style={{ fontSize: 42, fontWeight: 900, color: "#a1a1aa", lineHeight: 1 }}>{formatIndianRupee(state?.currentBid ?? 0)}</div>
                  <div style={{ fontSize: 13, color: "#52525b", marginTop: 3 }}>No bids yet</div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
