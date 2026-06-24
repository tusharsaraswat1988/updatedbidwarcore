import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState, getGetAuctionStateQueryKey,
  useGetTournament, getGetTournamentQueryKey,
  useGetTeamPurses, getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { motion, AnimatePresence } from "framer-motion";
import { formatIndianRupee } from "@/lib/format";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import { BroadcastOverlayBrandMark } from "@/components/display/broadcast-overlay-brand-mark";
import { SponsorTicker, SPONSOR_RIBBON_TOTAL_HEIGHT_PX } from "@/components/display/sponsor-ticker";
import { getSponsorsByPriority, parseSponsorLogos } from "@/lib/sponsor-logo";
import { getDisplayTheme } from "@/lib/display-theme";
import { deriveAuctionDisplayMode, outcomeEventKey, soldRecordFromOutcome, unsoldRecordFromOutcome } from "@/lib/auction-display-status";
import { AuctionStatusOverlay } from "@/components/display/auction-status-overlay";
import { BreakCountdownOverlay } from "@/components/display/break-countdown-overlay";
import { useStickyCountdown } from "@/hooks/use-sticky-countdown";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import { OutcomeResultPanel } from "@/components/display/outcome-result-panel";
import { cldUrl } from "@/lib/cloudinary";
import {
  BROADCAST_OVERLAY_WIDTH,
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_CORNER_INSET_X,
  BROADCAST_OVERLAY_CORNER_INSET_TOP,
  BROADCAST_OVERLAY_PANEL_PADDING_X,
  BROADCAST_OVERLAY_BRAND_Z_INDEX,
} from "@/lib/broadcast-overlay";

/**
 * Broadcast Overlay — landscape 16:9 browser source for live streaming.
 * Canvas: 1920×1080. Internal route: `/tournament/:id/obs`.
 * Sponsor carousel, player card, and bid panel are stacked inside the canvas
 * with corner insets and bottom ribbon offsets to avoid clipping.
 */

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
          <img src={cldUrl(src, size > 120 ? "soldCard" : "avatar")} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

const TEAM_TICKER_HEIGHT_PX = 46;
/** Clear gap between lower-third player panel and team ticker (hex glow + gradient bleed). */
const BOTTOM_CHROME_GAP_PX = 16;

type TeamTickerRow = {
  name: string;
  shortCode: string;
  color: string | null;
  logoUrl?: string | null;
  playersBought: number;
  playersDue: number | null;
};

