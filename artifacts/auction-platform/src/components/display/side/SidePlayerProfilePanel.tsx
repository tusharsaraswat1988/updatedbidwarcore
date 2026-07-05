import { memo, useEffect, useMemo, useState } from "react";
import { User, UserRound } from "lucide-react";
import type { LedView } from "@/lib/led-view/types";
import type { PlayerGender } from "@/lib/led-view/player-gender";
import { hasUsablePortrait } from "@/lib/led-view/player-gender";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, getObsBroadcastLogoSrc } from "@/lib/brand-assets";
import {
  broadcastSpecLabel,
  portraitSpecGridClass,
} from "@/lib/led-view/portrait-footer-stats";
import { cldUrl } from "@/lib/cloudinary";

const SIDE_HEADER_LOGO_MAX_HEIGHT_PX = 30;
const SIDE_HEADER_LOGO_MAX_WIDTH_PX = 150;

function fmtTimer(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Full player profile for side LED — portrait-friendly layout with live bid strip.
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
    state,
    tournament,
    derivedState,
    timerCeiling,
  } = view;

  const { logos, brandName, iconVersion } = useBranding();
  const logoSrc = getObsBroadcastLogoSrc(logos, iconVersion);
  const logoAlt = getBrandLogoAlt(brandName);

  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [currentPlayer?.id, currentPlayer?.portrait]);

  const live = state.isBidding && derivedState === "bidding";
  const countdown = state.countdown;
  const urgent = live && countdown <= 5 && countdown > 0;
  const ceiling = Math.max(1, timerCeiling);
  const pct = Math.max(0, Math.min(100, (countdown / ceiling) * 100));

  const profileRows = useMemo(() => {
    if (!currentPlayer) return [];

    return [
      { shortLabel: "AGE", fullLabel: "Age", value: currentPlayer.age ? String(currentPlayer.age) : "—" },
      { shortLabel: "CITY", fullLabel: "City", value: currentPlayer.city?.trim() || "—" },
      { shortLabel: "BASE", fullLabel: "Base Price", value: basePriceLabel, accent: true as const },
      {
        shortLabel: "ROLE",
        fullLabel: "Role",
        value: currentPlayer.roleRaw || roleLabel || "—",
      },
      ...currentPlayer.specs.map((spec) => ({
        shortLabel: broadcastSpecLabel(spec.label),
        fullLabel: spec.label,
        value: spec.value?.trim() || "—",
      })),
    ];
  }, [currentPlayer, basePriceLabel, roleLabel]);

  const specGridClass = portraitSpecGridClass(profileRows.length);

  if (!currentPlayer) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-[8%] text-center">
        <p className="font-['Bebas_Neue'] text-5xl tracking-[0.12em] uppercase text-white/25">PLAYER</p>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
          Awaiting next player
        </p>
        <p className="mt-2 font-['Bebas_Neue'] text-xl tracking-[0.12em] uppercase text-white/70">
          {tournament.name}
        </p>
      </div>
    );
  }

  const showPhoto = hasUsablePortrait(currentPlayer.portrait) && !photoFailed;
  const player = currentPlayer;

  return (
    <div className="flex h-full w-full flex-col">
      <header className="shrink-0 border-b border-white/10 bg-black/50 px-[5%] pb-[3%] pt-0">
        {logoSrc ? (
          <div className="flex items-start justify-center">
            <img
              src={logoSrc}
              alt={logoAlt}
              className="block w-auto shrink-0 object-contain object-top"
              style={{
                maxHeight: SIDE_HEADER_LOGO_MAX_HEIGHT_PX,
                maxWidth: SIDE_HEADER_LOGO_MAX_WIDTH_PX,
                filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.55))",
              }}
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}
        <h1
          className={`text-center font-['Bebas_Neue'] text-4xl leading-none tracking-[0.12em] uppercase text-white/90 md:text-5xl ${logoSrc ? "mt-6" : "mt-4"}`}
        >
          {tournament.name}
        </h1>
      </header>

      <div className="relative flex-[45%] shrink-0">
        {showPhoto ? (
          <img
            src={cldUrl(player.portrait, "playerCard")}
            alt={player.name}
            className="absolute inset-0 h-full w-full object-cover object-center"
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
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div
          className="absolute top-[5%] right-[5%] z-10 grid size-12 place-items-center font-['Bebas_Neue'] text-xl italic shadow-2xl md:size-14 md:text-2xl"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
        >
          #{player.serialNo}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-[5%]">
          <p className="text-[11px] font-bold uppercase leading-snug tracking-[0.14em] sm:text-xs">
            <span style={{ color: "var(--accent)" }}>{roleLabel || player.roleRaw}</span>
            {player.categoryName ? (
              <>
                <span className="mx-2 font-normal text-white/35">•</span>
                <span className="font-mono tracking-[0.18em] text-white/80">{player.categoryName}</span>
              </>
            ) : null}
          </p>
          <h2 className="mt-2 font-['Bebas_Neue'] text-[clamp(1.75rem,8vw,4rem)] leading-[0.88] uppercase tracking-tight text-white">
            {player.name}
          </h2>
        </div>
      </div>

      <div className="shrink-0 overflow-hidden border-t border-white/10 px-[5%] py-[2.5%]">
        <div className={`grid ${specGridClass} gap-x-3 gap-y-1`}>
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
            className="mt-2 line-clamp-2 font-mono text-[11px] leading-snug text-white/60"
            title={player.achievements}
          >
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">Highlights: </span>
            {player.achievements}
          </p>
        ) : null}
      </div>

      <footer className="relative shrink-0 border-t border-white/10 bg-black/70 px-[5%] py-[4%]">
        {live ? (
          <div className="absolute right-[5%] top-1/2 flex -translate-y-1/2 flex-col items-end">
            <span className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
              Hammer Time
            </span>
            <span
              className="font-mono text-4xl font-bold tabular-nums leading-none md:text-5xl"
              style={{
                color: urgent ? "#ef4444" : "var(--accent)",
                animation: urgent ? "auction-urgency-pulse 0.8s ease-in-out infinite" : undefined,
              }}
            >
              {fmtTimer(countdown)}
            </span>
            <div className="mt-1 h-1 w-20 bg-white/10 overflow-hidden md:w-24">
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
          key={state.currentBid}
          className="mx-auto flex w-full max-w-3xl flex-col items-center text-center"
          style={{ animation: live ? "auction-bid-flash 1.2s ease-out" : undefined }}
        >
          <p
            className="mb-2 font-mono text-[10px] uppercase tracking-[0.5em]"
            style={{ color: "var(--accent)" }}
          >
            {state.currentBid > 0 ? "Current Bid" : "Bid Starts At"}
          </p>
          <p
            className="font-['Bebas_Neue'] text-[clamp(3.25rem,14vw,6.5rem)] leading-[0.85] tabular-nums tracking-tighter text-white"
            style={{
              animation: live ? "auction-mega-glow 3s ease-in-out infinite" : undefined,
            }}
          >
            {currentBidLabel}
          </p>
          {leadingTeam && state.currentBid > 0 ? (
            <div className="mt-3 flex max-w-full items-center justify-center gap-2">
              {leadingTeam.logoUrl ? (
                <img src={leadingTeam.logoUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />
              ) : null}
              <span
                className="truncate font-['Bebas_Neue'] text-base uppercase tracking-wider md:text-lg"
                style={{ color: leadingTeam.color }}
              >
                {leadingTeam.name}
              </span>
            </div>
          ) : live ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              Waiting for first bid
            </p>
          ) : null}
        </div>
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
    <p className={`min-w-0 leading-snug ${className ?? ""}`}>
      <span
        className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/50 sm:text-xs"
        title={fullLabel}
      >
        {shortLabel}:{" "}
      </span>
      <span
        className="font-mono text-[12px] font-bold sm:text-[13px]"
        style={{ color: accent ? "var(--accent)" : "#fff" }}
      >
        {value}
      </span>
    </p>
  );
}

function GenderPortraitIcon({ gender }: { gender: PlayerGender }) {
  const className = "w-24 h-24 text-white/20";
  if (gender === "female") {
    return <UserRound className={className} strokeWidth={1.15} aria-hidden />;
  }
  return <User className={className} strokeWidth={1.15} aria-hidden />;
}
