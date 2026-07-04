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
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";
import { BroadcastOverlayTopBar } from "@/components/display/broadcast-overlay-top-bar";
import { SponsorTicker, SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX } from "@/components/display/sponsor-ticker";
import { getSponsorsByPriority, parseSponsorLogos } from "@/lib/sponsor-logo";
import { BIDWAR_BROADCAST_YELLOW, BIDWAR_BROADCAST_YELLOW_BORDER, BIDWAR_BROADCAST_YELLOW_SOFT } from "@/lib/bidwar-broadcast-colors";
import { deriveAuctionDisplayMode, outcomeEventKey, soldRecordFromOutcome, unsoldRecordFromOutcome } from "@/lib/auction-display-status";
import { AuctionStatusOverlay } from "@/components/display/auction-status-overlay";
import { BreakCountdownOverlay } from "@/components/display/break-countdown-overlay";
import { useStickyCountdown } from "@/hooks/use-sticky-countdown";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import { OutcomeResultPanel } from "@/components/display/outcome-result-panel";
import { cldUrl } from "@/lib/cloudinary";
import { useSeamlessTicker } from "@/lib/chyron-ticker";
import {
  BROADCAST_OVERLAY_WIDTH,
  BROADCAST_OVERLAY_HEIGHT,
  BROADCAST_OVERLAY_PANEL_PADDING_X,
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
function CountdownRing({ timerEndsAt, size = 68 }: { timerEndsAt?: string | null; size?: number }) {
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
  const scale = size / 68;
  const r = 28 * scale;
  const cx = 34 * scale;
  const cy = 34 * scale;
  const circumference = 2 * Math.PI * r;
  const strokeDash = circumference * pct;
  const color = remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#f59e0b" : "#22c55e";
  const strokeWidth = Math.max(3, 4 * scale);

  if (!timerEndsAt) return null;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.25s linear" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(20 * scale), fontWeight: 900, color,
      }}>
        {remaining}
      </div>
    </div>
  );
}

/** ~20% tighter lower-third bid panel — proportional scale keeps animations legible. */
const OBS_BID_PANEL = {
  paddingY: 14,
  contentGap: 26,
  hexSize: 88,
  dividerHeight: 72,
  statusFont: 9,
  nameFont: 43,
  tagFont: 10,
  metaFont: 11,
  labelFont: 9,
  valueFont: 11,
  bidFont: 51,
  teamFont: 12,
  hintFont: 10,
  teamLogoH: 19,
  countdownSize: 54,
  statusGap: 4,
  tagMt: 6,
  tagPy: 3,
  tagPx: 11,
  metaMt: 4,
  baseMt: 8,
  basePy: 3,
  basePx: 11,
  bidSectionMinW: 224,
  bidLabelMb: 2,
  bidTeamMt: 5,
} as const;

const TEAM_TICKER_HEIGHT_PX = 46;

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
const TEAM_TICKER_PX_PER_SEC = 50;

