import { memo, useEffect, useState } from "react";
import type { LedView } from "@/lib/led-view/types";
import { ChyronStrip } from "./ChyronStrip";
import { SponsorSpotlight } from "./SponsorSpotlight";
import { TopStrip } from "./TopStrip";
import { LedOverlayTopBar } from "./led-overlay-top-bar";
import {
  computeTeamWiseGrid,
  formatTeamWiseMoney,
  formatTeamWiseMoneyShort,
  getTeamWiseStatus,
  getTeamWiseTypography,
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
    <div className="py-[0.4vh] flex items-center justify-center bg-black/20 border-t border-white/[0.05]">
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
          className="relative grid grid-cols-[auto_1fr_auto] items-center gap-8 px-12 py-6 border-8 bg-black/85"
          style={{
            borderColor: teamColor,
            animation: "auction-sold-slam 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          {photo ? (
            <img
              src={cldUrl(photo, "soldCard")}
              alt={playerName}
              className="h-40 w-32 object-cover border-4"
              style={{ borderColor: teamColor }}
            />
          ) : (
            <div className="h-40 w-32 bg-white/5 border-4" style={{ borderColor: teamColor }} />
          )}
          <div className="flex flex-col items-center">
            <p
              className="font-['Bebas_Neue'] text-[clamp(5rem,14vw,14rem)] leading-[0.85] tracking-tighter text-center"
              style={{ color: teamColor }}
            >
              SOLD
            </p>
            <p className="font-['Bebas_Neue'] text-3xl md:text-5xl tracking-widest text-center text-white mt-1 tabular-nums">
              {amount} → {teamShort}
            </p>
            <p className="text-xs md:text-sm font-mono uppercase tracking-[0.35em] text-white/70 text-center mt-2">
              {playerName} · {teamName}
            </p>
          </div>
          {teamLogo ? (
            <img src={teamLogo} alt={teamName} className="h-32 w-32 object-contain" />
          ) : (
            <div
              className="h-32 w-32 grid place-items-center font-['Bebas_Neue'] text-4xl tracking-widest"
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
            <p className="font-['Bebas_Neue'] text-[clamp(4rem,12vw,12rem)] leading-[0.85] tracking-tighter text-red-500">
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
            <p className="font-['Bebas_Neue'] text-[clamp(4rem,10vw,10rem)] leading-[0.85] tracking-tighter text-amber-400">
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
      <div className={`absolute inset-0 z-30 grid grid-rows-[3.5rem_1fr_auto] pointer-events-none overflow-hidden ${LED_STAGE_FONT_CLASS}`}>
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
              className="font-['Bebas_Neue'] text-[clamp(6rem,18vw,18rem)] leading-[0.85] tracking-tighter text-amber-400 mt-2"
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
            className="font-['Bebas_Neue'] text-[clamp(3rem,7vw,6rem)] leading-none tracking-widest text-white"
          >
            AUCTION STARTS IN
          </p>
          <p
            key={breakInfo.secondsLeft}
            className="font-['Bebas_Neue'] text-[clamp(10rem,28vw,28rem)] leading-[0.85] tracking-tighter tabular-nums mt-4"
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
    const nameSize = `${1.8 * scale + 0.85}vw`;
    const amountSize = `${2.6 * scale + 1.1}vw`;
    const subSize = `${1.2 * scale + 0.75}vw`;
    const labelSize = `${0.6 * scale + 0.55}vw`;

    return (
      <div className={`absolute inset-0 z-30 grid grid-rows-[3.5rem_1fr] pointer-events-none ${LED_STAGE_FONT_CLASS}`}>
        <div className="absolute inset-0 bg-[#070b1a]" />
        <LedOverlayTopBar
          tournamentName={tournament.name}
          tournamentLogoUrl={tournament.logoUrl}
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
        <div className={`absolute inset-0 z-30 bg-black overflow-hidden grid grid-rows-[3.5rem_1fr_minmax(3rem,8%)] ${LED_STAGE_FONT_CLASS}`}>
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
      <div className={`absolute inset-0 z-30 bg-black overflow-hidden grid grid-rows-[3.5rem_1fr_auto] ${LED_STAGE_FONT_CLASS}`}>
        <LedOverlayTopBar
          tournamentName={tournament.name}
          tournamentLogoUrl={tournament.logoUrl}
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
                style={{ fontSize: "2.4vw" }}
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
    const totalSold = teams.reduce((s, t) => s + t.playersBought, 0);
    const totalPurseLeft = teams.reduce((s, t) => s + t.purse, 0);
    const playerTotal = totalPlayers || (totalSold + remaining);

    return (
      <div
        className={`absolute inset-0 z-30 grid grid-rows-[3.5rem_1fr_auto_auto] overflow-hidden pointer-events-none ${LED_STAGE_FONT_CLASS}`}
      >
        <div className="absolute inset-0 bg-[#070b1a]" />
        <LedOverlayTopBar
          tournamentName={tournament.name}
          tournamentLogoUrl={tournament.logoUrl}
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
          className="relative px-[1.2%] pt-[0.6%] pb-[0.5%] grid min-h-0 min-w-0"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            gap: "0.9%",
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
              />
            ))
          )}
        </div>

        {/* Bottom summary bar */}
        <TeamWiseSummaryBar
          totalSold={totalSold}
          playerTotal={playerTotal}
          totalPurseLeft={totalPurseLeft}
          labelSize={type.label}
          metaSize={type.meta}
          unit={auctionUnit}
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
        <div className="relative h-full grid grid-rows-[3.5rem_1fr_auto]">
          <LedOverlayTopBar
            tournamentName={tournament.name}
            tournamentLogoUrl={tournament.logoUrl}
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
          <div className="px-[3%] py-[1.5%] flex flex-col justify-center gap-[1.2vh] min-h-0">
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
            <div className="h-[7vh] min-h-[56px]">
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
  return <BoosterOverlaySlot overlay={purseBoosterOverlay} unit={auctionUnit} />;
});


