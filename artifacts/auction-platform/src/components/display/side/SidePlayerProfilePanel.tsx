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

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="relative shrink-0 bg-black/50"
        style={{ height: SIDE_LED_LAYOUT.profileHeaderHeight + SIDE_LED_LAYOUT.dividerHeight }}
      >
        <SideBroadcastHeader tournamentName={tournament.name} variant="profile" />
        <SideDivider top={SIDE_LED_LAYOUT.profileHeaderHeight} />
      </header>

      <div className="relative flex-[40%] shrink-0">
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
        <div className="side-player-photo-gradient absolute inset-0" aria-hidden />
        <div
          className="side-player-serial-badge broadcast-tournament-name absolute z-10 grid place-items-center italic"
          style={{
            fontSize: 30,
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
          }}
        >
          #{player.serialNo}
        </div>
        <div className="side-player-name-zone absolute bottom-0 left-0 right-0">
          <p className="broadcast-category" style={{ margin: 0, fontSize: 34, lineHeight: 1.2 }}>
            <span style={{ color: "var(--accent)" }}>{roleLabel || player.roleRaw}</span>
            {player.categoryName ? (
              <>
                <span style={{ margin: "0 12px", color: "rgba(255,255,255,0.35)" }}>•</span>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{player.categoryName}</span>
              </>
            ) : null}
          </p>
          <h2
            className="broadcast-player-name side-player-name"
            style={{
              margin: "10px 0 0",
              fontSize: "clamp(5rem, 14vw, 9rem)",
              lineHeight: 0.86,
              color: "#fff",
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
              marginTop: 20,
              fontSize: 30,
              lineHeight: 1.35,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
            title={player.achievements}
          >
            <span style={{ fontSize: 28, color: "rgba(255,255,255,0.45)" }}>Highlights: </span>
            {player.achievements}
          </p>
        ) : null}
      </div>

      <footer className="side-player-bid-footer relative shrink-0 px-[5%] min-h-[22%]">
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
              <div className="absolute right-[5%] top-1/2 flex -translate-y-1/2 flex-col items-end">
                <span
                  className="broadcast-kicker"
                  style={{ marginBottom: 8, fontSize: 28, color: "rgba(255,255,255,0.45)" }}
                >
                  Hammer Time
                </span>
                <span
                  className="broadcast-bid-amount"
                  style={{
                    fontSize: 64,
                    lineHeight: 1,
                    color: urgent ? "#ef4444" : "var(--accent)",
                    animation: urgent ? "auction-urgency-pulse 0.8s ease-in-out infinite" : undefined,
                  }}
                >
                  {fmtTimer(countdown)}
                </span>
                <div className="mt-2 h-1.5 w-28 bg-white/10 overflow-hidden">
                  <div
                    className="h-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: urgent ? "#ef4444" : "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div
              key={`${state.currentBid}-${leadingTeam?.id ?? "none"}`}
              className="side-player-bid-hero mx-auto flex w-full max-w-3xl flex-col items-center text-center"
              style={{ animation: live ? "auction-bid-flash 1.2s ease-out" : undefined }}
            >
              <p
                className="broadcast-sponsor-kicker side-player-bid-kicker"
                style={{ margin: "0 0 16px", fontSize: 32 }}
              >
                {state.currentBid > 0 ? "Current Bid" : "Bid Starts At"}
              </p>
              <p
                className="broadcast-bid-amount side-player-bid-amount"
                style={{
                  margin: 0,
                  color: "#fff",
                  ...(teamBidGlow ? { "--bid-team-glow": teamBidGlow } : {}),
                  animation:
                    live && teamBidGlow
                      ? "broadcast-team-bid-glow 2.5s ease-in-out infinite"
                      : live
                        ? "auction-mega-glow 3s ease-in-out infinite"
                        : undefined,
                }}
              >
                {currentBidLabel}
              </p>
              {leadingTeam && state.currentBid > 0 ? (
                <div className="side-player-bid-team mt-5 flex max-w-full items-center justify-center gap-3">
                  {leadingTeam.logoUrl ? (
                    <img src={leadingTeam.logoUrl} alt="" className="h-12 w-12 shrink-0 object-contain" />
                  ) : null}
                  <span
                    className="broadcast-tournament-name"
                    style={{
                      fontSize: 40,
                      lineHeight: 1,
                      color: leadingTeam.color,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {leadingTeam.name}
                  </span>
                </div>
              ) : live ? (
                <p
                  className="broadcast-kicker"
                  style={{ marginTop: 16, fontSize: 28, color: "rgba(255,255,255,0.4)" }}
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
    <p className={`side-player-spec-row min-w-0 leading-snug ${className ?? ""}`}>
      <span className="broadcast-spec-label side-player-spec-label" style={{ fontSize: 30 }} title={fullLabel}>
        {shortLabel}:{" "}
      </span>
      <span
        className="broadcast-spec-value side-player-spec-value"
        style={{
          fontSize: 40,
          textTransform: "uppercase",
          color: accent ? "var(--accent)" : "#fff",
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