function TeamTicker({ teams }: { teams: TeamTickerRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  const contentKey = useMemo(
    () =>
      teams
        .map((t) => `${t.shortCode}:${t.name}:${t.playersBought}:${t.playersDue ?? ""}`)
        .join("|"),
    [teams],
  );

  const { measureRef, trackRef, ready } = useSeamlessTicker(contentKey, {
    enabled: needsScroll && teams.length > 0,
    pxPerSec: TEAM_TICKER_PX_PER_SEC,
  });

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
  }, [teams, measureRef]);

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
        ref={trackRef}
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          width: needsScroll ? undefined : "100%",
          justifyContent: needsScroll ? undefined : "center",
          whiteSpace: "nowrap",
          opacity: needsScroll ? (ready ? 1 : 0) : 1,
          willChange: needsScroll ? "transform" : undefined,
        }}
      >
        <div
          ref={measureRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {teams.map((t, i) => (
            <TeamTickerItem key={`copy-a-${i}`} t={t} />
          ))}
        </div>
        {needsScroll ? (
          <div
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {teams.map((t, i) => (
              <TeamTickerItem key={`copy-b-${i}`} t={t} />
            ))}
          </div>
        ) : null}
      </div>
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
  const { formatAmount } = useAuctionUnit(tournament);

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

  const themeAccent = BIDWAR_BROADCAST_YELLOW;
  const bidColor = state?.currentBidTeamColor || themeAccent;
  const panelAccent = themeAccent;

  const hasPlayer = !!state?.currentPlayer;
  const isActive = displayMode.phase === "live";
  const freezeBidUpdates = displayMode.freezeBidUpdates;
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
  const bottomStackHeight = SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX + teamTickerOffset;
  const showAwaitingPlayer =
    !!state &&
    !hasPlayer &&
    !showSold &&
    !stickyDc &&
    displayMode.overlayMode !== "paused";

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

      {/* ── Top row: tournament · BidWar · sponsor (aligned) ── */}
      <BroadcastOverlayTopBar
        tournamentLogoUrl={tournament?.logoUrl}
        tournamentName={tournament?.name}
        sponsorLogos={sponsorLogos}
      />

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

      {/* ── Between players — subtle hold message above sponsor strip ── */}
      <AnimatePresence>
        {showAwaitingPlayer ? (
          <motion.div
            key="awaiting-player"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: bottomStackHeight + 18,
              zIndex: 28,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 22px",
                borderTop: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
                borderBottom: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
                background: "rgba(0,0,0,0.42)",
                backdropFilter: "blur(4px)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: themeAccent,
                  opacity: 0.85,
                  animation: "livePulse 1.6s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.38em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.62)",
                  fontFamily: "monospace",
                }}
              >
                Awaiting new player
              </span>
            </div>
          </motion.div>
        ) : null}
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
              bottom: bottomStackHeight,
              left: 0, right: 0,
              zIndex: 30,
              overflow: "hidden",
              opacity: displayMode.showStatusOverlay ? 0.4 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            {/* Gradient fade above the panel */}
            <div style={{
              height: 24,
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))",
              pointerEvents: "none",
            }} />

            {/* Main panel */}
            <div style={{
              background: "rgba(0,0,0,0.94)",
              borderTop: `3px solid ${isActive ? panelAccent : "rgba(255,255,255,0.1)"}`,
              boxShadow: isActive ? `0 -4px 40px ${panelAccent}33` : "none",
              padding: `${OBS_BID_PANEL.paddingY}px ${BROADCAST_OVERLAY_PANEL_PADDING_X}px`,
              display: "flex",
              alignItems: "center",
              gap: OBS_BID_PANEL.contentGap,
            }}>
              {/* Hexagonal player photo */}
              <HexPhoto
                src={state?.currentPlayer?.photoUrl}
                color={isActive ? (hasBid ? bidColor : panelAccent) : "#666"}
                size={OBS_BID_PANEL.hexSize}
                playerTag={(state?.currentPlayer as { playerTag?: string | null } | undefined)?.playerTag}
              />

              {/* Player info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: OBS_BID_PANEL.statusGap }}>
                  {isActive ? (
                    <>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "livePulse 1s infinite" }} />
                      <span style={{ fontSize: OBS_BID_PANEL.statusFont, fontWeight: 700, color: "#22c55e", letterSpacing: "0.25em" }}>LIVE AUCTION</span>
                    </>
                  ) : (
                    <span style={{ fontSize: OBS_BID_PANEL.statusFont, fontWeight: 700, color: "#71717a", letterSpacing: "0.25em" }}>UP NEXT</span>
                  )}
                </div>
                <div style={{ fontSize: OBS_BID_PANEL.nameFont, fontWeight: 900, color: "#fff", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "uppercase", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>
                  {state?.currentPlayer?.name}
                </div>
                {(() => {
                  const pt = (state?.currentPlayer as { playerTag?: string | null } | undefined)?.playerTag;
                  const tt = getTagTheme(pt);
                  return tt ? (
                    <div style={{
                      display: "inline-flex", alignItems: "center",
                      marginTop: OBS_BID_PANEL.tagMt,
                      padding: `${OBS_BID_PANEL.tagPy}px ${OBS_BID_PANEL.tagPx}px`,
                      borderRadius: 999,
                      fontSize: OBS_BID_PANEL.tagFont,
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
                <div style={{ fontSize: OBS_BID_PANEL.metaFont, color: "rgba(255,255,255,0.80)", marginTop: OBS_BID_PANEL.metaMt, display: "flex", gap: 10 }}>
                  {state?.currentPlayer?.role && <span>{state.currentPlayer.role}</span>}
                  {state?.currentPlayer?.city && <span style={{ opacity: 0.6 }}>· {state.currentPlayer.city}</span>}
                </div>

                {/* BASE VALUE bar */}
                <div style={{
                  marginTop: OBS_BID_PANEL.baseMt,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: BIDWAR_BROADCAST_YELLOW_SOFT,
                  border: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
                  borderRadius: 6,
                  padding: `${OBS_BID_PANEL.basePy}px ${OBS_BID_PANEL.basePx}px`,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: panelAccent }} />
                  <span style={{ fontSize: OBS_BID_PANEL.labelFont, color: panelAccent, fontWeight: 700, letterSpacing: "0.15em" }}>BASE VALUE</span>
                  <span style={{ fontSize: OBS_BID_PANEL.valueFont, color: "#fff", fontWeight: 800, fontFamily: "monospace" }}>
                    {formatAmount(state?.currentPlayer?.basePrice ?? 0)}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: OBS_BID_PANEL.dividerHeight, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

              {/* Bid section */}
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: OBS_BID_PANEL.bidSectionMinW }}>
                {hasBid ? (
                  freezeBidUpdates ? (
                    <div>
                      <div style={{ fontSize: OBS_BID_PANEL.labelFont, color: "rgba(255,255,255,0.85)", letterSpacing: "0.15em", marginBottom: OBS_BID_PANEL.bidLabelMb }}>LEADING BID</div>
                      <div style={{ fontSize: OBS_BID_PANEL.bidFont, fontWeight: 900, color: bidColor, lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.9)", filter: `drop-shadow(0 0 12px ${bidColor}88)` }}>
                        {formatAmount(state?.currentBid ?? 0)}
                      </div>
                      <div style={{ marginTop: OBS_BID_PANEL.bidTeamMt, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        {state?.currentBidTeamLogoUrl && (
                          <img src={cldUrl(state.currentBidTeamLogoUrl, "teamLogo")} alt="" style={{ height: OBS_BID_PANEL.teamLogoH, objectFit: "contain" }} />
                        )}
                        <span style={{ fontSize: OBS_BID_PANEL.teamFont, color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>{state?.currentBidTeamName}</span>
                      </div>
                    </div>
                  ) : (
                  <motion.div
                    key={state?.currentBid}
                    initial={{ scale: 1.15, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <div style={{ fontSize: OBS_BID_PANEL.labelFont, color: "rgba(255,255,255,0.85)", letterSpacing: "0.15em", marginBottom: OBS_BID_PANEL.bidLabelMb }}>LEADING BID</div>
                    <div style={{ fontSize: OBS_BID_PANEL.bidFont, fontWeight: 900, color: bidColor, lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.9)", filter: `drop-shadow(0 0 12px ${bidColor}88)` }}>
                      {formatAmount(state?.currentBid ?? 0)}
                    </div>
                    <div style={{ marginTop: OBS_BID_PANEL.bidTeamMt, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      {state?.currentBidTeamLogoUrl && (
                        <img src={cldUrl(state.currentBidTeamLogoUrl, "teamLogo")} alt="" style={{ height: OBS_BID_PANEL.teamLogoH, objectFit: "contain" }} />
                      )}
                      <span style={{ fontSize: OBS_BID_PANEL.teamFont, color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>{state?.currentBidTeamName}</span>
                    </div>
                  </motion.div>
                  )
                ) : (
                  <div>
                    <div style={{ fontSize: OBS_BID_PANEL.labelFont, color: "rgba(255,255,255,0.95)", letterSpacing: "0.15em", marginBottom: OBS_BID_PANEL.bidLabelMb }}>OPENING BID</div>
                    <div style={{ fontSize: OBS_BID_PANEL.bidFont, fontWeight: 900, color: "rgba(255,255,255,0.95)", lineHeight: 1, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>
                      {formatAmount(state?.currentBid ?? 0)}
                    </div>
                    <div style={{ fontSize: OBS_BID_PANEL.hintFont, color: "rgba(255,255,255,0.80)", marginTop: OBS_BID_PANEL.bidTeamMt }}>Waiting for first bid...</div>
                  </div>
                )}
              </div>

              {/* Timer */}
              {isActive && !freezeBidUpdates && state?.timerEndsAt && (
                <>
                  <div style={{ width: 1, height: OBS_BID_PANEL.dividerHeight, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <CountdownRing timerEndsAt={state.timerEndsAt} size={OBS_BID_PANEL.countdownSize} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom ticker — sponsors + periodic "Powered by BidWar" ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 25 }}>
        <SponsorTicker logos={sponsorLogos} themeAccent={themeAccent} includePoweredByBidWar overlay />
      </div>

      {/* ── Team squad ticker — above sponsor strip ── */}
      {teams.length > 0 && !showSold && (
        <div style={{
          position: "absolute",
          bottom: SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX,
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