type TopSoldPlayer = LedView["topSoldPlayers"][number];

type TeamWiseTypography = ReturnType<typeof getTeamWiseTypography>;

function TeamWiseSummaryBar({
  totalSold,
  playerTotal,
  totalPurseLeft,
  labelSize,
  metaSize,
  unit,
}: {
  totalSold: number;
  playerTotal: number;
  totalPurseLeft: number;
  labelSize: string;
  metaSize: string;
  unit: ReturnType<typeof normalizeAuctionUnit>;
}) {
  return (
    <div className="relative flex items-center justify-end gap-[2%] px-[1.5%] py-[0.55%] bg-[#080d1e] border-t border-white/[0.08]">
      <div className="flex items-center gap-[0.5em] shrink-0">
        <span className="font-mono uppercase tracking-[0.08em] text-white/45 leading-none" style={{ fontSize: metaSize }}>
          Total Players Sold
        </span>
        <span className={`${LED_HEADLINE_CLASS} text-white/90 leading-none`} style={{ fontSize: labelSize }}>
          {totalSold} / {playerTotal || "—"}
        </span>
      </div>

      <div className="flex items-center gap-[0.5em] shrink-0 border-l border-white/[0.08] pl-[1.5%]">
        <span className="font-mono uppercase tracking-[0.08em] text-white/45 leading-none" style={{ fontSize: metaSize }}>
          Total Purse Left
        </span>
        <span
          className="font-['Barlow_Condensed'] font-bold tabular-nums text-amber-300 leading-none"
          style={{ fontSize: labelSize }}
        >
          {formatTeamWiseMoney(totalPurseLeft, unit)}
        </span>
      </div>
    </div>
  );
}

