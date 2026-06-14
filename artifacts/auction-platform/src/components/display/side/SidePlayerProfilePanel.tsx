import { memo, useEffect, useState } from "react";
import { User, UserRound } from "lucide-react";
import type { LedView } from "@/lib/led-view/types";
import type { PlayerGender } from "@/lib/led-view/player-gender";
import { hasUsablePortrait } from "@/lib/led-view/player-gender";

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

  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [currentPlayer?.id, currentPlayer?.portrait]);

  const live = state.isBidding && derivedState === "bidding";
  const countdown = state.countdown;
  const urgent = live && countdown <= 5 && countdown > 0;
  const ceiling = Math.max(1, timerCeiling);
  const pct = Math.max(0, Math.min(100, (countdown / ceiling) * 100));

  if (!currentPlayer) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-[8%] text-center">
        <p className="font-['Bebas_Neue'] text-5xl tracking-widest text-white/25">PLAYER</p>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.4em] text-white/45">
          Awaiting next player
        </p>
        <p className="mt-2 font-['Bebas_Neue'] text-xl tracking-wider text-white/70">
          {tournament.name}
        </p>
      </div>
    );
  }

  const showPhoto = hasUsablePortrait(currentPlayer.portrait) && !photoFailed;
  const player = currentPlayer;

  return (
    <div className="flex h-full w-full flex-col">
      <header className="shrink-0 flex items-center justify-between border-b border-white/10 bg-black/50 px-[5%] py-[2.5%]">
        <div className="flex items-center gap-2">
          <div
            className="size-10 grid place-items-center font-['Bebas_Neue'] text-lg italic"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
          >
            #{player.serialNo}
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
              Live Auction
            </p>
            <p className="font-['Bebas_Neue'] text-sm tracking-widest text-white/90 truncate max-w-[40vw]">
              {tournament.name}
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 py-1 border ${
            live ? "border-red-500/50 bg-red-500/10" : "border-white/15 bg-white/5"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${live ? "bg-red-500 animate-pulse" : "bg-white/40"}`}
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/70">
            {live ? "On Block" : "Profile"}
          </span>
        </div>
      </header>

      <div className="relative min-h-0 flex-[45%] shrink-0">
        {showPhoto ? (
          <img
            src={player.portrait}
            alt={player.name}
            className="absolute inset-0 h-full w-full object-cover object-top"
            loading="eager"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/[0.06] to-black/80">
            <GenderPortraitIcon gender={player.gender} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-[5%]">
          <span
            className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
          >
            {roleLabel || player.roleRaw}
          </span>
          {player.categoryName ? (
            <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/50">
              {player.categoryName}
            </span>
          ) : null}
          <h2 className="mt-2 font-['Bebas_Neue'] text-[clamp(2rem,8vw,4rem)] leading-[0.9] uppercase tracking-tight text-white">
            {player.name}
          </h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[5%] py-[4%] space-y-[4%]">
        <div className="grid grid-cols-2 gap-2">
          <ProfileStat label="Age" value={player.age ? String(player.age) : "—"} />
          <ProfileStat label="City" value={player.city || "—"} />
          <ProfileStat label="Batting" value={player.battingHand} />
          <ProfileStat label="Bowling" value={player.bowlingStyle || "—"} />
          <ProfileStat label="Base Price" value={basePriceLabel} accent />
          <ProfileStat
            label="Role"
            value={player.roleRaw || roleLabel}
          />
        </div>

        {player.specialization ? (
          <div className="border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
              Specialization
            </p>
            <p className="mt-1 text-sm leading-snug text-white/85">{player.specialization}</p>
          </div>
        ) : null}

        {player.achievements ? (
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
              Highlights
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/75 line-clamp-4">
              {player.achievements}
            </p>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-black/70 px-[5%] py-[3%]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="font-mono text-[9px] uppercase tracking-[0.35em]"
              style={{ color: "var(--accent)" }}
            >
              {state.currentBid > 0 ? "Current Bid" : "Opening Bid"}
            </p>
            <p
              key={state.currentBid}
              className="font-['Bebas_Neue'] text-[clamp(2rem,7vw,3.5rem)] leading-none tabular-nums tracking-tight"
              style={{ animation: live ? "auction-bid-flash 1.2s ease-out" : undefined }}
            >
              {currentBidLabel}
            </p>
            {leadingTeam && state.currentBid > 0 ? (
              <div className="mt-1 flex items-center gap-2 min-w-0">
                {leadingTeam.logoUrl ? (
                  <img src={leadingTeam.logoUrl} alt="" className="h-5 w-5 object-contain shrink-0" />
                ) : null}
                <span
                  className="truncate text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: leadingTeam.color }}
                >
                  {leadingTeam.name}
                </span>
              </div>
            ) : live ? (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">
                Waiting for first bid
              </p>
            ) : null}
          </div>

          {live ? (
            <div className="flex flex-col items-end shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
                Timer
              </span>
              <span
                className="font-mono text-4xl font-bold tabular-nums leading-none"
                style={{
                  color: urgent ? "#ef4444" : "var(--accent)",
                  animation: urgent ? "auction-urgency-pulse 0.8s ease-in-out infinite" : undefined,
                }}
              >
                {fmtTimer(countdown)}
              </span>
              <div className="mt-1 h-1 w-24 bg-white/10 overflow-hidden">
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
        </div>
      </footer>
    </div>
  );
});

function ProfileStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-white/10 bg-black/40 px-3 py-2">
      <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-white/40">{label}</p>
      <p
        className="mt-0.5 font-['Bebas_Neue'] text-lg tracking-wide truncate"
        style={{ color: accent ? "var(--accent)" : "#fff" }}
      >
        {value}
      </p>
    </div>
  );
}

function GenderPortraitIcon({ gender }: { gender: PlayerGender }) {
  const className = "w-24 h-24 text-white/20";
  if (gender === "female") {
    return <UserRound className={className} strokeWidth={1.15} aria-hidden />;
  }
  return <User className={className} strokeWidth={1.15} aria-hidden />;
}
