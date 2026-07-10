import { memo, useEffect, useRef, useState } from "react";
import type { LedView } from "@/lib/led-view/types";
import { ChyronStrip } from "./ChyronStrip";
import { SponsorSpotlight } from "./SponsorSpotlight";
import { TopStrip } from "./TopStrip";
import { LedOverlayTopBar } from "./led-overlay-top-bar";
import {
  computeTeamWiseGrid,
  countPlayerPoolByStatus,
  formatTeamWiseMoney,
  formatTeamWiseMoneyShort,
  getTeamWiseStatus,
  getTeamWiseHeaderBandStyle,
  getTeamWisePanelShellStyle,
  getTeamWiseTypography,
  getTeamWisePurseValueStyle,
  getTeamWiseProgressTrackStyle,
  getTeamWiseProgressFillStyle,
} from "./team-wise-layout";
import type { LedTeam } from "@/lib/led-view/types";
import { LedTopBrandMark } from "./led-top-brand-mark";
import { PurseBoosterLedOverlay } from "../purse-booster-led-overlay";
import {
  LED_AMOUNT_CLASS,
  LED_HEADLINE_CLASS,
  LED_META_LABEL_CLASS,
  LED_PLAYER_NAME_CLASS,
  LED_ROLE_META_CLASS,
  LED_SECTION_KICKER_CLASS,
  LED_STAGE_FONT_CLASS,
  LED_SUBHEAD_CLASS,
} from "@/lib/led-display-typography";
import { normalizeAuctionUnit, formatAuctionAmount } from "@workspace/api-base/auction-unit";
import { cldUrl } from "@/lib/cloudinary";
import { PlayerDirectoryOverlay } from "./player-directory-overlay";