function TeamTickerItem({ t }: { t: TeamTickerRow }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "0 28px", height: "100%",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
    }}>
      {t.logoUrl ? (
        <img src={cldUrl(t.logoUrl, "teamLogo")} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color || "#666", flexShrink: 0 }} />
      )}
      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>{t.name}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.color || "#F59E0B", fontFamily: "monospace" }}>
        {t.playersBought} taken
      </span>
      {t.playersDue !== null && (
        <>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
            {t.playersDue > 0 ? `${t.playersDue} due` : "full"}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Team squad ticker ────────────────────────────────────────────────────────
function TeamTicker({ teams }: { teams: TeamTickerRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      setNeedsScroll(measure.scrollWidth > container.clientWidth + 2);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [teams]);

  const items = needsScroll ? [...teams, ...teams] : teams;

  return (
    <div
      ref={containerRef}
      style={{
        height: TEAM_TICKER_HEIGHT_PX,
        background: "rgba(0,0,0,0.82)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          display: "inline-flex",
          alignItems: "center",
          height: TEAM_TICKER_HEIGHT_PX,
          whiteSpace: "nowrap",
        }}
      >
        {teams.map((t, i) => <TeamTickerItem key={`measure-${i}`} t={t} />)}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          height: "100%",
          width: needsScroll ? undefined : "100%",
          justifyContent: needsScroll ? undefined : "center",
          animation: needsScroll ? `tickerScroll ${Math.max(teams.length * 6, 12)}s linear infinite` : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {items.map((t, i) => (
          <TeamTickerItem key={`${t.shortCode}-${i}`} t={t} />
        ))}
      </div>
      {needsScroll && (
        <style>{`
          @keyframes tickerScroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      )}
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
type SoldSnap = {
  outcome: "sold" | "unsold";
  playerName: string; photoUrl?: string | null;
  amount?: number; teamName?: string; teamColor: string; teamLogoUrl?: string | null;
};

export default function ObsOverlay() {
  const [, params] = useRoute("/tournament/:id/obs");
  const tournamentId = parseInt(params?.id || "0");

  // Browser source must be transparent outside UI chrome — otherwise OBS/preview camera is hidden.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      rootBg: root?.style.background ?? "",
      rootMinH: root?.style.minHeight ?? "",
      htmlMinH: html.style.minHeight,
      bodyMinH: body.style.minHeight,
      bodyOverflow: body.style.overflow,
    };

    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.overflow = "hidden";
    html.style.minHeight = "0";
    body.style.minHeight = "0";
    if (root) {
      root.style.background = "transparent";
      root.style.minHeight = `${BROADCAST_OVERLAY_HEIGHT}px`;
    }

    return () => {
      html.style.background = prev.htmlBg;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
      html.style.minHeight = prev.htmlMinH;
      body.style.minHeight = prev.bodyMinH;
      if (root) {
        root.style.background = prev.rootBg;
        root.style.minHeight = prev.rootMinH;
      }
    };
  }, []);

  const { connectionStatus } = useAuctionSocket(tournamentId);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: sseAwareRefetchInterval(connectionStatus, 10000),
    },
  });
  const lastActivityAt =
    typeof state?.lastAuctionActivityAt === "string" ? state.lastAuctionActivityAt : null;
  const feed = useAuctionConnectionState(connectionStatus, tournamentId, lastActivityAt);
  const isStaleFeed = feed.state === "disconnected" || feed.state === "reconnecting";
  const embeddedPurses = state?.teamPurses;
  const { data: teamPursesFromQuery } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId && !embeddedPurses?.length,
      refetchInterval: sseAwareRefetchInterval(connectionStatus, 30000),
      staleTime: 15000,
    },
  });
  const teamPurses = embeddedPurses ?? teamPursesFromQuery;
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const [soldSnap, setSoldSnap] = useState<SoldSnap | null>(null);
  const [showSold, setShowSold] = useState(false);
  const lastOutcomeKeyRef = useRef<string | null>(null);
  const initialOutcomeSeenRef = useRef(false);
  const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const _rawDc = (state as { displayCountdown?: { type?: string; endsAt?: string; message?: string | null } | null } | undefined)?.displayCountdown;
  const stickyDc = useStickyCountdown(_rawDc);
  const displayMode = useMemo(
    () => deriveAuctionDisplayMode(state),
    [state?.status, state?.lastAction, state?.outcome, state?.displayCountdown],
  );

  useEffect(() => {
    const outcome = displayMode.outcome;
    if (!outcome) {
      if (state && !initialOutcomeSeenRef.current) initialOutcomeSeenRef.current = true;
      return;
    }

    const key = outcomeEventKey(outcome);
    if (!key) return;

    if (!initialOutcomeSeenRef.current) {
      initialOutcomeSeenRef.current = true;
      lastOutcomeKeyRef.current = key;
      return;
    }

    if (key === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = key;

    const sold = soldRecordFromOutcome(outcome);
    const unsold = unsoldRecordFromOutcome(outcome);
    if (sold) {
      setSoldSnap({
        outcome: "sold",
        playerName: sold.playerName,
        photoUrl: sold.photoUrl,
        amount: sold.amount,
        teamName: sold.teamName,
        teamColor: sold.teamColor,
        teamLogoUrl: sold.teamLogoUrl,
      });
      setShowSold(true);
    } else if (unsold) {
      setSoldSnap({
        outcome: "unsold",
        playerName: unsold.playerName,
        photoUrl: unsold.photoUrl,
        teamColor: "#ef4444",
      });
      setShowSold(true);
    }

    if (sold || unsold) {
      if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
      soldTimerRef.current = setTimeout(() => setShowSold(false), 7000);
    }
  }, [displayMode.outcome, state]);

  useEffect(() => {
    if (state?.currentPlayer?.id) setShowSold(false);
  }, [state?.currentPlayer?.id]);

  useEffect(() => {
    return () => {
      if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
    };
  }, []);

  const sponsorLogos = useMemo(
    () => getSponsorsByPriority(parseSponsorLogos(tournament?.sponsorLogos)),
    [tournament?.sponsorLogos],
  );

  const themeAccent = useMemo(() => {
    try {
      const name = localStorage.getItem(`display_theme_${tournamentId}`);
      return getDisplayTheme(name).accentColor;
    } catch {
      return "#a78bfa";
    }
  }, [tournamentId]);

  const hasPlayer = !!state?.currentPlayer;
  const isActive = displayMode.phase === "live";
  const freezeBidUpdates = displayMode.freezeBidUpdates;
  const bidColor = state?.currentBidTeamColor || "#00d4ff";
  const hasBid = !!state?.currentBidTeamName;

  const teams: TeamTickerRow[] = (teamPurses ?? []).map(t => ({
    name: t.teamName,
    shortCode: t.shortCode,
    color: t.color ?? null,
    logoUrl: t.logoUrl,
    playersBought: t.playersBought,
    playersDue: t.maximumSquadSize > 0
      ? Math.max(0, t.maximumSquadSize - t.playersBought)
      : null,
  }));

  const teamTickerOffset = teams.length > 0 && !showSold ? TEAM_TICKER_HEIGHT_PX : 0;
  const bottomChromeGap = teamTickerOffset > 0 ? BOTTOM_CHROME_GAP_PX : 0;
  const bottomStackHeight = SPONSOR_RIBBON_TOTAL_HEIGHT_PX + teamTickerOffset + bottomChromeGap;

  return (
    <div
      data-broadcast-overlay-root
      style={{
      background: "transparent",
      width: `${BROADCAST_OVERLAY_WIDTH}px`,
      height: `${BROADCAST_OVERLAY_HEIGHT}px`,
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      outline: isStaleFeed ? "4px solid rgba(245,158,11,0.35)" : undefined,
      outlineOffset: -4,
      opacity: isStaleFeed ? 0.95 : 1,
      transition: "opacity 0.3s ease",
    }}>

      {/* ── Connection status — top center ── */}
      <DisplayConnectionBanner
        feedState={feed.state}
        secondsSinceLastActivity={feed.secondsSinceLastActivity}
      />

      {/* ── Top-center: permanent BidWar brand mark ── */}
      <div style={{
        position: "absolute",
        top: BROADCAST_OVERLAY_CORNER_INSET_TOP,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: BROADCAST_OVERLAY_BRAND_Z_INDEX,
      }}>
        <BroadcastOverlayBrandMark />
      </div>

      {/* ── Top-left: tournament logo ── */}
      {tournament?.logoUrl && (
        <div style={{
          position: "absolute",
          top: BROADCAST_OVERLAY_CORNER_INSET_TOP,
          left: BROADCAST_OVERLAY_CORNER_INSET_X,
          zIndex: 35,
        }}>
          <div style={{
            background: "rgba(0,0,0,0.92)",
            borderRadius: 12,
            padding: "8px 14px",
            border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <img src={cldUrl(tournament.logoUrl, "headerLogo")} alt="" style={{ height: 60, maxWidth: 200, objectFit: "contain" }} />
          </div>
        </div>
      )}

      {/* ── Top-right: LIVE + sponsor (inline row) ── */}
      {(isActive || sponsorLogos.length > 0) && (
        <div style={{
          position: "absolute",
          top: 36,
          right: BROADCAST_OVERLAY_CORNER_INSET_X,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          zIndex: 20,
        }}>
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
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
          {sponsorLogos.length > 0 && (
            <SponsorCarousel logos={sponsorLogos} />
          )}
        </div>
      )}

      {/* ── Outcome fullscreen banner ── */}
      <AnimatePresence>
        {showSold && soldSnap && (
          <motion.div
            key="sold-banner"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              borderTop: `4px solid ${soldSnap.teamColor}`,
              boxShadow: `0 -8px 60px ${soldSnap.teamColor}44`,
              padding: `28px ${BROADCAST_OVERLAY_PANEL_PADDING_X}px`,
            }}
          >
            <OutcomeResultPanel
              layout="obs-banner"
              data={{
                outcome: soldSnap.outcome,
                playerName: soldSnap.playerName,
                photoUrl: soldSnap.photoUrl,
                amount: soldSnap.amount,
                teamName: soldSnap.teamName,
                teamColor: soldSnap.teamColor,
                teamLogoUrl: soldSnap.teamLogoUrl,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pause banner (break uses full-screen countdown below) ── */}
      {displayMode.overlayMode === "paused" && (
        <AuctionStatusOverlay mode="paused" />
      )}

      {/* ── Pre Auction & Break Timer — bottom strip so camera feed stays visible ── */}
      {stickyDc && (
        <BreakCountdownOverlay
          key={stickyDc.endsAt}
          endsAt={stickyDc.endsAt}
          message={stickyDc.message}
          tournamentName={tournament?.name ?? null}
          compact
          compactPlacement="bottom"
          compactBottomOffset={bottomStackHeight}
        />
      )}

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
              bottom: bottomStackHeight,
              left: 0, right: 0,
              zIndex: 30,
              overflow: "hidden",
              opacity: displayMode.showStatusOverlay ? 0.4 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            {/* Gradient fade above the panel — kept short so it does not bleed into team ticker */}
            <div style={{
              height: 48,
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))",
              pointerEvents: "none",
            }} />

            {/* Main panel */}
            <div style={{
              background: "rgba(0,0,0,0.94)",
              borderTop: `3px solid ${isActive ? bidColor : "rgba(255,255,255,0.1)"}`,
              boxShadow: isActive ? `0 -4px 40px ${bidColor}33` : "none",
              padding: `18px ${BROADCAST_OVERLAY_PANEL_PADDING_X}px`,
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
                <div style={{ fontSize: 54, fontWeight: 900, color: "#fff", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "uppercase", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>
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
                      letterSpacing: "0.06em",
                      background: tt.bg,
                      border: `1.5px solid ${tt.border}`,
                      color: tt.color,
                      boxShadow: `0 0 10px ${tt.glow}`,
                      animation: TAG_PULSE_ANIMATION,
                    }}>
                      {tt.label}
                    </div>
                  ) : null;
                })()}
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.80)", marginTop: 5, display: "flex", gap: 12 }}>
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
                  freezeBidUpdates ? (
                    <div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", letterSpacing: "0.15em", marginBottom: 2 }}>LEADING BID</div>
                      <div style={{ fontSize: 64, fontWeight: 900, color: bidColor, lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.9)", filter: `drop-shadow(0 0 12px ${bidColor}88)` }}>
                        {formatIndianRupee(state?.currentBid ?? 0)}
                      </div>
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        {state?.currentBidTeamLogoUrl && (
                          <img src={cldUrl(state.currentBidTeamLogoUrl, "teamLogo")} alt="" style={{ height: 24, objectFit: "contain" }} />
                        )}
                        <span style={{ fontSize: 15, color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>{state?.currentBidTeamName}</span>
                      </div>
                    </div>
                  ) : (
                  <motion.div
                    key={state?.currentBid}
                    initial={{ scale: 1.15, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", letterSpacing: "0.15em", marginBottom: 2 }}>LEADING BID</div>
                    <div style={{ fontSize: 64, fontWeight: 900, color: bidColor, lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.9)", filter: `drop-shadow(0 0 12px ${bidColor}88)` }}>
                      {formatIndianRupee(state?.currentBid ?? 0)}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      {state?.currentBidTeamLogoUrl && (
                        <img src={cldUrl(state.currentBidTeamLogoUrl, "teamLogo")} alt="" style={{ height: 24, objectFit: "contain" }} />
                      )}
                      <span style={{ fontSize: 15, color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>{state?.currentBidTeamName}</span>
                    </div>
                  </motion.div>
                  )
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", letterSpacing: "0.15em", marginBottom: 2 }}>OPENING BID</div>
                    <div style={{ fontSize: 64, fontWeight: 900, color: "rgba(255,255,255,0.95)", lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>
                      {formatIndianRupee(state?.currentBid ?? 0)}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.80)", marginTop: 6 }}>Waiting for first bid...</div>
                  </div>
                )}
              </div>

              {/* Timer */}
              {isActive && !freezeBidUpdates && state?.timerEndsAt && (
                <>
                  <div style={{ width: 1, height: 90, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <CountdownRing timerEndsAt={state.timerEndsAt} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom ticker — sponsors + periodic "Powered by BidWar" ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 25 }}>
        <SponsorTicker logos={sponsorLogos} themeAccent={themeAccent} includePoweredByBidWar />
      </div>

      {/* ── Team squad ticker — above sponsor strip ── */}
      {teams.length > 0 && !showSold && (
        <div style={{
          position: "absolute",
          bottom: SPONSOR_RIBBON_TOTAL_HEIGHT_PX,
          left: 0,
          right: 0,
          zIndex: 22,
        }}>
          <TeamTicker teams={teams} />
        </div>
      )}

      <style>{`
        @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
