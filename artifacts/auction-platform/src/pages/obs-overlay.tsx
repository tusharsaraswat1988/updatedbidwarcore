import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState, getGetAuctionStateQueryKey,
  useGetTournament, getGetTournamentQueryKey,
  useListTeams, getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { motion, AnimatePresence } from "framer-motion";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";

// ─── Hexagon clip-path player photo ──────────────────────────────────────────
function HexPhoto({ src, color, size = 180, playerTag }: { src?: string | null; color: string; size?: number; playerTag?: string | null }) {
  const hex = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
  const tag = getTagTheme(playerTag);
  const glowColor = tag?.color ?? color;
  return (
    <div style={{ position: "relative", width: size, height: size * 1.08, flexShrink: 0 }}>
      {/* Glow ring — uses tag colour when available */}
      <div style={{
        position: "absolute", inset: -3,
        clipPath: hex,
        background: glowColor,
        filter: `blur(8px)`,
        opacity: tag ? 0.75 : 0.6,
        animation: tag ? TAG_PULSE_ANIMATION : undefined,
        willChange: tag ? "opacity" : undefined,
        transform: "translateZ(0)",
      }} />
      {/* Border */}
      <div style={{
        position: "absolute", inset: -2,
        clipPath: hex,
        background: glowColor,
        opacity: 0.9,
      }} />
      {/* Photo */}
      <div style={{
        position: "absolute", inset: 3,
        clipPath: hex,
        background: `${color}22`,
        overflow: "hidden",
      }}>
        {src ? (
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.35, color, fontWeight: 900,
            background: `linear-gradient(135deg, #0d0d0d 0%, ${color}18 100%)`,
          }}>
            ?
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Countdown ring ───────────────────────────────────────────────────────────
function CountdownRing({ timerEndsAt }: { timerEndsAt?: string | null }) {
  const [remaining, setRemaining] = useState(0);
  // Capture the full duration at the moment timerEndsAt arrives so the ring
  // always starts at 100% regardless of what the tournament default is.
  const totalRef = useRef<number>(30);

  useEffect(() => {
    if (!timerEndsAt) { setRemaining(0); return; }
    const fullMs = new Date(timerEndsAt).getTime() - Date.now();
    totalRef.current = Math.max(1, Math.ceil(fullMs / 1000));
    const tick = () => {
      const ms = new Date(timerEndsAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerEndsAt]);

  const pct = totalRef.current > 0 ? remaining / totalRef.current : 0;
  const r = 28, cx = 34, cy = 34;
  const circumference = 2 * Math.PI * r;
  const strokeDash = circumference * pct;
  const color = remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#f59e0b" : "#22c55e";

  if (!timerEndsAt) return null;

  return (
    <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
      <svg width={68} height={68} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.25s linear" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 900, color,
      }}>
        {remaining}
      </div>
    </div>
  );
}

// ─── Team purse ticker ────────────────────────────────────────────────────────
function TeamTicker({ teams }: { teams: Array<{ name: string; shortCode: string; color: string | null; purse: number; purseUsed: number; purseRemaining: number; logoUrl?: string | null }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = [...teams, ...teams]; // duplicate for seamless loop

  return (
    <div style={{
      height: 46,
      background: "rgba(0,0,0,0.82)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      overflow: "hidden",
      position: "relative",
    }}>
      <div
        ref={ref}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          height: "100%",
          animation: `tickerScroll ${teams.length * 6}s linear infinite`,
          whiteSpace: "nowrap",
        }}
      >
        {items.map((t, i) => (
          <div key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "0 28px", height: "100%",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}>
            {t.logoUrl ? (
              <img src={t.logoUrl} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color || "#666", flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>{t.shortCode}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{t.name}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.color || "#F59E0B", fontFamily: "monospace" }}>
              {formatShortIndianRupee(t.purseRemaining)}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>left</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
type SoldSnap = {
  playerName: string; photoUrl?: string | null;
  amount: number; teamName: string; teamColor: string; teamLogoUrl?: string | null;
};

export default function ObsOverlay() {
  const [, params] = useRoute("/tournament/:id/obs");
  const tournamentId = parseInt(params?.id || "0");

  useAuctionSocket(tournamentId);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamsRaw } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const [soldSnap, setSoldSnap] = useState<SoldSnap | null>(null);
  const [showSold, setShowSold] = useState(false);
  const lastActionRef = useRef<string | null>(null);
  const lastKnownRef = useRef<SoldSnap | null>(null);
  const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track last known state for sold snap
  useEffect(() => {
    if (state?.currentPlayer && state.currentBidTeamId) {
      lastKnownRef.current = {
        playerName: state.currentPlayer.name,
        photoUrl: state.currentPlayer.photoUrl,
        amount: state.currentBid ?? 0,
        teamName: state.currentBidTeamName ?? "",
        teamColor: state.currentBidTeamColor ?? "#F59E0B",
        teamLogoUrl: state.currentBidTeamLogoUrl,
      };
    }
  }, [state?.currentPlayer?.id, state?.currentBidTeamId, state?.currentBid]);

  useEffect(() => {
    if (state?.lastAction?.startsWith("SOLD:") && state.lastAction !== lastActionRef.current) {
      lastActionRef.current = state.lastAction;
      const snap = state.currentPlayer
        ? { playerName: state.currentPlayer.name, photoUrl: state.currentPlayer.photoUrl, amount: state.currentBid ?? 0, teamName: state.currentBidTeamName ?? "", teamColor: state.currentBidTeamColor ?? "#F59E0B", teamLogoUrl: state.currentBidTeamLogoUrl }
        : lastKnownRef.current;
      if (snap) setSoldSnap(snap);
      setShowSold(true);
      if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
      soldTimerRef.current = setTimeout(() => setShowSold(false), 7000);
    }
  }, [state?.lastAction]);

  useEffect(() => {
    if (state?.currentPlayer?.id) setShowSold(false);
  }, [state?.currentPlayer?.id]);

  const hasPlayer = !!state?.currentPlayer;
  const isActive = state?.status === "active";
  const bidColor = state?.currentBidTeamColor || "#00d4ff";
  const hasBid = !!state?.currentBidTeamName;

  type TeamRow = { name: string; shortCode: string; color: string | null; purse: number; purseUsed: number; purseRemaining: number; logoUrl?: string | null };
  const teams: TeamRow[] = (teamsRaw ?? []).map(t => ({
    name: t.name,
    shortCode: t.shortCode,
    color: t.color ?? null,
    purse: t.purse,
    purseUsed: t.purseUsed ?? 0,
    purseRemaining: t.purse - (t.purseUsed ?? 0),
    logoUrl: t.logoUrl,
  }));

  return (
    <div style={{
      background: "transparent",
      width: "1920px",
      height: "1080px",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── Tournament logo — top-left ── */}
      {tournament?.logoUrl && (
        <div style={{
          position: "absolute", top: 32, left: 40,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          padding: "8px 14px",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <img src={tournament.logoUrl} alt="" style={{ height: 44, maxWidth: 160, objectFit: "contain" }} />
        </div>
      )}

      {/* ── Live indicator — top-right ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            style={{
              position: "absolute", top: 36, right: 40,
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(239,68,68,0.9)",
              borderRadius: 8, padding: "6px 14px",
              boxShadow: "0 0 20px rgba(239,68,68,0.5)",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "livePulse 1s ease-in-out infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.2em" }}>LIVE</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SOLD fullscreen banner ── */}
      <AnimatePresence>
        {showSold && soldSnap && (
          <motion.div
            key="sold-banner"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: `linear-gradient(135deg, rgba(0,0,0,0.97) 0%, ${soldSnap.teamColor}28 100%)`,
              borderTop: `4px solid ${soldSnap.teamColor}`,
              boxShadow: `0 -8px 60px ${soldSnap.teamColor}44`,
              padding: "28px 48px",
              display: "flex", alignItems: "center", gap: 36,
            }}
          >
            {/* Sold stamp */}
            <motion.div
              initial={{ scale: 3, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: -8 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
              style={{
                position: "absolute", top: 18, left: 40,
                fontSize: 72, fontWeight: 900, color: soldSnap.teamColor,
                opacity: 0.15, letterSpacing: "0.05em", lineHeight: 1,
                pointerEvents: "none",
              }}
            >
              SOLD
            </motion.div>

            <HexPhoto src={soldSnap.photoUrl} color={soldSnap.teamColor} size={140} />

            <div style={{ flex: 1 }}>
              <motion.div
                initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 }}
                style={{ fontSize: 14, fontWeight: 800, color: soldSnap.teamColor, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 6 }}
              >
                SOLD
              </motion.div>
              <motion.div
                initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.22 }}
                style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1.05 }}
              >
                {soldSnap.playerName}
              </motion.div>
              <motion.div
                initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", marginTop: 6 }}
              >
                acquired by {soldSnap.teamName}
              </motion.div>
            </div>

            <motion.div
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: "spring" }}
              style={{ textAlign: "right", flexShrink: 0 }}
            >
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em", marginBottom: 4 }}>SOLD FOR</div>
              <div style={{ fontSize: 64, fontWeight: 900, color: soldSnap.teamColor, lineHeight: 1, filter: `drop-shadow(0 0 20px ${soldSnap.teamColor})` }}>
                {formatIndianRupee(soldSnap.amount)}
              </div>
              {soldSnap.teamLogoUrl && (
                <img src={soldSnap.teamLogoUrl} alt="" style={{ height: 40, marginTop: 10, objectFit: "contain", marginLeft: "auto" }} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live bidding lower-third ── */}
      <AnimatePresence>
        {hasPlayer && !showSold && (
          <motion.div
            key={`player-${state?.currentPlayer?.id}`}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            style={{
              position: "absolute",
              bottom: teams.length > 0 ? 46 : 0,
              left: 0, right: 0,
            }}
          >
            {/* Gradient fade above the panel */}
            <div style={{
              height: 120,
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.6))",
              pointerEvents: "none",
            }} />

            {/* Main panel */}
            <div style={{
              background: "rgba(0,0,0,0.88)",
              borderTop: `3px solid ${isActive ? bidColor : "rgba(255,255,255,0.1)"}`,
              boxShadow: isActive ? `0 -4px 40px ${bidColor}33` : "none",
              padding: "18px 48px",
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}>
              {/* Hexagonal player photo */}
              <HexPhoto
                src={state?.currentPlayer?.photoUrl}
                color={isActive ? bidColor : "#666"}
                size={110}
                playerTag={(state?.currentPlayer as { playerTag?: string | null } | undefined)?.playerTag}
              />

              {/* Player info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {isActive ? (
                    <>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "livePulse 1s infinite" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", letterSpacing: "0.25em" }}>LIVE AUCTION</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: "0.25em" }}>UP NEXT</span>
                  )}
                </div>
                <div style={{ fontSize: 42, fontWeight: 900, color: "#fff", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {state?.currentPlayer?.name}
                </div>
                {(() => {
                  const pt = (state?.currentPlayer as { playerTag?: string | null } | undefined)?.playerTag;
                  const tt = getTagTheme(pt);
                  return tt ? (
                    <div style={{
                      display: "inline-flex", alignItems: "center",
                      marginTop: 8,
                      padding: "4px 14px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      background: tt.bg,
                      border: `1.5px solid ${tt.border}`,
                      color: tt.color,
                      boxShadow: `0 0 10px ${tt.glow}`,
                      animation: TAG_PULSE_ANIMATION,
                      transform: "translateZ(0)",
                      willChange: "opacity",
                    }}>
                      {tt.label}
                    </div>
                  ) : null;
                })()}
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 5, display: "flex", gap: 12 }}>
                  {state?.currentPlayer?.role && <span>{state.currentPlayer.role}</span>}
                  {state?.currentPlayer?.city && <span style={{ opacity: 0.6 }}>· {state.currentPlayer.city}</span>}
                </div>

                {/* BASE VALUE bar */}
                <div style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(0,212,255,0.12)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  borderRadius: 6,
                  padding: "4px 14px",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff" }} />
                  <span style={{ fontSize: 11, color: "#00d4ff", fontWeight: 700, letterSpacing: "0.15em" }}>BASE VALUE</span>
                  <span style={{ fontSize: 14, color: "#fff", fontWeight: 800, fontFamily: "monospace" }}>
                    {formatIndianRupee(state?.currentPlayer?.basePrice ?? 0)}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 90, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

              {/* Bid section */}
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: 280 }}>
                {hasBid ? (
                  <motion.div
                    key={state?.currentBid}
                    initial={{ scale: 1.15, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em", marginBottom: 2 }}>LEADING BID</div>
                    <div style={{ fontSize: 52, fontWeight: 900, color: bidColor, lineHeight: 1, filter: `drop-shadow(0 0 12px ${bidColor}88)` }}>
                      {formatIndianRupee(state?.currentBid ?? 0)}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      {state?.currentBidTeamLogoUrl && (
                        <img src={state.currentBidTeamLogoUrl} alt="" style={{ height: 24, objectFit: "contain" }} />
                      )}
                      <span style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{state?.currentBidTeamName}</span>
                    </div>
                  </motion.div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em", marginBottom: 2 }}>OPENING BID</div>
                    <div style={{ fontSize: 52, fontWeight: 900, color: "rgba(255,255,255,0.35)", lineHeight: 1 }}>
                      {formatIndianRupee(state?.currentBid ?? 0)}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>Waiting for first bid...</div>
                  </div>
                )}
              </div>

              {/* Timer */}
              {isActive && state?.timerEndsAt && (
                <>
                  <div style={{ width: 1, height: 90, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <CountdownRing timerEndsAt={state.timerEndsAt} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Team purse ticker at very bottom ── */}
      {teams.length > 0 && !showSold && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <TeamTicker teams={teams} />
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes softPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.92; } }
      `}</style>
    </div>
  );
}