function LedPoweredByFooter({ text }: { text?: string }) {
  return (
    <div className="py-[0.4cqh] flex items-center justify-center bg-black/20 border-t border-white/[0.05]">
      {text ? (
        <p className={`${LED_META_LABEL_CLASS} text-white/30`}>{text}</p>
      ) : (
        <p className={`${LED_META_LABEL_CLASS} text-white/30`}>
          Powered by{" "}
          <span
            className={`${LED_SUBHEAD_CLASS} text-sm`}
            style={{ color: "var(--accent)" }}
          >
            BIDWAR.IN
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * EFFECTS LAYER — full-stage overlays driven by derivedState from production DB.
 *   sold / unsold     → outcome slam
 *   paused            → "PAUSED" hold
 *   break             → "BREAK" with countdown
 *   fortuneWheel      → wheel spinner / winner reveal
 *   teamPurse         → "TEAM PURSE VIEW" overlay
 *   teamWise          → compact broadcast team rows (purse + squad stats)
 * Purse booster overlay renders as a top broadcast panel for ~10 seconds.
 */
function BoosterOverlaySlot({
  overlay,
  unit,
}: {
  overlay: LedView["purseBoosterOverlay"];
  unit: ReturnType<typeof normalizeAuctionUnit>;
}) {
  return <PurseBoosterLedOverlay overlay={overlay} unit={unit} />;
}

export const EffectsLayer = memo(function EffectsLayer({
  view,
}: {
  view: LedView;
}) {
  const {
    derivedState,
    leadingTeam,
    currentBidLabel,
    currentPlayer,
    basePriceLabel,
    lastOutcome,
    breakInfo,
    pausedSeconds,
    wheel,
    state,
    toast: _toast,
    purseBooster: _purseBooster,
    purseBoosterOverlay,
    banner,
    filteredPlayers,
    topSoldPlayers,
    playerFilterLabel,
    displayPlayerFilter,
    tournament,
    branding,
    minimumBid,
    totalPlayers,
    remaining,
  } = view;
  const teams = state.teams;
  const auctionUnit = normalizeAuctionUnit(tournament.auctionUnit);

  const [newPlayerName, setNewPlayerName] = useState<string | null>(null);
  const prevDerivedRef = useRef(derivedState);

  useEffect(() => {
    const prev = prevDerivedRef.current;
    prevDerivedRef.current = derivedState;
    if (prev === "awaitingNext" && derivedState === "bidding" && currentPlayer?.name) {
      setNewPlayerName(currentPlayer.name);
      const timer = window.setTimeout(() => setNewPlayerName(null), 8000);
      return () => window.clearTimeout(timer);
    }
  }, [derivedState, currentPlayer?.name]);


  // ---------- SOLD ----------
  if (derivedState === "sold") {
    const teamName = lastOutcome?.teamName ?? leadingTeam?.name ?? "";
    const teamShort = leadingTeam?.short ?? teamName.slice(0, 3).toUpperCase();
    const teamColor = lastOutcome?.teamColor ?? leadingTeam?.color ?? "#22C55E";
    const teamLogo = lastOutcome?.teamLogoUrl ?? leadingTeam?.logoUrl ?? null;
    const photo = lastOutcome?.photoUrl ?? currentPlayer?.portrait ?? "";
    const playerName = lastOutcome?.playerName ?? currentPlayer?.name ?? "";
    const amount = lastOutcome?.amount
      ? formatAuctionAmount(lastOutcome.amount, auctionUnit)
      : currentBidLabel;

    return (
      <div className="absolute inset-0 z-30 grid place-items-center pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(ellipse at center, ${teamColor}66 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute inset-y-0 w-1/3"
          style={{
            background: `linear-gradient(90deg, transparent, ${teamColor}cc, transparent)`,
            animation: "auction-team-sweep 1.8s ease-out 0.4s both",
          }}
        />
        <div
          className="relative grid max-w-[92cqw] grid-cols-[auto_1fr_auto] items-center gap-[1.7cqw] px-[2.5cqw] py-[1.1cqh] border-[0.42cqw] bg-black/85"
          style={{
            borderColor: teamColor,
            animation: "auction-sold-slam 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          {photo ? (
            <img
              src={cldUrl(photo, "soldCard")}
              alt={playerName}
              className="h-[14.8cqh] w-[6.7cqw] object-cover border-[0.21cqw]"
              style={{ borderColor: teamColor }}
            />
          ) : (
            <div className="h-[14.8cqh] w-[6.7cqw] bg-white/5 border-[0.21cqw]" style={{ borderColor: teamColor }} />
          )}
          <div className="flex flex-col items-center min-w-0">
            <p
              className="font-['Bebas_Neue'] text-[clamp(3rem,14cqw,14rem)] leading-[0.85] tracking-tighter text-center"
              style={{ color: teamColor }}
            >
              SOLD
            </p>
            <p className="font-['Bebas_Neue'] text-[clamp(1.25rem,3.5cqw,3rem)] tracking-widest text-center text-white mt-1 tabular-nums">
              {amount} → {teamShort}
            </p>
            <p className="text-[clamp(0.55rem,1.1cqw,0.875rem)] font-mono uppercase tracking-[0.35em] text-white/70 text-center mt-2 truncate max-w-full">
              {playerName} · {teamName}
            </p>
          </div>
          {teamLogo ? (
            <img src={teamLogo} alt={teamName} className="h-[14.8cqh] w-[14.8cqh] object-contain" />
          ) : (
            <div
              className="h-[14.8cqh] w-[14.8cqh] grid place-items-center font-['Bebas_Neue'] text-[clamp(1.5rem,3cqw,2.25rem)] tracking-widest"
              style={{ backgroundColor: teamColor, color: "#000" }}
            >
              {teamShort}
            </div>
          )}
        </div>
        <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
      </div>
    );
  }

  // ---------- UNSOLD ----------
  if (derivedState === "unsold") {
    const photo = lastOutcome?.photoUrl ?? currentPlayer?.portrait ?? "";
    const playerName = lastOutcome?.playerName ?? currentPlayer?.name ?? "";
    return (
      <div className="absolute inset-0 z-30 grid place-items-center pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, rgba(239,68,68,0.35), transparent 70%)",
            animation: "auction-red-wash 0.6s ease-out both",
          }}
        />
        <div
          className="relative grid grid-cols-[auto_1fr] items-center gap-8 px-12 py-6 border-8 border-red-500 bg-black/85"
          style={{ animation: "auction-sold-slam 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
        >
          {photo ? (
            <img
              src={cldUrl(photo, "soldCard")}
              alt={playerName}
              className="h-40 w-32 object-cover border-4 border-red-500 grayscale"
            />
          ) : null}
          <div>
            <p className="font-['Bebas_Neue'] text-[clamp(4rem,12cqw,12rem)] leading-[0.85] tracking-tighter text-red-500">
              UNSOLD
            </p>
            <p className="text-xs font-mono uppercase tracking-[0.35em] text-white/60 mt-2">
              {playerName} · Base {basePriceLabel} unmet
            </p>
          </div>
        </div>
        <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
      </div>
    );
  }

  // ---------- AWAITING NEXT (deferred player — keep stage, show notices) ----------
  if (derivedState === "awaitingNext") {
    const playerName = lastOutcome?.playerName ?? currentPlayer?.name ?? "Player";
    return (
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="absolute inset-x-0 bottom-0 top-[35%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-[10%] flex flex-col items-center gap-4 px-[6%]">
          <div
            className="max-w-3xl border-4 border-amber-400/85 bg-black/88 px-10 py-5 text-center shadow-[0_0_40px_rgba(245,158,11,0.25)]"
            style={{ animation: "auction-sold-slam 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.55em] text-amber-300/90">
              Player Deferred
            </p>
            <p className="font-['Bebas_Neue'] text-[clamp(2rem,5cqw,4rem)] leading-none tracking-wide text-white mt-2">
              {playerName}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-amber-200/85 mt-3">
              Returned to available pool
            </p>
          </div>
          <div className="border border-white/20 bg-black/65 px-8 py-3 backdrop-blur-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-white/75">
              Awaiting next player
            </p>
          </div>
        </div>
        <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
      </div>
    );
  }

  // ---------- PAUSED ----------
  if (derivedState === "paused") {
    return (
      <div className="absolute inset-0 z-30 grid place-items-center pointer-events-none">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative px-16 py-10 border-8 border-amber-400 bg-black/90 flex items-center gap-8"
             style={{ animation: "auction-sold-slam 0.5s ease-out both" }}>
          <div className="flex gap-2">
            <span className="block w-5 h-20 bg-amber-400" />
            <span className="block w-5 h-20 bg-amber-400" />
          </div>
          <div>
            <p className="font-['Bebas_Neue'] text-[clamp(4rem,10cqw,10rem)] leading-[0.85] tracking-tighter text-amber-400">
              PAUSED
            </p>
            {pausedSeconds != null ? (
              <p className="text-xs font-mono uppercase tracking-[0.35em] text-white/60 mt-2">
                Resume at {pausedSeconds}s remaining
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ---------- BREAK ----------
  if (derivedState === "break") {
    const mm = Math.floor(breakInfo.secondsLeft / 60).toString().padStart(2, "0");
    const ss = (breakInfo.secondsLeft % 60).toString().padStart(2, "0");
    const poweredBy = branding?.poweredByText ?? "Powered by BidWar";
    return (
      <div className={`absolute inset-0 z-30 grid grid-rows-[5.2cqh_1fr_auto] pointer-events-none overflow-hidden ${LED_STAGE_FONT_CLASS}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-black to-orange-950" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(245,158,11,0.4) 0%, transparent 60%)",
          }}
        />

        <LedOverlayTopBar
          tournamentName={tournament.name}
          tournamentLogoUrl={tournament.logoUrl}
          isTrial={tournament.isTrial}
          barClassName="backdrop-blur-sm"
        />

        {/* Center content */}
        <div className="relative grid place-items-center">
          <div
            className="relative text-center px-16 py-10 border-8 border-amber-400 bg-black/70"
            style={{ animation: "auction-sold-slam 0.6s ease-out both" }}
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.6em] text-amber-300/80">
              Auction Paused
            </p>
            <p
              className="font-['Bebas_Neue'] text-[clamp(6rem,18cqw,18rem)] leading-[0.85] tracking-tighter text-amber-400 mt-2"
              style={{ textShadow: "0 0 60px rgba(245,158,11,0.6)" }}
            >
              BREAK
            </p>
            {breakInfo.secondsLeft > 0 ? (
              <p className="font-['Bebas_Neue'] text-7xl md:text-8xl tabular-nums text-white mt-4 tracking-wider">
                {mm}:{ss}
              </p>
            ) : (
              <p className="text-xs font-mono uppercase tracking-[0.4em] text-white/60 mt-4">
                Resuming shortly
              </p>
            )}
            {breakInfo.message ? (
              <p className="text-sm md:text-base font-mono uppercase tracking-[0.35em] text-amber-200/90 mt-6">
                {breakInfo.message}
              </p>
            ) : null}
          </div>
        </div>

        <LedPoweredByFooter text={poweredBy} />
      </div>
    );
  }

  // ---------- PRE-AUCTION COUNTDOWN ----------
  if (derivedState === "preAuction") {
    const mm = Math.floor(breakInfo.secondsLeft / 60).toString().padStart(2, "0");
    const ss = (breakInfo.secondsLeft % 60).toString().padStart(2, "0");
    const showMinutes = breakInfo.secondsLeft >= 60;
    return (
      <div className="absolute inset-0 z-30 grid place-items-center pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-950 to-black" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 35%, transparent) 0%, transparent 65%)",
            animation: "auction-red-wash 1.2s ease-out both",
          }}
        />
        <div
          className="relative text-center"
          style={{ animation: "auction-sold-slam 0.6s ease-out both" }}
        >
          <p
            className="text-xs font-mono uppercase tracking-[0.6em] mb-3"
            style={{ color: "var(--accent)" }}
          >
            Get Ready
          </p>
          <p
            className="font-['Bebas_Neue'] text-[clamp(3rem,7cqw,6rem)] leading-none tracking-widest text-white"
          >
            AUCTION STARTS IN
          </p>
          <p
            key={breakInfo.secondsLeft}
            className="font-['Bebas_Neue'] text-[clamp(10rem,28cqw,28rem)] leading-[0.85] tracking-tighter tabular-nums mt-4"
            style={{
              color: "var(--accent)",
              textShadow: "0 0 80px color-mix(in srgb, var(--accent) 70%, transparent)",
              animation: "auction-sold-slam 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            {showMinutes ? `${mm}:${ss}` : ss}
          </p>
          {breakInfo.message ? (
            <p className="text-sm md:text-lg font-mono uppercase tracking-[0.4em] text-white/80 mt-4">
              {breakInfo.message}
            </p>
          ) : null}
        </div>
      </div>
    );
  }


  // ---------- FORTUNE WHEEL ----------
  if (derivedState === "fortuneWheel") {
    return (
      <div className="absolute inset-0 z-30 grid place-items-center pointer-events-none">
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
        <div className="relative flex flex-col items-center gap-8" style={{ animation: "auction-sold-slam 0.6s ease-out both" }}>
          <p className="text-[10px] font-mono uppercase tracking-[0.5em] text-white/60">
            Fortune Wheel
          </p>
          <FortuneWheel items={wheel.items} spinning={wheel.spinning} winner={wheel.winner} />
          {wheel.winner ? (
            <div className="px-8 py-3 border-4" style={{ borderColor: "var(--accent)" }}>
              <p className="font-['Bebas_Neue'] text-5xl tracking-widest text-white">
                {wheel.winner}
              </p>
            </div>
          ) : (
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-white/50">
              {wheel.spinning ? "Spinning…" : "Get Ready"}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---------- TEAM PURSE VIEW ----------
  if (derivedState === "teamPurse") {
    const n = Math.max(teams.length, 1);
    // Choose rows so cards stay landscape-comfortable and never scroll.
    const rows = n <= 3 ? 1 : n <= 6 ? 2 : n <= 12 ? 3 : n <= 16 ? 4 : 5;
    const cols = Math.ceil(n / rows);
    const fmt = (v: number) => v.toLocaleString("en-IN");
    // Scale font size by row count so larger grids shrink content proportionally,
    // but with a comfortable floor so text stays readable on screen.
    const scale = 1 / rows;
    const nameSize = `${1.8 * scale + 0.85}cqw`;
    const amountSize = `${2.6 * scale + 1.1}cqw`;
    const subSize = `${1.2 * scale + 0.75}cqw`;
    const labelSize = `${0.6 * scale + 0.55}cqw`;

    return (
      <div className={`absolute inset-0 z-30 grid grid-rows-[5.2cqh_1fr] pointer-events-none ${LED_STAGE_FONT_CLASS}`}>
        <div className="absolute inset-0 bg-[#070b1a]" />
        <LedOverlayTopBar
          tournamentName={tournament.name}
          tournamentLogoUrl={tournament.logoUrl}
          isTrial={tournament.isTrial}
          right={
            <p className={`${LED_HEADLINE_CLASS} text-xl md:text-2xl text-white/90`}>
              TEAM PURSE
            </p>
          }
        />

        <div
          className="relative px-[1.5%] pb-[1.5%] grid gap-[0.6%] min-h-0"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {teams.map((t) => (
            <div
              key={t.id}
              className="relative flex items-center gap-[4%] px-[3%] py-[2%] bg-[#0e1430] border border-white/5 rounded-md overflow-hidden min-w-0 min-h-0"
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ backgroundColor: t.color }}
              />
              {/* Logo — fixed-width box, never grows */}
              <div className="shrink-0 grid place-items-center" style={{ width: "22%", aspectRatio: "1 / 1" }}>
                {t.logoUrl ? (
                  <img src={t.logoUrl} alt={t.short} className="max-h-full max-w-full object-contain" />
                ) : (
                  <div
                    className="h-full w-full grid place-items-center font-['Bebas_Neue'] rounded-sm"
                    style={{ backgroundColor: t.color, color: "#000", fontSize: amountSize }}
                  >
                    {t.short}
                  </div>
                )}
              </div>
              {/* Body */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <p
                  className="font-['Barlow_Condensed'] font-semibold leading-tight text-white/90 tracking-wide uppercase truncate"
                  style={{ fontSize: nameSize }}
                >
                  {t.name}
                </p>
                <div className="flex items-baseline justify-between gap-2 mt-[2%]">
                  <span className="font-mono tracking-wider text-emerald-400" style={{ fontSize: subSize }}>
                    P. <span className="text-white/90">{t.playersBought}</span>
                  </span>
                  <span
                    className="font-['Bebas_Neue'] leading-none tabular-nums text-amber-400"
                    style={{ fontSize: amountSize }}
                  >
                    {fmt(t.purse)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-[3%] pt-[3%] border-t border-white/10">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono uppercase tracking-[0.2em] text-white/40" style={{ fontSize: labelSize }}>
                      MAX
                    </span>
                    <span className="font-['Bebas_Neue'] tabular-nums text-white/85 ml-auto" style={{ fontSize: subSize }}>
                      {fmt(t.maxBidAllowed)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono uppercase tracking-[0.2em] text-white/40" style={{ fontSize: labelSize }}>
                      RES
                    </span>
                    <span className="font-['Bebas_Neue'] tabular-nums text-white/85 ml-auto" style={{ fontSize: subSize }}>
                      {fmt(t.reservedAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }






  // ---------- BANNER VIEW ----------
  if (derivedState === "banner") {
    if (!banner.url) {
      return (
        <div className={`absolute inset-0 z-30 bg-black overflow-hidden grid grid-rows-[5.2cqh_1fr_minmax(4.5cqh,8%)] ${LED_STAGE_FONT_CLASS}`}>
          <TopStrip view={view} />
          <div className="relative min-h-0 h-full w-full">
            <SponsorSpotlight
              tournamentName={tournament.name}
              sponsors={view.sponsors ?? []}
            />
          </div>
          <ChyronStrip view={view} />
          <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
        </div>
      );
    }

    return (
      <div className={`absolute inset-0 z-30 bg-black overflow-hidden grid grid-rows-[5.2cqh_1fr_auto] ${LED_STAGE_FONT_CLASS}`}>
        <LedOverlayTopBar
          tournamentName={tournament.name}
          tournamentLogoUrl={tournament.logoUrl}
          isTrial={tournament.isTrial}
          barClassName="bg-black/70 backdrop-blur-sm"
        />


        {/* Banner image */}
        <div className="relative min-h-0 grid place-items-center bg-black">
          {banner.url ? (
            <img
              src={banner.url}
              alt="Banner"
              className="w-full h-full"
              style={{ objectFit: banner.fit }}
            />
          ) : (
            <div className="text-center flex flex-col items-center gap-4">
              <LedTopBrandMark />
              <p
                className={`${LED_HEADLINE_CLASS} text-white/90`}
                style={{ fontSize: "2.4cqw" }}
              >
                {tournament.name}
              </p>
            </div>
          )}
        </div>

        {/* Powered by — ticker hidden while banner is shown */}
        <LedPoweredByFooter />

        <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
      </div>
    );
  }



  // ---------- TEAM WISE VIEW ----------
  if (derivedState === "teamWise") {
    const n = Math.max(teams.length, 1);
    const { cols, rows } = computeTeamWiseGrid(n);
    const type = getTeamWiseTypography(rows);
    const poolCounts = countPlayerPoolByStatus(state.players);

    return (
      <div
        className={`absolute inset-0 z-30 grid grid-rows-[5.2cqh_1fr_auto_auto] overflow-hidden pointer-events-none ${LED_STAGE_FONT_CLASS}`}
      >
        <div className="absolute inset-0 team-wise-scene" />
        <div className="absolute inset-0 team-wise-scene-stadium pointer-events-none" />
        <div className="absolute inset-0 team-wise-scene-grid-glow pointer-events-none" />
        <div className="absolute inset-0 team-wise-scene-vignette pointer-events-none" />
        <div className="absolute inset-0 team-wise-scene-texture pointer-events-none" />
        <div className="absolute inset-0 team-wise-scene-particles pointer-events-none" />
        <LedOverlayTopBar
          tournamentName={tournament.name}
          tournamentLogoUrl={tournament.logoUrl}
          isTrial={tournament.isTrial}
          right={
            <div className="text-right">
              <p className={LED_SECTION_KICKER_CLASS}>Squad Status</p>
              <p
                className={`${LED_HEADLINE_CLASS} text-2xl md:text-4xl mt-0.5`}
                style={{ color: "var(--accent)" }}
              >
                TEAM WISE
              </p>
            </div>
          }
        />

        <div
          className="relative px-[1.6%] pt-[1%] pb-[0.72%] grid min-h-0 min-w-0"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            columnGap: "1.2%",
            rowGap: "2%",
          }}
        >
          {teams.length === 0 ? (
            <div className="col-span-full grid place-items-center">
              <p className="text-white/40 font-mono uppercase tracking-[0.4em] text-sm">No teams yet</p>
            </div>
          ) : (
            teams.map((team) => (
              <TeamWiseBroadcastPanel
                key={team.id}
                team={team}
                minimumBid={minimumBid}
                type={type}
                unit={auctionUnit}
                isActive={leadingTeam?.id === team.id}
                countdown={leadingTeam?.id === team.id ? state.countdown : null}
              />
            ))
          )}
        </div>

        {/* Bottom summary bar */}
        <TeamWiseSummaryBar
          poolCounts={poolCounts}
          metaSize={type.meta}
          valueSize={type.squad}
          lastOutcome={lastOutcome}
          teams={teams}
          unit={auctionUnit}
          soldAtAuction={state.players.filter((p) => p.status === "sold").length}
        />

        <LedPoweredByFooter />
        <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
      </div>
    );
  }

  // ---------- PLAYER WISE VIEW (with filters) ----------
  if (derivedState === "playerWise") {
    return (
      <>
        <PlayerDirectoryOverlay
          players={filteredPlayers}
          teams={teams}
          totalPlayers={state.players.length}
          playerFilterLabel={playerFilterLabel}
          displayPlayerFilter={displayPlayerFilter}
          currentPlayerId={currentPlayer?.id ?? null}
          auctionUnit={auctionUnit}
          purseBoosterOverlay={purseBoosterOverlay}
        />
        <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
      </>
    );
  }

  // ---------- TOP 5 SOLD PLAYERS ----------
  if (derivedState === "topSold") {
    const max = topSoldPlayers[0]?.soldPrice ?? 1;
    const animKey = topSoldPlayers.map((p) => `${p.id}:${p.soldPrice}`).join("|");
    return (
      <div className={`absolute inset-0 z-30 overflow-hidden ${LED_STAGE_FONT_CLASS}`}>
        <div className="absolute inset-0 bg-[#070b1a]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at top, color-mix(in oklab, var(--accent) 25%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="relative h-full grid grid-rows-[5.2cqh_1fr_auto]">
          <LedOverlayTopBar
            tournamentName={tournament.name}
            tournamentLogoUrl={tournament.logoUrl}
          isTrial={tournament.isTrial}
            right={
              <div>
                <p className={LED_SECTION_KICKER_CLASS}>Highest Bids</p>
                <p
                  className={`${LED_HEADLINE_CLASS} text-2xl md:text-4xl mt-0.5`}
                  style={{ color: "var(--accent)" }}
                >
                  TOP 5 PLAYERS SOLD
                </p>
              </div>
            }
          />

          {/* List */}
          <div className="px-[3%] py-[1.5%] flex flex-col justify-center gap-[1.2cqh] min-h-0">
            {topSoldPlayers.length === 0 ? (
              <p className="text-center text-white/40 font-mono uppercase tracking-[0.4em] text-xs">
                No sales yet
              </p>
            ) : (
              topSoldPlayers.map((p, i) => (
                <TopSoldRow
                  key={p.id}
                  rank={i + 1}
                  player={p}
                  max={max}
                  index={i}
                  animKey={animKey}
                  unit={auctionUnit}
                />
              ))
            )}
          </div>

          {/* Sponsor ticker + Powered by footer */}
          <div className="flex flex-col">
            <div className="h-[7cqh] min-h-[5.2cqh]">
              <ChyronStrip view={view} />
            </div>
            <LedPoweredByFooter />
          </div>

        </div>
        <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
      </div>
    );
  }


  // ---------- transient cards over normal stage ----------
  return (
    <>
      {newPlayerName && derivedState === "bidding" ? (
        <div className="absolute inset-x-0 top-[12%] z-30 flex justify-center pointer-events-none px-[6%]">
          <div
            className="border-4 border-emerald-400/80 bg-black/88 px-10 py-4 text-center shadow-[0_0_32px_rgba(52,211,153,0.22)]"
            style={{ animation: "auction-sold-slam 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-emerald-300/90">
              Now Bidding
            </p>
            <p className="font-['Bebas_Neue'] text-[clamp(1.75rem,4cqw,3rem)] leading-none tracking-wide text-white mt-1">
              {newPlayerName}
            </p>
          </div>
        </div>
      ) : null}
      <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />
    </>
  );
});


type TopSoldPlayer = LedView["topSoldPlayers"][number];

type TeamWiseTypography = ReturnType<typeof getTeamWiseTypography>;

function TeamWiseSummaryBar({
  poolCounts,
  metaSize,
  valueSize,
  lastOutcome,
  teams,
  unit,
  soldAtAuction,
}: {
  poolCounts: ReturnType<typeof countPlayerPoolByStatus>;
  metaSize: string;
  valueSize: string;
  lastOutcome: LedView["lastOutcome"];
  teams: LedTeam[];
  unit: ReturnType<typeof normalizeAuctionUnit>;
  soldAtAuction: number;
}) {
  const stats = [
    { label: "Total Players Available", value: poolCounts.available, valueClass: "text-sky-300", iconClass: "bg-sky-400/80" },
    { label: "Total Players Retained", value: poolCounts.retained, valueClass: "text-purple-300", iconClass: "bg-purple-400/80" },
    { label: "Total Players Sold", value: poolCounts.sold, valueClass: "text-emerald-300", iconClass: "bg-emerald-400/80" },
    { label: "Total Players Unsold", value: poolCounts.unsold, valueClass: "text-amber-300", iconClass: "bg-amber-400/80" },
  ] as const;

  const highestPurseTeam =
    teams.length > 0
      ? teams.reduce((best, t) => (t.purse > best.purse ? t : best), teams[0])
      : null;
  const lastSold =
    lastOutcome?.type === "sold" && lastOutcome.playerName ? lastOutcome : null;

  return (
    <div className="relative team-wise-ticker flex items-stretch px-[2.4%] py-[1%] gap-[0.5%]">
      {(lastSold || highestPurseTeam) ? (
        <div className="team-wise-ticker-extra shrink-0">
          {lastSold ? (
            <div className="team-wise-ticker-extra-block">
              <span className="team-wise-label" style={{ fontSize: metaSize }}>
                Last Sold
              </span>
              <p
                className="team-wise-ticker-extra-value mt-[0.2em]"
                style={{ fontSize: valueSize, color: lastSold.teamColor ?? "var(--accent)" }}
              >
                {lastSold.playerName}
              </p>
            </div>
          ) : null}
          {highestPurseTeam ? (
            <div className="team-wise-ticker-extra-block">
              <span className="team-wise-label" style={{ fontSize: metaSize }}>
                Highest Purse
              </span>
              <p
                className="team-wise-ticker-extra-value mt-[0.2em]"
                style={{ fontSize: valueSize, color: highestPurseTeam.color }}
              >
                {highestPurseTeam.short} · {formatTeamWiseMoneyShort(highestPurseTeam.purse, unit)}
              </p>
            </div>
          ) : null}
          <div className="team-wise-ticker-extra-block">
            <span className="team-wise-label" style={{ fontSize: metaSize }}>
              Auction Round
            </span>
            <p className="team-wise-ticker-extra-value mt-[0.2em] text-amber-200/90" style={{ fontSize: valueSize }}>
              {Math.max(1, soldAtAuction + 1)}
            </p>
          </div>
        </div>
      ) : null}

      {stats.map((stat, index) => (
        <div key={stat.label} className="flex flex-1 items-center min-w-0">
          {index > 0 ? <div className="team-wise-ticker-sep mx-[1%]" aria-hidden /> : null}
          <div className="flex flex-1 items-center justify-center min-w-0">
            <div className="flex flex-col items-center min-w-0 gap-[0.28em]">
              <span
                className="team-wise-label text-center leading-tight"
                style={{ fontSize: metaSize }}
              >
                {stat.label}
              </span>
              <div className="flex items-center gap-[0.45em]">
                <span className={`team-wise-ticker-stat-icon ${stat.iconClass}`} aria-hidden />
                <span
                  className={`team-wise-ticker-value ${stat.valueClass}`}
                  style={{ fontSize: valueSize }}
                >
                  {stat.value}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTeamWiseCountdown(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function TeamWiseBroadcastPanel({
  team,
  minimumBid,
  type,
  unit,
  isActive = false,
  countdown = null,
}: {
  team: LedTeam;
  minimumBid: number;
  type: TeamWiseTypography;
  unit: ReturnType<typeof normalizeAuctionUnit>;
  isActive?: boolean;
  countdown?: number | null;
}) {
  const status = getTeamWiseStatus(team, minimumBid);
  const squadCap = team.squadCap;
  const progressPct = Math.min(100, (team.playersBought / squadCap) * 100);

  return (
    <div
      className={`team-wise-panel relative flex flex-col rounded-xl overflow-hidden min-w-0 min-h-0 border ${
        isActive ? "team-wise-panel--active" : ""
      }`}
      style={getTeamWisePanelShellStyle(team.color, isActive)}
    >
      <div className="team-wise-panel-glass" aria-hidden />
      {isActive ? <div className="team-wise-panel-active-ring" aria-hidden /> : null}

      {isActive && countdown != null && countdown > 0 ? (
        <div className="team-wise-last-pick">
          <p className="team-wise-label" style={{ fontSize: type.meta }}>
            Last Pick
          </p>
          <p
            className="team-wise-stat-primary text-amber-200 tabular-nums leading-none mt-[0.15em]"
            style={{ fontSize: type.money }}
          >
            {formatTeamWiseCountdown(countdown)}
          </p>
        </div>
      ) : null}

      {/* Franchise banner — logo + name same row */}
      <div
        className="team-wise-header flex items-center gap-[0.72em] px-[0.72em] py-[0.52em] shrink-0"
        style={getTeamWiseHeaderBandStyle(team.color)}
      >
        <div className="team-wise-header-metal" aria-hidden />
        <div className="team-wise-header-gold-line" aria-hidden />
        <div className="team-wise-header-bottom-edge" aria-hidden />
        <div className="team-wise-header-shine" aria-hidden />
        <div className="team-wise-header-streak" aria-hidden />
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt=""
            aria-hidden
            className="team-wise-header-watermark"
          />
        ) : null}
        <div
          className="team-wise-logo-badge shrink-0 grid place-items-center overflow-hidden"
          style={{ width: type.logo, height: type.logo }}
        >
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.short} className="max-h-[88%] max-w-[88%] object-contain drop-shadow-lg" />
          ) : (
            <span
              className={`${LED_HEADLINE_CLASS} leading-none`}
              style={{ fontSize: type.squad, color: "#fff" }}
            >
              {team.short}
            </span>
          )}
        </div>
        <h2
          className={`team-wise-franchise-name ${LED_HEADLINE_CLASS} flex-1 min-w-0 truncate text-white leading-tight`}
          style={{ fontSize: type.name }}
        >
          {team.name}
        </h2>
      </div>

      {/* Body — justify-between so sections fill the full card height */}
      <div className="relative z-[1] flex flex-col justify-between px-[4.5%] py-[3.5%] flex-1 min-h-0 gap-[0.45em]">

        {/* Financial stats: Purse Left | Max Bid | Reserve */}
        <div className="grid grid-cols-3 gap-[0.5em]">
          {/* Purse Left */}
          <div className="min-w-0">
            <p className="team-wise-label" style={{ fontSize: type.label }}>
              Purse Left
            </p>
            <p
              className="team-wise-stat-hero tabular-nums mt-[0.2em] transition-[color,text-shadow] duration-500"
              style={{ fontSize: type.heroPurse, ...getTeamWisePurseValueStyle(true) }}
            >
              {formatTeamWiseMoneyShort(team.purse, unit)}
            </p>
          </div>
          {/* Max Bid */}
          <div className="min-w-0">
            <p className="team-wise-label" style={{ fontSize: type.label }}>
              Max Bid
            </p>
            <p
              className="team-wise-stat-spendable tabular-nums mt-[0.2em]"
              style={{ fontSize: type.spendable }}
            >
              {formatTeamWiseMoneyShort(team.maxBidAllowed, unit)}
            </p>
            <p className="team-wise-label mt-[0.12em]" style={{ fontSize: type.meta }}>
              On 1 Player
            </p>
          </div>
          {/* Reserve */}
          <div className="min-w-0">
            <p className="team-wise-label" style={{ fontSize: type.label }}>
              Reserve
            </p>
            <p
              className="team-wise-stat-tertiary tabular-nums mt-[0.2em]"
              style={{ fontSize: type.money }}
            >
              {formatTeamWiseMoneyShort(team.reservedAmount, unit)}
            </p>
          </div>
        </div>

        <div className="team-wise-divider" role="separator" />

        {/* Squad counts + status */}
        <div className="grid grid-cols-3 gap-[0.5em] items-center">
          <div className="min-w-0">
            <p className="team-wise-label" style={{ fontSize: type.label }}>
              Bought
            </p>
            <p className="team-wise-stat-tertiary leading-none mt-[0.16em]" style={{ fontSize: type.money }}>
              {team.playersBought}
            </p>
          </div>
          <div className="min-w-0">
            <p className="team-wise-label" style={{ fontSize: type.label }}>
              Slots Left
            </p>
            <p
              className="team-wise-stat-slots leading-none mt-[0.16em]"
              style={{ fontSize: type.squad }}
            >
              {team.slotsRemaining}
            </p>
          </div>
          <div className={status.badgeClass}>
            <span className={status.dotClass} aria-hidden />
            <span style={{ fontSize: type.badge }}>{status.label}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="min-w-0">
          <div
            className="team-wise-progress-track h-[0.6em] min-h-[6px]"
            style={getTeamWiseProgressTrackStyle(team.color)}
          >
            <div
              className="team-wise-progress-fill h-full"
              style={{
                width: `${progressPct}%`,
                ...getTeamWiseProgressFillStyle(team.color),
              }}
            />
          </div>
          <p className="team-wise-label mt-[0.55em]" style={{ fontSize: type.meta }}>
            {team.playersBought} / {squadCap} Players
          </p>
        </div>

        <div className="team-wise-divider" role="separator" />

        {/* Last purchase */}
        <div className="min-w-0">
          <p className="team-wise-label" style={{ fontSize: type.meta }}>
            Last Purchase
          </p>
          {team.lastPurchase ? (
            <div className="team-wise-purchase-strip flex items-baseline justify-between gap-[0.55em]">
              <p
                className={`team-wise-purchase-name ${LED_HEADLINE_CLASS} truncate text-white leading-tight flex-1 min-w-0`}
                style={{ fontSize: type.purse }}
              >
                {team.lastPurchase.playerName}
              </p>
              <p
                className="team-wise-stat-hero tabular-nums shrink-0 leading-none text-right"
                style={{ fontSize: type.spendable, ...getTeamWisePurseValueStyle(true) }}
              >
                {formatTeamWiseMoneyShort(team.lastPurchase.amount, unit)}
              </p>
            </div>
          ) : (
            <p className="team-wise-label mt-[0.24em]" style={{ fontSize: type.meta }}>
              No Purchase Yet —
            </p>
          )}
        </div>
      </div>

      {isActive ? (
        <div className="team-wise-active-pill" aria-label="Active bidding team">
          Active
        </div>
      ) : null}
    </div>
  );
}

function TopSoldRow({
  rank,
  player,
  max,
  index,
  animKey,
  unit,
}: {
  rank: number;
  player: TopSoldPlayer;
  max: number;
  index: number;
  animKey: string;
  unit: ReturnType<typeof normalizeAuctionUnit>;
}) {
  const accent = player.team?.color ?? "var(--accent)";
  const targetPct = Math.max(8, (player.soldPrice / max) * 100);
  const [progress, setProgress] = useState(0); // 0..1
  const duration = 1600;
  const delay = 120 + index * 90;

  useEffect(() => {
    let raf = 0;
    let start = 0;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    setProgress(0);
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setProgress(easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    timeout = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      if (timeout) clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
    // re-run when the row's identity/value changes or list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, player.id, player.soldPrice]);

  const currentAmount = Math.round(player.soldPrice * progress);
  const widthPct = targetPct * progress;
  const formatted = formatAuctionAmount(currentAmount, unit);

  return (
    <div className="flex items-center gap-[1.5cqw]">
      <span
        className={`${LED_AMOUNT_CLASS} text-right tabular-nums`}
        style={{ color: accent, fontSize: "5.5cqw", width: "5cqw" }}
      >
        {rank}
      </span>
      {player.portrait ? (
        <img
          src={cldUrl(player.portrait, "soldCard")}
          alt=""
          className="object-cover border-2"
          style={{ borderColor: accent, height: "7cqw", width: "7cqw" }}
        />
      ) : (
        <div
          className="bg-white/5 border-2"
          style={{ borderColor: accent, height: "7cqw", width: "7cqw" }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`${LED_PLAYER_NAME_CLASS} text-white truncate text-[clamp(1.75rem,3.4cqw,3.25rem)]`}
        >
          {player.name}
        </p>
        <p className="mt-[0.4cqw] truncate leading-tight">
          <span className={LED_ROLE_META_CLASS}>SOLD TO — </span>
          <span
            className={`${LED_HEADLINE_CLASS} text-[clamp(0.9375rem,1.5cqw,1.5rem)] text-white/90`}
          >
            {player.team?.name ?? "—"}
          </span>
        </p>
        <div
          className="mt-[0.7cqw] bg-white/10 overflow-hidden rounded-sm"
          style={{ height: "0.55cqw" }}
        >
          <div
            className="h-full rounded-sm"
            style={{
              width: `${widthPct}%`,
              background: `linear-gradient(90deg, ${accent}, color-mix(in oklab, ${accent} 60%, white))`,
              boxShadow: `0 0 12px ${accent}`,
            }}
          />
        </div>
      </div>
      {player.team?.logoUrl ? (
        <img
          src={player.team.logoUrl}
          alt=""
          className="object-contain"
          style={{ height: "4.5cqw", width: "4.5cqw" }}
        />
      ) : null}
      <p
        className={`${LED_AMOUNT_CLASS} text-right text-[clamp(2rem,4cqw,4.25rem)]`}
        style={{ color: accent, width: "13cqw" }}
      >
        {formatted}
      </p>
    </div>
  );
}


function FortuneWheel({
  items,
  spinning,
  winner,
}: {
  items: { label: string; color?: string }[];
  spinning: boolean;
  winner: string | null;
}) {
  const n = Math.max(items.length, 1);
  const slice = 360 / n;
  const gradient = items
    .map((it, i) => {
      const start = i * slice;
      const end = (i + 1) * slice;
      return `${it.color ?? "#3B82F6"} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="relative h-[clamp(16rem,32cqw,28rem)] w-[clamp(16rem,32cqw,28rem)]">
      <div
        className="absolute inset-0 rounded-full border-8 border-white/20 shadow-[0_0_60px_rgba(0,0,0,0.8)]"
        style={{
          background:
            items.length > 0 ? `conic-gradient(${gradient})` : "conic-gradient(#3B82F6 0deg 360deg)",
          animation: spinning
            ? "auction-wheel-spin 1.2s linear infinite"
            : winner
              ? "auction-wheel-settle 0.6s ease-out both"
              : "none",
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-20 w-20 rounded-full bg-black border-4 border-white/30" />
      </div>
      <div
        className="absolute left-1/2 -top-3 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: "22px solid var(--accent)",
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div className="bg-black/60 px-[8%] py-[6%] flex flex-col justify-center">
      <p className="text-[0.5cqw] font-mono uppercase tracking-[0.25em] text-white/45 leading-none">
        {label}
      </p>
      <p
        className={`font-['Bebas_Neue'] tabular-nums tracking-wide leading-none mt-[6%] ${
          big ? "text-[1.55cqw]" : "text-[1.05cqw]"
        }`}
        style={{ color: accent ?? "#fff" }}
      >
        {value}
      </p>
    </div>
  );
}
