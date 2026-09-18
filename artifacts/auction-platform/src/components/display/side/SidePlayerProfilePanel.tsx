import { memo, useEffect, useMemo, useState } from "react";
import { User, UserRound } from "lucide-react";
import type { LedView } from "@/lib/led-view/types";
import type { PlayerGender } from "@/lib/led-view/player-gender";
import { hasUsablePortrait } from "@/lib/led-view/player-gender";
import { SIDE_LED_LAYOUT } from "@/lib/broadcast-canvas/constants";
import {
  broadcastSpecLabel,
  portraitSpecGridClass,
} from "@/lib/led-view/portrait-footer-stats";
import { cldUrl } from "@/lib/cloudinary";
import { SideBroadcastHeader } from "../broadcast-canvas/SideBroadcastHeader";
import { SideDivider } from "../broadcast-canvas/SideDivider";
import {
  PortraitPlayerTagBadge,
  PortraitPlayerTagGlow,
  portraitTagFrameStyle,
  resolvePortraitPlayerTag,
} from "../v1/portrait-player-tag";

function fmtTimer(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Full player profile for side LED — broadcast canvas typography (matches sponsor screen).
 */
export const SidePlayerProfilePanel = memo(function SidePlayerProfilePanel({
  view,
}: {
  view: LedView;
}) {
  const {
    currentPlayer,
    roleLabel,
    basePriceLabel,
    currentBidLabel,
    leadingTeam,
    lastOutcome,
    state,
    tournament,
    derivedState,
    timerCeiling,
  } = view;

  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [currentPlayer?.id, currentPlayer?.portrait]);

  const sold = derivedState === "sold";
  const soldTeamColor = lastOutcome?.teamColor ?? leadingTeam?.color ?? "#22C55E";
  const soldTeamName = lastOutcome?.teamName ?? leadingTeam?.name ?? null;
  const live = state.isBidding && derivedState === "bidding";
  const teamBidGlow =
    leadingTeam && state.currentBid > 0 ? leadingTeam.color : null;
  const countdown = state.countdown;
  const urgent = live && countdown <= 5 && countdown > 0;
  const ceiling = Math.max(1, timerCeiling);
  const pct = Math.max(0, Math.min(100, (countdown / ceiling) * 100));

  const profileRows = useMemo(() => {
    if (!currentPlayer) return [];

    const specRows = currentPlayer.specs
      .filter((spec) => {
        const label = spec.label?.trim().toLowerCase() ?? "";
        if (label === "role") return false;
        return Boolean(spec.value?.trim());
      })
      .map((spec) => ({
        shortLabel: broadcastSpecLabel(spec.label),
        fullLabel: spec.label,
        value: spec.value.trim(),
      }));

    return [
      { shortLabel: "AGE", fullLabel: "Age", value: currentPlayer.age ? String(currentPlayer.age) : "—" },
      { shortLabel: "CITY", fullLabel: "City", value: currentPlayer.city?.trim() || "—" },
      { shortLabel: "BASE", fullLabel: "Base Price", value: basePriceLabel, accent: true as const },
      ...specRows,
    ];
  }, [currentPlayer, basePriceLabel]);

  const specGridClass = portraitSpecGridClass(profileRows.length);

  if (!currentPlayer) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-[8%] text-center">
        <p className="broadcast-tournament-name" style={{ fontSize: 72, color: "rgba(255,255,255,0.25)" }}>
          PLAYER
        </p>
        <p className="broadcast-kicker" style={{ marginTop: 16, fontSize: 28, color: "rgba(255,255,255,0.45)" }}>
          Awaiting next player
        </p>
        <p className="broadcast-tournament-name" style={{ marginTop: 12, fontSize: 40, color: "rgba(255,255,255,0.7)" }}>
          {tournament.name}
        </p>
      </div>
    );
  }

  const showPhoto = hasUsablePortrait(currentPlayer.portrait) && !photoFailed;
  const player = currentPlayer;
  const tag = resolvePortraitPlayerTag(player.playerTag);
  const frameStyle = portraitTagFrameStyle(tag);

  const bidPopKey = `${state.currentBid}-${leadingTeam?.id ?? "none"}`;
  const bidRestGlow =
    live && teamBidGlow
      ? "broadcast-team-bid-glow 2.5s ease-in-out 0.85s infinite"
      : live
        ? "auction-mega-glow 3s ease-in-out 0.85s infinite"
        : undefined;

  return (
    <div key={player.id} className="side-player-stack flex h-full w-full flex-col">
      <header
        className="relative shrink-0 bg-black/50"
        style={{ height: SIDE_LED_LAYOUT.profileHeaderHeight + SIDE_LED_LAYOUT.dividerHeight }}
      >
        <SideBroadcastHeader tournamentName={tournament.name} variant="profile" isTrial={tournament.isTrial} />
        <SideDivider top={SIDE_LED_LAYOUT.profileHeaderHeight} />
      </header>

      <div className="side-player-portrait relative border-2" style={frameStyle}>
        {showPhoto ? (
          <img
            src={cldUrl(player.portrait, "playerCard")}
            alt={player.name}
            className="side-player-photo absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/[0.06] to-black/80">
            <GenderPortraitIcon gender={player.gender} />
          </div>
        )}
        {tag ? <PortraitPlayerTagGlow tag={tag} /> : null}
        <div className="side-player-portrait-spotlight" aria-hidden />
        <div className="side-player-photo-gradient absolute inset-0" aria-hidden />
        {tag ? (
          <div className="absolute left-[4%] top-[4%] z-10 max-w-[55%]">
            <PortraitPlayerTagBadge tag={tag} fontSize="clamp(18px, 2.2vw, 28px)" />
          </div>
        ) : null}
        <div
          className="side-player-serial-badge led-label absolute z-10 grid place-items-center"
          style={{
            fontFamily: 'var(--led-font-label, "Space Grotesk", sans-serif)',
            fontSize: 28,
            fontWeight: 800,
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
          }}
        >
          #{player.serialNo}
        </div>
        <div className="side-player-name-zone absolute bottom-0 left-0 right-0 z-10">
          <p
            className="led-label flex flex-wrap items-center gap-x-3 gap-y-1"
            style={{
              margin: 0,
              fontFamily: 'var(--led-font-label, "Space Grotesk", sans-serif)',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            <span style={{ color: "var(--accent)" }}>{roleLabel || player.roleRaw}</span>
            {player.categoryName ? (
              <>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>•</span>
                <span style={{ color: "rgba(255,255,255,0.92)" }}>{player.categoryName}</span>
              </>
            ) : null}
            {tag ? (
              <>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>•</span>
                <span style={{ color: tag.color }}>{tag.label}</span>
              </>
            ) : null}
          </p>
          <h2
            className="led-player side-player-name"
            style={{
              margin: "12px 0 0",
              fontFamily: 'var(--led-font-display, "Bebas Neue", sans-serif)',
              fontSize: player.name.length > 20 ? 92 : player.name.length > 14 ? 108 : 126,
              fontWeight: 800,
              letterSpacing: "0.04em",
              lineHeight: 0.88,
              color: "#fff",
              textShadow: "0 4px 24px rgba(0, 0, 0, 0.95), 0 0 40px rgba(0, 0, 0, 0.75)",
            }}
          >
            {player.name}
          </h2>
        </div>
      </div>

      <div className="side-player-stats shrink-0 overflow-hidden px-[5%]">
        <div className={`grid ${specGridClass} side-player-stats-grid`}>
          {profileRows.map((row, index) => (
            <SideSpecRow
              key={`${row.fullLabel}-${index}`}
              shortLabel={row.shortLabel}
              fullLabel={row.fullLabel}
              value={row.value}
              accent={row.accent === true}
              className={
                profileRows.length > 2 &&
                profileRows.length % 2 === 1 &&
                index === profileRows.length - 1
                  ? "col-span-2"
                  : undefined
              }
            />
          ))}
        </div>

        {player.achievements ? (
          <p
            className="broadcast-kicker side-player-highlights"
            style={{
              marginTop: 12,
              fontSize: 28,
              lineHeight: 1.3,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
            title={player.achievements}
          >
            <span style={{ fontSize: 26, color: "rgba(255,255,255,0.45)" }}>Highlights: </span>
            {player.achievements}
          </p>
        ) : null}
      </div>

      <footer className="side-player-bid-footer relative shrink-0 px-[5%] min-h-[20%]">
        {sold ? (
          <div className="side-player-sold-hero flex h-full min-h-[160px] flex-col items-center justify-center text-center">
            <p
              className="broadcast-bid-amount"
              style={{
                margin: 0,
                fontSize: 160,
                lineHeight: 0.9,
                color: soldTeamColor,
                ["--bid-team-glow" as string]: soldTeamColor,
                animation:
                  "auction-sold-slam 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both, broadcast-team-bid-glow 2.5s ease-in-out 0.7s infinite",
              }}
            >
              SOLD
            </p>
            {soldTeamName ? (
              <span
                className="broadcast-tournament-name side-player-sold-team-name mt-8"
                style={{ color: soldTeamColor }}
              >
                {soldTeamName}
              </span>
            ) : null}
          </div>
        ) : (
          <>
            {live ? (
              <div className="absolute right-[5%] top-1/2 z-10 flex -translate-y-1/2 flex-col items-end">
                <span
                  className="led-label"
                  style={{
                    marginBottom: 6,
                    fontFamily: 'var(--led-font-label, "Space Grotesk", sans-serif)',
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "0.10em",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  Hammer Time
                </span>
                <span
                  className="led-timer broadcast-bid-amount"
                  style={{
                    fontFamily: 'var(--led-font-mono, "JetBrains Mono", monospace)',
                    fontSize: 76,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: "-0.01em",
                    color: urgent ? "#ef4444" : "var(--accent)",
                    textShadow: urgent ? "0 0 28px rgba(239, 68, 68, 0.75)" : "0 0 24px var(--accent-glow)",
                    animation: urgent ? "auction-urgency-pulse 0.8s ease-in-out infinite" : undefined,
                  }}
                >
                  {fmtTimer(countdown)}
                </span>
                <div className="mt-2.5 h-2 w-32 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: urgent ? "#ef4444" : "var(--accent)",
                      boxShadow: urgent ? "0 0 10px #ef4444" : "0 0 10px var(--accent)",
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div
              key={bidPopKey}
              className={`side-player-bid-hero side-player-bid-hero--pop mx-auto flex w-full max-w-3xl flex-col items-center text-center`}
            >
              <p
                className="led-label side-player-bid-kicker"
                style={{
                  margin: "0 0 10px",
                  fontFamily: 'var(--led-font-label, "Space Grotesk", sans-serif)',
                  fontSize: 36,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  color: "var(--accent)",
                  textShadow: "0 0 20px var(--accent-glow)",
                }}
              >
                {state.currentBid > 0 ? "Current Bid" : "Bid Starts At"}
              </p>
              <p
                className="led-hero broadcast-bid-amount side-player-bid-amount"
                style={{
                  margin: 0,
                  fontFamily: 'var(--led-font-display, "Bebas Neue", sans-serif)',
                  fontSize: 164,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  color: "#fff",
                  ...(teamBidGlow ? { "--bid-team-glow": teamBidGlow } : {}),
                  animation: [
                    "side-player-bid-pop 0.85s cubic-bezier(0.22, 1.35, 0.36, 1) both",
                    bidRestGlow,
                  ]
                    .filter(Boolean)
                    .join(", "),
                }}
              >
                {currentBidLabel}
              </p>
              {leadingTeam && state.currentBid > 0 ? (
                <div className="side-player-bid-team mt-5 flex max-w-full items-center justify-center gap-4">
                  {leadingTeam.logoUrl ? (
                    <img src={leadingTeam.logoUrl} alt="" className="h-14 w-14 shrink-0 object-contain drop-shadow" />
                  ) : null}
                  <span
                    className="led-team broadcast-tournament-name"
                    style={{
                      fontFamily: 'var(--led-font-primary, "Barlow Condensed", sans-serif)',
                      fontSize: 48,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      lineHeight: 1,
                      color: leadingTeam.color,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textShadow: `0 0 24px ${leadingTeam.color}66`,
                    }}
                  >
                    {leadingTeam.name}
                  </span>
                </div>
              ) : live ? (
                <p
                  className="led-status"
                  style={{
                    marginTop: 16,
                    fontFamily: 'var(--led-font-label, "Space Grotesk", sans-serif)',
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  Waiting for first bid
                </p>
              ) : null}
            </div>
          </>
        )}
      </footer>
    </div>
  );
});

function SideSpecRow({
  shortLabel,
  fullLabel,
  value,
  accent,
  className,
}: {
  shortLabel: string;
  fullLabel: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <p className={`side-player-spec-row min-w-0 leading-snug flex items-baseline gap-2.5 ${className ?? ""}`}>
      <span
        className="led-label side-player-spec-label"
        style={{
          fontFamily: 'var(--led-font-label, "Space Grotesk", sans-serif)',
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "rgba(255, 255, 255, 0.82)",
          textTransform: "uppercase",
        }}
        title={fullLabel}
      >
        {shortLabel}:
      </span>
      <span
        className="led-value side-player-spec-value"
        style={{
          fontFamily: 'var(--led-font-label, "Space Grotesk", sans-serif)',
          fontSize: 42,
          fontWeight: 800,
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
          textTransform: "uppercase",
          color: accent ? "var(--accent)" : "#ffffff",
          textShadow: accent ? "0 0 16px var(--accent-glow)" : "0 2px 8px rgba(0,0,0,0.6)",
        }}
        title={value}
      >
        {value}
      </span>
    </p>
  );
}

function GenderPortraitIcon({ gender }: { gender: PlayerGender }) {
  const size = 96;
  const className = "text-white/20";
  if (gender === "female") {
    return <UserRound width={size} height={size} className={className} strokeWidth={1.15} aria-hidden />;
  }
  return <User width={size} height={size} className={className} strokeWidth={1.15} aria-hidden />;
}