function TeamWiseBroadcastPanel({
  team,
  minimumBid,
  type,
  unit,
}: {
  team: LedTeam;
  minimumBid: number;
  type: TeamWiseTypography;
  unit: ReturnType<typeof normalizeAuctionUnit>;
}) {
  const status = getTeamWiseStatus(team, minimumBid);
  const squadCap = Math.max(team.maximumSquadSize, team.playersBought, 1);
  const progressPct = Math.min(100, (team.playersBought / squadCap) * 100);

  return (
    <div className="relative flex flex-col bg-[#0d1220] border border-white/[0.09] rounded-xl overflow-hidden min-w-0 min-h-0 shadow-[0_8px_32px_rgba(0,0,0,0.75),0_4px_14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.35)]">

      {/* Colored header band — logo + name same row */}
      <div
        className="flex items-center gap-[0.45em] px-[0.55em] py-[0.38em] shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${team.color} 55%, #0a1022)` }}
      >
        <div
          className="shrink-0 grid place-items-center rounded overflow-hidden bg-black/20"
          style={{ width: type.logo, height: type.logo }}
        >
          {team.logoUrl ? (
            <img src={team.logoUrl} alt={team.short} className="max-h-[90%] max-w-[90%] object-contain" />
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
          className={`${LED_HEADLINE_CLASS} flex-1 min-w-0 truncate text-white leading-tight`}
          style={{ fontSize: type.name, textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
        >
          {team.name}
        </h2>
      </div>

      {/* Body — justify-between so sections fill the full card height */}
      <div className="flex flex-col justify-between px-[3%] py-[2.5%] flex-1 min-h-0">

        {/* Financial stats: Purse Left | Max Spendable | Reserve */}
        <div className="grid grid-cols-3 gap-[0.3em]">
          {/* Purse Left */}
          <div className="min-w-0">
            <p className="font-mono uppercase tracking-[0.1em] text-white/50 leading-none" style={{ fontSize: type.label }}>
              Purse Left
            </p>
            <p className="font-['Barlow_Condensed'] font-bold tabular-nums leading-tight text-amber-300 mt-[0.14em]"
              style={{ fontSize: type.purse }}>
              {formatTeamWiseMoneyShort(team.purse, unit)}
            </p>
          </div>
          {/* Max Spendable */}
          <div className="min-w-0">
            <p className="font-mono uppercase tracking-[0.1em] text-white/50 leading-none" style={{ fontSize: type.label }}>
              Max Spendable
            </p>
            <p className="font-['Barlow_Condensed'] font-bold tabular-nums leading-tight text-emerald-300 mt-[0.14em]"
              style={{ fontSize: type.purse }}>
              {formatTeamWiseMoneyShort(team.maxBidAllowed, unit)}
            </p>
            <p className="font-mono uppercase tracking-[0.06em] text-white/32 leading-none mt-[0.06em]" style={{ fontSize: type.meta }}>
              On 1 Player
            </p>
          </div>
          {/* Reserve */}
          <div className="min-w-0">
            <p className="font-mono uppercase tracking-[0.1em] text-white/50 leading-none" style={{ fontSize: type.label }}>
              Reserve
            </p>
            <p className="font-['Barlow_Condensed'] font-bold tabular-nums leading-tight text-white/80 mt-[0.14em]"
              style={{ fontSize: type.money }}>
              {formatTeamWiseMoneyShort(team.reservedAmount, unit)}
            </p>
          </div>
        </div>

        <div className="border-t border-white/[0.07]" />

        {/* Squad counts + status */}
        <div className="grid grid-cols-3 gap-[0.3em] items-center">
          <div className="min-w-0">
            <p className="font-mono uppercase tracking-[0.1em] text-white/45 leading-none" style={{ fontSize: type.label }}>
              Bought
            </p>
            <p className={`${LED_AMOUNT_CLASS} text-white/92 leading-none mt-[0.12em]`} style={{ fontSize: type.squad }}>
              {team.playersBought}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-mono uppercase tracking-[0.1em] text-white/45 leading-none" style={{ fontSize: type.label }}>
              Slots Left
            </p>
            <p className={`${LED_AMOUNT_CLASS} text-white/88 leading-none mt-[0.12em]`} style={{ fontSize: type.squad }}>
              {team.slotsRemaining}
            </p>
          </div>
          <div className={`flex items-center justify-center gap-[0.3em] rounded-lg border px-[0.3em] py-[0.3em] self-stretch ${status.badgeClass}`}>
            <span className={`h-[0.4em] w-[0.4em] min-h-[4px] min-w-[4px] rounded-full shrink-0 ${status.dotClass}`} />
            <span className="font-mono uppercase tracking-[0.05em] leading-none text-center" style={{ fontSize: type.badge }}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="min-w-0">
          <div className="h-[0.5em] min-h-[4px] rounded-full bg-white/[0.08] overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%`, backgroundColor: team.color }} />
          </div>
          <p className="font-mono uppercase tracking-[0.08em] text-white/40 mt-[0.45em] leading-none"
            style={{ fontSize: type.meta }}>
            {team.playersBought} / {squadCap} Players
          </p>
        </div>

        <div className="border-t border-white/[0.07]" />

        {/* Last purchase */}
        <div className="min-w-0">
          <p className="font-mono uppercase tracking-[0.08em] text-white/38 leading-none" style={{ fontSize: type.meta }}>
            Last Purchase
          </p>
          {team.lastPurchase ? (
            <div className="flex items-baseline justify-between gap-[0.4em] mt-[0.1em]">
              <p className={`${LED_HEADLINE_CLASS} truncate text-white/90 leading-tight flex-1 min-w-0`}
                style={{ fontSize: type.money }}>
                {team.lastPurchase.playerName}
              </p>
              <p className="font-['Barlow_Condensed'] font-bold tabular-nums text-white/65 shrink-0 leading-none"
                style={{ fontSize: type.money }}>
                {formatTeamWiseMoneyShort(team.lastPurchase.amount, unit)}
              </p>
            </div>
          ) : (
            <p className="font-mono uppercase tracking-[0.06em] text-white/30 leading-none mt-[0.1em]"
              style={{ fontSize: type.meta }}>
              No Purchase Yet —
            </p>
          )}
        </div>
      </div>
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
    <div className="flex items-center gap-[1.5vw]">
      <span
        className={`${LED_AMOUNT_CLASS} text-right tabular-nums`}
        style={{ color: accent, fontSize: "5.5vw", width: "5vw" }}
      >
        {rank}
      </span>
      {player.portrait ? (
        <img
          src={cldUrl(player.portrait, "soldCard")}
          alt=""
          className="object-cover border-2"
          style={{ borderColor: accent, height: "7vw", width: "7vw" }}
        />
      ) : (
        <div
          className="bg-white/5 border-2"
          style={{ borderColor: accent, height: "7vw", width: "7vw" }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`${LED_PLAYER_NAME_CLASS} text-white truncate text-[clamp(1.75rem,3.4vw,3.25rem)]`}
        >
          {player.name}
        </p>
        <p className="mt-[0.4vw] truncate leading-tight">
          <span className={LED_ROLE_META_CLASS}>SOLD TO — </span>
          <span
            className={`${LED_HEADLINE_CLASS} text-[clamp(0.9375rem,1.5vw,1.5rem)] text-white/90`}
          >
            {player.team?.name ?? "—"}
          </span>
        </p>
        <div
          className="mt-[0.7vw] bg-white/10 overflow-hidden rounded-sm"
          style={{ height: "0.55vw" }}
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
          style={{ height: "4.5vw", width: "4.5vw" }}
        />
      ) : null}
      <p
        className={`${LED_AMOUNT_CLASS} text-right text-[clamp(2rem,4vw,4.25rem)]`}
        style={{ color: accent, width: "13vw" }}
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
    <div className="relative h-[clamp(16rem,32vw,28rem)] w-[clamp(16rem,32vw,28rem)]">
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
      <p className="text-[0.5vw] font-mono uppercase tracking-[0.25em] text-white/45 leading-none">
        {label}
      </p>
      <p
        className={`font-['Bebas_Neue'] tabular-nums tracking-wide leading-none mt-[6%] ${
          big ? "text-[1.55vw]" : "text-[1.05vw]"
        }`}
        style={{ color: accent ?? "#fff" }}
      >
        {value}
      </p>
    </div>
  );
}
